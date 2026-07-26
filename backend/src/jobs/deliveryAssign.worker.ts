/**
 * Delivery auto-assign worker.
 *
 * Handles two job names on the DELIVERY_ASSIGN queue:
 *   • "assign" — { orderId, express? } — picks the best partner and creates the
 *     assignment via delivery.service.autoAssign (which handles order status,
 *     history, partner-load bump, and its own delivery.assigned notification).
 *   • "scan"   — enqueued by the scheduler every 30s — sweeps READY/UNASSIGNED
 *     orders in small batches and re-enqueues them as individual "assign" jobs.
 *
 * Idempotent: an order with an active/completed DeliveryAssignment
 * (ASSIGNED, ACCEPTED, PICKED_UP, OUT_FOR_DELIVERY, DELIVERED) is skipped.
 *
 * INTEGRATOR NOTE — jobs/index.ts (owned by the notification-worker agent)
 * should import { startDeliveryAssignWorker } from './deliveryAssign.worker.js'
 * and call it from startWorkers(). This file intentionally does not touch
 * that composition point so agents don't collide.
 */
import { Worker, type Job } from 'bullmq';

import { DELIVERY_STATUS, ORDER_STATUS } from '@elite/shared';

import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import { getQueue, queueConnection, QUEUES } from '../lib/queue.js';
import { autoAssign as autoAssignService } from '../modules/delivery/delivery.service.js';
import { ApiError } from '../utils/ApiError.js';

/** Payload for the per-order "assign" job. */
export interface DeliveryAssignJobData {
  orderId: string;
  express?: boolean;
}

/** Job name constants — reference these, never raw strings. */
export const DELIVERY_ASSIGN_JOBS = {
  ASSIGN: 'assign',
  SCAN: 'scan',
} as const;

/** Batch cap per scan tick — protects the DB from bursty stampedes on boot. */
export const SCAN_BATCH_SIZE = 20;

/** Concurrent per-order assignments the worker will process in parallel. */
const WORKER_CONCURRENCY = 5;

/**
 * Delivery-assignment statuses that mean "this order is already being handled"
 * — the worker must not re-run auto-assign for these. UNASSIGNED / FAILED /
 * RETURNED_TO_STORE are treated as retriable (or the order status has already
 * moved past READY, so the scan won't pick them up anyway).
 */
const ACTIVE_ASSIGNMENT_STATUSES: string[] = [
  DELIVERY_STATUS.ASSIGNED,
  DELIVERY_STATUS.ACCEPTED,
  DELIVERY_STATUS.PICKED_UP,
  DELIVERY_STATUS.OUT_FOR_DELIVERY,
  DELIVERY_STATUS.DELIVERED,
];

/** Attempt to auto-assign a single order. Idempotent + tolerant of "no partner". */
async function handleAssign(data: DeliveryAssignJobData): Promise<{ skipped?: string; assignmentId?: string }> {
  const { orderId } = data;
  const express = Boolean(data.express);
  if (!orderId) throw new Error('deliveryAssign.worker: missing orderId in job data');

  const existing = await prisma.deliveryAssignment.findUnique({
    where: { orderId },
    select: { id: true, status: true },
  });
  if (existing && ACTIVE_ASSIGNMENT_STATUSES.includes(existing.status)) {
    logger.debug(
      { orderId, assignmentStatus: existing.status },
      'delivery-assign: skipping — order already has an active assignment',
    );
    return { skipped: existing.status };
  }

  try {
    const dto = await autoAssignService(orderId, express);
    logger.info(
      {
        orderId,
        orderCode: dto.orderCode,
        assignmentId: dto.id,
        partnerName: dto.partnerName,
        express,
      },
      'delivery-assign: order assigned',
    );

    // delivery.service already enqueues NOTIFICATIONS 'delivery.assigned' (partner-facing).
    // Also enqueue a customer-facing 'order.assigned' event as per worker spec.
    await getQueue(QUEUES.NOTIFICATIONS).add('order.assigned', {
      orderId,
      orderCode: dto.orderCode,
      assignmentId: dto.id,
      partnerName: dto.partnerName,
    });

    return { assignmentId: dto.id };
  } catch (err) {
    // 409 conflict = "no available delivery partner for this pincode" — a soft
    // failure. Log and let the next scan tick retry; do NOT throw (would count
    // against BullMQ retry budget and add noise to failed-jobs metrics).
    if (err instanceof ApiError && err.statusCode === 409) {
      logger.warn({ orderId, express, reason: err.message }, 'delivery-assign: no partner available, will retry on next scan');
      return { skipped: 'NO_PARTNER' };
    }
    // Anything else (order missing, DB error, ...) — surface it so BullMQ retries per its backoff.
    logger.error({ err, orderId, express }, 'delivery-assign: unexpected error assigning order');
    throw err;
  }
}

/** Scan tick — find up to SCAN_BATCH_SIZE READY orders needing assignment, enqueue each. */
async function handleScan(): Promise<{ enqueued: number }> {
  // READY orders that either have no assignment record yet, or a lingering
  // UNASSIGNED one (created but never picked up).
  const orders = await prisma.order.findMany({
    where: {
      status: ORDER_STATUS.READY,
      OR: [{ assignment: null }, { assignment: { status: DELIVERY_STATUS.UNASSIGNED } }],
    },
    orderBy: { placedAt: 'asc' }, // oldest first — fairness
    take: SCAN_BATCH_SIZE,
    select: { id: true, code: true },
  });

  if (orders.length === 0) {
    logger.debug('delivery-assign scan: no ready orders');
    return { enqueued: 0 };
  }

  const queue = getQueue(QUEUES.DELIVERY_ASSIGN);
  await Promise.all(
    orders.map((o) =>
      queue.add(
        DELIVERY_ASSIGN_JOBS.ASSIGN,
        { orderId: o.id } satisfies DeliveryAssignJobData,
        { attempts: 3, backoff: { type: 'exponential', delay: 5_000 }, removeOnComplete: 1000, removeOnFail: 500 },
      ),
    ),
  );
  logger.info({ count: orders.length, sample: orders.slice(0, 3).map((o) => o.code) }, 'delivery-assign scan: enqueued orders');
  return { enqueued: orders.length };
}

/**
 * Start the delivery-assign BullMQ worker. Called from jobs/index.ts
 * startWorkers() by the integrator. Returns the Worker so the caller can
 * wire graceful shutdown (worker.close()).
 */
export function startDeliveryAssignWorker(): Worker {
  const worker = new Worker(
    QUEUES.DELIVERY_ASSIGN,
    async (job: Job) => {
      switch (job.name) {
        case DELIVERY_ASSIGN_JOBS.SCAN:
          return handleScan();
        case DELIVERY_ASSIGN_JOBS.ASSIGN:
          return handleAssign(job.data as DeliveryAssignJobData);
        default:
          logger.warn({ jobName: job.name, jobId: job.id }, 'delivery-assign: unknown job name, ignoring');
          return { ignored: true };
      }
    },
    { connection: queueConnection, concurrency: WORKER_CONCURRENCY },
  );

  worker.on('failed', (job, err) => {
    logger.error(
      { err, jobId: job?.id, jobName: job?.name, data: job?.data, attemptsMade: job?.attemptsMade },
      'delivery-assign worker: job failed',
    );
  });
  worker.on('error', (err) => {
    logger.error({ err }, 'delivery-assign worker: transport error');
  });

  logger.info({ queue: QUEUES.DELIVERY_ASSIGN, concurrency: WORKER_CONCURRENCY }, 'delivery-assign worker started');
  return worker;
}
