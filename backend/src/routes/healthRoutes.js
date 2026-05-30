import { Router } from 'express';
import { asyncHandler } from '../middlewares/errorHandler.js';
import { checkDbHealth } from '../config/db.js';
import { checkRedisHealth } from '../config/redis.js';

const router = Router();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const [db, redis] = await Promise.all([checkDbHealth(), checkRedisHealth()]);

    const isHealthy = db.status === 'connected';
    const statusCode = isHealthy ? 200 : 503;

    res.status(statusCode).json({
      status: isHealthy ? 'ok' : 'degraded',
      db,
      redis,
      timestamp: new Date().toISOString(),
    });
  })
);

export default router;
