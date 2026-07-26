import { useContext } from 'react';

import { AuthContext, type AuthContextValue } from './AuthContext';

/** Access the auth state. Must be used within <AuthProvider>. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an <AuthProvider>');
  return ctx;
}
