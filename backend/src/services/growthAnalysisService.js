import pLimit from 'p-limit';
import { prisma } from '../config/db.js';
import { getRedis } from '../config/redis.js';
import { identifyByName, enrichCompany } from '../clients/crustdataClient.js';
import {
  getIdentifyNameCandidates,
  normalizeCompanyName,
} from '../utils/normalizeCompany.js';

const IDENTIFY_CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;
const GROWTH_CACHE_TTL_SECONDS = 24 * 60 * 60;
const enrichLimit = pLimit(3);

/**
 * @param {string} companyName
 * @returns {Promise<{ status: 'resolved', record: object, source: string } | { status: 'failed', companyName: string, error: string }>}
 */
export async function resolveAndEnrichEmployer(companyName) {
  const normalized = normalizeCompanyName(companyName);

  try {
    for (const candidate of getIdentifyNameCandidates(companyName)) {
      const cachedIdentify = await getCachedIdentify(candidate);
      if (cachedIdentify?.crustdataCompanyId) {
        const cachedGrowth = await getCachedGrowthById(cachedIdentify.crustdataCompanyId);
        if (cachedGrowth) {
          return { status: 'resolved', record: cachedGrowth, source: 'cache' };
        }
      }
    }

    const existing = await prisma.companyGrowth.findFirst({
      where: {
        OR: [
          { companyName: { equals: companyName, mode: 'insensitive' } },
          { companyName: { contains: companyName.split(/\s*[-–—]\s+/)[0], mode: 'insensitive' } },
        ],
      },
      orderBy: { lastUpdated: 'desc' },
    });

    if (existing?.crustdataCompanyId) {
      const freshEnough =
        Date.now() - existing.lastUpdated.getTime() < GROWTH_CACHE_TTL_SECONDS * 1000;
      if (freshEnough) {
        await setGrowthCache(existing);
        return { status: 'resolved', record: existing, source: 'database' };
      }

      const refreshed = await enrichAndUpsert(existing.crustdataCompanyId, companyName);
      if (refreshed) {
        return { status: 'resolved', record: refreshed, source: 'enrich' };
      }
    }

    const identifyCandidates = getIdentifyNameCandidates(companyName);
    let identified = null;

    for (const candidate of identifyCandidates) {
      const cachedIdentify = await getCachedIdentify(candidate);
      if (cachedIdentify) {
        identified = cachedIdentify;
        break;
      }

      const result = await identifyByName(candidate);
      if (result) {
        await setCachedIdentify(candidate, result);
        identified = result;
        break;
      }
    }

    if (!identified) {
      return {
        status: 'failed',
        companyName,
        error: 'No confident company match from Crustdata identify',
      };
    }

    const record = await enrichAndUpsert(identified.crustdataCompanyId, companyName);
    if (!record) {
      return {
        status: 'failed',
        companyName,
        error: 'Company enrich returned no data',
      };
    }

    return { status: 'resolved', record, source: 'identify+enrich' };
  } catch (error) {
    return {
      status: 'failed',
      companyName,
      error: error.message ?? 'Company enrichment failed',
    };
  }
}

/**
 * @param {string[]} companyNames
 */
export async function resolveEmployersBatch(companyNames) {
  const uniqueNames = [...new Set(companyNames.map((name) => name.trim()).filter(Boolean))];

  const results = await Promise.allSettled(
    uniqueNames.map((name) => enrichLimit(() => resolveAndEnrichEmployer(name)))
  );

  const resolved = [];
  const warnings = [];

  for (let i = 0; i < uniqueNames.length; i++) {
    const outcome = results[i];
    const companyName = uniqueNames[i];

    if (outcome.status === 'rejected') {
      warnings.push(`Could not resolve: ${companyName} (${outcome.reason?.message ?? 'error'})`);
      continue;
    }

    if (outcome.value.status === 'resolved') {
      resolved.push(outcome.value.record);
    } else {
      warnings.push(`Could not resolve: ${companyName} (${outcome.value.error})`);
    }
  }

  return { resolved, warnings };
}

/**
 * @param {number} crustdataCompanyId
 * @param {string} fallbackName
 */
async function enrichAndUpsert(crustdataCompanyId, fallbackName) {
  const cached = await getCachedGrowthById(crustdataCompanyId);
  if (cached) return cached;

  const companyData = await enrichCompany(crustdataCompanyId);
  if (!companyData) return null;

  const record = await upsertCompanyGrowth(companyData, fallbackName);
  await setGrowthCache(record);
  return record;
}

/**
 * @param {object} companyData
 * @param {string} fallbackName
 */
