require('dotenv').config();
const express = require('express');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');
const OpenAI = require('openai');

// ─── Config (values never logged) ───────────────────────────────────────────
const PORT            = process.env.PORT || 3001;
const AGENT_NAME      = process.env.AGENT_NAME || 'VendorLens';
const CHAIN_ID        = process.env.GOAT_CHAIN_ID || '2345';
const ERC8004_REGISTRY = process.env.ERC8004_REGISTRY;
const METADATA_URI    = process.env.AGENT_METADATA_URI;
const WALLET_ADDRESS  = process.env.AGENT_WALLET_ADDRESS;
const MERCHANT_ID     = process.env.GOATX402_MERCHANT_ID;

if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error('[FATAL] TELEGRAM_BOT_TOKEN is not set in .env');
  process.exit(1);
}
if (!process.env.OPENAI_API_KEY) {
  console.error('[FATAL] OPENAI_API_KEY is not set in .env');
  process.exit(1);
}

// ─── Clients ─────────────────────────────────────────────────────────────────
const bot    = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── Express ──────────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    agent: AGENT_NAME,
    chain: `GOAT Mainnet (Chain ID ${CHAIN_ID})`,
    services: {
      telegram:     'configured',
      openai:       'configured',
      metadataUri:  METADATA_URI && !METADATA_URI.includes('YOUR_WEBSITE') ? 'configured' : 'placeholder',
      walletAddress: WALLET_ADDRESS && !WALLET_ADDRESS.includes('PASTE_') ? 'configured' : 'placeholder',
      x402MerchantId: MERCHANT_ID && MERCHANT_ID !== 'pending' ? 'configured' : 'pending',
    },
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`[${AGENT_NAME}] Express health check → http://localhost:${PORT}/`);
});

// ─── State ────────────────────────────────────────────────────────────────────
const awaitingPayment = new Set(); // chatIds waiting for CONFIRM PAYMENT

// ─── Helpers ─────────────────────────────────────────────────────────────────
function configLabel(val, badPatterns = []) {
  if (!val) return '❌ not configured';
  if (badPatterns.some(p => val.includes(p))) return '⚠️  placeholder (update .env)';
  return '✅ configured';
}

const HIGH_RISK_RE = [
  /increase\s+(my\s+)?spending\s+limit/i,
  /auto[- ]?approve\s+(supplier\s+)?payment/i,
  /approve\s+supplier\s+payment\s+auto/i,
  /send\s+funds/i,
  /transfer\s+funds/i,
  /(change|update|modify)\s+(my\s+)?wallet/i,
  /(update|modify)\s+merchant\s+settings/i,
];

function isHighRisk(text) {
  return HIGH_RISK_RE.some(re => re.test(text));
}

const GUARDRAIL_MSG =
`⛔ *Security Guardrail — Action Blocked*

This agent is read-only and cannot execute financial operations or modify account settings.

Actions I will *never* perform:
• Increase or modify spending limits
• Auto-approve supplier payments
• Send or transfer funds
• Change or update wallet addresses
• Modify merchant settings

Please use your organization's authorized procurement platform with proper human approval workflows for these actions.

Type /help to see what I can do.`;

// ─── Commands ────────────────────────────────────────────────────────────────

bot.onText(/\/start/, (msg) => {
  const name = msg.from?.first_name || 'there';
  bot.sendMessage(msg.chat.id,
    `👋 Hello ${name}! I'm *${AGENT_NAME}* — your AI-powered supplier verification agent on GOAT Mainnet.\n\n` +
    `I help procurement teams verify vendors before payment, flag risk signals, and generate on-chain supplier memos.\n\n` +
    `Type /help to see all commands.`,
    { parse_mode: 'Markdown' }
  );
});

bot.onText(/\/help/, (msg) => {
  bot.sendMessage(msg.chat.id,
    `📋 *${AGENT_NAME} — Commands*\n\n` +
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
    `/help — This message\n\n` +
    `You can also ask: _"what do you do?"_`,
    { parse_mode: 'Markdown' }
  );
});

