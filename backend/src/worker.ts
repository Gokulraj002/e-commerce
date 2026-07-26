/**
 * Elite NonVeg BullMQ worker process.
 *
 * Runs independently of the HTTP API (see `server.ts`) — same codebase,
 * same env, different PM2 process. Importing `./config/env.js` triggers
 * the zod validation at boot so a misconfigured worker fails fast rather
 * than silently dropping jobs.
 *
 * Scripts:
 *   • `npm run worker`       — dev, tsx watch
 *   • `npm run worker:start` — prod, runs the compiled dist entry
 */
import { env } from './config/env.js';
import { startWorkers } from './jobs/index.js';
import { logger } from './lib/logger.js';

async function main(): Promise<void> {
  logger.info({ env: env.NODE_ENV }, '🍗 Elite NonVeg worker starting');

  const workers = await startWorkers();

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'worker: shutting down — draining in-flight jobs');
    await Promise.all(workers.map((w) => w.close()));
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  logger.info({ workers: workers.length }, 'worker: ready');
}

main().catch((err: unknown) => {
  logger.error({ err }, 'worker: fatal boot error');
  process.exit(1);
});
