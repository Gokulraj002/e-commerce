/**
 * Daily sales report scheduler.
 *
 * Fires once a day at 07:30 local (Asia/Kolkata) and pushes yesterday's
 * sales digest — total orders, paid-order revenue in paise, and the top
 * five products by revenue — as a "system.dailyReport" IN_APP notification
 * to every active SUPER_ADMIN / ADMIN user.
 *
 * Called by the scheduler registered in `schedules/index.ts`; the actual
 * handler runs inside a BullMQ Worker attached to `QUEUES.REPORTS`.
 */
import type { Queue } from 'bullmq';
import { PaymentStatus, Role } from '@prisma/client';

import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';

/** Stable scheduler id — dedupe key for upsertJobScheduler. */
export const DAILY_REPORT_SCHEDULE_ID = 'schedule:daily-sales-report';

/** Job name the Worker matches to route this schedule to its handler. */
export const DAILY_REPORT_JOB_NAME = 'schedule.dailySalesReport';

/** Cron: minute 30 of hour 7, every day. */
export const DAILY_REPORT_CRON = '30 7 * * *';

/** Timezone applied to the cron expression. */
export const DAILY_REPORT_TZ = 'Asia/Kolkata';

/** Roles that receive the digest. */
const ADMIN_ROLES: Role[] = [Role.SUPER_ADMIN, Role.ADMIN];

/** Number of products shown in the top-products list. */
const TOP_PRODUCTS_LIMIT = 5;

/** One line in the top-products list. */
export interface TopProductLine {
  productName: string;
  quantity: number;
  revenuePaise: number;
}

/** Digest payload embedded in the notification meta. */
export interface DailyReportSummary {
  date: string; // YYYY-MM-DD (start of yesterday, local)
  totalOrders: number;
  paidOrders: number;
  revenuePaise: number;
  topProducts: TopProductLine[];
}

/** Full result returned by the scheduler for tests + logs. */
export interface DailyReportRunResult extends DailyReportSummary {
  notifiedAdmins: number;
}

/**
 * Yesterday's half-open window `[start, end)` in server-local time, plus a
 * YYYY-MM-DD label of `start`. Local time is what the ops team cares about;
 * the daily digest boundary should match the store day.
 */
function yesterdayWindow(now: Date = new Date()): { start: Date; end: Date; label: string } {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
  const end = startOfToday;
  const label = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(
    start.getDate(),
  ).padStart(2, '0')}`;
  return { start, end, label };
}

export async function runDailySalesReport(deps: {
  notificationsQueue: Queue;
}): Promise<DailyReportRunResult> {
  const { start, end, label } = yesterdayWindow();

  const orders = await prisma.order.findMany({
    where: { placedAt: { gte: start, lt: end } },
    include: { items: true },
  });

  const paidOrders = orders.filter((o) => o.paymentStatus === PaymentStatus.PAID);
  const revenuePaise = paidOrders.reduce((sum, o) => sum + o.totalPaise, 0);

  // Top products by revenue — only PAID orders contribute (unpaid orders may
  // never settle and would inflate the digest misleadingly).
  const perProduct = new Map<string, TopProductLine>();
  for (const o of paidOrders) {
    for (const item of o.items) {
      const existing =
        perProduct.get(item.productName) ??
        { productName: item.productName, quantity: 0, revenuePaise: 0 };
      existing.quantity += item.quantity;
      existing.revenuePaise += item.lineTotalPaise;
      perProduct.set(item.productName, existing);
    }
  }
  const topProducts: TopProductLine[] = [...perProduct.values()]
    .sort((a, b) => b.revenuePaise - a.revenuePaise)
    .slice(0, TOP_PRODUCTS_LIMIT);

  const summary: DailyReportSummary = {
    date: label,
    totalOrders: orders.length,
    paidOrders: paidOrders.length,
    revenuePaise,
    topProducts,
  };

  const admins = await prisma.user.findMany({
    where: { role: { in: ADMIN_ROLES }, isActive: true },
    select: { id: true },
  });

  if (admins.length === 0) {
    logger.warn({ date: label }, 'dailySalesReport: no admin users to notify');
    return { ...summary, notifiedAdmins: 0 };
  }

  const rupees = (revenuePaise / 100).toFixed(2);
  const title = `Daily sales report — ${label}`;
  const body = `${orders.length} orders (${paidOrders.length} paid), revenue ₹${rupees}`;

  await Promise.all(
    admins.map((admin) =>
      deps.notificationsQueue.add('system.dailyReport', {
        userId: admin.id,
        channel: 'IN_APP',
        title,
        body,
        meta: { kind: 'dailyReport', ...summary },
      }),
    ),
  );

  logger.info(
    { date: label, totalOrders: orders.length, notifiedAdmins: admins.length },
    'dailySalesReport: notifications enqueued',
  );

  return { ...summary, notifiedAdmins: admins.length };
}
