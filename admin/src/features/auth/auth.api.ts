import type { AuthResult, UserDTO } from '@elite/shared';

import { api } from '@/lib/apiClient';

import type { StaffLoginInput } from './auth.schema';

/** POST /auth/login — returns the authenticated user and token pair. */
export function loginRequest(input: StaffLoginInput): Promise<AuthResult> {
  return api.post<AuthResult>('/auth/login', input);
}

/** GET /auth/me — resolve the current user from a stored access token. */
export function fetchCurrentUser(): Promise<UserDTO> {
  return api.get<UserDTO>('/auth/me');
}

/** POST /auth/logout — best-effort server-side token revocation. */
export function logoutRequest(): Promise<void> {
  return api.post<void>('/auth/logout').catch(() => undefined);
}
