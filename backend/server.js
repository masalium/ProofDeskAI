'use strict';
require('dotenv').config(); // Must be first — modules read process.env at load time

const express     = require('express');
const cors        = require('cors');
const TelegramBot = require('node-telegram-bot-api');
const OpenAI      = require('openai');

const cfg    = require('./src/config/safeConfig');
const logger = require('./src/utils/logger');

const { generateFreeVendorPreview }                     = require('./src/workflows/vendorReviewWorkflow');
const { generateDemoPremiumReport, generatePremiumSupplierMemo } = require('./src/workflows/premiumReportWorkflow');
const {
  PAYMENT_STATES,
  startPremiumPaymentCheckpoint,
  confirmPayment,
  cancelPayment,
  getPaymentStatus,
  createX402Order,
  getX402OrderStatus,
  fetchX402Proof,
}                                                       = require('./src/workflows/x402PaymentWorkflow');
const { getIdentityProof }                             = require('./src/workflows/identityProofWorkflow');
const { classifyRisk, guardrailResponse }               = require('./src/policies/guardrails');
const { getSession, updateSession }                     = require('./src/state/sessionStore');

// ─── Startup guards ───────────────────────────────────────────────────────────
if (!cfg.hasTelegramToken) {
  logger.error('server', 'TELEGRAM_BOT_TOKEN is not set in .env — cannot start');
  process.exit(1);
}
if (!cfg.hasOpenAIKey) {
  logger.warn('server', 'OPENAI_API_KEY not set — /review_vendor will return an error until configured');
}
if (!cfg.hasX402Config) {
  logger.warn('server', 'x402 credentials not fully configured — payment flow will use Phase 1 demo mode');
}

// ─── Clients ──────────────────────────────────────────────────────────────────
const bot    = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
const openai = cfg.hasOpenAIKey
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// ─── Express health route ─────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({
    ok:       true,
    service:  'VendorLens Agent',
    phase:    'phase-3-x402-real',
    telegram: cfg.hasTelegramToken ? 'configured' : 'not configured',
    openai:   cfg.hasOpenAIKey     ? 'configured' : 'not configured',
    x402:     cfg.hasX402Config    ? 'configured' : 'demo-mode',
  });
});

// ─── x402 API routes ──────────────────────────────────────────────────────────

app.post('/api/x402/create-order', async (req, res) => {
  const { chatId } = req.body;
  if (!chatId) return res.status(400).json({ ok: false, error: 'chatId required' });
  if (!cfg.hasX402Config) {
    return res.status(503).json({ ok: false, error: 'x402 not configured', mode: 'demo' });
  }
  const session = getSession(String(chatId));
  try {
    const order = await createX402Order({ session, chatId: String(chatId) });
    res.json({
      ok:           true,
      orderId:      order.orderId,
      payToAddress: order.payToAddress,
      tokenSymbol:  order.tokenSymbol,
      amountWei:    order.amountWei,
      expiresAt:    order.expiresAt,
      flow:         order.flow,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message.slice(0, 200) });
  }
});

app.get('/api/x402/status/:orderId', async (req, res) => {
  const { orderId } = req.params;
  if (!cfg.hasX402Config) {
    return res.status(503).json({ ok: false, error: 'x402 not configured', mode: 'demo' });
  }
  try {
    const status = await getX402OrderStatus({ orderId });
    res.json({
      ok:          true,
      orderId:     status.orderId || orderId,
      status:      status.status,
      txHash:      status.txHash      || null,
      confirmedAt: status.confirmedAt || null,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message.slice(0, 200) });
  }
});

app.get('/api/x402/debug', (_req, res) => {
  res.json({
    ok:                  true,
    x402ApiUrl:          cfg.x402ApiUrl,
    x402ApiUrlPresent:   !!process.env.GOATX402_API_URL,
    merchantIdPresent:   cfg.hasX402MerchantId,
    merchantId:          cfg.hasX402MerchantId ? cfg.merchantId : null,
    apiKeyPresent:       cfg.hasX402ApiKey,
    apiSecretPresent:    cfg.hasX402ApiSecret,
    receivingWallet:     cfg.x402ReceivingWallet || cfg.walletAddress || null,
    tokenSymbol:         cfg.x402TokenSymbol,
    amount:              cfg.x402Amount,
    hasX402Config:       cfg.hasX402Config,
    mode:                cfg.hasX402Config ? 'real' : 'demo',
  });
});

