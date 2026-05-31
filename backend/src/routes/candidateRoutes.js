import { Router } from 'express';
import { z } from 'zod';
import {
  uploadCandidate,
  getCandidate,
  analyzeCandidate,
} from '../controllers/candidateController.js';
import { handleResumeUpload } from '../middlewares/upload.js';
import { validateBody, validateParams } from '../middlewares/validateRequest.js';

const router = Router();

const candidateIdSchema = z.object({
  id: z.string().uuid('Invalid candidate ID'),
});

const analyzeBodySchema = z.object({
  candidateId: z.string().uuid('candidateId must be a valid UUID'),
});

router.post('/upload', handleResumeUpload, uploadCandidate);
router.post('/analyze', validateBody(analyzeBodySchema), analyzeCandidate);
router.get('/:id', validateParams(candidateIdSchema), getCandidate);

export default router;
