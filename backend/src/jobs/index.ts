/**
 * Worker composition point.
 *
 * `startWorkers()` boots every BullMQ Worker in this monorepo AND registers
 * every repeatable schedule (idempotent). It is called by `src/worker.ts`,
 * which runs as a **separate** PM2 process from the HTTP API server — a
 * crashing worker must never take the API down with it.
 *
 * Adding a new worker? Import its `start…Worker()` here and push the
 * returned Worker onto the array. Adding a new schedule? Register it in
 * `schedules/index.ts`; nothing to change here.
 */
import { Worker } from 'bullmq';

import { logger } from '../lib/logger.js';
import { QUEUES, queueConnection } from '../lib/queue.js';

import { registerDeliveryAssignScheduler } from './deliveryAssign.scheduler.js';
import { startDeliveryAssignWorker } from './deliveryAssign.worker.js';
import { startNotificationWorker } from './notification.worker.js';
import { createScheduleProcessor, registerSchedules } from './schedules/index.js';

/** Concurrency for the schedule processor — its handlers are DB-bound, keep it low. */
const SCHEDULE_WORKER_CONCURRENCY = 2;

/**
 * Start every BullMQ Worker and register every repeatable schedule.
 * Returns the list of live Workers so the caller can `close()` them on
 * graceful shutdown.
 */
export async function startWorkers(): Promise<Worker[]> {
  // 1. Register all repeatable schedules first — idempotent, safe on every boot.
  await registerSchedules();
  await registerDeliveryAssignScheduler();

  // 2. Boot the Workers that consume every queue we care about.
  const workers: Worker[] = [
    startNotificationWorker(),
    startDeliveryAssignWorker(),
    new Worker(QUEUES.REPORTS, createScheduleProcessor(), {
      connection: queueConnection,
      concurrency: SCHEDULE_WORKER_CONCURRENCY,
    }),
  ];

  logger.info({ count: workers.length }, 'workers: all started');
  return workers;
}
