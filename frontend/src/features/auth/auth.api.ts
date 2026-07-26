/**
 * Auth API calls. The apiClient response interceptor unwraps the envelope,
 * so these resolve directly to the DTO payloads.
 */
import type { AuthResult, LoginInput, RegisterInput, UserDTO } from '@elite/shared';

import { apiClient } from '@/lib/apiClient';

export async function loginRequest(input: LoginInput): Promise<AuthResult> {
  const { data } = await apiClient.post<AuthResult>('/auth/login', input);
  return data;
}

export async function registerRequest(input: RegisterInput): Promise<AuthResult> {
  const { data } = await apiClient.post<AuthResult>('/auth/register', input);
  return data;
}

export async function fetchMe(): Promise<UserDTO> {
  const { data } = await apiClient.get<UserDTO>('/auth/me');
  return data;
}

export async function logoutRequest(): Promise<void> {
  // Best-effort server-side revocation; ignore failure so logout always works.
  await apiClient.post('/auth/logout').catch(() => undefined);
}
