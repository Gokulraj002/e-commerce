/**
 * Payment service (fat). All business logic lives here; it talks to the
 * repository (Prisma) and to the provider abstraction (gateway factory), and
 * never touches Prisma or a concrete gateway directly.
 *
 * Flow overview:
 *   init    → create a gateway order, stash gatewayOrderId on Payment, return a
 *             secret-free init payload the browser SDK can open.
 *   verify  → validate the client-reported result via the provider; on success
 *             Payment=PAID + Order=CONFIRMED (+ history + CAPTURE txn), else FAILED.
 *   webhook → the trusted server-to-server confirmation. Signature is verified in
 *             the provider; here we dedupe on the event id and update state.
 *   refund  → create a Refund row, call the gateway, then mark the Payment
 *             REFUNDED / PARTIALLY_REFUNDED.
 *
 * INTEGRATION TODO(integrator): order-status transitions are written by the
 * repository directly (Order + OrderStatusHistory). Once the order lifecycle
 * state machine is the single source of truth, route these through
 * order.service instead of writing ORDER_STATUS.CONFIRMED here.
 */
import { PAYMENT_METHOD, PAYMENT_STATUS, STORE } from '@elite/shared';
import type { PaymentStatus } from '@elite/shared';
import type { Payment, Refund } from '@prisma/client';

import { ApiError } from '../../utils/ApiError.js';
import { getPaymentProvider, WEBHOOK_PROVIDERS } from './payment.providers/index.js';
import * as repo from './payment.repository.js';
import type {
  PaymentInitDTO,
  PaymentResultDTO,
  RefundResultDTO,
  WebhookAck,
  WebhookHeaders,
  WebhookProviderKey,
} from './payment.types.js';

const CURRENCY = STORE.CURRENCY;

interface VerifyPaymentInput {
  gatewayPaymentId: string;
  signature?: string;
  gatewayOrderId?: string;
}

// ── Init ───────────────────────────────────────────────────────────

/**
 * Create (or reuse) the Payment for an order and open a gateway checkout.
 * Returns a client-safe init payload — never a gateway secret.
 */
export async function initPayment(orderCode: string, userId: string): Promise<PaymentInitDTO> {
  const order = await repo.getOrderByCode(orderCode);
  if (!order || order.userId !== userId) throw ApiError.notFound('Order not found');

  if (order.paymentMethod === PAYMENT_METHOD.COD) {
    throw ApiError.badRequest('COD orders do not require an online payment');
  }
  if (order.paymentStatus === PAYMENT_STATUS.PAID) {
    throw ApiError.conflict('Order is already paid');
  }

  // Factory resolves the provider; throws 400 for COD / unknown methods.
  const provider = getPaymentProvider(order.paymentMethod);
  const payment = await repo.ensurePaymentForOrder(order);

  const result = await provider.createOrder({
    orderCode: order.code,
    amountPaise: order.totalPaise,
    currency: CURRENCY,
  });

  await repo.setGatewayOrderId(payment.id, result.gatewayOrderId);

  return {
    orderCode: order.code,
    method: order.paymentMethod,
    keyId: result.keyId,
    gatewayOrderId: result.gatewayOrderId,
    amountPaise: result.amountPaise,
    currency: result.currency,
    isMock: result.isMock,
    extra: result.extra,
  };
}

// ── Verify (client-side return) ────────────────────────────────────

/**
 * Verify the checkout result the browser handed back. Idempotent: a payment
 * that is already PAID short-circuits to the current result.
 */
