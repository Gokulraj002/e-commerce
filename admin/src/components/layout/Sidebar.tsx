import { NavLink, useLocation } from 'react-router-dom';

import { Icon } from '@/components/ui';
import { useAuth } from '@/features/auth';

import { NAV_GROUPS, type NavItem } from './nav.config';

const APP_VERSION = 'v1.0.0';
const WORKSPACE_LABEL = 'Admin · Hyderabad';

interface SidebarProps {
  /** Desktop rail state — persisted by AdminLayout. */
  collapsed: boolean;
  /** Mobile drawer open state — transient, driven by the topbar hamburger. */
  mobileOpen: boolean;
  /** Toggle desktop collapse (bottom pill button). */
  onToggleCollapse: () => void;
  /** Close the mobile drawer (backdrop click, nav-link click). */
  onCloseMobile: () => void;
}

function initialsOf(name: string | undefined | null): string {
  if (!name) return '?';
  return (
    name
      .split(' ')
      .filter(Boolean)
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  );
}

/**
 * AdminShell v3 sidebar — Linear/Vercel inspired dark rail with sectioned nav,
 * per-item chips, an always-visible user footer, and a collapse pill anchored
 * to the bottom. On mobile (< lg) the sidebar becomes a slide-in drawer with a
 * backdrop; on desktop the width toggles between 256px and 72px.
 */
export function Sidebar({ collapsed, mobileOpen, onToggleCollapse, onCloseMobile }: SidebarProps) {
  const { user, hasRole, logout } = useAuth();
  const { pathname } = useLocation();

  const canSee = (item: NavItem) => !item.roles || hasRole(...item.roles);
  const isActive = (item: NavItem) =>
    item.matchPrefix ? pathname.startsWith(item.matchPrefix) : pathname === item.to;

  const initials = initialsOf(user?.name);
  const meta = user?.email ?? user?.phone ?? '';

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          className="app-sidebar__backdrop"
          aria-label="Close sidebar"
          onClick={onCloseMobile}
        />
      )}
      <aside
        className={`app-sidebar ${collapsed ? 'is-collapsed' : ''} ${
          mobileOpen ? 'is-mobile-open' : ''
        }`}
        aria-label="Primary navigation"
      >
        <div className="app-sidebar__brand">
          <span className="app-sidebar__mark" aria-hidden="true">
            E
          </span>
          <span className="app-sidebar__brand-text">
            <span className="app-sidebar__brand-name">Elite NonVeg</span>
            <span className="app-sidebar__brand-sub">{WORKSPACE_LABEL}</span>
          </span>
        </div>

        <nav className="app-sidebar__nav">
          {NAV_GROUPS.map((group, gi) => {
            const items = group.items.filter(canSee);
            if (items.length === 0) return null;
            const key = group.label ?? `group-${gi}`;
            return (
              <div key={key} className="app-sidebar__group">
                {group.label ? (
                  <div className="app-sidebar__group-label" aria-hidden={collapsed}>
                    <span>{group.label}</span>
                    <span className="app-sidebar__group-rule" />
                  </div>
                ) : (
                  <div className="app-sidebar__group-spacer" aria-hidden="true" />
                )}
                <div className="app-sidebar__group-items">
                  {items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={!item.matchPrefix}
                      className={`app-nav-link ${isActive(item) ? 'is-active' : ''}`}
                      title={collapsed ? item.label : undefined}
                      onClick={onCloseMobile}
                    >
                      <span className="app-nav-link__icon" aria-hidden="true">
                        <Icon name={item.icon} size={18} />
                      </span>
                      <span className="app-nav-link__label">{item.label}</span>
                      {item.badge != null && (
                        <span className="app-nav-link__badge">{item.badge}</span>
                      )}
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="app-sidebar__footer">
          <div
            className="app-sidebar__user"
            title={collapsed ? `${user?.name ?? 'Staff'} — ${meta}` : undefined}
          >
            <span className="app-sidebar__avatar" aria-hidden="true">
              {initials}
            </span>
            <span className="app-sidebar__user-text">
              <span className="app-sidebar__user-name">{user?.name ?? 'Staff'}</span>
              {meta && <span className="app-sidebar__user-role">{meta}</span>}
            </span>
            <button
              type="button"
              className="app-sidebar__icon-btn"
              onClick={logout}
              aria-label="Sign out"
              title="Sign out"
            >
              <Icon name="logout" size={16} />
            </button>
          </div>
          <div className="app-sidebar__meta">
            <span className="app-sidebar__version">{APP_VERSION}</span>
            <button
              type="button"
              className="app-sidebar__collapse-btn"
              onClick={onToggleCollapse}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? 'Expand' : 'Collapse'}
            >
              <Icon name={collapsed ? 'chevron-right' : 'chevron-left'} size={14} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
