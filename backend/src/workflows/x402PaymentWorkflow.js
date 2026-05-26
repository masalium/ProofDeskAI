'use strict';

const cfg    = require('../config/safeConfig');
const logger = require('../utils/logger');

// ─── Payment state machine constants ─────────────────────────────────────────
const PAYMENT_STATES = Object.freeze({
  IDLE:                  'IDLE',
  AWAITING_CONFIRMATION: 'AWAITING_CONFIRMATION',
  ORDER_CREATED:         'ORDER_CREATED',
  PAYMENT_PENDING:       'PAYMENT_PENDING',
  PAYMENT_VERIFIED:      'PAYMENT_VERIFIED',
  PAYMENT_FAILED:        'PAYMENT_FAILED',
  PAYMENT_EXPIRED:       'PAYMENT_EXPIRED',
  CANCELLED:             'CANCELLED',
  X402_NOT_CONFIGURED:   'X402_NOT_CONFIGURED',
});

// ─── ESM → CJS bridge (goatx402-sdk-server is ESM) ───────────────────────────
// dynamic import() is required to load ES modules from CommonJS.
let _sdkModule = null;
let _sdkLoadAttempted = false;

async function loadSdk() {
  if (_sdkLoadAttempted) return _sdkModule;
  _sdkLoadAttempted = true;
  try {
    _sdkModule = await import('goatx402-sdk-server');
    logger.info('x402', 'goatx402-sdk-server loaded');
  } catch (err) {
    logger.warn('x402', `SDK load failed — will use demo mode only: ${err.message}`);
    _sdkModule = null;
  }
  return _sdkModule;
}

async function getSdkClient() {
  const sdk = await loadSdk();
  if (!sdk || !sdk.GoatX402Client) return null;
  return new sdk.GoatX402Client({
    baseUrl:   process.env.GOATX402_API_URL || 'https://api.x402.goat.network',
    apiKey:    process.env.GOATX402_API_KEY,
    apiSecret: process.env.GOATX402_API_SECRET,
  });
}

// ─── Config helpers ───────────────────────────────────────────────────────────
function isX402Configured() {
  return cfg.hasX402Config;
}

// USDC has 6 decimals: 0.1 USDC = 100000 wei
function toWei(amount) {
  return String(Math.round(parseFloat(amount) * 1e6));
}

function fromWei(amountWei, decimals = 6) {
  const val = parseInt(amountWei, 10);
  return isNaN(val) ? '?' : (val / Math.pow(10, decimals)).toFixed(2);
}

// Scrub any token/key/secret words from error messages before showing them
function safeErrMsg(err) {
  return (err.message || 'Unknown error')
    .replace(/api[_-]?key[^\s]*/gi, '***')
    .replace(/api[_-]?secret[^\s]*/gi, '***')
    .replace(/secret[^\s]*/gi, '***')
    .replace(/token[^\s]*/gi, '***')
    .slice(0, 200);
}

// ─── Core x402 API functions ──────────────────────────────────────────────────

async function createX402Order({ session, chatId }) {
  const client = await getSdkClient();
  if (!client) throw new Error('GoatX402 SDK client unavailable');

  const id          = chatId || 'bot';
  const dappOrderId = `vl-${id}-${Date.now().toString(36)}`;
  const amountWei   = toWei(process.env.X402_AMOUNT || '0.1');
  const tokenSymbol = process.env.X402_TOKEN_SYMBOL || 'USDC';
  const chainId     = parseInt(process.env.GOAT_CHAIN_ID || '2345', 10);
  const fromAddress = process.env.AGENT_WALLET_ADDRESS
                    || process.env.X402_RECEIVING_WALLET
                    || '0x0000000000000000000000000000000000000000';

  const baseUrl      = process.env.GOATX402_API_URL || 'https://api.x402.goat.network';
  const attemptedUrl = `${baseUrl}/api/v1/orders`;

  let order;
  try {
    order = await client.createOrder({
      dappOrderId,
      chainId,
      tokenSymbol,
      fromAddress,
      amountWei,
    });
  } catch (err) {
    logger.error('x402', `createOrder failed → ${attemptedUrl}`);
    logger.error('x402', `  error.name:    ${err.name}`);
    logger.error('x402', `  error.message: ${err.message}`);
    if (err.cause)        logger.error('x402', `  error.cause:   ${err.cause}`);
    if (err.status)       logger.error('x402', `  error.status:  ${err.status}`);
    if (err.responseBody) logger.error('x402', `  response body: ${String(err.responseBody).slice(0, 400)}`);
    throw err;
  }

  session.x402DappOrderId  = dappOrderId;
  session.x402OrderId      = order.orderId;
  session.x402PayToAddress = order.payToAddress;
  session.x402TokenSymbol  = order.tokenSymbol;
  session.x402AmountWei    = order.amountWei;
  session.x402ExpiresAt    = order.expiresAt;
  session.x402Flow         = order.flow;
  session.paymentState     = PAYMENT_STATES.ORDER_CREATED;

  return order;
}

