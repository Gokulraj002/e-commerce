import { Prisma } from '@prisma/client';

import { prisma } from '../../lib/prisma.js';
import { orderInclude, type OrderWithRelations } from '../order/order.types.js';
import { cartInclude, type CartWithItems } from './checkout.types.js';

/** Prisma access for the checkout flow ONLY. Mutations accept a tx client. */
type Db = Prisma.TransactionClient;

export interface ReserveLine {
  variantId: string;
  weightG: number;
  quantity: number;
}

export function getCart(userId: string, db: Db = prisma): Promise<CartWithItems | null> {
  return db.cart.findUnique({ where: { userId }, include: cartInclude });
}

export function findAddress(id: string, userId: string, db: Db = prisma) {
  return db.address.findFirst({ where: { id, userId } });
}

export function findSlot(id: string, db: Db = prisma) {
  return db.deliverySlot.findUnique({ where: { id } });
}

export function findActiveCoupon(code: string, db: Db = prisma) {
  return db.coupon.findUnique({ where: { code } });
}

/** A delivery zone that services the given pincode (array membership). */
export function findServiceableZone(pincode: string, db: Db = prisma) {
  return db.deliveryZone.findFirst({ where: { isActive: true, pincodes: { has: pincode } } });
}

export function createOrder(
  data: Prisma.OrderCreateInput,
  db: Db = prisma,
): Promise<OrderWithRelations> {
  return db.order.create({ data, include: orderInclude });
}

/** Reserve stock: bump reservedG per line. Caller must have re-validated availability. */
export async function reserveStock(lines: ReserveLine[], db: Db = prisma): Promise<void> {
  for (const line of lines) {
    await db.inventory.updateMany({
      where: { variantId: line.variantId },
      data: { reservedG: { increment: line.weightG * line.quantity } },
    });
  }
}

export function createPayment(data: Prisma.PaymentUncheckedCreateInput, db: Db = prisma) {
  return db.payment.create({ data });
}

export function addHistory(
  orderId: string,
  status: Prisma.OrderStatusHistoryCreateInput['status'],
  note: string | undefined,
  changedBy: string | undefined,
  db: Db = prisma,
) {
  return db.orderStatusHistory.create({ data: { orderId, status, note, changedBy } });
}

export function incrementSlotBooked(slotId: string, db: Db = prisma) {
  return db.deliverySlot.update({ where: { id: slotId }, data: { booked: { increment: 1 } } });
}

/** Empty the cart and drop any applied coupon after a successful order. */
export async function clearCart(cartId: string, db: Db = prisma): Promise<void> {
  await db.cartItem.deleteMany({ where: { cartId } });
  await db.cart.update({ where: { id: cartId }, data: { couponCode: null } });
}
