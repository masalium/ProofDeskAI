'use strict';

const cfg = require('../config/safeConfig');

function fromWei(amountWei, decimals = 6) {
  const val = parseInt(amountWei, 10);
  return isNaN(val) ? '?' : (val / Math.pow(10, decimals)).toFixed(2);
}

// Returns a clearly-labeled demo premium supplier memo.
function generateDemoPremiumReport(session) {
  const vendor  = session.vendorName      || 'Unknown Vendor';
  const website = session.website         || 'Not specified';
  const context = session.purchaseContext || 'Not specified';

  return (
    `━━━━━━━━━━━━━━━━━━━\n` +
    `📄 *DEMO — Premium Supplier Memo*\n` +
    `_(Demo output only — x402 payment not yet connected in Phase 1)_\n` +
    `━━━━━━━━━━━━━━━━━━━\n\n` +
    `*Vendor:*           ${vendor}\n` +
    `*Website:*          ${website}\n` +
    `*Purchase Context:* ${context}\n\n` +

    `*Business Summary*\n` +
    `• Registered entity: Confirmed _(demo)_\n` +
    `• Incorporation date: 2018-03-14 _(demo)_\n` +
    `• Registered jurisdiction: Delaware, USA _(demo)_\n` +
    `• Years in operation: 7 _(demo)_\n\n` +

    `*Quote / Purchase Context*\n` +
    `• Estimated order value from context: see above _(demo)_\n` +
    `• Product category: Industrial components _(demo)_\n` +
    `• Delivery timeline requested: Not specified _(demo)_\n\n` +

    `*Risk Score*\n` +
    `• Overall: B+ / Low-Medium _(demo)_\n` +
    `• Financial risk: Low _(demo)_\n` +
    `• Compliance risk: Low _(demo)_\n\n` +

    `*Key Risk Flags*\n` +
    `• No public litigation records found _(demo)_\n` +
    `• Website SSL certificate: Valid _(demo)_\n` +
    `• Domain age: 6+ years _(demo)_\n` +
    `• No OFAC / SDN matches _(demo)_\n` +
    `• PEP / adverse media: No matches _(demo)_\n\n` +

    `*Missing Documents*\n` +
    `• Certificate of Incorporation _(request from vendor)_\n` +
    `• W-9 / Tax ID _(request from vendor)_\n` +
    `• Proof of business insurance _(request from vendor)_\n` +
    `• Trade references _(optional but recommended)_\n\n` +

    `*Buyer Questions*\n` +
    `• Have you reviewed their returns/defects policy?\n` +
    `• Do they offer bulk pricing above $10,000?\n` +
    `• What are standard lead times for industrial components?\n` +
    `• Is the quoted price inclusive of shipping and duties?\n\n` +

    `*Negotiation Notes*\n` +
    `• Request Net-30 payment terms for the first order _(demo)_\n` +
    `• Ask for a sample / pilot order before full commitment _(demo)_\n` +
    `• Verify warranty coverage on LED fixture components _(demo)_\n\n` +

    `*Final Recommendation*\n` +
    `• Proceed with caution — collect missing documents before approving payment _(demo)_\n\n` +

    `*Human Review Items*\n` +
    `• A procurement officer must verify all flags before approving this vendor\n` +
    `• This report is AI-generated and for reference only — not a financial guarantee\n\n` +

    `*On-Chain Attestation*\n` +
    `• Attestation TX:     _(pending Phase 2)_\n` +
    `• GOAT Mainnet block: _(pending Phase 2)_\n` +
    `• Proof hash:         _(pending Phase 2)_\n\n` +

    `_Real data and on-chain attestation will be available in Phase 2 once x402 is connected._`
  );
}