app.get('/api/x402/proof/:orderId', async (req, res) => {
  const { orderId } = req.params;
  if (!cfg.hasX402Config) {
    return res.status(503).json({ ok: false, error: 'x402 not configured', mode: 'demo' });
  }
  try {
    const proof = await fetchX402Proof({ orderId });
    res.json({
      ok:        true,
      orderId:   proof.payload?.order_id   || orderId,
      txHash:    proof.payload?.tx_hash    || null,
      fromAddr:  proof.payload?.from_addr  || null,
      amountWei: proof.payload?.amount_wei || null,
      chainId:   proof.payload?.chain_id   || null,
      flow:      proof.payload?.flow       || null,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message.slice(0, 200) });
  }
});

app.listen(cfg.port, () => {
  logger.info(cfg.agentName, `Express health check → http://localhost:${cfg.port}/`);
});

// ─── Local helper ─────────────────────────────────────────────────────────────
function cfgLabel(val, badPatterns = []) {
  if (!val) return '❌ not configured';
  if (badPatterns.some(p => val.includes(p))) return '⚠️  placeholder (update .env)';
  return '✅ configured';
}

// ─── /start ───────────────────────────────────────────────────────────────────
bot.onText(/\/start/, (msg) => {
  const name = msg.from?.first_name || 'there';
  bot.sendMessage(msg.chat.id,
    `👋 Hello ${name}! I'm *${cfg.agentName}* — your AI-powered supplier verification agent on GOAT Mainnet.\n\n` +
    `I help procurement teams verify vendors before payment, flag risk signals, and generate on-chain supplier memos.\n\n` +
    `Type /help to see all commands.`,
    { parse_mode: 'Markdown' }
  );
});

// ─── /help ────────────────────────────────────────────────────────────────────
bot.onText(/\/help/, (msg) => {
  bot.sendMessage(msg.chat.id,
    `📋 *${cfg.agentName} — Commands*\n\n` +

    `*Vendor Verification*\n` +
    `/review\\_vendor <name> | <website> | <purchase context>\n` +
    `  → Free AI preview: risk flags, summary, recommendation\n\n` +

    `*Premium Report*\n` +
    `/unlock\\_premium\\_report\n` +
    `  → Full verified memo via x402 payment (0.1 USDC, GOAT Mainnet)\n\n` +

    `*Identity & Status*\n` +
    `/show\\_identity — This agent's ERC-8004 on-chain identity\n` +
    `/status — Service configuration health\n\n` +

    `*General*\n` +
    `/start — Welcome message\n` +
    `/cancel — Cancel current operation\n` +
    `/judge\\_demo — Hackathon demo sequence\n` +
    `/help — This message\n\n` +

    `*Payment behavior:* Premium reports require 0.1 USDC via x402 on GOAT Mainnet. ` +
    `Payment confirmation is always manual — I never charge automatically.\n\n` +

    `*Safety:* I will never send funds, approve payments, or modify account settings autonomously. ` +
    `Any risky action requires explicit human authorization.\n\n` +

    `*Identity:* This agent is an ERC-8004 registered AI agent on GOAT Mainnet (Chain ID ${cfg.chainId}).\n\n` +

    `You can also ask: _"what do you do?"_`,
    { parse_mode: 'Markdown' }
  );
});

// ─── /status ─────────────────────────────────────────────────────────────────
bot.onText(/\/status/, (msg) => {
  const chatId   = msg.chat.id;
  const session  = getSession(chatId);
  const payState = getPaymentStatus(session);
  const orderId  = session.x402OrderId || null;
  const orderLine = orderId ? `Order ID:          \`${orderId}\`` : 'Order ID:          none';

  bot.sendMessage(chatId,
    `🔧 *${cfg.agentName} — Service Status*\n\n` +
    `Telegram Bot:      ✅ configured (polling active)\n` +
    `OpenAI API:        ${cfg.hasOpenAIKey      ? '✅ configured' : '❌ not configured'}\n` +
    `x402 Config:       ${cfg.hasX402Config     ? '✅ configured' : '⚠️  not fully configured'}\n` +
    `Identity Config:   ${cfg.hasIdentityConfig ? '✅ configured' : '⚠️  placeholder values'}\n\n` +
    `Metadata URI:      ${cfgLabel(cfg.metadataUri,   ['YOUR_WEBSITE'])}\n` +
    `Wallet Address:    ${cfgLabel(cfg.walletAddress, ['PASTE_'])}\n` +
    `x402 Merchant ID:  ${cfg.merchantId && !cfg.merchantId.includes('PASTE_') && cfg.merchantId !== 'pending'
                           ? '✅ configured' : '⚠️  pending'}\n\n` +
    `Chain:             GOAT Mainnet (Chain ID ${cfg.chainId})\n` +
    `ERC-8004 Registry: \`${cfg.erc8004Registry}\`\n\n` +
    `*Payment State:*   ${payState}\n` +
    `${orderLine}\n\n` +
    `_Secret values are never displayed._`,
    { parse_mode: 'Markdown' }
  );
});

