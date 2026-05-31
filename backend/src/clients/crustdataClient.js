import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { AppError } from '../middlewares/errorHandler.js';

const IDENTIFY_CONFIDENCE_THRESHOLD = 0.5;
const ENRICH_FIELDS = ['basic_info', 'headcount', 'funding'];
const MIN_REQUEST_INTERVAL_MS = 4000;

let lastRequestAt = 0;

/**
 * @param {string} path
 * @param {Record<string, unknown>} body
 */
async function crustdataRequest(path, body) {
  if (!env.CRUSTDATA_API_KEY) {
    throw new AppError('Crustdata API key is not configured', 502);
  }

  await throttleCrustdata();

  const response = await fetch(`${env.CRUSTDATA_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.CRUSTDATA_API_KEY}`,
      'content-type': 'application/json',
      'x-api-version': env.CRUSTDATA_API_VERSION,
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => null);

  if (response.status === 429) {
    const retryAfter = Number(response.headers.get('retry-after')) || 60;
    throw new AppError('External API rate limited', 503, { retryAfter });
  }

  if (!response.ok) {
    const message =
      payload?.error ||
      payload?.message ||
      `Crustdata request failed (${response.status})`;
    throw new AppError(message, 502, { path, status: response.status });
  }

  return payload;
}

async function throttleCrustdata() {
  const now = Date.now();
  const waitMs = Math.max(0, MIN_REQUEST_INTERVAL_MS - (now - lastRequestAt));
  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  lastRequestAt = Date.now();
}

/**
 * @param {string} path
 * @param {Record<string, unknown>} body
 * @param {number} [attempt]
 */
async function crustdataRequestWithRetry(path, body, attempt = 0) {
  try {
    return await crustdataRequest(path, body);
  } catch (error) {
    if (error.statusCode === 503 && attempt < 1) {
      const retryAfter = (error.details?.retryAfter ?? 60) * 1000;
      logger.warn({ path, retryAfter }, 'Crustdata rate limited, retrying');
      await new Promise((resolve) => setTimeout(resolve, Math.min(retryAfter, 15000)));
      return crustdataRequestWithRetry(path, body, attempt + 1);
    }
    throw error;
  }
}

/**
 * @param {string} companyName
 * @returns {Promise<{ crustdataCompanyId: number, confidenceScore: number, basicInfo: object } | null>}
 */
export async function identifyByName(companyName) {
  const results = await crustdataRequestWithRetry('/company/identify', {
    names: [companyName],
  });

  const entry = Array.isArray(results)
    ? results.find((item) => item.matched_on === companyName) ?? results[0]
    : null;

  const matches = entry?.matches ?? [];
  const best = pickBestIdentifyMatch(companyName, matches);

  if (!best) return null;

  const companyData = best.company_data ?? {};
  const crustdataCompanyId =
    companyData.crustdata_company_id ?? companyData.basic_info?.crustdata_company_id;

  if (!crustdataCompanyId) return null;

  return {
    crustdataCompanyId,
    confidenceScore: best.confidence_score ?? 0,
    basicInfo: companyData.basic_info ?? {},
  };
}

/**
 * @param {number} companyId
 * @param {string[]} [fields]
 */
export async function enrichCompany(companyId, fields = ENRICH_FIELDS) {
  const results = await crustdataRequestWithRetry('/company/enrich', {
    crustdata_company_ids: [companyId],
    fields,
  });

  const entry = Array.isArray(results) ? results[0] : null;
  const match = entry?.matches?.[0];

  return match?.company_data ?? null;
}

/**
 * @param {string} queryName
 * @param {Array<{ confidence_score?: number, company_data?: object }>} matches
 */
function pickBestIdentifyMatch(queryName, matches) {
  const eligible = matches.filter(
    (match) => (match.confidence_score ?? 0) >= IDENTIFY_CONFIDENCE_THRESHOLD
  );

  if (!eligible.length) return null;

  const normalizedQuery = queryName.trim().toLowerCase();

  const exact = eligible.find((match) => {
    const name = match.company_data?.basic_info?.name;
    return name?.trim().toLowerCase() === normalizedQuery;
  });

  if (exact) return exact;

  return eligible.reduce((best, current) =>
    (current.confidence_score ?? 0) > (best.confidence_score ?? 0) ? current : best
  );
}
