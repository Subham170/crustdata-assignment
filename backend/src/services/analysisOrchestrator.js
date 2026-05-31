import { getResumeAbsolutePath } from '../middlewares/upload.js';
import { notFound, unprocessableEntity } from '../middlewares/errorHandler.js';
import { logger } from '../config/logger.js';
import { parseResumeFile } from './resumeParserService.js';
import {
  getCandidateById,
  persistParsedResume,
  saveGrowthReport,
  updateCandidateStatus,
} from './candidateService.js';
import {
  formatEmployerGrowth,
  linkExperiencesToGrowth,
  resolveEmployersBatch,
} from './growthAnalysisService.js';
import { generateInsights } from './llmService.js';
import {
  computeEmployerScores,
  computeAggregateScore,
  getScoreBand,
} from '../utils/scoreCalculator.js';

/**
 * Parse resume, enrich employers, compute score, generate AI insights, save report.
 * @param {string} candidateId
 */
export async function analyzeCandidate(candidateId) {
  const existing = await getCandidateById(candidateId);

  if (!existing) {
    throw notFound('Candidate not found');
  }

  await updateCandidateStatus(candidateId, 'PARSING');
  logger.info({ candidateId }, 'Starting candidate analysis');

  try {
    const filePath = getResumeAbsolutePath(existing.resumeUrl);
    const parsed = await parseResumeFile(filePath);

    if (!parsed.experiences.length) {
      await updateCandidateStatus(candidateId, 'FAILED');
      throw unprocessableEntity('Could not extract work history from resume');
    }

    const saved = await persistParsedResume(candidateId, parsed);

    await updateCandidateStatus(candidateId, 'ANALYZING');

    const companyNames = saved.experiences.map((exp) => exp.companyName);
    const { resolved, warnings } = await resolveEmployersBatch(companyNames);

    await linkExperiencesToGrowth(saved.experiences, resolved);

    const refreshed = await getCandidateById(candidateId);
    const employerScores = computeEmployerScores(refreshed.experiences);
    const growthScore = computeAggregateScore(employerScores);
    const scoreBand = getScoreBand(growthScore);

    const insights = await generateInsights({
      name: refreshed.name,
      growthScore,
      scoreBand,
      employerScores,
      warnings,
    });

    await saveGrowthReport(candidateId, {
      growthScore,
      scoreBand,
      employerScores,
      aiSummary: insights.summary,
      signals: insights.signals,
    });

    const completed = await getCandidateById(candidateId);
    const [report] = completed.growthReports;

    logger.info(
      { candidateId, growthScore, scoreBand, resolved: resolved.length, warnings: warnings.length },
      'Candidate analysis completed'
    );

    return buildAnalyzeResponse({
      completed,
      report,
      growthScore,
      scoreBand,
      summary: insights.summary,
      signals: insights.signals,
      employerScores,
      warnings,
    });
  } catch (error) {
    if (error.statusCode === 422 || error.statusCode === 503) {
      throw error;
    }
    logger.error({ candidateId, err: error.message }, 'Candidate analysis failed');
    await updateCandidateStatus(candidateId, 'FAILED');
    throw error;
  }
}

function buildAnalyzeResponse({
  completed,
  report,
  growthScore,
  scoreBand,
  summary,
  signals,
  employerScores,
  warnings,
}) {
  return {
    candidateId: completed.id,
    status: completed.status.toLowerCase(),
    name: completed.name,
    email: completed.email,
    growthScore,
    scoreBand,
    summary,
    signals,
    experiences: completed.experiences.map((exp) => ({
      id: exp.id,
      companyName: exp.companyName,
      role: exp.role,
      startDate: exp.startDate,
      endDate: exp.endDate,
      crustdataCompanyId: exp.crustdataCompanyId,
      companyGrowthId: exp.companyGrowthId,
      companyGrowth: exp.companyGrowth ? formatEmployerGrowth(exp.companyGrowth) : null,
    })),
    employers: employerScores.map((item) => ({
      companyName: item.companyName,
      role: item.role,
      durationMonths: item.durationMonths,
      employeeGrowth6m: item.employeeGrowth6m,
      employeeGrowth12m: item.employeeGrowth12m,
      headcountTotal: item.headcountTotal,
      employerScore: item.employerScore,
    })),
    report: report
      ? {
          id: report.id,
          growthScore: report.growthScore,
          scoreBand: report.scoreBand,
          aiSummary: report.aiSummary,
          signals: report.signals,
          employerScores: report.employerScores,
          createdAt: report.createdAt,
        }
      : null,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}
