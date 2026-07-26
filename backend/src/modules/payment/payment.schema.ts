/**
 * Zod schemas for the payment module (body/params validation).
 * Kept intentionally small — the heavy lifting (ownership, gateway calls,
 * idempotency) lives in the service, not in validation.
 */
import { z } from 'zod';

/** POST /init — start a gateway checkout for an existing order. */
export const initSchema = z.object({
  orderCode: z.string().min(3),
});

/**
 * POST /verify — client hands back what the gateway returned after checkout.
 * `gatewayPaymentId` is required (matches VerifyInput); `signature` /
 * `gatewayOrderId` are gateway-specific (Razorpay needs both, Cashfree needs
 * neither — it re-fetches order status server-side).
 */
export const verifySchema = z.object({
  orderCode: z.string().min(3),
  gatewayPaymentId: z.string().min(1),
  signature: z.string().min(1).optional(),
  gatewayOrderId: z.string().min(1).optional(),
});

/** POST /:paymentId/refund — path param + body. */
export const paymentIdParamSchema = z.object({
  paymentId: z.string().min(1),
});

export const refundSchema = z.object({
  amountPaise: z.number().int().positive(),
  reason: z.string().max(500).optional(),
});

export type InitInput = z.infer<typeof initSchema>;
export type VerifyInput = z.infer<typeof verifySchema>;
export type RefundInput = z.infer<typeof refundSchema>;
