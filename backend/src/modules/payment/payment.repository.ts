/**
 * Payment repository — the ONLY place Prisma is touched for this module.
 * Multi-write, atomic operations (payment + order + history + transaction) are
 * exposed as single methods so the service stays Prisma-free while keeping the
 * writes inside one `$transaction`.
 *
 * INTEGRATION TODO: order-status transitions are written here directly (plus an
 * OrderStatusHistory row). When the order module lands, route these through
 * order.service so a single source of truth owns the lifecycle state machine.
 */
import type { Order } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { ORDER_STATUS, PAYMENT_STATUS } from '@elite/shared';
import type { PaymentStatus } from '@elite/shared';

import { prisma } from '../../lib/prisma.js';

/** Fold an optional eventId + payload into a JSON column value for Transactions. */
function buildRawPayload(
  eventId?: string,
  payload?: Record<string, unknown>,
): Prisma.InputJsonValue {
  const out: Record<string, unknown> = {};
  if (eventId) out.eventId = eventId;
  if (payload) out.payload = payload;
  return out as Prisma.InputJsonValue;
}

export function getOrderByCode(code: string) {
  return prisma.order.findUnique({ where: { code }, include: { payment: true } });
}

export function getPaymentById(id: string) {
  return prisma.payment.findUnique({ where: { id }, include: { order: true, refunds: true } });
}

export function getPaymentByOrderId(orderId: string) {
  return prisma.payment.findUnique({ where: { orderId } });
}

export function getPaymentByGatewayOrderId(gatewayOrderId: string) {
  return prisma.payment.findFirst({ where: { gatewayOrderId } });
}

export function getPaymentByGatewayPaymentId(gatewayPaymentId: string) {
  return prisma.payment.findFirst({ where: { gatewayPaymentId } });
}

/** Create the Payment row for an order on first init, or return the existing one. */
export async function ensurePaymentForOrder(order: Order) {
  const existing = await prisma.payment.findUnique({ where: { orderId: order.id } });
  if (existing) return existing;
  return prisma.payment.create({
    data: {
      orderId: order.id,
      method: order.paymentMethod,
      amountPaise: order.totalPaise,
      status: PAYMENT_STATUS.PENDING,
    },
  });
}

export function setGatewayOrderId(paymentId: string, gatewayOrderId: string) {
  return prisma.payment.update({ where: { id: paymentId }, data: { gatewayOrderId } });
}

interface TransactionInput {
  paymentId: string;
  kind: string; // AUTH / CAPTURE / WEBHOOK / REFUND
  status: string;
  amountPaise: number;
  eventId?: string;
  rawPayload?: Record<string, unknown>;
}

export function recordTransaction(input: TransactionInput) {
  return prisma.transaction.create({
    data: {
      paymentId: input.paymentId,
      kind: input.kind,
      status: input.status,
      amountPaise: input.amountPaise,
      rawPayload: buildRawPayload(input.eventId, input.rawPayload),
    },
  });
}

/**
 * Idempotency probe: has a WEBHOOK transaction with this eventId already been
 * stored for this payment? Uses a Postgres JSON path filter on rawPayload.eventId.
 */
export function findWebhookTransaction(paymentId: string, eventId: string) {
  if (!eventId) return Promise.resolve(null);
  return prisma.transaction.findFirst({
    where: {
      paymentId,
      kind: 'WEBHOOK',
      rawPayload: { path: ['eventId'], equals: eventId },
    },
  });
}

interface MarkPaidInput {
  paymentId: string;
  orderId: string;
  gatewayPaymentId: string;
  signature?: string | null;
  amountPaise: number;
  kind: 'CAPTURE' | 'WEBHOOK';
  eventId?: string;
  changedBy?: string | null;
  rawPayload?: Record<string, unknown>;
}

/** Payment → PAID, Order → CONFIRMED (+ history), Transaction(CAPTURE|WEBHOOK). Atomic. */
export function markPaid(input: MarkPaidInput) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.update({
      where: { id: input.paymentId },
      data: {
        status: PAYMENT_STATUS.PAID,
        gatewayPaymentId: input.gatewayPaymentId,
        gatewaySignature: input.signature ?? undefined,
      },
    });
    const order = await tx.order.update({
      where: { id: input.orderId },
      data: { status: ORDER_STATUS.CONFIRMED, paymentStatus: PAYMENT_STATUS.PAID },
    });
    await tx.orderStatusHistory.create({
      data: {
        orderId: input.orderId,
        status: ORDER_STATUS.CONFIRMED,
        note: `Payment captured via ${input.kind.toLowerCase()}`,
        changedBy: input.changedBy ?? 'system',
      },
    });
    await tx.transaction.create({
      data: {
        paymentId: input.paymentId,
        kind: input.kind,
        status: 'SUCCESS',
        amountPaise: input.amountPaise,
        rawPayload: buildRawPayload(input.eventId, input.rawPayload),
      },
    });
    return { payment, order };
  });
}

interface MarkFailedInput {
  paymentId: string;
  gatewayPaymentId?: string;
  amountPaise: number;
  kind: 'CAPTURE' | 'WEBHOOK';
  eventId?: string;
  rawPayload?: Record<string, unknown>;
}

/** Payment → FAILED, Transaction recorded. Order is intentionally LEFT PENDING_PAYMENT. */
export function markFailed(input: MarkFailedInput) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.update({
      where: { id: input.paymentId },
      data: { status: PAYMENT_STATUS.FAILED, gatewayPaymentId: input.gatewayPaymentId ?? undefined },
    });
    await tx.transaction.create({
      data: {
        paymentId: input.paymentId,
        kind: input.kind,
        status: 'FAILED',
        amountPaise: input.amountPaise,
        rawPayload: buildRawPayload(input.eventId, input.rawPayload),
      },
    });
    return payment;
  });
}

export function createRefund(paymentId: string, amountPaise: number, reason?: string) {
  return prisma.refund.create({
    data: { paymentId, amountPaise, reason: reason ?? undefined, status: 'PENDING' },
  });
}

export function failRefund(refundId: string) {
  return prisma.refund.update({ where: { id: refundId }, data: { status: 'FAILED' } });
}

interface CompleteRefundInput {
  refundId: string;
  paymentId: string;
  amountPaise: number;
  gatewayRefundId: string;
  refundStatus: string;
  newPaymentStatus: PaymentStatus;
  rawPayload?: Record<string, unknown>;
}

/** Refund → completed, Payment → REFUNDED|PARTIALLY_REFUNDED, Transaction(REFUND). Atomic. */
export function completeRefund(input: CompleteRefundInput) {
  return prisma.$transaction(async (tx) => {
    const refund = await tx.refund.update({
      where: { id: input.refundId },
      data: { gatewayRefundId: input.gatewayRefundId, status: input.refundStatus },
    });
    const payment = await tx.payment.update({
      where: { id: input.paymentId },
      data: { status: input.newPaymentStatus },
    });
    await tx.transaction.create({
      data: {
        paymentId: input.paymentId,
        kind: 'REFUND',
        status: input.refundStatus,
        amountPaise: input.amountPaise,
        rawPayload: buildRawPayload(undefined, input.rawPayload),
      },
    });
    return { refund, payment };
  });
}
