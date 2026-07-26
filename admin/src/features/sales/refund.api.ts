import type { OrderDTO, PaymentStatus } from '@elite/shared';

import { api } from '@/lib/apiClient';

/**
 * Refund helpers for the sales domain.
 *
 * The backend exposes `POST /payments/:paymentId/refund` (ADMIN + SUPER_ADMIN),
 * validated by `refundSchema` in `backend/src/modules/payment/payment.schema.ts`:
 *   { amountPaise: positive int, reason?: string(<=500) }
 * The response envelope wraps `RefundResultDTO`, unwrapped here to the caller.
 */

/** Body accepted by the refund route. Mirrors the backend `RefundInput`. */
export interface RefundPaymentInput {
  amountPaise: number;
  reason?: string;
}

/**
 * Response payload from a successful refund. Mirrors the backend
 * `RefundResultDTO`; kept local because it isn't re-exported from
 * `@elite/shared`.
 */
export interface RefundResult {
  refundId: string;
  paymentId: string;
  amountPaise: number;
  paymentStatus: PaymentStatus;
  gatewayRefundId: string;
}

/**
 * Slim view of the payment attached to an order. The current `OrderDTO`
 * exposes only `paymentMethod` and `paymentStatus`; the UI needs the payment
 * id (and refundable balance) to call the refund route. Declared as an
 * intersection so this works today (when the field is absent — button
 * disabled) and continues to work once the backend widens `OrderDTO`.
 */
export interface OrderPaymentInfo {
  id: string;
  amountPaise: number;
  refundablePaise: number;
  status: PaymentStatus;
}

/** OrderDTO widened with an optional payment sub-object. */
export type OrderWithPayment = OrderDTO & {
  payment?: OrderPaymentInfo | null;
};

/** Thin wrapper — POSTs to `/payments/:paymentId/refund`. */
export function refundPayment(
  paymentId: string,
  body: RefundPaymentInput,
): Promise<RefundResult> {
  return api.post<RefundResult>(`/payments/${paymentId}/refund`, body);
}