bot.onText(/\/status/, (msg) => {
  bot.sendMessage(msg.chat.id,
    `🔧 *${AGENT_NAME} — Service Status*\n\n` +
    `Telegram Bot:      ✅ configured (polling active)\n` +
    `OpenAI API:        ✅ configured\n` +
    `Metadata URI:      ${configLabel(METADATA_URI, ['YOUR_WEBSITE'])}\n` +
    `Wallet Address:    ${configLabel(WALLET_ADDRESS, ['PASTE_'])}\n` +
    `x402 Merchant ID:  ${MERCHANT_ID && MERCHANT_ID !== 'pending' ? '✅ configured' : '⚠️  pending'}\n\n` +
    `Chain: GOAT Mainnet (Chain ID ${CHAIN_ID})\n` +
    `ERC-8004 Registry: ${configLabel(ERC8004_REGISTRY)}\n\n` +
    `_Secret values are never displayed._`,
    { parse_mode: 'Markdown' }
  );
});

bot.onText(/\/cancel/, (msg) => {
  awaitingPayment.delete(msg.chat.id);
  bot.sendMessage(msg.chat.id, '✅ Operation cancelled. Type /help to see available commands.');
});

bot.onText(/\/show_identity/, (msg) => {
  const walletLine = (WALLET_ADDRESS && !WALLET_ADDRESS.includes('PASTE_'))
    ? `\`${WALLET_ADDRESS}\``
    : '_(not set — update AGENT\\_WALLET\\_ADDRESS in .env)_';

  const metaLine = (METADATA_URI && !METADATA_URI.includes('YOUR_WEBSITE'))
    ? METADATA_URI
    : '_(placeholder — update AGENT\\_METADATA\\_URI in .env)_';

  bot.sendMessage(msg.chat.id,
    `🪪 *${AGENT_NAME} — On-Chain Identity (ERC-8004)*\n\n` +
    `Network:             GOAT Mainnet\n` +
    `Chain ID:            ${CHAIN_ID}\n` +
    `ERC-8004 Registry:   \`${ERC8004_REGISTRY || 'not set'}\`\n\n` +
    `Agent Metadata URI:  ${metaLine}\n` +
    `Public Wallet:       ${walletLine}\n\n` +
    `Transaction Hash:    _(Phase 1 — registration not yet submitted)_\n` +
    `Agent ID:            _(Phase 1 — assigned after on-chain registration)_\n\n` +
    `ℹ️ ERC-8004 registration will be completed in Phase 2.`,
    { parse_mode: 'Markdown' }
  );
});

bot.onText(/\/unlock_premium_report/, (msg) => {
  awaitingPayment.add(msg.chat.id);

  const merchantLine = (MERCHANT_ID && MERCHANT_ID !== 'pending')
    ? `\`${MERCHANT_ID}\``
    : '_(pending — update GOATX402\\_MERCHANT\\_ID in .env)_';

  bot.sendMessage(msg.chat.id,
    `🔐 *Premium Supplier Memo — Payment Required*\n\n` +
    `To unlock the full verified supplier report, a micro-payment is required:\n\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `Protocol:    x402\n` +
    `Network:     GOAT Mainnet\n` +
    `Amount:      0.1 USDC\n` +
    `Merchant ID: ${merchantLine}\n` +
    `Purpose:     Unlock premium supplier memo\n` +
    `━━━━━━━━━━━━━━━━━━━\n\n` +
    `Reply with \`CONFIRM PAYMENT\` to proceed, or /cancel to abort.`,
    { parse_mode: 'Markdown' }
  );
});

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

  await bot.sendMessage(chatId,
    `🔍 Analyzing *${vendorName}* — this may take a few seconds…`,
    { parse_mode: 'Markdown' }
  );

  const systemPrompt =
    `You are ${AGENT_NAME}, an AI supplier verification agent for B2B procurement teams. ` +
    `Analyze the vendor and return a structured free-preview risk report. ` +
    `Be concise and specific. Flag genuine risk signals if evident; note what verification is still needed if not.`;

  const userPrompt =
    `Vendor Name: ${vendorName}\n` +
    `Website: ${website}\n` +
    `Purchase Context: ${purchaseContext}\n\n` +
    `Respond in exactly this format:\n\n` +
    `**VENDOR SUMMARY**\n[2-3 sentences]\n\n` +
    `**INITIAL RISK FLAGS**\n[Bullet list, or "No immediate red flags — further verification recommended"]\n\n` +
    `**MISSING INFORMATION**\n[What docs/data are needed for full verification]\n\n` +
    `**RECOMMENDATION PREVIEW**\n[One clear line: Low risk / Proceed with caution / Request additional docs / High risk — do not proceed]\n\n` +
    `**NEXT STEP**\n[Single action item for the procurement team]\n\n` +
    `---\nNote: This is a free preview. Use /unlock_premium_report for the full on-chain verified memo.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt   },
      ],
      max_tokens: 700,
      temperature: 0.3,
    });

    const report = completion.choices[0].message.content;

    await bot.sendMessage(chatId,
      `📊 *Vendor Review: ${vendorName}*\n_Free Preview_\n\n${report}\n\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `Use /unlock\\_premium\\_report for the full verified memo with on-chain attestation.`,
      { parse_mode: 'Markdown' }
    );
  } catch (err) {
    console.error('[OpenAI error]', err.message);
    await bot.sendMessage(chatId,
      `❌ *Vendor analysis failed*\n\n` +
      `The AI service returned an error. Please try again in a moment.\n` +
      `If the problem persists, verify your OPENAI_API_KEY in .env.`,
      { parse_mode: 'Markdown' }
    );
  }
});

