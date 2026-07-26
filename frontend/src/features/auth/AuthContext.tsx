/**
 * React binding over the framework-agnostic `authStore`.
 *
 * Exposes the current user + auth status and the login/register/logout actions.
 * The store is the source of truth (so axios can use it too); this provider
 * simply mirrors it into React state via `useSyncExternalStore`.
 */
import { createContext, useCallback, useMemo, useSyncExternalStore, type ReactNode } from 'react';

import type { LoginInput, RegisterInput, UserDTO } from '@elite/shared';

import { loginRequest, logoutRequest, registerRequest } from './auth.api';
import { authStore } from './authStore';

export interface AuthContextValue {
  user: UserDTO | null;
  isAuthenticated: boolean;
  login: (input: LoginInput) => Promise<UserDTO>;
  register: (input: RegisterInput) => Promise<UserDTO>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const snapshot = useSyncExternalStore(authStore.subscribe, authStore.getSnapshot);

  const login = useCallback(async (input: LoginInput): Promise<UserDTO> => {
    const result = await loginRequest(input);
    authStore.setSession(result.user, result.tokens);
    return result.user;
  }, []);

  const register = useCallback(async (input: RegisterInput): Promise<UserDTO> => {
    const result = await registerRequest(input);
    authStore.setSession(result.user, result.tokens);
    return result.user;
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    await logoutRequest();
    authStore.clear();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: snapshot.user,
      isAuthenticated: snapshot.user !== null && snapshot.tokens !== null,
      login,
      register,
      logout,
    }),
    [snapshot, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
