/**
 * Cashfree provider (PG "Next" / Orders API).
 *
 * Auth: x-client-id / x-client-secret headers (+ x-api-version).
 * Amounts: Cashfree works in RUPEES (float), so paise are divided by 100.
 * Return verification: there is no HMAC on the browser return — the trusted
 *   check is a server-side order-status fetch (order_status === 'PAID').
 * Webhook signature:
 *   base64(HMAC_SHA256(`${x-webhook-timestamp}${rawBody}`, SECRET_KEY))
 *   compared against the `x-webhook-signature` header (raw bytes required).
 *
 * Dev guard: when CASHFREE_APP_ID / CASHFREE_SECRET_KEY are absent, mock init +
 * pass verification, no network.
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
  hmacSha256Base64,
  safeEqual,
  toJsonObject,
} from './_shared.js';

function creds() {
  const appId = process.env.CASHFREE_APP_ID?.trim();
  const secretKey = process.env.CASHFREE_SECRET_KEY?.trim();
  const apiVersion = process.env.CASHFREE_API_VERSION?.trim() || '2023-08-01';
  const host = process.env.CASHFREE_HOST?.trim() || 'https://api.cashfree.com/pg';
  return { appId, secretKey, apiVersion, host };
}

function authHeaders(appId: string, secretKey: string, apiVersion: string): Record<string, string> {
  return {
    'x-client-id': appId,
    'x-client-secret': secretKey,
    'x-api-version': apiVersion,
    'Content-Type': 'application/json',
  };
}

function paiseToRupees(paise: number): number {
  return Math.round(paise) / 100;
}

export const cashfreeProvider: PaymentProvider = {
  method: PAYMENT_METHOD.CASHFREE,

  async createOrder(input: CreateOrderInput): Promise<ProviderInitResult> {
    const { appId, secretKey, apiVersion, host } = creds();
    if (!appId || !secretKey) {
      return {
        gatewayOrderId: input.orderCode,
        keyId: appId ?? 'CASHFREE_MOCK',
        amountPaise: input.amountPaise,
        currency: input.currency,
        isMock: true,
      };
    }
    const data = await gatewayFetch<{
      order_id?: string;
      cf_order_id?: string | number;
      payment_session_id?: string;
    }>(
      `${host}/orders`,
      {
        method: 'POST',
        headers: authHeaders(appId, secretKey, apiVersion),
        body: JSON.stringify({
          order_id: input.orderCode,
          order_amount: paiseToRupees(input.amountPaise),
          order_currency: input.currency,
          customer_details: {
            customer_id: input.orderCode,
            customer_phone: input.customer?.phone ?? '9999999999',
            customer_email: input.customer?.email ?? undefined,
            customer_name: input.customer?.name ?? undefined,
          },
        }),
      },
      'Cashfree',
    );
    return {
      gatewayOrderId: String(data.order_id ?? data.cf_order_id ?? input.orderCode),
      keyId: appId,
      amountPaise: input.amountPaise,
      currency: input.currency,
      isMock: false,
      extra: data.payment_session_id ? { paymentSessionId: data.payment_session_id } : undefined,
    };
  },

  async verify(input: VerifyInput): Promise<ProviderVerifyResult> {
    const { appId, secretKey, apiVersion, host } = creds();
    if (!appId || !secretKey) {
      return { verified: true, isMock: true, reason: 'dev: no credentials configured' };
    }
    const orderId = input.gatewayOrderId ?? input.gatewayPaymentId;
    const data = await gatewayFetch<{ order_status?: string }>(
      `${host}/orders/${orderId}`,
      { method: 'GET', headers: authHeaders(appId, secretKey, apiVersion) },
      'Cashfree',
    );
    return { verified: data.order_status === 'PAID', isMock: false, reason: data.order_status };
  },

  async refund(input: RefundInput): Promise<ProviderRefundResult> {
    const { appId, secretKey, apiVersion, host } = creds();
    if (!appId || !secretKey) {
      return { gatewayRefundId: `mock_cf_rfnd_${Date.now()}`, status: 'PENDING', isMock: true };
    }
    const data = await gatewayFetch<{
      refund_id?: string | number;
      cf_refund_id?: string | number;
      refund_status?: string;
    }>(
      `${host}/orders/${input.gatewayOrderId ?? ''}/refunds`,
      {
        method: 'POST',
        headers: authHeaders(appId, secretKey, apiVersion),
        body: JSON.stringify({
          refund_amount: paiseToRupees(input.amountPaise),
          refund_id: `REF-${Date.now()}`,
          refund_note: input.reason ?? 'Refund',
        }),
      },
      'Cashfree',
    );
    return {
      gatewayRefundId: String(data.cf_refund_id ?? data.refund_id ?? `cf_rfnd_${Date.now()}`),
      status: data.refund_status ?? 'PENDING',
      isMock: false,
    };
  },

  parseWebhook(rawBody: Buffer, headers: WebhookHeaders): WebhookEvent {
    const { secretKey } = creds();
    const signature = headerValue(headers, 'x-webhook-signature');
    const timestamp = headerValue(headers, 'x-webhook-timestamp') ?? '';

    let verified = false;
    if (!secretKey) {
      verified = true; // dev
    } else if (signature) {
      const expected = hmacSha256Base64(secretKey, `${timestamp}${rawBody.toString('utf8')}`);
      verified = safeEqual(expected, signature);
    }

    const body = toJsonObject(rawBody);
    const type = asString(body['type']) ?? '';
    const data = asRecord(body['data']);
    const order = asRecord(data?.['order']);
    const payment = asRecord(data?.['payment']);

    const gatewayOrderId = asString(order?.['order_id']) ?? null;
    const cfPaymentId = asNumber(payment?.['cf_payment_id']);
    const gatewayPaymentId =
      cfPaymentId !== undefined ? String(cfPaymentId) : asString(payment?.['cf_payment_id']) ?? null;
    const amountRupees = asNumber(payment?.['payment_amount']);
    const amountPaise = amountRupees !== undefined ? Math.round(amountRupees * 100) : null;
    const status = asString(payment?.['payment_status']);

    let outcome: WebhookOutcome = 'UNKNOWN';
    if (status === 'SUCCESS' || type.includes('SUCCESS')) outcome = 'PAID';
    else if (status === 'FAILED' || type.includes('FAILED') || type.includes('USER_DROPPED')) {
      outcome = 'FAILED';
    } else if (type.includes('REFUND')) outcome = 'REFUNDED';

    return {
      verified,
      eventId: gatewayPaymentId ?? `${type}:${gatewayOrderId ?? ''}`,
      outcome,
      gatewayOrderId,
      gatewayPaymentId,
      amountPaise,
      raw: body,
    };
  },
};
