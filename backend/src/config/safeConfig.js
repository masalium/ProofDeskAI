'use strict';

// All env reads happen here. Only non-secret values are exported directly.
// Secret values are never exported — only boolean flags derived from them.

const config = {
  // ── Non-secret public values ──────────────────────────────────────────────
  port:            process.env.PORT           || 3001,
  agentName:       process.env.AGENT_NAME     || 'VendorLens',
  chainId:         process.env.GOAT_CHAIN_ID  || '2345',
  rpcUrl:          process.env.GOAT_RPC_URL   || 'https://rpc.goat.network',
  erc8004Registry: process.env.ERC8004_REGISTRY
                   || '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
  metadataUri:     process.env.AGENT_METADATA_URI   || null,
  walletAddress:   process.env.AGENT_WALLET_ADDRESS || null,
  merchantId:      process.env.GOATX402_MERCHANT_ID || null,
  x402ApiUrl:      process.env.GOATX402_API_URL     || 'https://api.x402.goat.network',
  x402TokenSymbol: process.env.X402_TOKEN_SYMBOL    || 'USDC',
  x402Amount:      process.env.X402_AMOUNT          || '0.1',
  erc8004TxHash:      process.env.ERC8004_TX_HASH      || null,
  erc8004AgentId:     process.env.ERC8004_AGENT_ID     || null,
  scanUrl:            process.env.ERC8004_8004SCAN_URL  || null,
  x402ReceivingWallet: process.env.X402_RECEIVING_WALLET || null,

  // ── Boolean capability flags (never expose raw secret values) ─────────────
  hasTelegramToken: !!process.env.TELEGRAM_BOT_TOKEN,

  hasOpenAIKey: !!process.env.OPENAI_API_KEY,

  // Individual x402 credential flags — for diagnostics only
  hasX402MerchantId: !!(
    process.env.GOATX402_MERCHANT_ID &&
    !process.env.GOATX402_MERCHANT_ID.includes('PASTE_')
  ),
  hasX402ApiKey: !!(
    process.env.GOATX402_API_KEY &&
    !process.env.GOATX402_API_KEY.includes('PASTE_')
  ),
  hasX402ApiSecret: !!(
    process.env.GOATX402_API_SECRET &&
    !process.env.GOATX402_API_SECRET.includes('PASTE_')
  ),

  hasX402Config: !!(
    process.env.GOATX402_MERCHANT_ID &&
    !process.env.GOATX402_MERCHANT_ID.includes('PASTE_') &&
    process.env.GOATX402_API_KEY &&
    !process.env.GOATX402_API_KEY.includes('PASTE_') &&
    process.env.GOATX402_API_SECRET &&
    !process.env.GOATX402_API_SECRET.includes('PASTE_')
  ),

  hasIdentityConfig: !!(
    process.env.AGENT_WALLET_ADDRESS &&
    !process.env.AGENT_WALLET_ADDRESS.includes('PASTE_') &&
    process.env.AGENT_METADATA_URI &&
    !process.env.AGENT_METADATA_URI.includes('YOUR_WEBSITE')
  ),
};

module.exports = config;
