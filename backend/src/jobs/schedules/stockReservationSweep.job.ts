/**
 * Stock reservation sweep scheduler.
 *
 * Hourly: find every Order stuck in PENDING_PAYMENT for more than 30
 * minutes and auto-cancel it — releasing the reserved inventory grams,
 * flipping the order status to CANCELLED, appending an OrderStatusHistory
 * row, and enqueuing an "order.autoCancelled" notification job. Batched at
 * up to 100 orders per tick so a backlog is bled off steadily rather than
 * in one thundering herd.
 *
 * Idempotent: only PENDING_PAYMENT orders older than the cutoff are
 * touched; anything already CANCELLED (or that moved on to CREATED) is
 * skipped by the WHERE clause.
 */
import type { Queue } from 'bullmq';
import { OrderStatus } from '@prisma/client';

import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';

/** Stable scheduler id — dedupe key for upsertJobScheduler. */
export const STOCK_RES_SWEEP_SCHEDULE_ID = 'schedule:stock-reservation-sweep';

/** Job name the Worker matches to route this schedule to its handler. */
export const STOCK_RES_SWEEP_JOB_NAME = 'schedule.stockReservationSweep';

/** Every hour at :05 — deliberately off the top of the hour to spread load. */
export const STOCK_RES_SWEEP_CRON = '5 * * * *';

/** Timezone applied to the cron expression. */
export const STOCK_RES_SWEEP_TZ = 'Asia/Kolkata';

/** Orders older than this in PENDING_PAYMENT are auto-cancelled. */
const PAYMENT_TIMEOUT_MS = 30 * 60 * 1000;

/** Max orders processed per tick — keeps DB pressure predictable. */
const BATCH_SIZE = 100;

/** What `runStockReservationSweep` returns (for tests + logs). */
export interface StockReservationSweepResult {
  scanned: number;
  cancelled: number;
  failed: number;
}

/**
 * Auto-cancel stale PENDING_PAYMENT orders. Each order is processed in
 * its own transaction so one bad row cannot poison the entire batch.
 */
export async function runStockReservationSweep(deps: {
  notificationsQueue: Queue;
}): Promise<StockReservationSweepResult> {
  const cutoff = new Date(Date.now() - PAYMENT_TIMEOUT_MS);

  const stale = await prisma.order.findMany({
    where: {
      status: OrderStatus.PENDING_PAYMENT,
      placedAt: { lt: cutoff },
    },
    include: { items: true },
    orderBy: { placedAt: 'asc' }, // oldest first — fairness
    take: BATCH_SIZE,
  });

  if (stale.length === 0) {
    logger.debug({ cutoff: cutoff.toISOString() }, 'stockReservationSweep: no stale orders');
    return { scanned: 0, cancelled: 0, failed: 0 };
  }

  let cancelled = 0;
  let failed = 0;

  for (const order of stale) {
    try {
      await prisma.$transaction(async (tx) => {
        for (const item of order.items) {
          await tx.inventory.updateMany({
            where: { variantId: item.variantId },
            data: { reservedG: { decrement: item.weightG * item.quantity } },
          });
        }
        await tx.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.CANCELLED },
        });
        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            status: OrderStatus.CANCELLED,
            note: 'Auto-cancelled: payment not received within 30 minutes',
          },
        });
      });

      await deps.notificationsQueue.add('order.autoCancelled', {
        orderId: order.id,
        orderCode: order.code,
        userId: order.userId,
        reason: 'payment_timeout',
        cancelledAt: new Date().toISOString(),
      });
      cancelled += 1;
    } catch (err) {
      failed += 1;
      logger.error(
        { err, orderId: order.id, orderCode: order.code },
        'stockReservationSweep: auto-cancel failed for order',
      );
    }
  }

  logger.info(
    { scanned: stale.length, cancelled, failed, cutoff: cutoff.toISOString() },
    'stockReservationSweep: sweep complete',
  );

  return { scanned: stale.length, cancelled, failed };
}
