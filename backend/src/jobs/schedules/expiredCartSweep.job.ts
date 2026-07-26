/**
 * Expired cart sweep scheduler.
 *
 * Once a day, delete every CartItem row whose parent Cart has not been
 * updated in more than 30 days. The empty Cart shell is left in place so
 * the user's `Cart.userId` identity survives (the model has
 * `userId @unique`); only its items are cleared.
 *
 * Idempotent by construction: repeated runs simply see an empty stale-cart
 * set on subsequent ticks.
 */
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';

/** Stable scheduler id — dedupe key for upsertJobScheduler. */
export const EXPIRED_CART_SCHEDULE_ID = 'schedule:expired-cart-sweep';

/** Job name the Worker matches to route this schedule to its handler. */
export const EXPIRED_CART_JOB_NAME = 'schedule.expiredCartSweep';

/** Daily at 03:15 local — off-peak. */
export const EXPIRED_CART_CRON = '15 3 * * *';

/** Timezone applied to the cron expression. */
export const EXPIRED_CART_TZ = 'Asia/Kolkata';

/** Carts untouched for longer than this window are pruned. */
const CART_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** What `runExpiredCartSweep` returns (for tests + logs). */
export interface ExpiredCartSweepResult {
  scannedCarts: number;
  deletedItems: number;
}

export async function runExpiredCartSweep(): Promise<ExpiredCartSweepResult> {
  const cutoff = new Date(Date.now() - CART_TTL_MS);

  const staleCarts = await prisma.cart.findMany({
    where: { updatedAt: { lt: cutoff } },
    select: { id: true },
  });

  if (staleCarts.length === 0) {
    logger.debug('expiredCartSweep: no carts older than 30 days');
    return { scannedCarts: 0, deletedItems: 0 };
  }

  const cartIds = staleCarts.map((c) => c.id);
  const { count } = await prisma.cartItem.deleteMany({
    where: { cartId: { in: cartIds } },
  });

  logger.info(
    { staleCarts: staleCarts.length, deletedItems: count, cutoff: cutoff.toISOString() },
    'expiredCartSweep: pruned stale cart items',
  );

  return { scannedCarts: staleCarts.length, deletedItems: count };
}
