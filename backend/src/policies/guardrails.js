'use strict';

const RISK_PATTERNS = [
  { pattern: /increase\s+(my\s+)?spending\s+limit/i,         category: 'spending-limit-change'  },
  { pattern: /auto[- ]?approve\s+(supplier\s+)?payment/i,    category: 'auto-payment-approval'  },
  { pattern: /approve\s+supplier\s+payment\s+auto/i,         category: 'auto-payment-approval'  },
  { pattern: /approve.*payment.*automatically/i,             category: 'auto-payment-approval'  },
  { pattern: /send\s+funds/i,                                category: 'fund-transfer'           },
  { pattern: /transfer\s+funds/i,                            category: 'fund-transfer'           },
  { pattern: /(change|update|modify)\s+(my\s+)?wallet/i,     category: 'wallet-change'           },
  { pattern: /(update|modify)\s+merchant\s+settings/i,       category: 'merchant-config-change'  },
  { pattern: /(update|modify|change)\s+metadata/i,           category: 'metadata-update'         },
  { pattern: /mainnet\s+write/i,                             category: 'mainnet-write'           },
  { pattern: /deploy\s+(contract|token)/i,                   category: 'mainnet-write'           },
];

const CATEGORY_LABELS = {
  'spending-limit-change':  'Spending limit modification',
  'auto-payment-approval':  'Autonomous payment approval',
  'fund-transfer':          'Fund transfer',
  'wallet-change':          'Wallet address change',
  'merchant-config-change': 'Merchant settings modification',
  'metadata-update':        'Agent metadata update',
  'mainnet-write':          'Mainnet write operation',
};

function classifyRisk(text) {
  for (const { pattern, category } of RISK_PATTERNS) {
    if (pattern.test(text)) {
      return { level: 'HIGH', category };
    }
  }
  return { level: 'LOW', category: null };
}

function guardrailResponse(risk) {
  const label = CATEGORY_LABELS[risk.category] || 'Sensitive action';
  return (
    `⛔ *Security Guardrail — Action Blocked*\n\n` +
    `*Detected:* ${label}\n\n` +
    `This agent is read-only and cannot execute financial operations or modify account settings ` +
    `without explicit human authorization through your organization's approved procurement platform.\n\n` +
    `*Actions I will never perform autonomously:*\n` +
    `• Increase or modify spending limits\n` +
    `• Auto-approve supplier payments\n` +
    `• Send or transfer funds\n` +
    `• Change or update wallet addresses\n` +
    `• Modify merchant settings\n` +
    `• Update agent metadata\n` +
    `• Execute mainnet write transactions\n\n` +
    `*To proceed with this action, your organization must:*\n` +
    `1. Use an authorized procurement platform with a proper approval workflow\n` +
    `2. Obtain required human sign-offs\n` +
    `3. Review: action · chain · amount · token · destination · expected result · risks\n\n` +
    `Type /cancel to clear this state, or /help to see what I can assist with.`
  );
}

module.exports = { classifyRisk, guardrailResponse };
