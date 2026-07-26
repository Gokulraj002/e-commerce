import { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import { CommandPalette } from '@/features/command';

import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

const COLLAPSE_KEY = 'admin.sidebar.collapsed';
const DESKTOP_QUERY = '(min-width: 992px)';

/** Read the persisted collapsed flag once at mount (SSR-safe). */
function readCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * App chrome: fixed dark sidebar + sticky topbar wrapping the routed page.
 *
 * The desktop rail's collapsed/expanded state is persisted under
 * `admin.sidebar.collapsed`; the mobile drawer's open state is transient and
 * always closes on route change so users never land on a new page with the
 * drawer still covering it.
 */
export function AdminLayout() {
  const [collapsed, setCollapsed] = useState<boolean>(readCollapsed);
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);
  const { pathname } = useLocation();

  // Persist rail state so a reload brings the sidebar back to how the user left it.
  useEffect(() => {
    try {
      window.localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
    } catch {
      // Ignore quota / disabled-storage errors; state stays session-only.
    }
  }, [collapsed]);

  // Auto-close the mobile drawer whenever we cross into desktop, so a viewport
  // resize never leaves the layout in a weird half-state.
  useEffect(() => {
    if (typeof window === 'undefined' || !mobileOpen) return;
    const mql = window.matchMedia(DESKTOP_QUERY);
    const onChange = () => {
      if (mql.matches) setMobileOpen(false);
    };
    if (mql.matches) setMobileOpen(false);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [mobileOpen]);

  // Route changes on mobile should not leave the drawer covering the new page.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Lock body scroll while the mobile drawer is open — the sidebar owns the viewport.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = mobileOpen ? 'hidden' : prev;
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  const toggleCollapse = useCallback(() => setCollapsed((v) => !v), []);
  const openMobile = useCallback(() => setMobileOpen(true), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  return (
    <div className="app-shell">
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onToggleCollapse={toggleCollapse}
        onCloseMobile={closeMobile}
      />
      <div className={`app-main ${collapsed ? 'is-collapsed' : ''}`}>
        <Topbar onOpenMobileSidebar={openMobile} />
        <main className="app-content">
          <Outlet />
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
