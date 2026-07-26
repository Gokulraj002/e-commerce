/**
 * Address book API calls for the account area. The checkout feature may keep
 * its own address hooks; these live locally to the account feature to avoid
 * cross-feature coupling.
 */
import type { AddressDTO, AddressInput } from '@elite/shared';

import { apiClient } from '@/lib/apiClient';

/** GET /users/addresses — all saved addresses for the signed-in user. */
export async function fetchAddresses(): Promise<AddressDTO[]> {
  const { data } = await apiClient.get<AddressDTO[]>('/users/addresses');
  return data;
}

/** POST /users/addresses — add a new address. */
export async function createAddress(input: AddressInput): Promise<AddressDTO> {
  const { data } = await apiClient.post<AddressDTO>('/users/addresses', input);
  return data;
}

/** PATCH /users/addresses/:id — update an existing address (partial). */
export async function updateAddress(
  id: string,
  input: Partial<AddressInput>,
): Promise<AddressDTO> {
  const { data } = await apiClient.patch<AddressDTO>(`/users/addresses/${id}`, input);
  return data;
}

/** DELETE /users/addresses/:id — remove an address. */
export async function deleteAddress(id: string): Promise<{ id: string }> {
  const { data } = await apiClient.delete<{ id: string }>(`/users/addresses/${id}`);
  return data;
}

/** PATCH /users/addresses/:id/default — mark an address as the default. */
export async function setDefaultAddress(id: string): Promise<AddressDTO> {
  const { data } = await apiClient.patch<AddressDTO>(`/users/addresses/${id}/default`, {});
  return data;
}