// ─── General message handler ─────────────────────────────────────────────────
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text   = (msg.text || '').trim();

  // Let onText handlers own command messages
  if (text.startsWith('/')) return;

  // High-risk guardrail
  if (isHighRisk(text)) {
    return bot.sendMessage(chatId, GUARDRAIL_MSG, { parse_mode: 'Markdown' });
  }

  // Payment confirmation
  if (text.toUpperCase() === 'CONFIRM PAYMENT') {
    if (!awaitingPayment.has(chatId)) {
      return bot.sendMessage(chatId,
        `ℹ️ No pending payment request. Use /unlock\\_premium\\_report first.`,
        { parse_mode: 'Markdown' }
      );
    }
    awaitingPayment.delete(chatId);

    return bot.sendMessage(chatId,
      `⚠️ *x402 verification is not connected yet in Phase 1.*\n\n` +
      `Here is what the full x402 flow will do in Phase 2:\n\n` +
      `1️⃣  *Create Order* — Agent posts a signed payment request to the x402 gateway with merchant ID, amount (0.1 USDC), and purpose\n` +
      `2️⃣  *Show Payment Details* — User receives a GOAT Mainnet payment address and invoice ID\n` +
      `3️⃣  *Poll Status* — Agent polls the x402 gateway every few seconds until on-chain confirmation is detected\n` +
      `4️⃣  *Fetch Proof* — Agent retrieves the x402 payment receipt and GOAT transaction hash\n` +
      `5️⃣  *Unlock Report* — Payment proof is verified on-chain and the full supplier memo is released\n\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `📄 *DEMO OUTPUT — Premium Supplier Memo*\n` +
      `_(Phase 1 placeholder — not real data)_\n` +
      `━━━━━━━━━━━━━━━━━━━\n\n` +
      `*Full Vendor Identity Verification*\n` +
      `• Business registration: Confirmed _(demo)_\n` +
      `• Incorporation date: 2018-03-14 _(demo)_\n` +
      `• Registered jurisdiction: Delaware, USA _(demo)_\n\n` +
      `*Financial Health Signals*\n` +
      `• Trade credit score: B+ _(demo)_\n` +
      `• Payment history: 94% on-time _(demo)_\n` +
      `• Outstanding liens: None found _(demo)_\n\n` +
      `*Compliance & Sanctions Screening*\n` +
      `• OFAC screening: Clear _(demo)_\n` +
      `• PEP / adverse media: No matches _(demo)_\n` +
      `• Import / export restrictions: None _(demo)_\n\n` +
      `*On-Chain Attestation*\n` +
      `• Attestation TX: _(pending Phase 2)_\n` +
      `• GOAT Mainnet block: _(pending Phase 2)_\n` +
      `• Proof hash: _(pending Phase 2)_\n\n` +
      `_Real data and on-chain proof will be available in Phase 2 once x402 is connected._`,
      { parse_mode: 'Markdown' }
    );
  }

  // Self-disclosure
  if (/what\s+(do|can)\s+you\s+do/i.test(text) || /what\s+are\s+you/i.test(text)) {
    return bot.sendMessage(chatId,
      `🤖 *I'm ${AGENT_NAME} — an AI Supplier Verification Agent*\n\n` +
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

// ─── Startup log ─────────────────────────────────────────────────────────────
console.log(`[${AGENT_NAME}] Bot started — polling Telegram`);
console.log(`[${AGENT_NAME}] Chain: GOAT Mainnet (Chain ID ${CHAIN_ID})`);
