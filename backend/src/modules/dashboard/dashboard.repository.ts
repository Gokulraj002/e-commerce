import { OrderStatus, PaymentStatus, Role } from '@prisma/client';

import { prisma } from '../../lib/prisma.js';

/** Order statuses considered "done" — excluded from the pending workload view. */
const TERMINAL_STATUSES: OrderStatus[] = [
  OrderStatus.DELIVERED,
  OrderStatus.CANCELLED,
  OrderStatus.RETURNED,
  OrderStatus.FAILED_DELIVERY,
];

/** Prisma access only — pure aggregation reads. */
export const dashboardRepository = {
  ordersToday(since: Date) {
    return prisma.order.count({ where: { placedAt: { gte: since } } });
  },

  revenueToday(since: Date) {
    return prisma.order.aggregate({
      _sum: { totalPaise: true },
      where: { paymentStatus: PaymentStatus.PAID, placedAt: { gte: since } },
    });
  },

  pendingByStatus() {
    return prisma.order.groupBy({
      by: ['status'],
      _count: { _all: true },
      where: { status: { notIn: TERMINAL_STATUSES } },
    });
  },

  /** stock <= reorder level — needs a column-to-column compare, so raw SQL. */
  lowStockCount() {
    return prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count
      FROM inventory
      WHERE "stockG" <= "reorderLevelG"
    `;
  },

  newCustomersToday(since: Date) {
    return prisma.user.count({ where: { role: Role.CUSTOMER, createdAt: { gte: since } } });
  },

  topProducts(limit: number) {
    return prisma.orderItem.groupBy({
      by: ['productName'],
      _sum: { quantity: true, lineTotalPaise: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: limit,
    });
  },
};
