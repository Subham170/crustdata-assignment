/**
 * Normalize employer names for cache keys and deduplication.
 * @param {string} name
 * @returns {string}
 */
export function normalizeCompanyName(name) {
  return name
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Alternate names to try with /company/identify (long resume titles).
 * @param {string} companyName
 * @returns {string[]}
 */
export function getIdentifyNameCandidates(companyName) {
  const trimmed = companyName.trim();
  const candidates = [trimmed];

  const shortName = trimmed.split(/\s*[-–—]\s+/)[0]?.trim();
  if (shortName && shortName !== trimmed) {
    candidates.push(shortName);
  }

  return [...new Set(candidates)];
}
