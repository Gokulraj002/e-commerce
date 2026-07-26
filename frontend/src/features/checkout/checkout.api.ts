/**
 * Thin apiClient wrappers for the checkout money-path.
 *
 * Every function returns the already-unwrapped DTO (the axios interceptor
 * collapses the `{ success, data }` envelope). The server owns all pricing —
 * these calls only pass identifiers and read back server-computed totals.
 */
import type { AddressDTO, AddressInput, DeliverySlotDTO, OrderDTO } from '@elite/shared';

import { apiClient } from '@/lib/apiClient';

import type {
  CheckoutSummary,
  PaymentInit,
  PaymentResult,
  PlaceOrderInput,
  PlaceOrderResult,
  ServiceabilityResult,
  VerifyPaymentInput,
} from './checkout.types';

// ── Addresses (/users/addresses) ───────────────────────────────────

export async function fetchAddresses(): Promise<AddressDTO[]> {
  const { data } = await apiClient.get<AddressDTO[]>('/users/addresses');
  return data;
}

export async function createAddress(input: AddressInput): Promise<AddressDTO> {
  const { data } = await apiClient.post<AddressDTO>('/users/addresses', input);
  return data;
}

// ── Delivery ────────────────────────────────────────────────────────

export async function fetchServiceability(pincode: string): Promise<ServiceabilityResult> {
  const { data } = await apiClient.get<ServiceabilityResult>('/delivery/serviceability', {
    params: { pincode },
  });
  return data;
}

export async function fetchSlots(date: string, pincode?: string): Promise<DeliverySlotDTO[]> {
  const { data } = await apiClient.get<DeliverySlotDTO[]>('/delivery/slots', {
    params: { date, ...(pincode ? { pincode } : {}) },
  });
  return data;
}

// ── Checkout ────────────────────────────────────────────────────────

export async function fetchCheckoutSummary(
  addressId: string,
  slotId?: string,
): Promise<CheckoutSummary> {
  const { data } = await apiClient.get<CheckoutSummary>('/checkout/summary', {
    params: { addressId, ...(slotId ? { slotId } : {}) },
  });
  return data;
}

export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const { data } = await apiClient.post<PlaceOrderResult>('/checkout/place', input);
  return data;
}

// ── Payments ────────────────────────────────────────────────────────

export async function initPayment(orderCode: string): Promise<PaymentInit> {
  const { data } = await apiClient.post<PaymentInit>('/payments/init', { orderCode });
  return data;
}

export async function verifyPayment(input: VerifyPaymentInput): Promise<PaymentResult> {
  const { data } = await apiClient.post<PaymentResult>('/payments/verify', input);
  return data;
}

// ── Order (confirmation page) ───────────────────────────────────────

export async function fetchOrder(code: string): Promise<OrderDTO> {
  const { data } = await apiClient.get<OrderDTO>(`/orders/${code}`);
  return data;
}
