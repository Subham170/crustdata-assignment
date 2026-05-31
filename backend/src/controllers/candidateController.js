import { z } from 'zod';
import { asyncHandler, notFound, validationError } from '../middlewares/errorHandler.js';
import { getResumeAbsolutePath, getResumeRelativePath } from '../middlewares/upload.js';
import { sanitizeUrl } from '../utils/sanitize.js';
import {
  createCandidate,
  deleteCandidate,
  formatCandidateResponse,
  getCandidateById,
  listCandidates,
  updateCandidate,
  updateCandidateProfile,
} from '../services/candidateService.js';
import { previewResumeFromFile } from '../services/resumeParserService.js';
import { analyzeCandidate as runCandidateAnalysis } from '../services/analysisOrchestrator.js';
import { compareCandidates } from '../services/comparisonService.js';

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

  const linkedinUrl = sanitizeUrl(linkedinResult.data || '');
  const resumeUrl = getResumeRelativePath(req.file.filename);

  const candidate = await createCandidate({ resumeUrl, linkedinUrl });

  let name = null;
  let email = null;

  try {
    const preview = await previewResumeFromFile(getResumeAbsolutePath(resumeUrl));
    name = preview.name;
    email = preview.email;

    if (name || email) {
      await updateCandidateProfile(candidate.id, { name, email });
    }
  } catch {
    // Upload still succeeds if preview parse fails; analyze will retry parsing.
  }

  res.status(201).json({
    candidateId: candidate.id,
    status: candidate.status.toLowerCase(),
    name,
    email,
  });
});

export const analyzeCandidate = asyncHandler(async (req, res) => {
  const result = await runCandidateAnalysis(req.body.candidateId);
  res.json(result);
});

export const compareCandidate = asyncHandler(async (req, res) => {
  const result = await compareCandidates(req.body.candidateIds);
  res.json(result);
});

export const listCandidatesHandler = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 200);
  const candidates = await listCandidates(limit);
  res.json({ candidates });
});

export const updateCandidateHandler = asyncHandler(async (req, res) => {
  const existing = await getCandidateById(req.params.id);
  if (!existing) {
    throw notFound('Candidate not found');
  }

  const body = req.body ?? {};
  const linkedinUrl =
    body.linkedinUrl !== undefined ? sanitizeUrl(body.linkedinUrl || '') : undefined;

  const updated = await updateCandidate(req.params.id, {
    name: body.name,
    email: body.email === '' ? null : body.email,
    linkedinUrl,
  });

  res.json({
    candidate: {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      linkedinUrl: updated.linkedinUrl,
      status: updated.status.toLowerCase(),
      updatedAt: updated.updatedAt,
    },
  });
});

export const deleteCandidateHandler = asyncHandler(async (req, res) => {
  const deleted = await deleteCandidate(req.params.id);

  if (!deleted) {
    throw notFound('Candidate not found');
  }

  res.json({ success: true, candidateId: deleted.id });
});

export const getCandidate = asyncHandler(async (req, res) => {
  const candidate = await getCandidateById(req.params.id);

  if (!candidate) {
    throw notFound('Candidate not found');
  }

  res.json(formatCandidateResponse(candidate));
});
