/**
 * PhonePe provider (Hermes / PG v1).
 *
 * Signature scheme — the `X-VERIFY` header:
 *   X-VERIFY = SHA256(base64Payload + apiPath + SALT_KEY) + "###" + SALT_INDEX
 *   • Pay:    apiPath = "/pg/v1/pay"
 *   • Status: apiPath = "/pg/v1/status/{merchantId}/{merchantTransactionId}"
 *   • Callback: SHA256(base64ResponseBody + SALT_KEY) + "###" + SALT_INDEX
 *
 * PhonePe has no separate "gateway order id" — the merchantTransactionId (we use
 * our own order code) is the correlation key, so we store the order code as the
 * Payment.gatewayOrderId.
 *
 * Dev guard: when PHONEPE_MERCHANT_ID / PHONEPE_SALT_KEY are absent, mock init +
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
  safeEqual,
  sha256Hex,
  toJsonObject,
} from './_shared.js';

function creds() {
  const merchantId = process.env.PHONEPE_MERCHANT_ID?.trim();
  const saltKey = process.env.PHONEPE_SALT_KEY?.trim();
  const saltIndex = process.env.PHONEPE_SALT_INDEX?.trim() || '1';
  const host = process.env.PHONEPE_HOST?.trim() || 'https://api.phonepe.com/apis/hermes';
  return { merchantId, saltKey, saltIndex, host };
}

function xVerify(base64: string, path: string, saltKey: string, saltIndex: string): string {
  return `${sha256Hex(base64 + path + saltKey)}###${saltIndex}`;
}

export const phonepeProvider: PaymentProvider = {
  method: PAYMENT_METHOD.PHONEPE,

  async createOrder(input: CreateOrderInput): Promise<ProviderInitResult> {
    const { merchantId, saltKey, saltIndex, host } = creds();
    if (!merchantId || !saltKey) {
      return {
        gatewayOrderId: input.orderCode,
        keyId: merchantId ?? 'PHONEPE_MOCK',
        amountPaise: input.amountPaise,
        currency: input.currency,
        isMock: true,
      };
    }
    const payload = {
      merchantId,
      merchantTransactionId: input.orderCode,
      amount: input.amountPaise, // PhonePe uses paise
      redirectMode: 'POST',
      paymentInstrument: { type: 'PAY_PAGE' },
    };
    const base64 = Buffer.from(JSON.stringify(payload)).toString('base64');
    const path = '/pg/v1/pay';
    const data = await gatewayFetch<{
      data?: { instrumentResponse?: { redirectInfo?: { url?: string } } };
    }>(
      `${host}${path}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-VERIFY': xVerify(base64, path, saltKey, saltIndex),
        },
        body: JSON.stringify({ request: base64 }),
      },
      'PhonePe',
    );
    const redirectUrl = data.data?.instrumentResponse?.redirectInfo?.url;
    return {
      gatewayOrderId: input.orderCode,
      keyId: merchantId,
      amountPaise: input.amountPaise,
      currency: input.currency,
      isMock: false,
      extra: redirectUrl ? { redirectUrl } : undefined,
    };
  },

  async verify(input: VerifyInput): Promise<ProviderVerifyResult> {
    const { merchantId, saltKey, saltIndex } = creds();
    if (!saltKey || !merchantId) {
      return { verified: true, isMock: true, reason: 'dev: no salt configured' };
    }
    if (!input.signature) return { verified: false, isMock: false, reason: 'missing X-VERIFY' };
    const mtx = input.gatewayOrderId ?? input.gatewayPaymentId;
    const path = `/pg/v1/status/${merchantId}/${mtx}`;
    // Status check X-VERIFY omits the base64 body.
    const expected = `${sha256Hex(path + saltKey)}###${saltIndex}`;
    return { verified: safeEqual(expected, input.signature), isMock: false };
  },

  async refund(input: RefundInput): Promise<ProviderRefundResult> {
    const { merchantId, saltKey, saltIndex, host } = creds();
    if (!merchantId || !saltKey) {
      return { gatewayRefundId: `mock_phonepe_rfnd_${Date.now()}`, status: 'PENDING', isMock: true };
    }
    const payload = {
      merchantId,
      originalTransactionId: input.gatewayPaymentId,
      merchantTransactionId: `REF-${Date.now()}`,
      amount: input.amountPaise,
    };
    const base64 = Buffer.from(JSON.stringify(payload)).toString('base64');
    const path = '/pg/v1/refund';
    const data = await gatewayFetch<{ data?: { transactionId?: string; state?: string } }>(
      `${host}${path}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-VERIFY': xVerify(base64, path, saltKey, saltIndex),
        },
        body: JSON.stringify({ request: base64 }),
      },
      'PhonePe',
    );
    return {
      gatewayRefundId: data.data?.transactionId ?? `phonepe_rfnd_${Date.now()}`,
      status: data.data?.state ?? 'PENDING',
      isMock: false,
    };
  },

  parseWebhook(rawBody: Buffer, headers: WebhookHeaders): WebhookEvent {
    const { saltKey, saltIndex } = creds();
    const outer = toJsonObject(rawBody);
    const base64 = asString(outer['response']);
    const xVerifyHeader = headerValue(headers, 'x-verify');

    let verified = false;
    if (!saltKey) {
      verified = true; // dev
    } else if (base64 && xVerifyHeader) {
      const expected = `${sha256Hex(base64 + saltKey)}###${saltIndex}`;
      verified = safeEqual(expected, xVerifyHeader);
    }

    const decoded = base64 ? toJsonObject(Buffer.from(base64, 'base64')) : outer;
    const code = asString(decoded['code']);
    const data = asRecord(decoded['data']);
    const mtx = asString(data?.['merchantTransactionId']) ?? null;
    const txnId = asString(data?.['transactionId']) ?? null;
    const amountPaise = asNumber(data?.['amount']) ?? null;
    const state = asString(data?.['state']);

    let outcome: WebhookOutcome = 'UNKNOWN';
    if (state === 'COMPLETED' || code === 'PAYMENT_SUCCESS') outcome = 'PAID';
    else if (state === 'FAILED' || code === 'PAYMENT_ERROR' || code === 'PAYMENT_DECLINED') {
      outcome = 'FAILED';
    }

    return {
      verified,
      eventId: txnId ?? mtx ?? '',
      outcome,
      gatewayOrderId: mtx,
      gatewayPaymentId: txnId,
      amountPaise,
      raw: decoded,
    };
  },
};
