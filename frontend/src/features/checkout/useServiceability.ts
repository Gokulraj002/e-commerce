import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { fetchServiceability } from './checkout.api';
import type { ServiceabilityResult } from './checkout.types';

const PINCODE_RE = /^\d{6}$/;

/**
 * Check whether a 6-digit pincode is inside a delivery zone. The query only
 * runs for a well-formed pincode so partial input never hits the network.
 */
export function useServiceability(pincode: string): UseQueryResult<ServiceabilityResult> {
  const valid = PINCODE_RE.test(pincode);
  return useQuery({
    queryKey: ['serviceability', pincode],
    queryFn: () => fetchServiceability(pincode),
    enabled: valid,
    staleTime: 5 * 60 * 1000,
  });
}
