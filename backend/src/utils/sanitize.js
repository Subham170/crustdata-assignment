const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;

/**
 * @param {unknown} value
 * @param {number} [maxLength=500]
 */
export function sanitizeString(value, maxLength = 500) {
  if (value == null) return null;
  if (typeof value !== 'string') return null;

  return value
    .replace(CONTROL_CHARS, '')
    .replace(/<[^>]*>/g, '')
    .trim()
    .slice(0, maxLength);
}

/**
 * @param {unknown} value
 */
export function sanitizeCompanyName(value) {
  const cleaned = sanitizeString(value, 200);
  return cleaned || null;
}

/**
 * @param {unknown} url
 */
export function sanitizeUrl(value) {
  const cleaned = sanitizeString(value, 2048);
  if (!cleaned) return null;

  try {
    const parsed = new URL(cleaned);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}
