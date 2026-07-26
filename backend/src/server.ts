import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`🍗 Elite NonVeg API running on http://localhost:${env.PORT}${env.API_PREFIX}`);
});

const shutdown = (signal: string) => {
  logger.info(`${signal} received — shutting down`);
  server.close(() => process.exit(0));
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
