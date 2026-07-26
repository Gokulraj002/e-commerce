/**
 * Cart state, backed by the `/cart` API through react-query.
 *
 * Design decision (kept deliberately simple & robust):
 *   The cart is SERVER-OWNED and requires an authenticated session. When a
 *   guest tries to add an item, `addItem` throws `RequireLoginError` so the UI
 *   can redirect to /login and resume afterwards. This avoids fragile
 *   guest-cart merge logic while keeping the server as the single source of
 *   truth for pricing, stock and totals.
 *
 * The next wave of pages consume this via `useCart()`.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useMemo, type ReactNode } from 'react';

import type { CartDTO } from '@elite/shared';

import { useAuth } from '@/features/auth/useAuth';

import {
  addCartItem,
  applyCoupon,
  clearCart,
  fetchCart,
  removeCartItem,
  removeCoupon,
  updateCartItem,
  type AddItemInput,
} from './cart.api';

export const CART_QUERY_KEY = ['cart'] as const;

/** Thrown when a cart mutation is attempted without an authenticated session. */
export class RequireLoginError extends Error {
  constructor() {
    super('Please sign in to continue');
    this.name = 'RequireLoginError';
  }
}

export interface CartContextValue {
  cart: CartDTO | null;
  itemCount: number;
  isLoading: boolean;
  isMutating: boolean;
  addItem: (input: AddItemInput) => Promise<CartDTO>;
  updateItem: (itemId: string, quantity: number) => Promise<CartDTO>;
  removeItem: (itemId: string) => Promise<CartDTO>;
  applyCouponCode: (code: string) => Promise<CartDTO>;
  clearCouponCode: () => Promise<CartDTO>;
  clear: () => Promise<CartDTO>;
}

export const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }): JSX.Element {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const cartQuery = useQuery({
    queryKey: CART_QUERY_KEY,
    queryFn: fetchCart,
    enabled: isAuthenticated,
  });

  const setCart = useCallback(
    (cart: CartDTO) => queryClient.setQueryData(CART_QUERY_KEY, cart),
    [queryClient],
  );

  const addMutation = useMutation({ mutationFn: addCartItem, onSuccess: setCart });
  const updateMutation = useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) =>
      updateCartItem(itemId, quantity),
    onSuccess: setCart,
  });
  const removeMutation = useMutation({ mutationFn: removeCartItem, onSuccess: setCart });
  const applyCouponMutation = useMutation({ mutationFn: applyCoupon, onSuccess: setCart });
  const removeCouponMutation = useMutation({ mutationFn: removeCoupon, onSuccess: setCart });
  const clearMutation = useMutation({ mutationFn: clearCart, onSuccess: setCart });

  const addItem = useCallback(
    (input: AddItemInput): Promise<CartDTO> => {
      if (!isAuthenticated) return Promise.reject(new RequireLoginError());
      return addMutation.mutateAsync(input);
    },
    [isAuthenticated, addMutation],
  );

  const updateItem = useCallback(
    (itemId: string, quantity: number): Promise<CartDTO> =>
      updateMutation.mutateAsync({ itemId, quantity }),
    [updateMutation],
  );

  const removeItem = useCallback(
    (itemId: string): Promise<CartDTO> => removeMutation.mutateAsync(itemId),
    [removeMutation],
  );

  const applyCouponCode = useCallback(
    (code: string): Promise<CartDTO> => applyCouponMutation.mutateAsync(code),
    [applyCouponMutation],
  );

  const clearCouponCode = useCallback(
    (): Promise<CartDTO> => removeCouponMutation.mutateAsync(),
    [removeCouponMutation],
  );

  const clear = useCallback((): Promise<CartDTO> => clearMutation.mutateAsync(), [clearMutation]);

  const cart = cartQuery.data ?? null;
  const itemCount = cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const isMutating =
    addMutation.isPending ||
    updateMutation.isPending ||
    removeMutation.isPending ||
    applyCouponMutation.isPending ||
    removeCouponMutation.isPending ||
    clearMutation.isPending;

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      itemCount,
      isLoading: cartQuery.isLoading,
      isMutating,
      addItem,
      updateItem,
      removeItem,
      applyCouponCode,
      clearCouponCode,
      clear,
    }),
    [
      cart,
      itemCount,
      cartQuery.isLoading,
      isMutating,
      addItem,
      updateItem,
      removeItem,
      applyCouponCode,
      clearCouponCode,
      clear,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
