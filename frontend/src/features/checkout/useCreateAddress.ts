import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';

import type { AddressDTO, AddressInput } from '@elite/shared';

import { createAddress } from './checkout.api';
import { ADDRESSES_QUERY_KEY } from './useAddresses';

/** Create a new saved address; refreshes the address list on success. */
export function useCreateAddress(): UseMutationResult<AddressDTO, unknown, AddressInput> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createAddress,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ADDRESSES_QUERY_KEY });
    },
  });
}
