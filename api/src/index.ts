import express from 'express';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { prisma } from './lib/prisma';
import { redis } from './lib/redis';
import { startPoolMonitor } from './services/keyPool';

const app = express();
const logger = pinoHttp();

app.use(logger);
app.use(express.json());

app.get('/health', async (_req, res) => {
  const health: {
    status: string;
    db: string;
    redis: string;
    version: string;
  } = {
    status: 'ok',
    db: 'disconnected',
    redis: 'disconnected',
    version: '1.0.0',
  };

  let isHealthy = true;

  try {
    await prisma.$queryRaw`SELECT 1`;
    health.db = 'connected';
  } catch {
    health.db = 'disconnected';
    isHealthy = false;
  }

  try {
    await redis.ping();
    health.redis = 'connected';
  } catch {
    health.redis = 'disconnected';
    isHealthy = false;
  }

  health.status = isHealthy ? 'ok' : 'degraded';

  res.status(isHealthy ? 200 : 503).json(health);
});

app.use(errorHandler);

// eslint-disable-next-line no-console
app.listen(env.PORT, async () => {
  console.log(`API listening on port ${env.PORT}`);
  await startPoolMonitor();
});
