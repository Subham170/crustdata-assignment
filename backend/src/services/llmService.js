import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

const insightsSchema = z.object({
  summary: z.string().min(1),
  signals: z.object({
    growthExposureSummary: z.string().min(1),
    startupReadiness: z.enum(['low', 'moderate', 'high']),
    enterpriseReadiness: z.enum(['low', 'moderate', 'high']),
    scalingExperience: z.enum(['weak', 'moderate', 'strong']),
    hiringSignals: z.array(z.string()).min(1),
  }),
});

const INSIGHTS_PROMPT = `You are a recruiter assistant for GrowthLens AI.
Analyze the candidate's employer growth exposure using ONLY the JSON data provided.
Return JSON only:
{
  "summary": "2-3 sentence hiring summary",
  "signals": {
    "growthExposureSummary": "1 sentence on growth exposure pattern",
    "startupReadiness": "low" | "moderate" | "high",
    "enterpriseReadiness": "low" | "moderate" | "high",
    "scalingExperience": "weak" | "moderate" | "strong",
    "hiringSignals": ["3-5 concise bullet strings grounded in metrics"]
  }
}
Be concise, data-grounded, and do not invent employers or metrics.`;

/**
 * @param {{
 *   name: string | null,
 *   growthScore: number,
 *   scoreBand: string,
 *   employerScores: Array<object>,
 *   warnings?: string[]
 * }} payload
 */
export async function generateInsights(payload) {
  try {
    const llmResult = await callGeminiInsights(payload);
    if (llmResult) return llmResult;
  } catch (error) {
    logger.warn({ err: error.message }, 'LLM insights failed, using fallback');
  }

  return buildFallbackInsights(payload);
}

async function callGeminiInsights(payload) {
  if (!env.GEMINI_API_KEY) return null;

  const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: env.GEMINI_MODEL,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.2,
    },
  });

  const result = await model.generateContent(
    `${INSIGHTS_PROMPT}\n\n---\n\n${JSON.stringify(payload).slice(0, 12000)}`
  );

  const parsed = insightsSchema.safeParse(JSON.parse(result.response.text()));
  if (!parsed.success) return null;

  return {
    summary: parsed.data.summary.trim(),
    signals: {
      growthExposureSummary: parsed.data.signals.growthExposureSummary.trim(),
      startupReadiness: parsed.data.signals.startupReadiness,
      enterpriseReadiness: parsed.data.signals.enterpriseReadiness,
      scalingExperience: parsed.data.signals.scalingExperience,
      hiringSignals: parsed.data.signals.hiringSignals.map((s) => s.trim()),
    },
  };
}

/**
 * @param {{
 *   name: string | null,
 *   growthScore: number,
 *   scoreBand: string,
 *   employerScores: Array<{ companyName: string, employerScore?: number, employeeGrowth6m?: number | null, employeeGrowth12m?: number | null, durationMonths?: number }>,
 *   warnings?: string[]
 * }} payload
 */
export function buildFallbackInsights(payload) {
  const topEmployers = [...(payload.employerScores ?? [])]
    .sort((a, b) => (b.employerScore ?? 0) - (a.employerScore ?? 0))
    .slice(0, 2);

  const topNames = topEmployers.map((e) => e.companyName).join(' and ') || 'their employers';
  const topGrowth = topEmployers[0]?.employeeGrowth12m;
  const growthNote =
    topGrowth != null ? `${topGrowth.toFixed(1)}% YoY headcount growth at ${topEmployers[0].companyName}` : 'limited public growth data';

  const readiness =
    payload.growthScore >= 61 ? 'high' : payload.growthScore >= 31 ? 'moderate' : 'low';

  return {
    summary: `${payload.name ?? 'This candidate'} shows ${payload.scoreBand} growth exposure with an overall score of ${payload.growthScore}/100, driven primarily by tenure at ${topNames}.`,
    signals: {
      growthExposureSummary: `Growth Exposure Score is ${payload.growthScore} (${payload.scoreBand}), with notable exposure via ${topNames}.`,
      startupReadiness: readiness,
      enterpriseReadiness: payload.growthScore >= 45 ? 'moderate' : 'low',
      scalingExperience:
        payload.growthScore >= 81 ? 'strong' : payload.growthScore >= 61 ? 'moderate' : 'weak',
      hiringSignals: [
        `Overall growth exposure: ${payload.scoreBand} (${payload.growthScore}/100)`,
        growthNote,
        topEmployers.length > 1
          ? `Multiple employers scored: ${topEmployers.map((e) => e.companyName).join(', ')}`
          : `Primary employer signal: ${topNames}`,
        ...(payload.warnings?.length ? [`Note: ${payload.warnings[0]}`] : []),
      ],
    },
  };
}

const COMPARE_PROMPT = `Compare candidates for hiring based on growth exposure JSON (ranked list).
Return JSON only:
{
  "recommendation": "2-4 sentences: who is the top hire, how runners-up compare, grounded in scores/metrics"
}
Use only provided metrics. Mention the winner by name.`;

/**
 * @param {object} comparisonPayload
 */
export async function generateComparisonRecommendation(comparisonPayload) {
  try {
    if (!env.GEMINI_API_KEY) {
      return buildFallbackComparisonRecommendation(comparisonPayload);
    }

    const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: env.GEMINI_MODEL,
      generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
    });

    const result = await model.generateContent(
      `${COMPARE_PROMPT}\n\n---\n\n${JSON.stringify(comparisonPayload).slice(0, 8000)}`
    );

    const parsed = z
      .object({ recommendation: z.string().min(1) })
      .safeParse(JSON.parse(result.response.text()));

    if (parsed.success) return parsed.data.recommendation.trim();
  } catch (error) {
    logger.warn({ err: error.message }, 'LLM comparison failed, using fallback');
  }

  return buildFallbackComparisonRecommendation(comparisonPayload);
}

export function buildFallbackComparisonRecommendation({ winnerId, ranked }) {
  const [top, ...rest] = ranked ?? [];
  if (!top) return 'No candidates to compare.';

  const topName = top.name ?? 'The top candidate';
  if (!rest.length) {
    return `${topName} is the recommended hire with a Growth Exposure Score of ${top.growthScore} (${top.scoreBand}).`;
  }

  const others = rest
    .map((c) => `${c.name ?? 'Unnamed'} (${c.growthScore}, ${c.scoreBand})`)
    .join('; ');

  return `${topName} is the recommended hire with a Growth Exposure Score of ${top.growthScore} (${top.scoreBand}), ahead of ${others}, based on greater exposure to high-growth employers.`;
}
