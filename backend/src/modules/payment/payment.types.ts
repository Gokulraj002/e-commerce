/**
 * Module-local types for the payment module.
 *
 * The PROVIDER ABSTRACTION lives here: every gateway (Razorpay / PhonePe /
 * Cashfree) implements `PaymentProvider`, so the service never branches on the
 * concrete gateway — it asks the factory for a provider and calls the same four
 * methods. COD is intentionally NOT a provider (it needs no gateway round-trip).
 */
import type { OrderStatus, PaymentMethod, PaymentStatus } from '@elite/shared';

/** Express `req.headers` shape (case-insensitive lookups happen in helpers). */
export type WebhookHeaders = Record<string, string | string[] | undefined>;

// ── Provider I/O contracts ─────────────────────────────────────────

export interface CreateOrderInput {
  orderCode: string;
  amountPaise: number;
  currency: string; // always 'INR' for this store
  customer?: { name?: string; email?: string | null; phone?: string };
}

/** What the client SDK needs to open the gateway checkout. */
export interface ProviderInitResult {
  gatewayOrderId: string;
  keyId: string; // public key id / merchant id the browser SDK needs
  amountPaise: number;
  currency: string;
  isMock: boolean; // true when credentials are absent (dev) — clearly marked
  extra?: Record<string, string>; // provider-specific (paymentSessionId, redirectUrl…)
}

export interface VerifyInput {
  gatewayOrderId: string | null;
  gatewayPaymentId: string;
  signature?: string;
  amountPaise: number;
}

export interface ProviderVerifyResult {
  verified: boolean;
  isMock: boolean;
  reason?: string;
}

export interface RefundInput {
  gatewayPaymentId: string;
  gatewayOrderId?: string | null;
  amountPaise: number;
  reason?: string;
}

export interface ProviderRefundResult {
  gatewayRefundId: string;
  status: string;
  isMock: boolean;
}

/** Normalised payment outcome parsed from a gateway webhook. */
export type WebhookOutcome = 'PAID' | 'FAILED' | 'REFUNDED' | 'UNKNOWN';

export interface WebhookEvent {
  verified: boolean; // signature check result
  eventId: string; // idempotency / dedupe key (stored in Transaction.rawPayload.eventId)
  outcome: WebhookOutcome;
  gatewayOrderId: string | null;
  gatewayPaymentId: string | null;
  amountPaise: number | null;
  raw: Record<string, unknown>; // decoded payload, persisted for audit
}

/**
 * Common interface implemented by every online gateway.
 * (Task contract: createOrder / verify / refund — plus parseWebhook for the
 * asynchronous server-to-server notifications.)
 */
export interface PaymentProvider {
  readonly method: PaymentMethod;
  createOrder(input: CreateOrderInput): Promise<ProviderInitResult>;
  verify(input: VerifyInput): Promise<ProviderVerifyResult>;
  refund(input: RefundInput): Promise<ProviderRefundResult>;
  parseWebhook(rawBody: Buffer, headers: WebhookHeaders): WebhookEvent;
}

// ── Client-facing DTOs (no secrets) ────────────────────────────────

export interface PaymentInitDTO {
  orderCode: string;
  method: PaymentMethod;
  keyId: string;
  gatewayOrderId: string;
  amountPaise: number;
  currency: string;
  isMock: boolean;
  extra?: Record<string, string>;
}

export interface PaymentResultDTO {
  orderCode: string;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  gatewayPaymentId: string | null;
}

export interface RefundResultDTO {
  refundId: string;
  paymentId: string;
  amountPaise: number;
  paymentStatus: PaymentStatus;
  gatewayRefundId: string;
}

export interface WebhookAck {
  received: true;
  handled: boolean;
  outcome?: WebhookOutcome;
  reason?: string;
}

/** Webhook route keys → provider registry keys. */
export type WebhookProviderKey = 'razorpay' | 'phonepe' | 'cashfree';
