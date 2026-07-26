import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import type { DeliverySlotDTO } from '@elite/shared';

import { fetchSlots } from './checkout.api';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Available delivery slots for a date (YYYY-MM-DD) + optional pincode.
 * Disabled until a valid date is supplied.
 */
export function useSlots(date: string, pincode?: string): UseQueryResult<DeliverySlotDTO[]> {
  return useQuery({
    queryKey: ['slots', date, pincode ?? null],
    queryFn: () => fetchSlots(date, pincode),
    enabled: DATE_RE.test(date),
  });
}
