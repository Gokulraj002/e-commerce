/**
 * Low-stock alert scheduler.
 *
 * Every 6 hours: scan every Inventory row and, when the sellable balance
 * (`stockG − reservedG`) has fallen at or below its `reorderLevelG`,
 * enqueue a "system.lowStock" IN_APP notification for each active
 * SUPER_ADMIN / ADMIN user. Skips notifying entirely when nothing is low.
 *
 * Called by the scheduler registered in `schedules/index.ts`; the actual
 * handler runs inside a BullMQ Worker attached to `QUEUES.REPORTS`.
 */
import type { Queue } from 'bullmq';
import { Role } from '@prisma/client';

import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';

/** Stable scheduler id — used as the upsertJobScheduler dedupe key. */
export const LOW_STOCK_SCHEDULE_ID = 'schedule:low-stock-alert';

/** Job name the Worker matches to route this schedule to its handler. */
export const LOW_STOCK_JOB_NAME = 'schedule.lowStockAlert';

/** Every 6 hours on the hour (00:00, 06:00, 12:00, 18:00 in LOW_STOCK_TZ). */
export const LOW_STOCK_CRON = '0 */6 * * *';

/** Timezone applied to the cron expression. */
export const LOW_STOCK_TZ = 'Asia/Kolkata';

/** Roles that receive the low-stock alert. */
const ADMIN_ROLES: Role[] = [Role.SUPER_ADMIN, Role.ADMIN];

/** Cap on how many SKUs are named in the notification body — meta carries the full list. */
const BODY_SKU_PREVIEW = 5;

/** Shape of a single low-stock line embedded in the notification meta. */
export interface LowStockLine {
  variantId: string;
  sku: string;
  productName: string;
  availableG: number;
  reorderLevelG: number;
}

/** What `runLowStockAlert` returns (for tests + logs). */
export interface LowStockRunResult {
  lowStockSkus: string[];
  notifiedAdmins: number;
}

/**
 * Scan all Inventory rows, compute availableG = stockG − reservedG in
 * memory (Prisma cannot express field arithmetic in `where`), and for
 * every SKU at or below its reorder level, enqueue a per-admin
 * notification job onto the NOTIFICATIONS queue.
 */
export async function runLowStockAlert(deps: {
  notificationsQueue: Queue;
}): Promise<LowStockRunResult> {
  const inventories = await prisma.inventory.findMany({
    include: { variant: { include: { product: true } } },
  });

  const low: LowStockLine[] = inventories
    .map<LowStockLine>((inv) => ({
      variantId: inv.variantId,
      sku: inv.variant.sku,
      productName: inv.variant.product.name,
      availableG: inv.stockG - inv.reservedG,
      reorderLevelG: inv.reorderLevelG,
    }))
    .filter((row) => row.availableG <= row.reorderLevelG);

  if (low.length === 0) {
    logger.debug('lowStockAlert: no SKUs at or below reorder level');
    return { lowStockSkus: [], notifiedAdmins: 0 };
  }

  const admins = await prisma.user.findMany({
    where: { role: { in: ADMIN_ROLES }, isActive: true },
    select: { id: true },
  });

  if (admins.length === 0) {
    logger.warn(
      { count: low.length },
      'lowStockAlert: SKUs below reorder level, but no admin users to notify',
    );
    return { lowStockSkus: low.map((l) => l.sku), notifiedAdmins: 0 };
  }

  const preview = low.slice(0, BODY_SKU_PREVIEW).map((l) => l.sku).join(', ');
  const overflow = low.length > BODY_SKU_PREVIEW ? ` (+${low.length - BODY_SKU_PREVIEW} more)` : '';
  const title = `${low.length} SKU(s) at or below reorder level`;
  const body = `Restock needed: ${preview}${overflow}`;

  await Promise.all(
    admins.map((admin) =>
      deps.notificationsQueue.add('system.lowStock', {
        userId: admin.id,
        channel: 'IN_APP',
        title,
        body,
        meta: {
          kind: 'lowStock',
          count: low.length,
          items: low,
        },
      }),
    ),
  );

  logger.info(
    { count: low.length, notifiedAdmins: admins.length },
    'lowStockAlert: notifications enqueued',
  );

  return { lowStockSkus: low.map((l) => l.sku), notifiedAdmins: admins.length };
}