export async function verifyPayment(
  orderCode: string,
  input: VerifyPaymentInput,
  userId: string,
): Promise<PaymentResultDTO> {
  const order = await repo.getOrderByCode(orderCode);
  if (!order || order.userId !== userId) throw ApiError.notFound('Order not found');

  const payment = order.payment;
  if (!payment) throw ApiError.badRequest('Payment has not been initialised for this order');

  if (payment.status === PAYMENT_STATUS.PAID) {
    // Already captured (e.g. webhook won the race) — return the settled state.
    return {
      orderCode: order.code,
      paymentStatus: PAYMENT_STATUS.PAID,
      orderStatus: order.status,
      gatewayPaymentId: payment.gatewayPaymentId,
    };
  }

  const provider = getPaymentProvider(order.paymentMethod);
  const verifyResult = await provider.verify({
    gatewayOrderId: input.gatewayOrderId ?? payment.gatewayOrderId,
    gatewayPaymentId: input.gatewayPaymentId,
    signature: input.signature,
    amountPaise: payment.amountPaise,
  });

  if (!verifyResult.verified) {
    await repo.markFailed({
      paymentId: payment.id,
      gatewayPaymentId: input.gatewayPaymentId,
      amountPaise: payment.amountPaise,
      kind: 'CAPTURE',
    });
    throw ApiError.badRequest('Payment verification failed', {
      reason: verifyResult.reason ?? 'signature mismatch',
    });
  }

  const { order: updatedOrder } = await repo.markPaid({
    paymentId: payment.id,
    orderId: order.id,
    gatewayPaymentId: input.gatewayPaymentId,
    signature: input.signature ?? null,
    amountPaise: payment.amountPaise,
    kind: 'CAPTURE',
    changedBy: userId,
  });

  return {
    orderCode: order.code,
    paymentStatus: PAYMENT_STATUS.PAID,
    orderStatus: updatedOrder.status,
    gatewayPaymentId: input.gatewayPaymentId,
  };
}

// ── Webhook (server-to-server, trusted) ────────────────────────────

/**
 * Handle an async gateway webhook. Signature verification happens inside the
 * provider (`parseWebhook`); here we locate the payment, dedupe on the event id
 * (idempotent — the gateway retries), and update Payment + Order state.
 */
export async function handleWebhook(
  providerKey: WebhookProviderKey,
  rawBody: Buffer,
  headers: WebhookHeaders,
): Promise<WebhookAck> {
  const provider = WEBHOOK_PROVIDERS[providerKey];
  if (!provider) throw ApiError.notFound(`Unknown webhook provider '${providerKey}'`);

  const event = provider.parseWebhook(rawBody, headers);
  if (!event.verified) {
    throw ApiError.badRequest('Invalid webhook signature', { provider: providerKey });
  }

  // Correlate the event to a Payment: prefer the gateway payment id, fall back
  // to the gateway order id (PhonePe/Cashfree store the order code there).
  const payment =
    (event.gatewayPaymentId
      ? await repo.getPaymentByGatewayPaymentId(event.gatewayPaymentId)
      : null) ??
    (event.gatewayOrderId ? await repo.getPaymentByGatewayOrderId(event.gatewayOrderId) : null);

  if (!payment) {
    return { received: true, handled: false, outcome: event.outcome, reason: 'payment not found' };
  }

  // Idempotency: this exact event id already produced a WEBHOOK transaction.
  if (event.eventId) {
    const seen = await repo.findWebhookTransaction(payment.id, event.eventId);
    if (seen) return { received: true, handled: true, outcome: event.outcome, reason: 'duplicate' };
  }

  const amountPaise = event.amountPaise ?? payment.amountPaise;
  const gatewayPaymentId = event.gatewayPaymentId ?? payment.gatewayPaymentId ?? undefined;

  switch (event.outcome) {
    case 'PAID': {
      if (payment.status === PAYMENT_STATUS.PAID) {
        // Already settled — keep the audit trail + dedupe marker, no re-write.
        await repo.recordTransaction({
          paymentId: payment.id,
          kind: 'WEBHOOK',
          status: 'DUPLICATE',
          amountPaise,
          eventId: event.eventId,
          rawPayload: event.raw,
        });
        return { received: true, handled: true, outcome: 'PAID', reason: 'already paid' };
      }
      await repo.markPaid({
        paymentId: payment.id,
        orderId: payment.orderId,
        gatewayPaymentId: gatewayPaymentId ?? `${providerKey}_${payment.id}`,
        amountPaise,
        kind: 'WEBHOOK',
        eventId: event.eventId,
        changedBy: 'webhook',
        rawPayload: event.raw,
      });
      return { received: true, handled: true, outcome: 'PAID' };
    }

    case 'FAILED': {
      await repo.markFailed({
        paymentId: payment.id,
        gatewayPaymentId,
        amountPaise,
        kind: 'WEBHOOK',
        eventId: event.eventId,
        rawPayload: event.raw,
      });
      return { received: true, handled: true, outcome: 'FAILED' };
    }

    case 'REFUNDED':
    default: {
      // Refund notifications and anything unrecognised are recorded for audit
      // (and to seed the idempotency marker) but don't transition Payment here.
      await repo.recordTransaction({
        paymentId: payment.id,
        kind: 'WEBHOOK',
        status: event.outcome,
        amountPaise,
        eventId: event.eventId,
        rawPayload: event.raw,
      });
      return {
        received: true,
        handled: event.outcome === 'REFUNDED',
        outcome: event.outcome,
      };
    }
  }
}

