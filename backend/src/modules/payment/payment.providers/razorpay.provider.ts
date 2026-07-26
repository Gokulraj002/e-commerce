/**
 * Razorpay provider.
 *
 * Signatures (official scheme):
 *  • Checkout verify: HMAC_SHA256(`${order_id}|${payment_id}`, KEY_SECRET) hex,
 *    compared against `razorpay_signature`.
 *  • Webhook:         HMAC_SHA256(rawBody, WEBHOOK_SECRET) hex, compared against
 *    the `X-Razorpay-Signature` header (MUST be computed over the exact raw bytes).
 *
 * Dev guard: when RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are absent we never touch
 * the network — createOrder returns a clearly-marked mock and verification is
 * treated as passing so the local flow can complete.
 */
import { PAYMENT_METHOD } from '@elite/shared';

import type {
  CreateOrderInput,
  PaymentProvider,
  ProviderInitResult,
  ProviderRefundResult,
  ProviderVerifyResult,
  RefundInput,
  VerifyInput,
  WebhookEvent,
  WebhookHeaders,
  WebhookOutcome,
} from '../payment.types.js';
import {
  asNumber,
  asRecord,
  asString,
  gatewayFetch,
  headerValue,
  hmacSha256Hex,
  safeEqual,
  toJsonObject,
} from './_shared.js';

const API = 'https://api.razorpay.com/v1';

function creds() {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim() || keySecret;
  return { keyId, keySecret, webhookSecret };
}

function basicAuth(keyId: string, keySecret: string): string {
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`;
}

export const razorpayProvider: PaymentProvider = {
  method: PAYMENT_METHOD.RAZORPAY,

  async createOrder(input: CreateOrderInput): Promise<ProviderInitResult> {
    const { keyId, keySecret } = creds();
    if (!keyId || !keySecret) {
      return {
        gatewayOrderId: `mock_rzp_order_${input.orderCode}_${Date.now()}`,
        keyId: keyId ?? 'rzp_test_mock',
        amountPaise: input.amountPaise,
        currency: input.currency,
        isMock: true,
      };
    }
    const data = await gatewayFetch<{ id: string }>(
      `${API}/orders`,
      {
        method: 'POST',
        headers: { Authorization: basicAuth(keyId, keySecret), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: input.amountPaise, // Razorpay uses paise directly
          currency: input.currency,
          receipt: input.orderCode,
        }),
      },
      'Razorpay',
    );
    return {
      gatewayOrderId: data.id,
      keyId,
      amountPaise: input.amountPaise,
      currency: input.currency,
      isMock: false,
    };
  },

  async verify(input: VerifyInput): Promise<ProviderVerifyResult> {
    const { keySecret } = creds();
    if (!keySecret) return { verified: true, isMock: true, reason: 'dev: no secret configured' };
    if (!input.gatewayOrderId || !input.signature) {
      return { verified: false, isMock: false, reason: 'missing order id or signature' };
    }
    const expected = hmacSha256Hex(keySecret, `${input.gatewayOrderId}|${input.gatewayPaymentId}`);
    return { verified: safeEqual(expected, input.signature), isMock: false };
  },

  async refund(input: RefundInput): Promise<ProviderRefundResult> {
    const { keyId, keySecret } = creds();
    if (!keyId || !keySecret) {
      return { gatewayRefundId: `mock_rzp_rfnd_${Date.now()}`, status: 'processed', isMock: true };
    }
    const data = await gatewayFetch<{ id: string; status: string }>(
      `${API}/payments/${input.gatewayPaymentId}/refund`,
      {
        method: 'POST',
        headers: { Authorization: basicAuth(keyId, keySecret), 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: input.amountPaise }),
      },
      'Razorpay',
    );
    return { gatewayRefundId: data.id, status: data.status, isMock: false };
  },

  parseWebhook(rawBody: Buffer, headers: WebhookHeaders): WebhookEvent {
    const { webhookSecret } = creds();
    const signature = headerValue(headers, 'x-razorpay-signature');
    const headerEventId = headerValue(headers, 'x-razorpay-event-id');

    let verified = false;
    if (!webhookSecret) {
      verified = true; // dev: accept unsigned so local webhook testing works
    } else if (signature) {
      verified = safeEqual(hmacSha256Hex(webhookSecret, rawBody.toString('utf8')), signature);
    }

    const raw = toJsonObject(rawBody);
    const event = asString(raw['event']) ?? '';
    const payload = asRecord(raw['payload']);
    const paymentEntity = asRecord(asRecord(payload?.['payment'])?.['entity']);
    const refundEntity = asRecord(asRecord(payload?.['refund'])?.['entity']);

    const gatewayPaymentId = asString(paymentEntity?.['id']) ?? null;
    const gatewayOrderId = asString(paymentEntity?.['order_id']) ?? null;
    const amountPaise = asNumber(paymentEntity?.['amount']) ?? null;

    let outcome: WebhookOutcome = 'UNKNOWN';
    if (event === 'payment.captured' || event === 'order.paid') outcome = 'PAID';
    else if (event === 'payment.failed') outcome = 'FAILED';
    else if (event.startsWith('refund.')) outcome = 'REFUNDED';

    const eventId =
      headerEventId || `${event}:${gatewayPaymentId ?? asString(refundEntity?.['id']) ?? ''}`;

    return { verified, eventId, outcome, gatewayOrderId, gatewayPaymentId, amountPaise, raw };
  },
};
