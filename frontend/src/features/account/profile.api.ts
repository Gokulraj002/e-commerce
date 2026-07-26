/**
 * Profile API calls for the account area. Resolves to the DTO directly (the
 * apiClient interceptor already unwraps the envelope).
 */
import type { UserDTO } from '@elite/shared';

import { apiClient } from '@/lib/apiClient';

export interface UpdateProfileInput {
  name?: string;
  email?: string;
}

/** GET /users/profile — the signed-in user's full profile. */
export async function fetchProfile(): Promise<UserDTO> {
  const { data } = await apiClient.get<UserDTO>('/users/profile');
  return data;
}

/** PATCH /users/profile — update name and/or email. */
export async function updateProfile(input: UpdateProfileInput): Promise<UserDTO> {
  const { data } = await apiClient.patch<UserDTO>('/users/profile', input);
  return data;
}
