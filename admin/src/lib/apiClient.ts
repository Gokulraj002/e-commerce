import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import type { ApiResponse, AuthTokens } from '@elite/shared';

import { tokenStore } from './tokenStore';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

/**
 * Central Axios client for the admin panel.
 *  - Attaches the Bearer access token on every request.
 *  - On a 401, transparently refreshes the token ONCE (concurrent 401s share
 *    the same refresh promise), then retries the original request.
 *  - If refresh fails, clears tokens and invokes the registered logout handler.
 * Response bodies use the shared { success, data, message } envelope; the typed
 * helpers below unwrap `.data` so callers work directly with domain payloads.
 */

let onForcedLogout: (() => void) | null = null;

/** Registered by AuthProvider so the client can trigger app-level logout. */
export function setForcedLogoutHandler(handler: () => void): void {
  onForcedLogout = handler;
}

export const http: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStore.getAccess();
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

// Refresh state — shared so parallel 401s wait on a single refresh call.
let refreshPromise: Promise<AuthTokens> | null = null;

async function refreshTokens(): Promise<AuthTokens> {
  const refreshToken = tokenStore.getRefresh();
  if (!refreshToken) throw new Error('No refresh token');

  // Bare axios (not `http`) to avoid recursive interceptor loops.
  const { data } = await axios.post<ApiResponse<AuthTokens>>(
    `${BASE_URL}/auth/refresh`,
    { refreshToken },
    { headers: { 'Content-Type': 'application/json' } },
  );
  tokenStore.set(data.data);
  return data.data;
}

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    const status = error.response?.status;

    const isAuthEndpoint = original?.url?.includes('/auth/');
    if (status !== 401 || !original || original._retried || isAuthEndpoint) {
      return Promise.reject(error);
    }

    original._retried = true;
    try {
      refreshPromise ??= refreshTokens();
      const tokens = await refreshPromise;
      original.headers.set('Authorization', `Bearer ${tokens.accessToken}`);
      return http(original);
    } catch (refreshErr) {
      tokenStore.clear();
      onForcedLogout?.();
      return Promise.reject(refreshErr);
    } finally {
      refreshPromise = null;
    }
  },
);

// ── Typed helpers: unwrap the ApiResponse envelope ────────────────
async function unwrap<T>(promise: Promise<{ data: ApiResponse<T> }>): Promise<T> {
  const res = await promise;
  return res.data.data;
}

export const api = {
  get: <T>(url: string, config?: AxiosRequestConfig) =>
    unwrap<T>(http.get<ApiResponse<T>>(url, config)),
  post: <T>(url: string, body?: unknown, config?: AxiosRequestConfig) =>
    unwrap<T>(http.post<ApiResponse<T>>(url, body, config)),
  put: <T>(url: string, body?: unknown, config?: AxiosRequestConfig) =>
    unwrap<T>(http.put<ApiResponse<T>>(url, body, config)),
  patch: <T>(url: string, body?: unknown, config?: AxiosRequestConfig) =>
    unwrap<T>(http.patch<ApiResponse<T>>(url, body, config)),
  delete: <T>(url: string, config?: AxiosRequestConfig) =>
    unwrap<T>(http.delete<ApiResponse<T>>(url, config)),
};

/** Best-effort extraction of a human-readable message from an API error. */
export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string } | undefined;
    return data?.message ?? error.message ?? fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}
