'use strict';

const { buildSystemPrompt } = require('../prompts/vendorLensSystemPrompt');
const logger = require('../utils/logger');

async function generateFreeVendorPreview({ openai, vendorName, website, purchaseContext }) {
  if (!openai) {
    return { ok: false, error: 'OPENAI_NOT_CONFIGURED' };
  }

  const userPrompt =
    `Vendor Name: ${vendorName}\n` +
    `Website: ${website}\n` +
    `Purchase Context: ${purchaseContext}\n\n` +
    `Respond in exactly this format:\n\n` +
    `**VENDOR SUMMARY**\n[2-3 sentences]\n\n` +
    `**INITIAL RISK FLAGS**\n[Bullet list, or "No immediate red flags — further verification recommended"]\n\n` +
    `**MISSING INFORMATION**\n[What docs/data are needed for full verification]\n\n` +
    `**HUMAN REVIEW ITEMS**\n[What a procurement officer must verify before approving spend]\n\n` +
    `**RECOMMENDATION PREVIEW**\n[One clear line: Low risk / Proceed with caution / Request additional docs / High risk — do not proceed]\n\n` +
    `**NEXT STEP**\n[Single action item for the procurement team]\n\n` +
    `---\n` +
    `Note: This is a free AI preview. Results are indicative only and require human review before any procurement decision. ` +
    `Do not add any trailing footer or next-step note — those will be appended separately.`;

  try {
    const completion = await openai.chat.completions.create({
      model:       'gpt-4o-mini',
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user',   content: userPrompt          },
      ],
      max_tokens:  800,
      temperature: 0.3,
    });
    return { ok: true, report: completion.choices[0].message.content };
  } catch (err) {
    logger.error('vendorReviewWorkflow', err.message);
    return { ok: false, error: 'OPENAI_ERROR' };
  }
}

module.exports = { generateFreeVendorPreview };
