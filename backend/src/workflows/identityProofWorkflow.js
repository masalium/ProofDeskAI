'use strict';

const cfg = require('../config/safeConfig');

function getIdentityProof() {
  const isPlaceholderWallet = !cfg.walletAddress || cfg.walletAddress.includes('PASTE_');
  const isPlaceholderMeta   = !cfg.metadataUri   || cfg.metadataUri.includes('YOUR_WEBSITE');

  const walletLine = isPlaceholderWallet
    ? '_(not set — update AGENT\\_WALLET\\_ADDRESS in .env)_'
    : `\`${cfg.walletAddress}\``;

  // Wrap real URI in backtick code span — bare URLs with underscores break Markdown v1
  const metaLine = isPlaceholderMeta
    ? '_(placeholder — update AGENT\\_METADATA\\_URI in .env)_'
    : `\`${cfg.metadataUri}\``;

  const txLine = cfg.erc8004TxHash
    ? `\`${cfg.erc8004TxHash}\``
    : '_(Phase 2 — registration not yet submitted)_';

  const agentIdLine = cfg.erc8004AgentId
    ? `\`${cfg.erc8004AgentId}\``
    : '_(Phase 2 — assigned after on-chain registration)_';

  const getWalletCall = cfg.erc8004AgentId
    ? `registry.getAgentWallet(${cfg.erc8004AgentId})`
    : 'registry.getAgentWallet(<agentId>)';

  const scanLine = (cfg.scanUrl && cfg.erc8004AgentId)
    ? `${cfg.scanUrl}/agent/${cfg.erc8004AgentId}`
    : '_(Phase 2 — available after registration)_';

  const registrationStatus = (cfg.erc8004TxHash && cfg.erc8004AgentId)
    ? '✅ Registered on-chain'
    : '⏳ Pending (Phase 2)';

  const metaUriForRegister = isPlaceholderMeta
    ? '<AGENT_METADATA_URI>'
    : cfg.metadataUri;

  return (
    `🪪 *${cfg.agentName} — On-Chain Identity (ERC-8004)*\n\n` +
    `Network:               GOAT Mainnet\n` +
    `Chain ID:              ${cfg.chainId}\n` +
    `RPC URL:               ${cfg.rpcUrl}\n` +
    `ERC-8004 Registry:     \`${cfg.erc8004Registry}\`\n\n` +
    `Agent Metadata URI:    ${metaLine}\n` +
    `Public Wallet:         ${walletLine}\n\n` +
    `Registration Status:   ${registrationStatus}\n` +
    `Transaction Hash:      ${txLine}\n` +
    `Agent ID:              ${agentIdLine}\n` +
    `getAgentWallet(id):    \`${getWalletCall}\` _(Phase 2)_\n` +
    `8004scan:              ${scanLine}\n\n` +
    `ℹ️ *Registration method:* \`registry.register("<agentMetadataURI>")\`\n` +
    `_register() takes the full metadata URI, not just a display name_\n\n` +
    `*URI to pass:* \`${metaUriForRegister}\``
  );
}

module.exports = { getIdentityProof };