// ── Refund (admin-initiated) ───────────────────────────────────────

function refundableRemaining(payment: Payment, refunds: Refund[]): number {
  const already = refunds
    .filter((r) => r.status !== 'FAILED')
    .reduce((sum, r) => sum + r.amountPaise, 0);
  return payment.amountPaise - already;
}

/**
 * Refund (fully or partially) a captured payment. Creates the Refund row first,
 * calls the gateway, then settles Payment status to REFUNDED / PARTIALLY_REFUNDED.
 */
export async function refund(
  paymentId: string,
  amountPaise: number,
  reason?: string,
): Promise<RefundResultDTO> {
  const payment = await repo.getPaymentById(paymentId);
  if (!payment) throw ApiError.notFound('Payment not found');

  if (payment.method === PAYMENT_METHOD.COD) {
    throw ApiError.badRequest('COD payments cannot be refunded through a gateway');
  }
  if (
    payment.status !== PAYMENT_STATUS.PAID &&
    payment.status !== PAYMENT_STATUS.PARTIALLY_REFUNDED
  ) {
    throw ApiError.badRequest('Only captured payments can be refunded');
  }
  if (!payment.gatewayPaymentId) {
    throw ApiError.badRequest('Payment has no gateway payment id to refund');
  }

  const remaining = refundableRemaining(payment, payment.refunds);
  if (amountPaise > remaining) {
    throw ApiError.badRequest('Refund amount exceeds the refundable balance', {
      requestedPaise: amountPaise,
      refundablePaise: remaining,
    });
  }

  const provider = getPaymentProvider(payment.method);
  const refundRow = await repo.createRefund(paymentId, amountPaise, reason);

  let result;
  try {
    result = await provider.refund({
      gatewayPaymentId: payment.gatewayPaymentId,
      gatewayOrderId: payment.gatewayOrderId,
      amountPaise,
      reason,
    });
  } catch (err) {
    await repo.failRefund(refundRow.id);
    throw err;
  }

  const newTotalRefunded = payment.amountPaise - remaining + amountPaise;
  const newPaymentStatus: PaymentStatus =
    newTotalRefunded >= payment.amountPaise
      ? PAYMENT_STATUS.REFUNDED
      : PAYMENT_STATUS.PARTIALLY_REFUNDED;

  const { refund: settled } = await repo.completeRefund({
    refundId: refundRow.id,
    paymentId,
    amountPaise,
    gatewayRefundId: result.gatewayRefundId,
    refundStatus: result.status,
    newPaymentStatus,
    rawPayload: { gatewayRefundId: result.gatewayRefundId, isMock: result.isMock },
  });

  return {
    refundId: settled.id,
    paymentId,
    amountPaise,
    paymentStatus: newPaymentStatus,
    gatewayRefundId: result.gatewayRefundId,
  };
}
