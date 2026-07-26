/**
 * Provider factory. The service depends on THIS, never on a concrete gateway.
 * `getPaymentProvider` resolves by PaymentMethod (COD has no provider);
 * `WEBHOOK_PROVIDERS` maps the webhook route segment → provider for parsing.
 */
import { PAYMENT_METHOD } from '@elite/shared';
import type { PaymentMethod } from '@elite/shared';

import { ApiError } from '../../../utils/ApiError.js';
import type { PaymentProvider, WebhookProviderKey } from '../payment.types.js';
import { cashfreeProvider } from './cashfree.provider.js';
import { phonepeProvider } from './phonepe.provider.js';
import { razorpayProvider } from './razorpay.provider.js';

const registry: Partial<Record<PaymentMethod, PaymentProvider>> = {
  [PAYMENT_METHOD.RAZORPAY]: razorpayProvider,
  [PAYMENT_METHOD.PHONEPE]: phonepeProvider,
  [PAYMENT_METHOD.CASHFREE]: cashfreeProvider,
};

/** Returns the online provider for a method, or 400 for COD / unknown methods. */
export function getPaymentProvider(method: PaymentMethod): PaymentProvider {
  const provider = registry[method];
  if (!provider) {
    throw ApiError.badRequest(`No online payment provider for method '${method}'`);
  }
  return provider;
}

export const WEBHOOK_PROVIDERS: Record<WebhookProviderKey, PaymentProvider> = {
  razorpay: razorpayProvider,
  phonepe: phonepeProvider,
  cashfree: cashfreeProvider,
};
