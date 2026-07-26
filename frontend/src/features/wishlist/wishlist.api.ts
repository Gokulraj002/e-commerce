/**
 * Thin apiClient wrappers for the wishlist endpoints. All are authenticated
 * (the router guards `/wishlist` with requireAuth). The axios layer unwraps the
 * `{ success, data }` envelope, so each returns the DTO directly.
 */
import type { CartDTO } from '@elite/shared';

import { apiClient } from '@/lib/apiClient';

import type { WishlistDTO } from './wishlist.types';

export async function fetchWishlist(): Promise<WishlistDTO> {
  const { data } = await apiClient.get<WishlistDTO>('/wishlist');
  return data;
}

export async function addWishlistItem(productId: string): Promise<WishlistDTO> {
  const { data } = await apiClient.post<WishlistDTO>('/wishlist/items', { productId });
  return data;
}

export async function removeWishlistItem(productId: string): Promise<WishlistDTO> {
  const { data } = await apiClient.delete<WishlistDTO>(`/wishlist/items/${productId}`);
  return data;
}

/** Move a wishlisted product into the cart (cheapest variant) — returns the cart. */
export async function moveWishlistItemToCart(productId: string): Promise<CartDTO> {
  const { data } = await apiClient.post<CartDTO>(`/wishlist/items/${productId}/move-to-cart`);
  return data;
}
