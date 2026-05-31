const MONTH_NAMES = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

const PRESENT_WORDS = new Set(['present', 'current', 'now', 'ongoing']);

/**
 * Parse resume date strings (e.g. "Jan 2021", "2021-01", "01/2021") to UTC month start.
 * @param {string | null | undefined} value
 * @returns {Date | null}
 */
export function parseResumeDate(value) {
  if (!value || typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed || PRESENT_WORDS.has(trimmed.toLowerCase())) return null;

  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})$/);
  if (isoMatch) {
    return monthStart(Number(isoMatch[1]), Number(isoMatch[2]) - 1);
  }

  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    return monthStart(Number(slashMatch[2]), Number(slashMatch[1]) - 1);
  }

  const yearOnly = trimmed.match(/^(\d{4})$/);
  if (yearOnly) {
    return monthStart(Number(yearOnly[1]), 0);
  }

  const monthYear = trimmed.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (monthYear) {
    const monthIndex = MONTH_NAMES[monthYear[1].toLowerCase()];
    if (monthIndex !== undefined) {
      return monthStart(Number(monthYear[2]), monthIndex);
    }
  }

  const yearMonth = trimmed.match(/^(\d{4})\s+([A-Za-z]+)$/);
  if (yearMonth) {
    const monthIndex = MONTH_NAMES[yearMonth[2].toLowerCase()];
    if (monthIndex !== undefined) {
      return monthStart(Number(yearMonth[1]), monthIndex);
    }
  }

  return null;
}

function monthStart(year, monthIndex) {
  if (monthIndex < 0 || monthIndex > 11) return null;
  return new Date(Date.UTC(year, monthIndex, 1));
}

/**
 * @param {Date | null} start
 * @param {Date | null} end
 * @returns {number}
 */
export function monthsBetween(start, end) {
  if (!start) return 0;
  const endDate = end ?? new Date();
  const months =
    (endDate.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (endDate.getUTCMonth() - start.getUTCMonth());
  return Math.max(0, months);
}
