/**
 * Pincode serviceability API.
 *
 * The customer app calls this before checkout — and eagerly from the header
 * pill — to know whether a given 6-digit pincode is deliverable, which zone
 * it falls in, and what the delivery fee will be. The apiClient response
 * interceptor unwraps the `{ success, data }` envelope so callers get the
 * DTO directly.
 */
import { apiClient } from '@/lib/apiClient';

/** Public serviceability answer for a pincode (mirrors the backend DTO). */
export interface ServiceabilityResult {
  serviceable: boolean;
  zone: string | null;
  feePaise: number;
}

export async function checkServiceability(pincode: string): Promise<ServiceabilityResult> {
  const { data } = await apiClient.get<ServiceabilityResult>('/delivery/serviceability', {
    params: { pincode },
  });
  return data;
}