async function upsertCompanyGrowth(companyData, fallbackName) {
  const basicInfo = companyData.basic_info ?? {};
  const headcount = companyData.headcount ?? {};
  const funding = companyData.funding ?? {};
  const growthPercent = headcount.growth_percent ?? {};
  const crustdataCompanyId =
    companyData.crustdata_company_id ?? basicInfo.crustdata_company_id ?? null;

  if (!crustdataCompanyId) return null;

  const payload = {
    companyName: basicInfo.name ?? fallbackName,
    crustdataCompanyId,
    primaryDomain: basicInfo.primary_domain ?? null,
    employeeGrowth6m: growthPercent.six_months ?? null,
    employeeGrowth12m: growthPercent.yoy ?? null,
    headcountTotal: headcount.total ?? null,
    totalInvestmentUsd: funding.total_investment_usd ?? null,
    yearFounded: basicInfo.year_founded ?? null,
    industry: basicInfo.industries?.[0] ?? null,
    rawPayload: companyData,
    lastUpdated: new Date(),
  };

  return prisma.companyGrowth.upsert({
    where: { crustdataCompanyId },
    create: payload,
    update: payload,
  });
}

async function getCachedIdentify(companyName) {
  const key = `company:identify:${normalizeCompanyName(companyName)}`;
  const cached = await redisGet(key);
  return cached;
}

async function setCachedIdentify(companyName, data) {
  const key = `company:identify:${normalizeCompanyName(companyName)}`;
  await redisSet(key, data, IDENTIFY_CACHE_TTL_SECONDS);
}

async function getCachedGrowthById(crustdataCompanyId) {
  const key = `company:growth:${crustdataCompanyId}`;
  const cached = await redisGet(key);
  if (!cached) return null;

  if (cached.id) {
    return prisma.companyGrowth.findUnique({ where: { id: cached.id } });
  }

  return prisma.companyGrowth.findUnique({
    where: { crustdataCompanyId },
  });
}

async function setGrowthCache(record) {
  const key = `company:growth:${record.crustdataCompanyId}`;
  await redisSet(
    key,
    {
      id: record.id,
      crustdataCompanyId: record.crustdataCompanyId,
      companyName: record.companyName,
      employeeGrowth6m: record.employeeGrowth6m,
      employeeGrowth12m: record.employeeGrowth12m,
      headcountTotal: record.headcountTotal,
      totalInvestmentUsd: record.totalInvestmentUsd,
      yearFounded: record.yearFounded,
      industry: record.industry,
      primaryDomain: record.primaryDomain,
    },
    GROWTH_CACHE_TTL_SECONDS
  );
}

async function redisGet(key) {
  try {
    const client = getRedis();
    if (client.status === 'end') return null;
    if (client.status !== 'ready') {
      await client.connect().catch(() => null);
    }
    if (client.status !== 'ready') return null;

    const value = await client.get(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

async function redisSet(key, value, ttlSeconds) {
  try {
    const client = getRedis();
    if (client.status === 'end') return;
    if (client.status !== 'ready') {
      await client.connect().catch(() => null);
    }
    if (client.status !== 'ready') return;

    await client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch {
    // Cache is optional — continue without Redis
  }
}

/**
 * @param {Array<{ id: string, companyName: string }>} experiences
 * @param {object[]} growthRecords
 */
export async function linkExperiencesToGrowth(experiences, growthRecords) {
  const growthByKey = new Map();

  for (const record of growthRecords) {
    growthByKey.set(normalizeCompanyName(record.companyName), record);
  }

  for (const experience of experiences) {
    const record =
      growthByKey.get(normalizeCompanyName(experience.companyName)) ??
      matchGrowthByPartialName(experience.companyName, growthRecords);

    if (!record) continue;

    await prisma.experience.update({
      where: { id: experience.id },
      data: {
        crustdataCompanyId: record.crustdataCompanyId,
        companyGrowthId: record.id,
      },
    });
  }
}

function matchGrowthByPartialName(companyName, growthRecords) {
  const shortName = companyName.split(/\s*[-–—]\s+/)[0]?.trim().toLowerCase();
  if (!shortName) return null;

  return (
    growthRecords.find((record) => record.companyName.toLowerCase().startsWith(shortName)) ??
    null
  );
}

export function formatEmployerGrowth(record) {
  return {
    companyName: record.companyName,
    crustdataCompanyId: record.crustdataCompanyId,
    primaryDomain: record.primaryDomain,
    employeeGrowth6m: record.employeeGrowth6m,
    employeeGrowth12m: record.employeeGrowth12m,
    headcountTotal: record.headcountTotal,
    totalInvestmentUsd: record.totalInvestmentUsd,
    yearFounded: record.yearFounded,
    industry: record.industry,
    lastUpdated: record.lastUpdated,
  };
}
