import { useMutation, type UseMutationResult } from '@tanstack/react-query';

import { initPayment, verifyPayment } from './checkout.api';
import type { PaymentInit, PaymentResult, VerifyPaymentInput } from './checkout.types';

/**
 * Open a gateway checkout for an online order. Returns a client-safe init
 * payload (no secrets); `isMock` is true in dev when gateway creds are absent.
 */
export function usePaymentInit(): UseMutationResult<PaymentInit, unknown, string> {
  return useMutation({ mutationFn: initPayment });
}

/** Verify the gateway result the browser hands back after checkout. */
export function usePaymentVerify(): UseMutationResult<PaymentResult, unknown, VerifyPaymentInput> {
  return useMutation({ mutationFn: verifyPayment });
}
