import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';

import { CART_QUERY_KEY } from '@/features/cart';

import { placeOrder } from './checkout.api';
import type { PlaceOrderInput, PlaceOrderResult } from './checkout.types';

/**
 * Place the order (the critical transactional call). The server clears the cart
 * server-side, so we invalidate the cached cart on success.
 */
export function usePlaceOrder(): UseMutationResult<PlaceOrderResult, unknown, PlaceOrderInput> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: placeOrder,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
    },
  });
}
