/**
 * BullMQ repeatable schedules — single registration point.
 *
 * `registerSchedules(queues)` upserts every scheduler entry against the
 * REPORTS queue using a stable id per schedule, so calling it on every
 * boot is safe and idempotent. `createScheduleProcessor(queues)` returns
 * the BullMQ `Processor` a Worker must attach to route each scheduled
 * job to its handler.
 *
 * The scheduler enqueues jobs onto `QUEUES.REPORTS`; each handler in turn
 * enqueues user-facing notification jobs onto `QUEUES.NOTIFICATIONS` for
 * the notification worker to consume.
 *
 * See `backend/src/jobs/README.md` for the worker composition + example
 * bootstrap.
 */
import type { Job, JobsOptions, Processor, Queue } from 'bullmq';

import { logger } from '../../lib/logger.js';
import { QUEUES, getQueue } from '../../lib/queue.js';

import {
  DAILY_REPORT_CRON,
  DAILY_REPORT_JOB_NAME,
  DAILY_REPORT_SCHEDULE_ID,
  DAILY_REPORT_TZ,
  runDailySalesReport,
} from './dailySalesReport.job.js';
import {
  EXPIRED_CART_CRON,
  EXPIRED_CART_JOB_NAME,
  EXPIRED_CART_SCHEDULE_ID,
  EXPIRED_CART_TZ,
  runExpiredCartSweep,
} from './expiredCartSweep.job.js';
import {
  LOW_STOCK_CRON,
  LOW_STOCK_JOB_NAME,
  LOW_STOCK_SCHEDULE_ID,
  LOW_STOCK_TZ,
  runLowStockAlert,
} from './lowStockAlert.job.js';
import {
  STOCK_RES_SWEEP_CRON,
  STOCK_RES_SWEEP_JOB_NAME,
  STOCK_RES_SWEEP_SCHEDULE_ID,
  STOCK_RES_SWEEP_TZ,
  runStockReservationSweep,
} from './stockReservationSweep.job.js';

/** Queues consumed by the scheduler layer. */
export interface SchedulerQueues {
  /** Repeatable schedulers are attached to this queue. */
  system: Queue;
  /** Handlers enqueue user notifications onto this queue. */
  notifications: Queue;
}

/**
 * Default queue set — shared Redis, shared queue names, safe to call
 * from either the `api` or the `worker` process. Callers may pass a
 * partial override (e.g. tests).
 */
export function resolveSchedulerQueues(overrides?: Partial<SchedulerQueues>): SchedulerQueues {
  return {
    system: overrides?.system ?? getQueue(QUEUES.REPORTS),
    notifications: overrides?.notifications ?? getQueue(QUEUES.NOTIFICATIONS),
  };
}

/** Internal description of one repeatable schedule. */
interface ScheduleSpec {
  id: string;
  name: string;
  cron: string;
  tz: string;
}

/** The single source of truth for what runs on a repeat. */
const SCHEDULES: readonly ScheduleSpec[] = [
  { id: LOW_STOCK_SCHEDULE_ID, name: LOW_STOCK_JOB_NAME, cron: LOW_STOCK_CRON, tz: LOW_STOCK_TZ },
  {
    id: DAILY_REPORT_SCHEDULE_ID,
    name: DAILY_REPORT_JOB_NAME,
    cron: DAILY_REPORT_CRON,
    tz: DAILY_REPORT_TZ,
  },
  {
    id: EXPIRED_CART_SCHEDULE_ID,
    name: EXPIRED_CART_JOB_NAME,
    cron: EXPIRED_CART_CRON,
    tz: EXPIRED_CART_TZ,
  },
  {
    id: STOCK_RES_SWEEP_SCHEDULE_ID,
    name: STOCK_RES_SWEEP_JOB_NAME,
    cron: STOCK_RES_SWEEP_CRON,
    tz: STOCK_RES_SWEEP_TZ,
  },
];

/** Job-options template applied to every scheduled emission. */
const DEFAULT_JOB_OPTS: JobsOptions = {
  removeOnComplete: 100,
  removeOnFail: 500,
  attempts: 3,
  backoff: { type: 'exponential', delay: 10_000 },
};

/**
 * Idempotently register every BullMQ repeatable. Uses `upsertJobScheduler`
 * so the stable scheduler id is the dedupe key — safe to call on every
 * boot without accumulating duplicate schedules in Redis.
 *
 * Retiring a schedule (changing its id or removing the file) leaves an
 * orphan entry in Redis; drop it with
 *   `getQueue(QUEUES.REPORTS).removeJobScheduler('schedule:old-id')`.
 */
export async function registerSchedules(overrides?: Partial<SchedulerQueues>): Promise<void> {
  const queues = resolveSchedulerQueues(overrides);

  for (const spec of SCHEDULES) {
    await queues.system.upsertJobScheduler(
      spec.id,
      { pattern: spec.cron, tz: spec.tz },
      {
        name: spec.name,
        data: {},
        opts: DEFAULT_JOB_OPTS,
      },
    );
  }

  logger.info(
    {
      queue: QUEUES.REPORTS,
      count: SCHEDULES.length,
      schedulerIds: SCHEDULES.map((s) => s.id),
    },
    'BullMQ schedules registered',
  );
}

/**
 * Build a BullMQ `Processor` that dispatches each scheduled job name to
 * its handler. Attach it to a `Worker` bound to the system queue — see
 * `backend/src/jobs/README.md` for the worker bootstrap example.
 */
export function createScheduleProcessor(overrides?: Partial<SchedulerQueues>): Processor {
  const queues = resolveSchedulerQueues(overrides);

  return async (job: Job): Promise<unknown> => {
    switch (job.name) {
      case LOW_STOCK_JOB_NAME:
        return runLowStockAlert({ notificationsQueue: queues.notifications });
      case DAILY_REPORT_JOB_NAME:
        return runDailySalesReport({ notificationsQueue: queues.notifications });
      case EXPIRED_CART_JOB_NAME:
        return runExpiredCartSweep();
      case STOCK_RES_SWEEP_JOB_NAME:
        return runStockReservationSweep({ notificationsQueue: queues.notifications });
      default:
        logger.warn(
          { jobName: job.name, jobId: job.id },
          'scheduler: unknown scheduled job name, ignoring',
        );
        return { ignored: true, jobName: job.name };
    }
  };
}

// Re-exports so callers only need to import from './schedules/index.js'.
export {
  DAILY_REPORT_CRON,
  DAILY_REPORT_JOB_NAME,
  DAILY_REPORT_SCHEDULE_ID,
  DAILY_REPORT_TZ,
  EXPIRED_CART_CRON,
  EXPIRED_CART_JOB_NAME,
  EXPIRED_CART_SCHEDULE_ID,
  EXPIRED_CART_TZ,
  LOW_STOCK_CRON,
  LOW_STOCK_JOB_NAME,
  LOW_STOCK_SCHEDULE_ID,
  LOW_STOCK_TZ,
  STOCK_RES_SWEEP_CRON,
  STOCK_RES_SWEEP_JOB_NAME,
  STOCK_RES_SWEEP_SCHEDULE_ID,
  STOCK_RES_SWEEP_TZ,
  runDailySalesReport,
  runExpiredCartSweep,
  runLowStockAlert,
  runStockReservationSweep,
};
