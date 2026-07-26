/**
 * Guards account-area pages. When the visitor is not signed in, it redirects
 * to the login page, preserving the intended destination so login can resume
 * the journey afterwards.
 */
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '@/features/auth/useAuth';
import { paths } from '@/routes/routes';

export function AuthGate({ children }: { children: ReactNode }): JSX.Element {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to={paths.login()} state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