async function getX402OrderStatus({ orderId }) {
  const client = await getSdkClient();
  if (!client) throw new Error('GoatX402 SDK client unavailable');
  return client.getOrderStatus(orderId);
}

async function fetchX402Proof({ orderId }) {
  const client = await getSdkClient();
  if (!client) throw new Error('GoatX402 SDK client unavailable');
  return client.getOrderProof(orderId);
}

// ─── Bot-facing state machine functions ──────────────────────────────────────

async function startPremiumPaymentCheckpoint(session, chatId) {
  // ── Demo mode: x402 credentials not configured ────────────────────────────
  if (!isX402Configured()) {
    session.paymentState = PAYMENT_STATES.AWAITING_CONFIRMATION;

    const merchantLine = (
      cfg.merchantId &&
      !cfg.merchantId.includes('PASTE_') &&
      cfg.merchantId !== 'pending'
    )
      ? `\`${cfg.merchantId}\``
      : '_(pending — update GOATX402\\_MERCHANT\\_ID in .env)_';

    return {
      state: PAYMENT_STATES.AWAITING_CONFIRMATION,
      mode:  'demo',
      message:
        `🔐 *Premium Supplier Memo — Payment Required*\n\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `Protocol:    x402\n` +
        `Network:     GOAT Mainnet (Chain ID ${cfg.chainId})\n` +
        `Token:       ${cfg.x402TokenSymbol}\n` +
        `Amount:      ${cfg.x402Amount} ${cfg.x402TokenSymbol}\n` +
        `Merchant ID: ${merchantLine}\n` +
        `Purpose:     Unlock premium supplier memo\n` +
        `State:       AWAITING\\_CONFIRMATION\n` +
        `━━━━━━━━━━━━━━━━━━━\n\n` +
        `⚠️ _x402 credentials not fully configured — running in demo mode_\n\n` +
        `Reply with \`CONFIRM PAYMENT\` to see the demo flow, or /cancel to abort.`,
    };
  }

  // ── Real x402 flow ────────────────────────────────────────────────────────
  try {
    const order = await createX402Order({ session, chatId });
    const displayAmt = fromWei(order.amountWei);
    const expiresStr = order.expiresAt
      ? new Date(order.expiresAt * 1000).toUTCString()
      : 'not specified';
    const payToLine  = order.payToAddress
      ? `\`${order.payToAddress}\``
      : '_(not returned — check API)_';

    return {
      state: PAYMENT_STATES.ORDER_CREATED,
      mode:  'real',
      order,
      message:
        `🔐 *Premium Supplier Memo — x402 Order Created*\n\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `Protocol:    x402\n` +
        `Network:     GOAT Mainnet (Chain ID ${cfg.chainId})\n` +
        `Token:       ${order.tokenSymbol}\n` +
        `Amount:      ${displayAmt} ${order.tokenSymbol}\n` +
        `Merchant ID: \`${cfg.merchantId}\`\n` +
        `Order ID:    \`${order.orderId}\`\n` +
        `Pay To:      ${payToLine}\n` +
        `Expires:     ${expiresStr}\n` +
        `Flow:        ${order.flow}\n` +
        `State:       ORDER\\_CREATED\n` +
        `━━━━━━━━━━━━━━━━━━━\n\n` +
        `Send ${displayAmt} ${order.tokenSymbol} to the address above from your wallet,\n` +
        `then reply \`CONFIRM PAYMENT\` to verify.\n\n` +
        `/cancel to abort this order.`,
    };
  } catch (err) {
    session.paymentState = PAYMENT_STATES.PAYMENT_FAILED;
    const isNetworkErr = err.name === 'TypeError' || err.message?.includes('fetch failed');
    return {
      state: PAYMENT_STATES.PAYMENT_FAILED,
      mode:  'error',
      message:
        `❌ *x402 API Connection Failed*\n\n` +
        `${isNetworkErr
          ? 'The x402 gateway could not be reached (network/fetch error).'
          : `The x402 gateway returned an error: _${safeErrMsg(err)}_`
        }\n\n` +
        `*Likely causes:*\n` +
        `• Bad or unreachable API URL (check \`GOATX402\\_API\\_URL\` in .env)\n` +
        `• Invalid credentials (check API key / secret)\n` +
        `• GOAT Network gateway temporarily unavailable\n` +
        `• SDK vs API version mismatch\n\n` +
        `No payment was created. No report was unlocked.\n\n` +
        `Use /debug\\_x402 to inspect configuration, then /unlock\\_premium\\_report to retry.\n` +
        `/cancel to clear.`,
    };
  }
}

