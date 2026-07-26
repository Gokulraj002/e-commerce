/**
 * Axios instance for the Elite NonVeg API.
 *
 * Responsibilities:
 *  - baseURL `/api/v1` (proxied to the backend by Vite in dev).
 *  - Attach the Bearer access token from the auth store on every request.
 *  - Unwrap the `{ success, data, message }` envelope so callers get `data`.
 *  - On a 401, transparently refresh the access token once, then retry;
 *    if refresh fails, clear the session (logout).
 */
import axios, {
  AxiosError,
  AxiosHeaders,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';

import type { ApiError, ApiResponse, AuthTokens } from '@elite/shared';

import { notifyToast } from '@/components/ui/toast/toastBridge';
import { authStore } from '@/features/auth/authStore';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

/** Bare client used only for token refresh (no interceptors → no recursion). */
const bareClient = axios.create({ baseURL: BASE_URL });

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request: attach access token ─────────────────────────────
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = authStore.getAccessToken();
  if (token) {
    const headers = AxiosHeaders.from(config.headers);
    headers.set('Authorization', `Bearer ${token}`);
    config.headers = headers;
  }
  return config;
});

// ── Single-flight refresh so parallel 401s share one request ──
let refreshPromise: Promise<AuthTokens> | null = null;

async function refreshTokens(): Promise<AuthTokens> {
  const refreshToken = authStore.getRefreshToken();
  if (!refreshToken) throw new Error('No refresh token');

  const { data } = await bareClient.post<ApiResponse<AuthTokens>>('/auth/refresh', {
    refreshToken,
  });
  const tokens = data.data;
  authStore.setTokens(tokens);
  return tokens;
}

interface RetriableConfig extends AxiosRequestConfig {
  _retry?: boolean;
}

// ── Response: unwrap envelope + handle 401 ───────────────────
apiClient.interceptors.response.use(
  (response: AxiosResponse<ApiResponse<unknown>>) => {
    // Collapse `{ success, data }` down to `data` for ergonomic callers.
    if (response.data && typeof response.data === 'object' && 'data' in response.data) {
      response.data = response.data.data as never;
    }
    return response;
  },
  async (error: AxiosError<ApiError>) => {
    const original = error.config as (RetriableConfig & InternalAxiosRequestConfig) | undefined;
    const status = error.response?.status;

    const canRetry =
      status === 401 &&
      original !== undefined &&
      !original._retry &&
      !original.url?.includes('/auth/refresh') &&
      authStore.getRefreshToken() !== null;

    if (canRetry && original) {
      original._retry = true;
      try {
        refreshPromise = refreshPromise ?? refreshTokens();
        const tokens = await refreshPromise;
        refreshPromise = null;

        const headers = AxiosHeaders.from(original.headers);
        headers.set('Authorization', `Bearer ${tokens.accessToken}`);
        original.headers = headers;
        return apiClient(original);
      } catch (refreshError) {
        refreshPromise = null;
        authStore.clear();
        return Promise.reject(refreshError);
      }
    }

    // Surface network failures and unexpected server errors via a toast if a
    // ToastProvider has registered a handler. Client errors (4xx other than
    // 429) are left for the caller to render inline — they usually need
    // context (form fields, per-item messages, etc.).
    const shouldToast =
      status === undefined || // network / CORS / timeout
      status >= 500 ||
      status === 429;
    if (shouldToast) {
      const message =
        error.response?.data?.message ??
        (status === undefined
          ? 'Network error — please check your connection.'
          : status === 429
            ? 'Too many requests — please slow down and try again.'
            : 'Something went wrong on our end. Please try again in a moment.');
      notifyToast('error', message);
    }

    return Promise.reject(error);
  },
);

/** Normalized error message extraction for UI/toasts. */
export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (axios.isAxiosError<ApiError>(error)) {
    return error.response?.data?.message ?? error.message ?? fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}
