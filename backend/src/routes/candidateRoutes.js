import { Router } from 'express';
import { z } from 'zod';
import {
  uploadCandidate,
  getCandidate,
  analyzeCandidate,
  compareCandidate,
  listCandidatesHandler,
  updateCandidateHandler,
  deleteCandidateHandler,
} from '../controllers/candidateController.js';
import { handleResumeUpload } from '../middlewares/upload.js';
import { validateBody, validateParams } from '../middlewares/validateRequest.js';
import { analyzeRateLimiter } from '../middlewares/rateLimiter.js';

const router = Router();

const candidateIdSchema = z.object({
  id: z.string().uuid('Invalid candidate ID'),
});

const analyzeBodySchema = z.object({
  candidateId: z.string().uuid('candidateId must be a valid UUID'),
});

const compareBodySchema = z
  .object({
    candidate1: z.string().uuid('candidate1 must be a valid UUID'),
    candidate2: z.string().uuid('candidate2 must be a valid UUID'),
  })
  .refine((data) => data.candidate1 !== data.candidate2, {
    message: 'candidate1 and candidate2 must be different',
    path: ['candidate2'],
  });

router.post('/upload', handleResumeUpload, uploadCandidate);
router.post('/analyze', analyzeRateLimiter, validateBody(analyzeBodySchema), analyzeCandidate);
router.post('/compare', validateBody(compareBodySchema), compareCandidate);
const updateBodySchema = z.object({
  name: z.string().max(120).optional(),
  email: z.string().email().optional().or(z.literal('')),
  linkedinUrl: z
    .string()
    .url()
    .optional()
    .or(z.literal('')),
});

router.get('/', listCandidatesHandler);
router.get('/:id', validateParams(candidateIdSchema), getCandidate);
router.patch(
  '/:id',
  validateParams(candidateIdSchema),
  validateBody(updateBodySchema),
  updateCandidateHandler
);
router.delete('/:id', validateParams(candidateIdSchema), deleteCandidateHandler);

export default router;
