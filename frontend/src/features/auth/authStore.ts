/**
 * Framework-agnostic auth token store.
 *
 * Lives outside React so the axios client can read/refresh tokens without a
 * hook. Tokens + user persist to localStorage; a tiny pub/sub lets the React
 * `AuthProvider` mirror this state. This is the single source of truth for
 * "who is logged in".
 */
import type { AuthTokens, UserDTO } from '@elite/shared';

const STORAGE_KEY = 'elite.auth';

export interface AuthSnapshot {
  user: UserDTO | null;
  tokens: AuthTokens | null;
}

type Listener = (snapshot: AuthSnapshot) => void;

let state: AuthSnapshot = load();
const listeners = new Set<Listener>();

function load(): AuthSnapshot {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { user: null, tokens: null };
    const parsed = JSON.parse(raw) as AuthSnapshot;
    return { user: parsed.user ?? null, tokens: parsed.tokens ?? null };
  } catch {
    return { user: null, tokens: null };
  }
}

function persist(): void {
  try {
    if (!state.tokens) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable (private mode) — keep in-memory only */
  }
}

function emit(): void {
  for (const listener of listeners) listener(state);
}

export const authStore = {
  getSnapshot(): AuthSnapshot {
    return state;
  },

  getAccessToken(): string | null {
    return state.tokens?.accessToken ?? null;
  },

  getRefreshToken(): string | null {
    return state.tokens?.refreshToken ?? null;
  },

  isAuthenticated(): boolean {
    return state.tokens !== null && state.user !== null;
  },

  setSession(user: UserDTO, tokens: AuthTokens): void {
    state = { user, tokens };
    persist();
    emit();
  },

  setUser(user: UserDTO): void {
    state = { ...state, user };
    persist();
    emit();
  },

  setTokens(tokens: AuthTokens): void {
    state = { ...state, tokens };
    persist();
    emit();
  },

  clear(): void {
    state = { user: null, tokens: null };
    persist();
    emit();
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
