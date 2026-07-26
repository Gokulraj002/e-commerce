import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import type { AddressDTO } from '@elite/shared';

import { useAuth } from '@/features/auth/useAuth';

import { fetchAddresses } from './checkout.api';

export const ADDRESSES_QUERY_KEY = ['addresses'] as const;

/** The signed-in customer's saved delivery addresses. */
export function useAddresses(): UseQueryResult<AddressDTO[]> {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ADDRESSES_QUERY_KEY,
    queryFn: fetchAddresses,
    enabled: isAuthenticated,
  });
}
