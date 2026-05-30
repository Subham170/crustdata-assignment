import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { connectDb, disconnectDb } from './config/db.js';
import { disconnectRedis } from './config/redis.js';
import { errorHandler, notFound } from './middlewares/errorHandler.js';
import healthRoutes from './routes/healthRoutes.js';
import candidateRoutes from './routes/candidateRoutes.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (_req, res) => {
  res.json({
    name: 'GrowthLens AI API',
    version: '0.1.0',
    health: '/api/health',
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
    console.log(`GrowthLens API running on http://localhost:${env.PORT}`);
    console.log(`Health check: http://localhost:${env.PORT}/api/health`);
  });
}

async function shutdown() {
  await disconnectDb();
  await disconnectRedis();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start().catch((error) => {
  console.error('Failed to start server:', error.message);
  process.exit(1);
});

export default app;