// ─── /cancel ─────────────────────────────────────────────────────────────────
bot.onText(/\/cancel/, (msg) => {
  const chatId = msg.chat.id;
  const session = getSession(chatId);
  cancelPayment(session);
  updateSession(chatId, { pendingPayment: false, paymentState: PAYMENT_STATES.IDLE });
  bot.sendMessage(chatId, '✅ Operation cancelled. Type /help to see available commands.');
});

// ─── /show_identity ───────────────────────────────────────────────────────────
bot.onText(/\/show_identity/, async (msg) => {
  const chatId = msg.chat.id;
  const text   = getIdentityProof();
  try {
    await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
  } catch (err) {
    logger.error(cfg.agentName, `show_identity Markdown failed: ${err.message}`);
    // Fallback: send as plain text so the user always gets a reply
    try {
      await bot.sendMessage(chatId, text.replace(/[*_`]/g, ''));
    } catch (e) {
      logger.error(cfg.agentName, `show_identity plain-text fallback also failed: ${e.message}`);
    }
  }
});

// ─── /unlock_premium_report ───────────────────────────────────────────────────
bot.onText(/\/unlock_premium_report/, async (msg) => {
  const chatId  = msg.chat.id;
  const session = getSession(chatId);
  let result;
  try {
    result = await startPremiumPaymentCheckpoint(session, chatId);
  } catch (err) {
    logger.error(cfg.agentName, `startPremiumPaymentCheckpoint threw: ${err.message}`);
    return bot.sendMessage(chatId,
      `❌ Payment checkpoint failed — please try again or check configuration.`
    );
  }
  updateSession(chatId, { pendingPayment: true });
  try {
    await bot.sendMessage(chatId, result.message, { parse_mode: 'Markdown' });
  } catch (err) {
    logger.error(cfg.agentName, `unlock_premium_report send failed: ${err.message}`);
    await bot.sendMessage(chatId,
      `Payment checkpoint — 0.1 USDC via x402 on GOAT Mainnet.\n` +
      `Reply: CONFIRM PAYMENT to proceed, or /cancel to abort.`
    );
  }
});

// ─── /review_vendor ───────────────────────────────────────────────────────────
bot.onText(/\/review_vendor(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const input  = (match[1] || '').trim();

  if (!input) {
    return bot.sendMessage(chatId,
      `⚠️ Usage:\n` +
      `/review\\_vendor <vendor name> | <website> | <purchase context>\n\n` +
      `Example:\n` +
      `/review\\_vendor Acme Supplies | acmesupplies.com | Office equipment $5,000`,
      { parse_mode: 'Markdown' }
    );
  }

  const parts = input.split('|').map(s => s.trim());
  if (parts.length < 3) {
    return bot.sendMessage(chatId,
      `⚠️ Please separate the three fields with *|*\n\n` +
      `Format: \`/review_vendor <name> | <website> | <context>\``,
      { parse_mode: 'Markdown' }
    );
  }

  const [vendorName, website, purchaseContext] = parts;
  updateSession(chatId, { vendorName, website, purchaseContext });

  if (!openai) {
    return bot.sendMessage(chatId,
      `❌ *Vendor analysis unavailable*\n\nOPENAI\\_API\\_KEY is not configured. Update backend/.env to enable AI reviews.`,
      { parse_mode: 'Markdown' }
    );
  }

  await bot.sendMessage(chatId,
    `🔍 Analyzing *${vendorName}* — this may take a few seconds…`,
    { parse_mode: 'Markdown' }
  );

  const result = await generateFreeVendorPreview({ openai, vendorName, website, purchaseContext });

  if (!result.ok) {
    return bot.sendMessage(chatId,
      `❌ *Vendor analysis failed*\n\n` +
      `The AI service returned an error. Please try again in a moment.\n` +
      `If the problem persists, verify your OPENAI_API_KEY in .env.`,
      { parse_mode: 'Markdown' }
    );
  }

  await bot.sendMessage(chatId,
    `📊 *Vendor Review: ${vendorName}*\n_Free Preview_\n\n${result.report}\n\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `Use /unlock\\_premium\\_report for the full verified memo with on-chain attestation.`,
    { parse_mode: 'Markdown' }
  );
});

// ─── /debug_x402 ─────────────────────────────────────────────────────────────
bot.onText(/\/debug_x402/, (msg) => {
  const merchantLine = cfg.hasX402MerchantId
    ? `✅ present (\`${cfg.merchantId}\`)`
    : '❌ missing or placeholder';
  const walletLine = (cfg.x402ReceivingWallet || cfg.walletAddress)
    ? `✅ \`${cfg.x402ReceivingWallet || cfg.walletAddress}\``
    : '❌ not set';

  bot.sendMessage(msg.chat.id,
    `🔧 *x402 Diagnostics*\n\n` +
    `API URL:          \`${cfg.x402ApiUrl}\`\n` +
    `Merchant ID:      ${merchantLine}\n` +
    `API Key:          ${cfg.hasX402ApiKey    ? '✅ present (value hidden)' : '❌ missing or placeholder'}\n` +
    `API Secret:       ${cfg.hasX402ApiSecret ? '✅ present (value hidden)' : '❌ missing or placeholder'}\n` +
    `Receiving Wallet: ${walletLine}\n` +
    `Token Symbol:     ${cfg.x402TokenSymbol}\n` +
    `Amount:           ${cfg.x402Amount}\n` +
    `hasX402Config:    ${cfg.hasX402Config ? '✅ true — real mode' : '❌ false — demo mode'}\n\n` +
    `*SDK:* goatx402-sdk-server (GoatX402Client)\n` +
    `*Endpoint tested:* \`${cfg.x402ApiUrl}/api/v1/orders\`\n\n` +
    `_Secret values are never displayed. Check terminal logs for full error detail._`,
    { parse_mode: 'Markdown' }
  );
});

// ─── /retry_payment ──────────────────────────────────────────────────────────
bot.onText(/\/retry_payment/, async (msg) => {
  const chatId  = msg.chat.id;
  const session = getSession(chatId);
  const state   = getPaymentStatus(session);

  if (state === PAYMENT_STATES.PAYMENT_VERIFIED) {
    return bot.sendMessage(chatId,
      `✅ Payment already verified — no retry needed.\n\nYour premium report has been unlocked.`
    );
  }

  // Recheck active order
  if (state === PAYMENT_STATES.ORDER_CREATED || state === PAYMENT_STATES.PAYMENT_PENDING) {
    let result;
    try {
      result = await confirmPayment(session);
    } catch (err) {
      logger.error(cfg.agentName, `retry_payment confirmPayment threw: ${err.message}`);
      return bot.sendMessage(chatId, `❌ Status check failed — please try again.`);
    }
    try {
      await bot.sendMessage(chatId, result.message, { parse_mode: 'Markdown' });
    } catch (err) {
      await bot.sendMessage(chatId, result.message.replace(/[*_`]/g, ''));
    }
    if (result.state === PAYMENT_STATES.PAYMENT_VERIFIED && result.mode === 'real') {
      const report = generatePremiumSupplierMemo({ session, proof: result.proof, orderProof: result.orderProof });
      try {
        await bot.sendMessage(chatId, report, { parse_mode: 'Markdown' });
      } catch (err) {
        await bot.sendMessage(chatId, report.replace(/[*_`]/g, ''));
      }
    }
    return;
  }

  // Terminal states — clear and start fresh
  if (
    state === PAYMENT_STATES.PAYMENT_FAILED  ||
    state === PAYMENT_STATES.PAYMENT_EXPIRED ||
    state === PAYMENT_STATES.CANCELLED
  ) {
    updateSession(chatId, {
      x402OrderId: null, x402DappOrderId: null, x402PayToAddress: null,
      x402TokenSymbol: null, x402AmountWei: null, x402ExpiresAt: null,
      x402Flow: null, x402TxHash: null, paymentState: PAYMENT_STATES.IDLE,
    });
    let result;
    try {
      result = await startPremiumPaymentCheckpoint(session, chatId);
    } catch (err) {
      logger.error(cfg.agentName, `retry_payment startPremiumPaymentCheckpoint threw: ${err.message}`);
      return bot.sendMessage(chatId, `❌ Failed to create new order — please use /unlock\\_premium\\_report.`, { parse_mode: 'Markdown' });
    }
    updateSession(chatId, { pendingPayment: true });
    try {
      await bot.sendMessage(chatId, result.message, { parse_mode: 'Markdown' });
    } catch (err) {
      await bot.sendMessage(chatId, result.message.replace(/[*_`]/g, ''));
    }
    return;
  }

  // IDLE / demo / not started
  bot.sendMessage(chatId,
    `ℹ️ No active payment to retry. Use /unlock\\_premium\\_report to start.`,
    { parse_mode: 'Markdown' }
  );
});

// ─── /judge_demo ─────────────────────────────────────────────────────────────
bot.onText(/\/judge_demo/, (msg) => {
  const x402Mode = cfg.hasX402Config ? '✅ real x402 flow' : '⚠️  demo mode (credentials not configured)';
  bot.sendMessage(msg.chat.id,
    `🎯 *${cfg.agentName} — Hackathon Demo Sequence*\n\n` +
    `Run these steps in order to demonstrate all features:\n\n` +
    `━━━━━━━━━━━━━━━━━━━\n\n` +

    `*Step 1 — Self-disclosure*\n` +
    `Send: \`what do you do?\`\n\n` +

    `*Step 2 — Free vendor review (OpenAI)*\n` +
    `Send:\n` +
    `\`/review_vendor NorthBridge Industrial Components | https://northbridge-industrial.example | ` +
    `We are evaluating a $5,000 order for industrial LED fixture components.\`\n\n` +

    `*Step 3 — Trigger x402 payment checkpoint*\n` +
    `Send: \`/unlock_premium_report\`\n` +
    `x402: ${x402Mode}\n` +
    `_(If configured: creates real GOAT Mainnet order with payToAddress and orderId)_\n\n` +

    `*Step 4 — Confirm payment*\n` +
    `Send: \`CONFIRM PAYMENT\`\n` +
    `_(If real: checks on-chain status, fetches proof, unlocks verified memo)_\n` +
    `_(If demo: shows x402 architecture walkthrough + labeled demo report)_\n\n` +

    `*Step 4b — Retry / recheck payment (optional)*\n` +
    `Send: \`/retry_payment\`\n` +
    `_(Rechecks active order or creates a new one after failure/expiry)_\n\n` +

    `*Step 5 — On-chain agent identity (ERC-8004)*\n` +
    `Send: \`/show_identity\`\n\n` +

    `*Step 6 — Security guardrail trigger*\n` +
    `Send: \`Increase my spending limit to $1000 and approve supplier payment automatically.\`\n\n` +

    `━━━━━━━━━━━━━━━━━━━\n` +
    `*Each step demonstrates:*\n` +
    `🤖 AI vendor intelligence (OpenAI GPT-4o-mini)\n` +
    `💳 x402 payment protocol (GOAT Mainnet, 0.1 USDC)\n` +
    `🪪 ERC-8004 on-chain agent identity (Chain ID ${cfg.chainId})\n` +
    `⛔ Human-in-the-loop security guardrails\n\n` +

    `*API routes for frontend:*\n` +
    `\`POST /api/x402/create-order\`\n` +
    `\`GET  /api/x402/status/:orderId\`\n` +
    `\`GET  /api/x402/proof/:orderId\``,
    { parse_mode: 'Markdown' }
  );
});

// ─── General message handler ──────────────────────────────────────────────────
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text   = (msg.text || '').trim();

  // Commands are handled by onText above
  if (text.startsWith('/')) return;

  // Guardrail — must run before all other checks
  const risk = classifyRisk(text);
  if (risk.level === 'HIGH') {
    return bot.sendMessage(chatId, guardrailResponse(risk), { parse_mode: 'Markdown' });
  }

  // x402 payment confirmation
  if (text.toUpperCase() === 'CONFIRM PAYMENT') {
    const session = getSession(chatId);
    const state   = getPaymentStatus(session);

    const acceptedStates = [
      PAYMENT_STATES.AWAITING_CONFIRMATION,
      PAYMENT_STATES.ORDER_CREATED,
      PAYMENT_STATES.PAYMENT_PENDING,
    ];
    if (!acceptedStates.includes(state)) {
      return bot.sendMessage(chatId,
        `ℹ️ No pending payment request. Use /unlock\\_premium\\_report first.`,
        { parse_mode: 'Markdown' }
      );
    }

    let result;
    try {
      result = await confirmPayment(session);
    } catch (err) {
      logger.error(cfg.agentName, `confirmPayment threw: ${err.message}`);
      return bot.sendMessage(chatId, `❌ Payment confirmation failed — please try again.`);
    }

    try {
      await bot.sendMessage(chatId, result.message, { parse_mode: 'Markdown' });
    } catch (err) {
      logger.error(cfg.agentName, `confirmPayment message send failed: ${err.message}`);
      await bot.sendMessage(chatId, result.message.replace(/[*_`]/g, ''));
    }

    // Real payment verified → generate full premium report with proof
    if (result.state === PAYMENT_STATES.PAYMENT_VERIFIED && result.mode === 'real') {
      const report = generatePremiumSupplierMemo({ session, proof: result.proof, orderProof: result.orderProof });
      try {
        await bot.sendMessage(chatId, report, { parse_mode: 'Markdown' });
      } catch (err) {
        logger.error(cfg.agentName, `premium memo send failed: ${err.message}`);
        await bot.sendMessage(chatId, report.replace(/[*_`]/g, ''));
      }
      return;
    }

    // Demo confirmation → show demo report
    if (result.demoReport) {
      const report = generateDemoPremiumReport(session);
      try {
        await bot.sendMessage(chatId, report, { parse_mode: 'Markdown' });
      } catch (err) {
        logger.error(cfg.agentName, `demo report send failed: ${err.message}`);
        await bot.sendMessage(chatId, report.replace(/[*_`]/g, ''));
      }
    }
    return;
  }

  // Self-disclosure
  if (/what\s+(do|can)\s+you\s+do/i.test(text) || /what\s+are\s+you/i.test(text)) {
    return bot.sendMessage(chatId,
      `🤖 *I'm ${cfg.agentName} — an AI Supplier Verification Agent*\n\n` +
      `I help procurement teams verify vendors before payment:\n\n` +
      `🔍 *Analyze suppliers* — summarize business info, flag risk signals, identify missing verification documents\n` +
      `💳 *Generate verified memos* — full on-chain supplier reports unlocked via x402 micro-payments on GOAT Mainnet (0.1 USDC)\n` +
      `🪪 *On-chain identity* — registered as an ERC-8004 agent on GOAT Mainnet for auditability and trust\n` +
      `⛔ *Block unsafe requests* — I will never approve payments, move funds, or modify account settings\n\n` +
      `Built for the OpenClaw hackathon on GOAT Network.\n` +
      `Type /help to see all commands.`,
      { parse_mode: 'Markdown' }
    );
  }

  // Fallback
  bot.sendMessage(chatId,
    `I didn't understand that. Type /help to see available commands, or ask _"what do you do?"_ to learn about me.`,
    { parse_mode: 'Markdown' }
  );
});

// ─── Startup: drain backlog then begin polling ────────────────────────────────
// Calling getUpdates before startPolling discards any messages that accumulated
// while the server was offline, preventing a flood of stale responses on restart.
async function startPolling() {
  logger.info(cfg.agentName, `Chain: GOAT Mainnet (Chain ID ${cfg.chainId})`);
  logger.info(cfg.agentName, `ERC-8004 Registry: ${cfg.erc8004Registry}`);
  logger.info(cfg.agentName, `Phase: phase-3-x402-real`);
  logger.info(cfg.agentName, `OpenAI:    ${cfg.hasOpenAIKey ? 'configured' : 'not configured'}`);
  logger.info(cfg.agentName, `x402 mode: ${cfg.hasX402Config ? 'configured (real)' : 'demo mode'}`);
  logger.info(cfg.agentName, `x402 url:  ${cfg.x402ApiUrl}`);

  try {
    const stale = await bot.getUpdates({ timeout: 0, limit: 100 });
    if (stale.length > 0) {
      const maxId = Math.max(...stale.map(u => u.update_id));
      await bot.getUpdates({ offset: maxId + 1, timeout: 0, limit: 1 });
      logger.info(cfg.agentName, `Dropped ${stale.length} backlog message(s) — only new messages will be processed`);
    }
  } catch (err) {
    logger.warn(cfg.agentName, `Backlog drain failed (non-fatal): ${err.message}`);
  }

  bot.startPolling();
  logger.info(cfg.agentName, 'Polling started — ready for new messages');
}

startPolling();
