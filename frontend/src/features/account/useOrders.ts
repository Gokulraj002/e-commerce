/**
 * Order queries + cancel mutation for the account area.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { OrderDTO } from '@elite/shared';

import { useAuth } from '@/features/auth/useAuth';

import {
  cancelOrder,
  fetchMyOrders,
  fetchOrder,
  type ListMyOrdersParams,
} from './order.api';

export const ORDERS_QUERY_KEY = ['orders'] as const;
export const orderQueryKey = (code: string) => ['order', code] as const;

export function useMyOrders(params: ListMyOrdersParams = {}) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: [...ORDERS_QUERY_KEY, params] as const,
    queryFn: () => fetchMyOrders(params),
    enabled: isAuthenticated,
  });
}

export function useOrder(code: string | undefined) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: orderQueryKey(code ?? ''),
    queryFn: () => fetchOrder(code as string),
    enabled: isAuthenticated && Boolean(code),
  });
}

export function useCancelOrder(code: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reason?: string) => cancelOrder(code, reason),
    onSuccess: (order: OrderDTO) => {
      queryClient.setQueryData(orderQueryKey(order.code), order);
      void queryClient.invalidateQueries({ queryKey: ORDERS_QUERY_KEY });
    },
  });
}
