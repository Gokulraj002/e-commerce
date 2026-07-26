/**
 * Client-side types for the checkout feature.
 *
 * Most shapes are shared DTOs (`@elite/shared`); this file only declares the
 * few response envelopes that the backend composes ad-hoc and does not export
 * as a named DTO (checkout summary, serviceability, payment init/verify).
 */
import type {
  AddressDTO,
  OrderDTO,
  PaymentMethod,
  PaymentStatus,
  OrderStatus,
} from '@elite/shared';

/** Server-computed pricing breakdown (authoritative — never recomputed client-side). */
export interface CheckoutPricing {
  subtotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  totalPaise: number;
  couponCode: string | null;
}

/** GET /checkout/summary response. */
export interface CheckoutSummary {
  pricing: CheckoutPricing;
  slotLabel: string | null;
  address: AddressDTO;
}

/** GET /delivery/serviceability response. */
export interface ServiceabilityResult {
  serviceable: boolean;
  zone: string | null;
  feePaise: number;
}

/** POST /checkout/place response. */
export interface PlaceOrderResult {
  order: OrderDTO;
  paymentMethod: PaymentMethod;
  requiresPaymentInit: boolean;
}

/** POST /payments/init response (client-safe — no gateway secrets). */
export interface PaymentInit {
  orderCode: string;
  method: PaymentMethod;
  keyId: string;
  gatewayOrderId: string;
  amountPaise: number;
  currency: string;
  isMock: boolean;
  extra?: Record<string, string>;
}

/** POST /payments/verify response. */
export interface PaymentResult {
  orderCode: string;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  gatewayPaymentId: string | null;
}

/** Body accepted by POST /checkout/place. */
export interface PlaceOrderInput {
  addressId: string;
  slotId?: string;
  paymentMethod: PaymentMethod;
  note?: string;
}

/** Body accepted by POST /payments/verify. */
export interface VerifyPaymentInput {
  orderCode: string;
  gatewayPaymentId: string;
  signature?: string;
  gatewayOrderId?: string;
}
