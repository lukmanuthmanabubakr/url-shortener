import express from 'express';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';

const app = express();
const logger = pinoHttp();

app.use(logger);
app.use(express.json());

app.get('/health', async (_req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
  });
});

app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`API listening on port ${env.PORT}`);
});
