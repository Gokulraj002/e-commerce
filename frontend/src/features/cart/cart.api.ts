/**
 * Cart API calls. Cart is server-owned; every mutation returns the full
 * recomputed CartDTO (totals, discounts, shipping) so the client never does
 * money math itself.
 */
import type { CartDTO } from '@elite/shared';

import { apiClient } from '@/lib/apiClient';

export interface AddItemInput {
  variantId: string;
  quantity: number;
}

export async function fetchCart(): Promise<CartDTO> {
  const { data } = await apiClient.get<CartDTO>('/cart');
  return data;
}

export async function addCartItem(input: AddItemInput): Promise<CartDTO> {
  const { data } = await apiClient.post<CartDTO>('/cart/items', input);
  return data;
}

export async function updateCartItem(itemId: string, quantity: number): Promise<CartDTO> {
  const { data } = await apiClient.patch<CartDTO>(`/cart/items/${itemId}`, { quantity });
  return data;
}

export async function removeCartItem(itemId: string): Promise<CartDTO> {
  const { data } = await apiClient.delete<CartDTO>(`/cart/items/${itemId}`);
  return data;
}

export async function applyCoupon(code: string): Promise<CartDTO> {
  const { data } = await apiClient.post<CartDTO>('/cart/coupon', { code });
  return data;
}

export async function removeCoupon(): Promise<CartDTO> {
  const { data } = await apiClient.delete<CartDTO>('/cart/coupon');
  return data;
}

export async function clearCart(): Promise<CartDTO> {
  const { data } = await apiClient.delete<CartDTO>('/cart');
  return data;
}
