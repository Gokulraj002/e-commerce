/**
 * Shared shell for the account area: a guarded, two-column layout with a
 * sticky sidebar of account links and a main content slot. Individual account
 * pages render their body inside this so the navigation stays consistent
 * without touching the router tree.
 */
import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

import { useAuth } from '@/features/auth/useAuth';
import { paths } from '@/routes/routes';

import { AuthGate } from './AuthGate';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  /** Match only the exact path (used for the dashboard root). */
  end?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: paths.account(), label: 'Dashboard', icon: '🏠', end: true },
  { to: paths.orders(), label: 'My Orders', icon: '📦' },
  { to: paths.addresses(), label: 'Addresses', icon: '📍' },
  { to: paths.wishlist(), label: 'Wishlist', icon: '❤️' },
  { to: paths.membership(), label: 'Membership', icon: '👑' },
];

export interface AccountLayoutProps {
  /** Small uppercase kicker above the title. */
  eyebrow?: string;
  title: string;
  /** Optional actions rendered on the right of the header (e.g. a button). */
  actions?: ReactNode;
  children: ReactNode;
}

/** Guarded account shell — sidebar + titled content column. */
export function AccountLayout({
  eyebrow = 'My Account',
  title,
  actions,
  children,
}: AccountLayoutProps): JSX.Element {
  const { user, logout } = useAuth();

  return (
    <AuthGate>
      <section className="en-container py-5">
        <div className="row g-4">
          {/* Sidebar */}
          <aside className="col-12 col-lg-3">
            <div className="en-card p-3" style={{ position: 'sticky', top: '5.5rem' }}>
              {user && (
                <div className="px-2 pt-2 pb-3 mb-2 border-bottom en-hairline border-0">
                  <div className="en-text-muted small text-uppercase" style={{ letterSpacing: '0.08em' }}>
                    Signed in as
                  </div>
                  <div className="en-display h5 mb-0 mt-1">{user.name}</div>
                  <div className="en-text-dim small">{user.phone}</div>
                </div>
              )}
              <nav className="en-account-nav">
                {NAV_ITEMS.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `en-account-nav__link${isActive ? ' is-active' : ''}`
                    }
                  >
                    <span aria-hidden>{item.icon}</span>
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </nav>
              <button
                type="button"
                onClick={() => void logout()}
                className="btn btn-ghost w-100 mt-2 d-flex align-items-center gap-2 justify-content-start"
                style={{ padding: '0.75rem 1rem' }}
              >
                <span aria-hidden>↩️</span>
                <span>Sign out</span>
              </button>
            </div>
          </aside>

          {/* Content */}
          <div className="col-12 col-lg-9">
            <div className="d-flex flex-wrap align-items-end justify-content-between gap-3 mb-4">
              <div>
                <span className="en-eyebrow d-block mb-1">{eyebrow}</span>
                <h1 className="en-display display-6 mb-0">{title}</h1>
              </div>
              {actions && <div>{actions}</div>}
            </div>
            {children}
          </div>
        </div>
      </section>
    </AuthGate>
  );
}
