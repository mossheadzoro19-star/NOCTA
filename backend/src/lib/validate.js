const logger = require('../config/logger');

/**
 * Validate a socket event payload against a schema.
 * Returns { valid, data } where data is the cleaned payload.
 */
function validatePayload(payload, schema) {
  if (!payload || typeof payload !== 'object') {
    return { valid: false };
  }

  const cleaned = {};
  for (const [key, rule] of Object.entries(schema)) {
    const val = payload[key];

    if (rule.required && (val === undefined || val === null)) {
      return { valid: false };
    }

    if (val === undefined || val === null) {
      if (rule.default !== undefined) cleaned[key] = rule.default;
      continue;
    }

    if (rule.type === 'string') {
      if (typeof val !== 'string') return { valid: false };
      const trimmed = val.trim();
      if (rule.maxLength && trimmed.length > rule.maxLength) return { valid: false };
      if (rule.minLength && trimmed.length < rule.minLength) return { valid: false };
      cleaned[key] = trimmed;
    } else if (rule.type === 'number') {
      if (typeof val !== 'number' || isNaN(val)) return { valid: false };
      if (rule.min !== undefined && val < rule.min) return { valid: false };
      if (rule.max !== undefined && val > rule.max) return { valid: false };
      cleaned[key] = val;
    } else if (rule.type === 'boolean') {
      if (typeof val !== 'boolean') return { valid: false };
      cleaned[key] = val;
    }
  }

  return { valid: true, data: cleaned };
}

module.exports = { validatePayload };
