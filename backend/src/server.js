import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { connectDb, disconnectDb } from './config/db.js';
import { disconnectRedis } from './config/redis.js';
import { errorHandler, notFound } from './middlewares/errorHandler.js';
import { requestLogger } from './middlewares/requestLogger.js';
import { apiRateLimiter } from './middlewares/rateLimiter.js';
import healthRoutes from './routes/healthRoutes.js';
import candidateRoutes from './routes/candidateRoutes.js';

const app = express();

app.use(cors());
app.use(requestLogger);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use('/api', apiRateLimiter);

app.get('/', (_req, res) => {
  res.json({
    name: 'GrowthLens AI API',
    version: '0.1.0',
    health: '/api/health',
    endpoints: {
      listCandidates: 'GET /api/candidates',
      updateCandidate: 'PATCH /api/candidates/:id',
      deleteCandidate: 'DELETE /api/candidates/:id',
      upload: 'POST /api/candidates/upload',
      analyze: 'POST /api/candidates/analyze',
      compare: 'POST /api/candidates/compare',
      getCandidate: 'GET /api/candidates/:id',
    },
  });
});

app.use('/api/health', healthRoutes);
app.use('/api/candidates', candidateRoutes);

app.use((_req, _res, next) => {
  next(notFound('Route not found'));
});

app.use(errorHandler);

async function start() {
  await connectDb();

  app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'GrowthLens API started');
    logger.info(`Health check: http://localhost:${env.PORT}/api/health`);
  });
}

async function shutdown() {
  logger.info('Shutting down GrowthLens API');
  await disconnectDb();
  await disconnectRedis();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start().catch((error) => {
  logger.error({ err: error.message }, 'Failed to start server');
  process.exit(1);
});

export default app;
