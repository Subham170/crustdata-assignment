import { z } from 'zod';
import { asyncHandler, notFound, validationError } from '../middlewares/errorHandler.js';
import { getResumeRelativePath } from '../middlewares/upload.js';
import {
  createCandidate,
  formatCandidateResponse,
  getCandidateById,
} from '../services/candidateService.js';
import { analyzeCandidate as runCandidateAnalysis } from '../services/analysisOrchestrator.js';

const linkedinUrlSchema = z
  .string()
  .url('linkedinUrl must be a valid URL')
  .optional()
  .or(z.literal(''));

export const uploadCandidate = asyncHandler(async (req, res) => {
  const linkedinResult = linkedinUrlSchema.safeParse(req.body.linkedinUrl ?? '');

  if (!linkedinResult.success) {
    throw validationError(
      linkedinResult.error.errors.map((err) => ({
        path: err.path.join('.'),
        message: err.message,
      }))
    );
  }

  const linkedinUrl = linkedinResult.data || null;
  const resumeUrl = getResumeRelativePath(req.file.filename);

  const candidate = await createCandidate({ resumeUrl, linkedinUrl });

  res.status(201).json({
    candidateId: candidate.id,
    status: candidate.status.toLowerCase(),
  });
});

export const analyzeCandidate = asyncHandler(async (req, res) => {
  const result = await runCandidateAnalysis(req.body.candidateId);
  res.json(result);
});

export const getCandidate = asyncHandler(async (req, res) => {
  const candidate = await getCandidateById(req.params.id);

  if (!candidate) {
    throw notFound('Candidate not found');
  }

  res.json(formatCandidateResponse(candidate));
});
