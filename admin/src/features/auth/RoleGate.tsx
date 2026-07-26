import type { ReactNode } from 'react';
import type { Role } from '@elite/shared';

import { useAuth } from './useAuth';

interface RoleGateProps {
  /** Roles allowed to see the children. */
  allow: Role[];
  children: ReactNode;
  /** Rendered when the current user is not permitted (defaults to nothing). */
  fallback?: ReactNode;
}

/**
 * Conditionally render UI based on the current user's role. Use for buttons,
 * menu items, or sections that only some staff roles should see.
 *
 *   <RoleGate allow={[ROLES.ADMIN, ROLES.SUPER_ADMIN]}>
 *     <button>Delete</button>
 *   </RoleGate>
 */
export function RoleGate({ allow, children, fallback = null }: RoleGateProps) {
  const { hasRole } = useAuth();
  return <>{hasRole(...allow) ? children : fallback}</>;
}
