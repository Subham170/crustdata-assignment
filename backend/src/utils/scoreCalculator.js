import { monthsBetween } from './dateUtils.js';

const WEIGHTS = {
  growth6m: 0.35,
  growth12m: 0.25,
  funding: 0.15,
  tenure: 0.25,
};

/**
 * Clamp a value into a 0–100 score using min/max bounds.
 * @param {number | null | undefined} value
 * @param {number} min
 * @param {number} max
 */
export function normalize(value, min, max) {
  if (value == null || Number.isNaN(value)) return 0;
  if (max <= min) return 0;

  const ratio = (value - min) / (max - min);
  return Math.round(Math.max(0, Math.min(1, ratio)) * 100);
}

/**
 * Log-scale funding score ($1M → ~60, $10B → ~100).
 * @param {number | null | undefined} totalInvestmentUsd
 */
export function normalizeFunding(totalInvestmentUsd) {
  if (totalInvestmentUsd == null || totalInvestmentUsd <= 0) return 0;
  const logValue = Math.log10(totalInvestmentUsd);
  return normalize(logValue, 6, 10);
}

/**
 * Tenure contribution capped at 48 months.
 * @param {number} months
 */
export function tenureScore(months) {
  return normalize(months, 0, 48);
}

/**
 * @param {number} score 0–100
 */
export function getScoreBand(score) {
  if (score <= 30) return 'stable';
  if (score <= 60) return 'moderate';
  if (score <= 80) return 'fast';
  return 'hypergrowth';
}

/**
 * @param {{ employeeGrowth6m?: number | null, employeeGrowth12m?: number | null, totalInvestmentUsd?: number | null }} growth
 * @param {number} durationMonths
 */
export function computeEmployerScore(growth, durationMonths) {
  const growth6mScore = normalize(growth.employeeGrowth6m ?? 0, 0, 50);
  const growth12mScore = normalize(growth.employeeGrowth12m ?? 0, 0, 80);
  const fundingScore = normalizeFunding(growth.totalInvestmentUsd);
  const tenure = tenureScore(durationMonths);

  return Math.round(
    growth6mScore * WEIGHTS.growth6m +
      growth12mScore * WEIGHTS.growth12m +
      fundingScore * WEIGHTS.funding +
      tenure * WEIGHTS.tenure
  );
}

/**
 * @param {Array<{ companyName: string, role?: string | null, startDate?: Date | null, endDate?: Date | null, companyGrowth?: object | null }>} experiences
 */
export function computeEmployerScores(experiences) {
  return experiences
    .filter((exp) => exp.companyGrowth)
    .map((exp) => {
      const growth = exp.companyGrowth;
      const durationMonths = monthsBetween(exp.startDate, exp.endDate);
      const employerScore = computeEmployerScore(
        {
          employeeGrowth6m: growth.employeeGrowth6m,
          employeeGrowth12m: growth.employeeGrowth12m,
          totalInvestmentUsd: growth.totalInvestmentUsd,
        },
        durationMonths
      );

      return {
        experienceId: exp.id,
        companyName: exp.companyName,
        role: exp.role ?? null,
        durationMonths,
        employeeGrowth6m: growth.employeeGrowth6m,
        employeeGrowth12m: growth.employeeGrowth12m,
        headcountTotal: growth.headcountTotal,
        totalInvestmentUsd: growth.totalInvestmentUsd,
        employerScore,
      };
    });
}

/**
 * @param {Array<{ employerScore: number, durationMonths: number }>} employerScores
 */
export function computeAggregateScore(employerScores) {
  if (!employerScores.length) return 0;

  const totalTenure = employerScores.reduce((sum, item) => sum + item.durationMonths, 0);

  if (totalTenure <= 0) {
    const avg =
      employerScores.reduce((sum, item) => sum + item.employerScore, 0) / employerScores.length;
    return Math.round(avg);
  }

  const weighted = employerScores.reduce(
    (sum, item) => sum + item.employerScore * item.durationMonths,
    0
  );

  return Math.round(weighted / totalTenure);
}
