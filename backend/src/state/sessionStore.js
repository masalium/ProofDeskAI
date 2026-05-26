'use strict';

// In-memory session store keyed by Telegram chat ID.
const sessions = new Map();

const DEFAULT_SESSION = () => ({
  vendorName:       null,
  website:          null,
  purchaseContext:  null,
  pendingPayment:   false,
  paymentState:     'IDLE',
  premiumUnlocked:  false,
  // x402 order fields
  x402DappOrderId:  null,
  x402OrderId:      null,
  x402PayToAddress: null,
  x402TokenSymbol:  null,
  x402AmountWei:    null,
  x402ExpiresAt:    null,
  x402Flow:         null,
  x402TxHash:       null,
});

function getSession(chatId) {
  if (!sessions.has(chatId)) {
    sessions.set(chatId, DEFAULT_SESSION());
  }
  return sessions.get(chatId);
}

function updateSession(chatId, patch) {
  const current = getSession(chatId);
  Object.assign(current, patch);
  return current;
}

function clearSession(chatId) {
  sessions.set(chatId, DEFAULT_SESSION());
}

module.exports = { getSession, updateSession, clearSession };
