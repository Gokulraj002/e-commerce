import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { STAFF_ROLES, type Role, type UserDTO } from '@elite/shared';

import { setForcedLogoutHandler } from '@/lib/apiClient';
import { tokenStore } from '@/lib/tokenStore';

import { fetchCurrentUser, loginRequest, logoutRequest } from './auth.api';
import type { StaffLoginInput } from './auth.schema';

export interface AuthContextValue {
  user: UserDTO | null;
  status: 'loading' | 'authenticated' | 'unauthenticated';
  login: (input: StaffLoginInput) => Promise<UserDTO>;
  logout: () => void;
  /** True when the current user holds at least one of the given roles. */
  hasRole: (...roles: Role[]) => boolean;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

function isStaff(role: Role): boolean {
  return STAFF_ROLES.includes(role);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDTO | null>(null);
  const [status, setStatus] = useState<AuthContextValue['status']>('loading');
  // Guards against setting state after unmount during the bootstrap fetch.
  const mounted = useRef(true);

  const logout = useCallback(() => {
    void logoutRequest();
    tokenStore.clear();
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  // Bootstrap: if a token exists, resolve the current user; enforce staff-only.
  useEffect(() => {
    mounted.current = true;
    setForcedLogoutHandler(() => {
      tokenStore.clear();
      setUser(null);
      setStatus('unauthenticated');
    });

    if (!tokenStore.getAccess()) {
      setStatus('unauthenticated');
      return;
    }

    fetchCurrentUser()
      .then((me) => {
        if (!mounted.current) return;
        if (!isStaff(me.role)) {
          tokenStore.clear();
          setStatus('unauthenticated');
          return;
        }
        setUser(me);
        setStatus('authenticated');
      })
      .catch(() => {
        if (!mounted.current) return;
        tokenStore.clear();
        setStatus('unauthenticated');
      });

    return () => {
      mounted.current = false;
    };
  }, []);

  const login = useCallback(async (input: StaffLoginInput): Promise<UserDTO> => {
    const result = await loginRequest(input);
    // Hard gate: customers and delivery partners may never enter the admin.
    if (!isStaff(result.user.role)) {
      throw new Error('This account is not authorised for the admin panel.');
    }
    tokenStore.set(result.tokens);
    setUser(result.user);
    setStatus('authenticated');
    return result.user;
  }, []);

  const hasRole = useCallback(
    (...roles: Role[]) => (user ? roles.includes(user.role) : false),
    [user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, login, logout, hasRole }),
    [user, status, login, logout, hasRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
