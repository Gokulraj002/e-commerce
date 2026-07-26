/**
 * Delivery auto-assign scheduler.
 *
 * Registers a BullMQ job scheduler that emits a "scan" job on the
 * DELIVERY_ASSIGN queue every SCAN_INTERVAL_MS. The worker in
 * deliveryAssign.worker.ts picks up "scan" jobs and enqueues per-order
 * "assign" jobs (up to SCAN_BATCH_SIZE per tick) for READY / UNASSIGNED
 * orders — small-batch on purpose so a restart doesn't stampede the DB.
 *
 * Idempotent: uses queue.upsertJobScheduler with a stable id, so calling
 * this on every boot never duplicates the schedule.
 *
 * INTEGRATOR NOTE — jobs/index.ts startWorkers() should call
 * registerDeliveryAssignScheduler() once, alongside startDeliveryAssignWorker().
 */
import { logger } from '../lib/logger.js';
import { getQueue, QUEUES } from '../lib/queue.js';

import { DELIVERY_ASSIGN_JOBS } from './deliveryAssign.worker.js';

/** How often the scan job fires. 30s per spec — tight enough for a fresh
 *  READY order to be picked up quickly, loose enough to spare Redis + PG. */
export const SCAN_INTERVAL_MS = 30_000;

/** Stable id for the scheduler entry — kept constant so redeploys upsert
 *  the same schedule rather than accumulating duplicates. */
export const SCAN_SCHEDULER_ID = 'delivery-assign:scan';

/**
 * Register (or refresh) the repeatable scan job. Safe to call multiple
 * times — upsertJobScheduler is idempotent. Returns void; the underlying
 * next-scheduled Job object is not needed by callers.
 */
export async function registerDeliveryAssignScheduler(): Promise<void> {
  const queue = getQueue(QUEUES.DELIVERY_ASSIGN);
  await queue.upsertJobScheduler(
    SCAN_SCHEDULER_ID,
    { every: SCAN_INTERVAL_MS },
    {
      name: DELIVERY_ASSIGN_JOBS.SCAN,
      data: {},
      opts: {
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    },
  );
  logger.info(
    { queue: QUEUES.DELIVERY_ASSIGN, schedulerId: SCAN_SCHEDULER_ID, everyMs: SCAN_INTERVAL_MS },
    'delivery-assign scheduler registered',
  );
}
