import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import type { OrderDTO } from '@elite/shared';

import { useAuth } from '@/features/auth/useAuth';

import { fetchOrder } from './checkout.api';

/** Fetch a single order by its human-friendly code (order confirmation page). */
export function useOrder(code: string | undefined): UseQueryResult<OrderDTO> {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['order', code],
    queryFn: () => fetchOrder(code as string),
    enabled: isAuthenticated && Boolean(code),
  });
}
