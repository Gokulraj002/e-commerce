import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { Role } from '@elite/shared';

import { Spinner } from '@/components/ui';
import { ROUTES } from '@/routes/paths';

import { useAuth } from './useAuth';

interface ProtectedRouteProps {
  /** Optional role gate for a whole route subtree. Omit to allow any staff. */
  roles?: Role[];
}

/**
 * Route guard. Redirects unauthenticated users to /login (preserving the
 * intended destination) and blocks users lacking the required role.
 */
export function ProtectedRoute({ roles }: ProtectedRouteProps) {
  const { status, hasRole } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="center-fill">
        <Spinner label="Loading…" />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return <Navigate to={ROUTES.login} replace state={{ from: location }} />;
  }

  if (roles && roles.length > 0 && !hasRole(...roles)) {
    return <Navigate to={ROUTES.dashboard} replace />;
  }

  return <Outlet />;
}
