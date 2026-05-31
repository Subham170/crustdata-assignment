import { badRequest, notFound } from '../middlewares/errorHandler.js';
import { getCandidateById } from './candidateService.js';
import {
  buildFallbackComparisonRecommendation,
  generateComparisonRecommendation,
} from './llmService.js';
import { monthsBetween } from '../utils/dateUtils.js';

/**
 * @param {string} candidate1Id
 * @param {string} candidate2Id
 */
export async function compareCandidates(candidate1Id, candidate2Id) {
  const [candidate1, candidate2] = await Promise.all([
    getCandidateById(candidate1Id),
    getCandidateById(candidate2Id),
  ]);

  if (!candidate1) {
    throw notFound('Candidate 1 not found');
  }
  if (!candidate2) {
    throw notFound('Candidate 2 not found');
  }

  const [report1] = candidate1.growthReports;
  const [report2] = candidate2.growthReports;

  if (!report1 || !report2) {
    throw badRequest('Both candidates must be analyzed before comparison');
  }

  const profile1 = buildComparisonProfile(candidate1, report1);
  const profile2 = buildComparisonProfile(candidate2, report2);
  const winner = pickWinner(profile1, profile2);

  const recommendation = await generateComparisonRecommendation({
    winner,
    candidate1: profile1,
    candidate2: profile2,
  });

  return {
    winner,
    comparison: {
      candidate1: profile1,
      candidate2: profile2,
      recommendation:
        recommendation ||
        buildFallbackComparisonRecommendation({
          winner,
          candidate1: profile1,
          candidate2: profile2,
        }),
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

export function pickWinner(profile1, profile2) {
  if (profile1.growthScore !== profile2.growthScore) {
    return profile1.growthScore > profile2.growthScore ? 'candidate1' : 'candidate2';
  }

  const g1 = profile1.avgEmployerGrowth6m ?? 0;
  const g2 = profile2.avgEmployerGrowth6m ?? 0;

  if (g1 !== g2) {
    return g1 > g2 ? 'candidate1' : 'candidate2';
  }

  return profile1.careerStabilityMonths >= profile2.careerStabilityMonths
    ? 'candidate1'
    : 'candidate2';
}

function inferReadiness(growthScore) {
  if (growthScore >= 61) return 'high';
  if (growthScore >= 31) return 'moderate';
  return 'low';
}

function round(value) {
  return Math.round(value * 100) / 100;
}
