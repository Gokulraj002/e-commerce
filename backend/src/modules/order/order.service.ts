import {
  ORDER_STATUS,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  type AddressDTO,
  type OrderDTO,
  type OrderItemDTO,
  type Paginated,
} from '@elite/shared';
import { Prisma } from '@prisma/client';

import { prisma } from '../../lib/prisma.js';
import { QUEUES, getQueue } from '../../lib/queue.js';
import { ApiError } from '../../utils/ApiError.js';
import * as repo from './order.repository.js';
import type { StockLine } from './order.repository.js';
import { CUSTOMER_CANCELLABLE, canTransition } from './order.stateMachine.js';
import type { AdminListOrdersInput, UpdateStatusInput } from './order.schema.js';
import type { OrderWithRelations } from './order.types.js';

// ── Mappers (Prisma → shared DTOs) ─────────────────────────────────

function toAddressDTO(a: OrderWithRelations['address']): AddressDTO {
  return {
    id: a.id,
    label: a.label,
    name: a.name,
    phone: a.phone,
    line1: a.line1,
    line2: a.line2,
    city: a.city,
    pincode: a.pincode,
    lat: a.lat,
    lng: a.lng,
    isDefault: a.isDefault,
  };
}

function toOrderItemDTO(i: OrderWithRelations['items'][number]): OrderItemDTO {
  return {
    id: i.id,
    productName: i.productName,
    weightG: i.weightG,
    quantity: i.quantity,
    pricePaise: i.pricePaise,
    lineTotalPaise: i.lineTotalPaise,
  };
}

/** Single source of truth for Order → OrderDTO. Imported by the checkout module too. */
export function toOrderDTO(order: OrderWithRelations): OrderDTO {
  return {
    id: order.id,
    code: order.code,
    status: order.status,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    items: order.items.map(toOrderItemDTO),
    subtotalPaise: order.subtotalPaise,
    discountPaise: order.discountPaise,
    shippingPaise: order.shippingPaise,
    totalPaise: order.totalPaise,
    address: toAddressDTO(order.address),
    slotLabel: order.slotLabel,
    placedAt: order.placedAt.toISOString(),
  };
}

// ── Helpers ────────────────────────────────────────────────────────

function toStockLines(order: OrderWithRelations): StockLine[] {
  return order.items.map((i) => ({ variantId: i.variantId, weightG: i.weightG, quantity: i.quantity }));
}

function isPrepaid(order: OrderWithRelations): boolean {
  return order.paymentMethod !== PAYMENT_METHOD.COD && order.paymentStatus === PAYMENT_STATUS.PAID;
}

async function enqueueOrderNotification(event: string, order: OrderWithRelations): Promise<void> {
  await getQueue(QUEUES.NOTIFICATIONS).add(event, {
    orderId: order.id,
    orderCode: order.code,
    userId: order.userId,
    status: order.status,
  });
}

// ── Customer operations ────────────────────────────────────────────

export async function listMyOrders(
  userId: string,
  page: number,
  pageSize: number,
): Promise<Paginated<OrderDTO>> {
  const skip = (page - 1) * pageSize;
  const [rows, total] = await Promise.all([
    repo.getMyOrders(userId, skip, pageSize),
    repo.countMyOrders(userId),
  ]);
  return {
    items: rows.map(toOrderDTO),
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize) || 1,
  };
}

export async function getMyOrder(userId: string, code: string): Promise<OrderDTO> {
  const order = await repo.findOrderByCode(code);
  if (!order || order.userId !== userId) throw ApiError.notFound('Order not found');
  return toOrderDTO(order);
}

/** Customer self-cancel — allowed only before fulfilment (PACKING) begins. */
export async function cancelMyOrder(
  userId: string,
  code: string,
  reason: string | undefined,
): Promise<OrderDTO> {
  const existing = await repo.findOrderByCode(code);
  if (!existing || existing.userId !== userId) throw ApiError.notFound('Order not found');

  if (!CUSTOMER_CANCELLABLE.includes(existing.status)) {
    throw ApiError.badRequest('This order can no longer be cancelled');
  }
  if (!canTransition(existing.status, ORDER_STATUS.CANCELLED)) {
    throw ApiError.badRequest('Invalid status transition');
  }

  const updated = await prisma.$transaction(async (tx) => {
    await repo.releaseReservedStock(toStockLines(existing), tx);
    if (isPrepaid(existing)) {
      await repo.createPendingRefund(existing.id, existing.totalPaise, reason ?? 'Customer cancelled', tx);
    }
    const order = await repo.updateOrderStatus(existing.id, { status: ORDER_STATUS.CANCELLED }, tx);
    await repo.addHistory(order.id, ORDER_STATUS.CANCELLED, reason ?? 'Cancelled by customer', userId, tx);
    return order;
  });

  await enqueueOrderNotification('order.cancelled', updated);
  return toOrderDTO(updated);
}

// ── Admin / staff operations ───────────────────────────────────────

export async function adminListOrders(input: AdminListOrdersInput): Promise<Paginated<OrderDTO>> {
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  const where: Prisma.OrderWhereInput = {};
  if (input.status) where.status = input.status;
  if (input.dateFrom || input.dateTo) {
    const placedAt: Prisma.DateTimeFilter = {};
    if (input.dateFrom) placedAt.gte = input.dateFrom;
    if (input.dateTo) placedAt.lte = input.dateTo;
    where.placedAt = placedAt;
  }
  if (input.search) {
    where.OR = [
      { code: { contains: input.search, mode: 'insensitive' } },
      { user: { name: { contains: input.search, mode: 'insensitive' } } },
      { user: { phone: { contains: input.search } } },
    ];
  }

  const [rows, total] = await Promise.all([
    repo.adminListOrders(where, skip, pageSize),
    repo.countAdminOrders(where),
  ]);
  return {
    items: rows.map(toOrderDTO),
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize) || 1,
  };
}

/** Admin status change — guarded by the state machine, with stock side-effects. */
export async function updateOrderStatus(
  orderId: string,
  input: UpdateStatusInput,
  actorId: string,
): Promise<OrderDTO> {
  const existing = await repo.findOrderById(orderId);
  if (!existing) throw ApiError.notFound('Order not found');

  if (!canTransition(existing.status, input.status)) {
    throw ApiError.badRequest(
      `Cannot move order from ${existing.status} to ${input.status}`,
    );
  }

  const lines = toStockLines(existing);

  const updated = await prisma.$transaction(async (tx) => {
    if (input.status === ORDER_STATUS.DELIVERED) {
      await repo.commitStockOnDelivery(existing.id, lines, actorId, tx);
      if (existing.paymentMethod === PAYMENT_METHOD.COD) {
        await repo.setPaymentStatus(existing.id, PAYMENT_STATUS.PAID, tx);
      }
    } else if (
      input.status === ORDER_STATUS.CANCELLED ||
      input.status === ORDER_STATUS.FAILED_DELIVERY ||
      input.status === ORDER_STATUS.RETURNED
    ) {
      // Release the reservation so the grams return to sellable stock.
      await repo.releaseReservedStock(lines, tx);
      if (input.status === ORDER_STATUS.CANCELLED && isPrepaid(existing)) {
        await repo.createPendingRefund(existing.id, existing.totalPaise, input.note ?? 'Order cancelled', tx);
      }
    }

    const order = await repo.updateOrderStatus(existing.id, { status: input.status }, tx);
    await repo.addHistory(order.id, input.status, input.note, actorId, tx);
    return order;
  });

  await enqueueOrderNotification('order.status_changed', updated);
  return toOrderDTO(updated);
}
