/**
 * React-query hooks for the wishlist.
 *
 * The wishlist is server-owned and per-user, so:
 *  - the query is gated on `isAuthenticated` (no phantom fetches for guests),
 *  - every mutation returns the recomputed wishlist and seeds the cache via
 *    `setQueryData`, then invalidates so any stale reader refetches,
 *  - `useMoveToCart` also seeds the cart cache (its response is a `CartDTO`).
 */
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';

import type { CartDTO } from '@elite/shared';

import { useAuth } from '@/features/auth/useAuth';
import { CART_QUERY_KEY } from '@/features/cart';

import {
  addWishlistItem,
  fetchWishlist,
  moveWishlistItemToCart,
  removeWishlistItem,
} from './wishlist.api';
import type { WishlistDTO } from './wishlist.types';

export const WISHLIST_QUERY_KEY = ['wishlist'] as const;

/** The current user's wishlist. Disabled (and empty) for guests. */
export function useWishlist(): UseQueryResult<WishlistDTO> {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: WISHLIST_QUERY_KEY,
    queryFn: fetchWishlist,
    enabled: isAuthenticated,
  });
}

export function useAddToWishlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (productId: string) => addWishlistItem(productId),
    onSuccess: (wishlist) => {
      queryClient.setQueryData(WISHLIST_QUERY_KEY, wishlist);
    },
  });
}

export function useRemoveFromWishlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (productId: string) => removeWishlistItem(productId),
    onSuccess: (wishlist) => {
      queryClient.setQueryData(WISHLIST_QUERY_KEY, wishlist);
    },
  });
}

export function useMoveToCart() {
  const queryClient = useQueryClient();
  return useMutation<CartDTO, unknown, string>({
    mutationFn: (productId: string) => moveWishlistItemToCart(productId),
    onSuccess: (cart) => {
      // The item left the wishlist and entered the cart — refresh both.
      queryClient.setQueryData(CART_QUERY_KEY, cart);
      void queryClient.invalidateQueries({ queryKey: WISHLIST_QUERY_KEY });
    },
  });
}
