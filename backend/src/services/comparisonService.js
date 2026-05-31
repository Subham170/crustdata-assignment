import { badRequest, notFound } from '../middlewares/errorHandler.js';
import { getCandidateById } from './candidateService.js';
import {
  buildFallbackComparisonRecommendation,
  generateComparisonRecommendation,
} from './llmService.js';
import { monthsBetween } from '../utils/dateUtils.js';

export const MIN_COMPARE_CANDIDATES = 2;
export const MAX_COMPARE_CANDIDATES = 10;

/**
 * @param {string[]} candidateIds 2–10 unique UUIDs
 */
export async function compareCandidates(candidateIds) {
  const uniqueIds = [...new Set(candidateIds)];

  if (uniqueIds.length < MIN_COMPARE_CANDIDATES) {
    throw badRequest(`Select at least ${MIN_COMPARE_CANDIDATES} candidates to compare`);
  }
  if (uniqueIds.length > MAX_COMPARE_CANDIDATES) {
    throw badRequest(`You can compare at most ${MAX_COMPARE_CANDIDATES} candidates`);
  }
  if (uniqueIds.length !== candidateIds.length) {
    throw badRequest('Duplicate candidate IDs are not allowed');
  }

  const candidates = await Promise.all(uniqueIds.map((id) => getCandidateById(id)));

  for (let i = 0; i < uniqueIds.length; i++) {
    if (!candidates[i]) {
      throw notFound(`Candidate not found: ${uniqueIds[i]}`);
    }
    const [report] = candidates[i].growthReports;
    if (!report) {
      throw badRequest(
        `All candidates must be analyzed before comparison (${candidates[i].name ?? uniqueIds[i]} is not completed)`
      );
    }
  }

  const profiles = candidates.map((candidate) => {
    const [report] = candidate.growthReports;
    return buildComparisonProfile(candidate, report);
  });

  const ranked = rankProfiles(profiles).map((profile, index) => ({
    ...profile,
    rank: index + 1,
  }));

  const winnerId = ranked[0].id;

  const recommendation = await generateComparisonRecommendation({
    winnerId,
    ranked,
    candidateCount: ranked.length,
  });

  const recommendationText =
    recommendation ||
    buildFallbackComparisonRecommendation({
      winnerId,
      ranked,
    });

  return {
    winnerId,
    comparison: {
      recommendation: recommendationText,
      candidates: ranked,
    },
  };
}

function buildComparisonProfile(candidate, report) {
  const employerScores = Array.isArray(report.employerScores) ? report.employerScores : [];
  const signals = report.signals ?? {};

  const growth6mValues = employerScores
    .map((item) => item.employeeGrowth6m)
    .filter((value) => value != null);

  const avgEmployerGrowth6m =
    growth6mValues.length > 0
      ? round(
          growth6mValues.reduce((sum, value) => sum + value, 0) / growth6mValues.length
        )
      : null;

  const tenureMonths = candidate.experiences.map((exp) =>
    monthsBetween(exp.startDate, exp.endDate)
  );
  const careerStabilityMonths =
    tenureMonths.length > 0
      ? round(tenureMonths.reduce((sum, value) => sum + value, 0) / tenureMonths.length)
      : 0;

  return {
    id: candidate.id,
    name: candidate.name,
    growthScore: report.growthScore,
    scoreBand: report.scoreBand,
    avgEmployerGrowth6m,
    startupReadiness: signals.startupReadiness ?? inferReadiness(report.growthScore),
    enterpriseReadiness: signals.enterpriseReadiness ?? 'moderate',
    careerStabilityMonths,
    employerCount: employerScores.length,
  };
}

/**
 * @param {Array<{ growthScore: number, avgEmployerGrowth6m?: number | null, careerStabilityMonths?: number }>} profiles
 */
export function rankProfiles(profiles) {
  return [...profiles].sort(compareProfiles);
}

export function compareProfiles(a, b) {
  if (b.growthScore !== a.growthScore) {
    return b.growthScore - a.growthScore;
  }

  const g1 = b.avgEmployerGrowth6m ?? 0;
  const g2 = a.avgEmployerGrowth6m ?? 0;
  if (g1 !== g2) return g1 - g2;

  return (b.careerStabilityMonths ?? 0) - (a.careerStabilityMonths ?? 0);
}

/** @deprecated Use rankProfiles; kept for tests */
export function pickWinner(profile1, profile2) {
  const ranked = rankProfiles([profile1, profile2]);
  return ranked[0] === profile1 ? 'candidate1' : 'candidate2';
}

function inferReadiness(growthScore) {
  if (growthScore >= 61) return 'high';
  if (growthScore >= 31) return 'moderate';
  return 'low';
}

function round(value) {
  return Math.round(value * 100) / 100;
}
