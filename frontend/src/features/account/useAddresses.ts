/**
 * Address book queries + mutations. Kept local to the account feature so it
 * does not depend on another agent's checkout folder. Every mutation
 * invalidates the address list so the UI reflects the server state.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { AddressInput } from '@elite/shared';

import { useAuth } from '@/features/auth/useAuth';

import {
  createAddress,
  deleteAddress,
  fetchAddresses,
  setDefaultAddress,
  updateAddress,
} from './address.api';

export const ADDRESSES_QUERY_KEY = ['addresses'] as const;

export function useAddresses() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ADDRESSES_QUERY_KEY,
    queryFn: fetchAddresses,
    enabled: isAuthenticated,
  });
}

export function useCreateAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AddressInput) => createAddress(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADDRESSES_QUERY_KEY }),
  });
}

export function useUpdateAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<AddressInput> }) =>
      updateAddress(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADDRESSES_QUERY_KEY }),
  });
}

export function useDeleteAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAddress(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADDRESSES_QUERY_KEY }),
  });
}

export function useSetDefaultAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => setDefaultAddress(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADDRESSES_QUERY_KEY }),
  });
}
