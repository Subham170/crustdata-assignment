import { getResumeAbsolutePath } from '../middlewares/upload.js';
import { notFound, unprocessableEntity } from '../middlewares/errorHandler.js';
import { parseResumeFile } from './resumeParserService.js';
import {
  getCandidateById,
  persistParsedResume,
  updateCandidateStatus,
} from './candidateService.js';
import {
  formatEmployerGrowth,
  linkExperiencesToGrowth,
  resolveEmployersBatch,
} from './growthAnalysisService.js';

/**
 * Parse resume, enrich employers via Crustdata, and link experiences.
 * @param {string} candidateId
 */
export async function analyzeCandidate(candidateId) {
  const existing = await getCandidateById(candidateId);

  if (!existing) {
    throw notFound('Candidate not found');
  }

  await updateCandidateStatus(candidateId, 'PARSING');

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
    await updateCandidateStatus(candidateId, 'UPLOADED');

    const refreshed = await getCandidateById(candidateId);

    return {
      candidateId,
      status: refreshed.status.toLowerCase(),
      name: refreshed.name,
      email: refreshed.email,
      experiences: refreshed.experiences.map((exp) => ({
        id: exp.id,
        companyName: exp.companyName,
        role: exp.role,
        startDate: exp.startDate,
        endDate: exp.endDate,
        crustdataCompanyId: exp.crustdataCompanyId,
        companyGrowthId: exp.companyGrowthId,
        companyGrowth: exp.companyGrowth ? formatEmployerGrowth(exp.companyGrowth) : null,
      })),
      employers: resolved.map(formatEmployerGrowth),
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error) {
    if (error.statusCode === 422 || error.statusCode === 503) {
      throw error;
    }
    await updateCandidateStatus(candidateId, 'FAILED');
    throw error;
  }
}
