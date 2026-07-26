import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { fetchCheckoutSummary } from './checkout.api';
import type { CheckoutSummary } from './checkout.types';

/**
 * Live, server-computed order summary for the chosen address (+ optional slot).
 * The client never derives totals — this is the single source of truth shown at
 * checkout. Disabled until an address is selected.
 */
export function useCheckoutSummary(
  addressId: string | null,
  slotId?: string,
): UseQueryResult<CheckoutSummary> {
  return useQuery({
    queryKey: ['checkout-summary', addressId, slotId ?? null],
    queryFn: () => fetchCheckoutSummary(addressId as string, slotId),
    enabled: Boolean(addressId),
  });
}
