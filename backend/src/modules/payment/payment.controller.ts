/**
 * Thin payment controllers: pull validated input + auth context, delegate to
 * the service, and wrap the result in the standard envelope. No business logic,
 * no Prisma.
 */
import type { Request, Response } from 'express';

import { ok } from '../../utils/http.js';
import * as service from './payment.service.js';
import type { InitInput, RefundInput, VerifyInput } from './payment.schema.js';
import type { WebhookProviderKey } from './payment.types.js';

export async function init(req: Request, res: Response) {
  const userId = req.user!.id;
  const { orderCode } = req.body as InitInput;
  const result = await service.initPayment(orderCode, userId);
  return ok(res, result, 'Payment initialised');
}

export async function verify(req: Request, res: Response) {
  const userId = req.user!.id;
  const { orderCode, gatewayPaymentId, signature, gatewayOrderId } = req.body as VerifyInput;
  const result = await service.verifyPayment(
    orderCode,
    { gatewayPaymentId, signature, gatewayOrderId },
    userId,
  );
  return ok(res, result, 'Payment verified');
}

/**
 * Webhook handler factory (one per gateway route). Uses the raw request bytes —
 * `req.rawBody` is captured by the express.json `verify` hook in app.ts so the
 * gateway signature can be checked against the exact payload; it falls back to a
 * re-serialised body only in mock/dev where signatures are not enforced.
 */
export function webhook(providerKey: WebhookProviderKey) {
  return async (req: Request, res: Response) => {
    const raw =
      (req as Request & { rawBody?: Buffer }).rawBody ??
      Buffer.from(JSON.stringify(req.body ?? {}));
    const ack = await service.handleWebhook(providerKey, raw, req.headers);
    return ok(res, ack);
  };
}

export async function refund(req: Request, res: Response) {
  const { paymentId } = req.params as { paymentId: string };
  const { amountPaise, reason } = req.body as RefundInput;
  const result = await service.refund(paymentId, amountPaise, reason);
  return ok(res, result, 'Refund processed');
}
