import type { AuthTokens } from '@elite/shared';

/**
 * Tiny persistence layer for auth tokens. Kept separate from React so the
 * axios layer can read/refresh tokens without importing context. localStorage
 * survives reloads; swap the impl here if you move to httpOnly cookies.
 */
const ACCESS_KEY = 'elite.admin.accessToken';
const REFRESH_KEY = 'elite.admin.refreshToken';

export const tokenStore = {
  getAccess(): string | null {
    return localStorage.getItem(ACCESS_KEY);
  },
  getRefresh(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  },
  set(tokens: AuthTokens): void {
    localStorage.setItem(ACCESS_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
  },
  clear(): void {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};