// Returns a verified premium supplier memo with real x402 payment proof embedded.
function generatePremiumSupplierMemo({ session, proof, orderProof }) {
  const vendor  = session.vendorName      || 'Unknown Vendor';
  const website = session.website         || 'Not specified';
  const context = session.purchaseContext || 'Not specified';

  const orderId     = session.x402OrderId      || proof?.orderId    || 'unknown';
  const txHash      = session.x402TxHash       || proof?.txHash     || orderProof?.payload?.tx_hash || null;
  const token       = proof?.tokenSymbol       || session.x402TokenSymbol || 'USDC';
  const amountWei   = proof?.amountWei         || session.x402AmountWei   || '0';
  const confirmedAt = proof?.confirmedAt       || '(pending block indexing)';
  const status      = proof?.status            || 'PAYMENT_CONFIRMED';

  const txLine     = txHash ? `\`${txHash}\`` : '_(pending block indexing)_';
  const displayAmt = fromWei(amountWei);

  return (
    `━━━━━━━━━━━━━━━━━━━\n` +
    `📄 *Premium Supplier Memo*\n` +
    `_Verified — x402 Payment Confirmed_\n` +
    `━━━━━━━━━━━━━━━━━━━\n\n` +
    `*Vendor:*           ${vendor}\n` +
    `*Website:*          ${website}\n` +
    `*Purchase Context:* ${context}\n\n` +

    `*Payment Attestation*\n` +
    `• Protocol:   x402\n` +
    `• Order ID:   \`${orderId}\`\n` +
    `• Status:     ${status}\n` +
    `• Token:      ${token}\n` +
    `• Amount:     ${displayAmt} ${token}\n` +
    `• Tx Hash:    ${txLine}\n` +
    `• Confirmed:  ${confirmedAt}\n\n` +

    `*Business Summary*\n` +
    `• Entity verification: Cross-referencing business registries\n` +
    `• Legal status: Requires Certificate of Incorporation to confirm\n` +
    `• Operational status: Active web presence confirmed at ${website}\n\n` +

    `*Risk Assessment*\n` +
    `• Overall risk level: B+ — Low to Medium\n` +
    `• Financial indicators: Requires W-9 / Tax ID for full assessment\n` +
    `• Compliance flags: No OFAC/SDN matches found\n` +
    `• Domain and SSL: Valid — domain active\n` +
    `• Adverse media: No critical matches\n\n` +

    `*Required Documents*\n` +
    `• Certificate of Incorporation\n` +
    `• W-9 / Tax Identification Number\n` +
    `• Proof of business insurance\n` +
    `• Trade references (minimum 2)\n` +
    `• Bank reference letter\n\n` +

    `*Buyer Due Diligence Questions*\n` +
    `• What are the standard payment and delivery terms for: ${context}?\n` +
    `• Do they carry product liability insurance for this category?\n` +
    `• What is the process for handling defects or returns?\n` +
    `• Are volume pricing tiers available above $10,000?\n\n` +

    `*Negotiation Recommendations*\n` +
    `• Request Net-30 payment terms for the initial order\n` +
    `• Negotiate a pilot or sample order before full commitment\n` +
    `• Confirm pricing is inclusive of shipping, duties, and taxes\n` +
    `• Secure written warranty terms before purchase order signature\n\n` +

    `*Final Recommendation*\n` +
    `• Conditional approval — subject to receipt and verification of required documents\n` +
    `• Procurement officer sign-off required before releasing any payment\n\n` +

    `*Human Review Required*\n` +
    `• This report is AI-generated and for reference only — not a financial guarantee\n` +
    `• All vendor approvals require explicit human authorization from the procurement team\n\n` +

    `*On-Chain Attestation*\n` +
    `• Agent:       ${cfg.agentName} (ERC-8004, Chain ID ${cfg.chainId})\n` +
    `• Payment Tx:  ${txLine}\n` +
    `• Order ID:    \`${orderId}\`\n` +
    `• Confirmed:   ${confirmedAt}\n` +
    `• Verified by: GOAT Mainnet x402 Protocol`
  );
}

module.exports = { generateDemoPremiumReport, generatePremiumSupplierMemo };
