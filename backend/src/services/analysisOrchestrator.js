import { getResumeAbsolutePath } from '../middlewares/upload.js';
import { notFound, unprocessableEntity } from '../middlewares/errorHandler.js';
import { parseResumeFile } from './resumeParserService.js';
import {
  getCandidateById,
  persistParsedResume,
  updateCandidateStatus,
} from './candidateService.js';

/**
 * Phase 3: parse resume and persist experiences (enrichment/scoring in later phases).
 * @param {string} candidateId
 */
export async function parseAndPersistCandidate(candidateId) {
  const candidate = await getCandidateById(candidateId);

  if (!candidate) {
    throw notFound('Candidate not found');
  }

  await updateCandidateStatus(candidateId, 'PARSING');

  try {
    const filePath = getResumeAbsolutePath(candidate.resumeUrl);
    const parsed = await parseResumeFile(filePath);

    if (!parsed.experiences.length) {
      await updateCandidateStatus(candidateId, 'FAILED');
      throw unprocessableEntity('Could not extract work history from resume');
    }

    const saved = await persistParsedResume(candidateId, parsed);

    return {
      candidateId,
      status: saved.status.toLowerCase(),
      name: saved.name,
      email: saved.email,
      experiences: saved.experiences.map((exp) => ({
        id: exp.id,
        companyName: exp.companyName,
        role: exp.role,
        startDate: exp.startDate,
        endDate: exp.endDate,
      })),
    };
  } catch (error) {
    if (error.statusCode === 422) {
      throw error;
    }
    await updateCandidateStatus(candidateId, 'FAILED');
    throw error;
  }
}
