import { Prisma, type OrderStatus, type PaymentStatus } from '@prisma/client';

import { prisma } from '../../lib/prisma.js';
import { orderInclude, type OrderWithRelations } from './order.types.js';

/**
 * Prisma access for orders ONLY. Every mutating helper accepts an optional
 * transaction client (`db`) so the service can compose them inside a single
 * `prisma.$transaction`. Defaults to the singleton client for plain reads.
 */
type Db = Prisma.TransactionClient;

/** Line data needed to move stock (reserve / release / commit). */
export interface StockLine {
  variantId: string;
  weightG: number;
  quantity: number;
}

export function getMyOrders(userId: string, skip: number, take: number): Promise<OrderWithRelations[]> {
  return prisma.order.findMany({
    where: { userId },
    include: orderInclude,
    orderBy: { placedAt: 'desc' },
    skip,
    take,
  });
}

export function countMyOrders(userId: string): Promise<number> {
  return prisma.order.count({ where: { userId } });
}

export function findOrderByCode(code: string, db: Db = prisma): Promise<OrderWithRelations | null> {
  return db.order.findUnique({ where: { code }, include: orderInclude });
}

export function findOrderById(id: string, db: Db = prisma): Promise<OrderWithRelations | null> {
  return db.order.findUnique({ where: { id }, include: orderInclude });
}

export function adminListOrders(
  where: Prisma.OrderWhereInput,
  skip: number,
  take: number,
): Promise<OrderWithRelations[]> {
  return prisma.order.findMany({
    where,
    include: orderInclude,
    orderBy: { placedAt: 'desc' },
    skip,
    take,
  });
}

export function countAdminOrders(where: Prisma.OrderWhereInput): Promise<number> {
  return prisma.order.count({ where });
}

export function updateOrderStatus(
  id: string,
  data: Prisma.OrderUpdateInput,
  db: Db = prisma,
): Promise<OrderWithRelations> {
  return db.order.update({ where: { id }, data, include: orderInclude });
}

export function addHistory(
  orderId: string,
  status: OrderStatus,
  note: string | undefined,
  changedBy: string | undefined,
  db: Db = prisma,
): Promise<{ id: string }> {
  return db.orderStatusHistory.create({
    data: { orderId, status, note, changedBy },
    select: { id: true },
  });
}

/** Release reserved grams back to available (cancellation / return before commit). */
export async function releaseReservedStock(lines: StockLine[], db: Db = prisma): Promise<void> {
  for (const line of lines) {
    await db.inventory.updateMany({
      where: { variantId: line.variantId },
      data: { reservedG: { decrement: line.weightG * line.quantity } },
    });
  }
}

/**
 * On DELIVERED: convert reservation into a real stock decrement and record a
 * SALE_OUT movement per line. Reads the variant's inventory to resolve warehouse.
 */
export async function commitStockOnDelivery(
  orderId: string,
  lines: StockLine[],
  createdBy: string | undefined,
  db: Db = prisma,
): Promise<void> {
  for (const line of lines) {
    const qtyG = line.weightG * line.quantity;
    const inv = await db.inventory.findUnique({
      where: { variantId: line.variantId },
      select: { warehouseId: true },
    });
    if (!inv) continue; // inventory row missing — nothing to decrement

    await db.inventory.update({
      where: { variantId: line.variantId },
      data: { stockG: { decrement: qtyG }, reservedG: { decrement: qtyG } },
    });

    await db.stockMovement.create({
      data: {
        variantId: line.variantId,
        warehouseId: inv.warehouseId,
        type: 'SALE_OUT',
        quantityG: -qtyG,
        reason: 'Order delivered',
        refType: 'ORDER',
        refId: orderId,
        createdBy,
      },
    });
  }
}

export function setPaymentStatus(
  orderId: string,
  status: PaymentStatus,
  db: Db = prisma,
): Promise<Prisma.BatchPayload> {
  return db.payment.updateMany({ where: { orderId }, data: { status } });
}

/** Record a refund request (prepaid cancellation) as PENDING for the finance team. */
export async function createPendingRefund(
  orderId: string,
  amountPaise: number,
  reason: string | undefined,
  db: Db = prisma,
): Promise<void> {
  const payment = await db.payment.findUnique({ where: { orderId }, select: { id: true } });
  if (!payment) return;
  await db.refund.create({
    data: { paymentId: payment.id, amountPaise, reason, status: 'PENDING' },
  });
}