async function confirmPayment(session) {
  const orderId = session.x402OrderId;

  // ── Demo mode: no real order ──────────────────────────────────────────────
  if (!orderId || !isX402Configured()) {
    if (session.paymentState !== PAYMENT_STATES.AWAITING_CONFIRMATION) {
      return {
        state:      session.paymentState,
        mode:       'demo',
        demoReport: false,
        message:    'No pending payment. Use /unlock\\_premium\\_report first.',
      };
    }
    session.paymentState = PAYMENT_STATES.PAYMENT_FAILED;
    logger.info('x402', 'Demo mode: showing Phase 3 flow description');
    return {
      state:      PAYMENT_STATES.PAYMENT_FAILED,
      mode:       'demo',
      demoReport: true,
      message:
        `⚠️ *x402 verification not connected — Demo Flow*\n\n` +
        `When credentials are configured, here is what Phase 3 executes:\n\n` +
        `1️⃣  *Create Order* — Agent posts a signed request to the x402 gateway\n` +
        `   with merchant ID, amount (0.1 USDC), chain ID, and payer address\n\n` +
        `2️⃣  *Show Payment Details* — User receives the GOAT Mainnet \`payToAddress\`\n` +
        `   and a unique \`orderId\` to track the transaction\n\n` +
        `3️⃣  *User Pays* — User sends USDC from their wallet to \`payToAddress\`\n\n` +
        `4️⃣  *Check Status* — Agent calls \`getOrderStatus(orderId)\` and checks\n` +
        `   for \`PAYMENT_CONFIRMED\` or \`CHECKOUT_VERIFIED\`\n\n` +
        `5️⃣  *Fetch Proof* — Agent calls \`getOrderProof(orderId)\` to retrieve\n` +
        `   the on-chain tx hash and signed payment receipt\n\n` +
        `6️⃣  *Unlock Report* — Payment proof embedded in the full supplier memo`,
    };
  }

  // ── Real order: check status ──────────────────────────────────────────────
  try {
    const proof = await getX402OrderStatus({ orderId });
    logger.info('x402', `Order ${orderId} status: ${proof.status}`);

    // ── Verified ─────────────────────────────────────────────────────────────
    if (proof.status === 'PAYMENT_CONFIRMED' || proof.status === 'CHECKOUT_VERIFIED') {
      let orderProof = null;
      try {
        orderProof = await fetchX402Proof({ orderId });
      } catch (e) {
        logger.warn('x402', `Proof not yet available: ${e.message}`);
      }

      session.paymentState    = PAYMENT_STATES.PAYMENT_VERIFIED;
      session.x402TxHash      = proof.txHash || orderProof?.payload?.tx_hash || null;
      session.premiumUnlocked = true;

      const txLine = session.x402TxHash
        ? `\`${session.x402TxHash}\``
        : '_(not yet indexed — check block explorer)_';

      return {
        state:      PAYMENT_STATES.PAYMENT_VERIFIED,
        mode:       'real',
        demoReport: false,
        proof,
        orderProof,
        message:
          `✅ *Payment Verified — Unlocking Report*\n\n` +
          `Order ID:    \`${orderId}\`\n` +
          `Status:      ${proof.status}\n` +
          `Token:       ${proof.tokenSymbol}\n` +
          `Amount:      ${fromWei(proof.amountWei)} ${proof.tokenSymbol}\n` +
          `Tx Hash:     ${txLine}\n` +
          `Confirmed:   ${proof.confirmedAt || '(pending block indexing)'}`,
      };
    }

    // ── Pending ───────────────────────────────────────────────────────────────
    if (proof.status === 'INVOICED' || proof.status === 'CHECKOUT_VERIFIED') {
      session.paymentState = PAYMENT_STATES.PAYMENT_PENDING;
      return {
        state:      PAYMENT_STATES.PAYMENT_PENDING,
        mode:       'real',
        demoReport: false,
        message:
          `⏳ *Payment Pending*\n\n` +
          `Order \`${orderId}\` is invoiced but not yet confirmed on-chain.\n\n` +
          `If you sent the payment, wait a moment then send \`CONFIRM PAYMENT\` again.\n` +
          `Use /retry\\_payment to recheck, or /cancel to abort.`,
      };
    }

    // ── Terminal failure states ───────────────────────────────────────────────
    const TERMINAL = {
      FAILED:    { state: PAYMENT_STATES.PAYMENT_FAILED,  emoji: '❌', label: 'Failed'    },
      EXPIRED:   { state: PAYMENT_STATES.PAYMENT_EXPIRED, emoji: '⏰', label: 'Expired'   },
      CANCELLED: { state: PAYMENT_STATES.CANCELLED,       emoji: '🚫', label: 'Cancelled' },
    };

    if (TERMINAL[proof.status]) {
      const t = TERMINAL[proof.status];
      session.paymentState = t.state;
      return {
        state:      t.state,
        mode:       'real',
        demoReport: false,
        message:
          `${t.emoji} *Order ${t.label}*\n\n` +
          `Order \`${orderId}\` status: ${proof.status}\n\n` +
          `Use /retry\\_payment or /unlock\\_premium\\_report to start a new order.`,
      };
    }

    // ── Unknown status ────────────────────────────────────────────────────────
    return {
      state:      session.paymentState,
      mode:       'real',
      demoReport: false,
      message:
        `ℹ️ *Order Status: ${proof.status}*\n\n` +
        `Order \`${orderId}\` returned an unrecognised status.\n` +
        `Send \`CONFIRM PAYMENT\` again to recheck, or /cancel to abort.`,
    };

  } catch (err) {
    logger.error('x402', `confirmPayment failed: ${safeErrMsg(err)}`);
    return {
      state:      session.paymentState,
      mode:       'error',
      demoReport: false,
      message:
        `❌ *x402 Status Check Failed*\n\n` +
        `A network or API error occurred while checking payment status.\n` +
        `No report has been unlocked.\n\n` +
        `Send \`CONFIRM PAYMENT\` to retry, or /cancel to abort.`,
    };
  }
}

function cancelPayment(session) {
  session.paymentState = PAYMENT_STATES.CANCELLED;
  return { state: PAYMENT_STATES.CANCELLED };
}

function getPaymentStatus(session) {
  return session.paymentState || PAYMENT_STATES.IDLE;
}

module.exports = {
  PAYMENT_STATES,
  isX402Configured,
  createX402Order,
  getX402OrderStatus,
  fetchX402Proof,
  startPremiumPaymentCheckpoint,
  confirmPayment,
  cancelPayment,
  getPaymentStatus,
};
