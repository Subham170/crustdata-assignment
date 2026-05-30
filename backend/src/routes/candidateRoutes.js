import { Router } from 'express';
import { z } from 'zod';
import { uploadCandidate, getCandidate } from '../controllers/candidateController.js';
import { handleResumeUpload } from '../middlewares/upload.js';
import { validateParams } from '../middlewares/validateRequest.js';

const router = Router();

const candidateIdSchema = z.object({
  id: z.string().uuid('Invalid candidate ID'),
});

router.post('/upload', handleResumeUpload, uploadCandidate);
router.get('/:id', validateParams(candidateIdSchema), getCandidate);

export default router;
