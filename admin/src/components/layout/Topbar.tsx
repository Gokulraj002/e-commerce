import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
  type SVGProps,
} from 'react';
import { Link } from 'react-router-dom';

import { Icon } from '@/components/ui';
import { useAuth } from '@/features/auth';
import { useCommandPalette } from '@/features/command';
import { ROUTES } from '@/routes/paths';

import { Breadcrumbs } from './Breadcrumbs';

interface TopbarProps {
  /** Open the sidebar mobile drawer (hamburger button, mobile only). */
  onOpenMobileSidebar: () => void;
}

/** Inline bell so the topbar stays self-contained without expanding the Icon set. */
function BellIcon({ size = 18, ...rest }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}

/** Close a popover when the user clicks outside its ref. Idle when `open` is false. */
function useOutsideClose(ref: RefObject<HTMLElement>, open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, ref, onClose]);
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
 * AdminShell v3 topbar — hamburger (mobile) + breadcrumbs on the left, a ghost
 * command-palette chip in the middle, and notification bell + env chip + user
 * menu on the right. Uses the frosted-glass surface defined in main.scss so
 * the topbar reads as a floating layer above scrolled content.
 */
export function Topbar({ onOpenMobileSidebar }: TopbarProps) {
  const { user, logout } = useAuth();
  const { toggle: toggleCommandPalette } = useCommandPalette();

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useOutsideClose(userMenuRef, userMenuOpen, () => setUserMenuOpen(false));
  useOutsideClose(notifRef, notifOpen, () => setNotifOpen(false));

  const modifierGlyph = useMemo(
    () =>
      typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/i.test(navigator.userAgent)
        ? '⌘'
        : 'Ctrl',
    [],
  );

  // Environment badge derives from the host, not the API base, so the chip is
  // meaningful even for previews on `*.vercel.app` etc.
  const env = useMemo<{ label: string; tone: 'dev' | 'prod' }>(() => {
    if (typeof window === 'undefined') return { label: 'PROD', tone: 'prod' };
    const host = window.location.hostname;
    const isDev =
      host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local') || host === '';
    return isDev ? { label: 'DEV', tone: 'dev' } : { label: 'PROD', tone: 'prod' };
  }, []);

  const initials = initialsOf(user?.name);
  const contact = user?.email ?? user?.phone ?? '';

  const closeUserMenu = () => setUserMenuOpen(false);

  return (
    <header className="app-topbar">
      <button
        type="button"
        className="app-icon-btn app-topbar__hamburger"
        onClick={onOpenMobileSidebar}
        aria-label="Open sidebar"
      >
        <Icon name="menu" />
      </button>

      <div className="app-topbar__crumbs">
        <Breadcrumbs />
      </div>

      <div className="app-topbar__spacer" />

      <button
        type="button"
        className="app-cmd-chip"
        onClick={toggleCommandPalette}
        aria-label="Open command palette"
        title={`Search anything (${modifierGlyph}K)`}
      >
        <span className="app-cmd-chip__icon" aria-hidden="true">
          <Icon name="search" size={14} />
        </span>
        <span className="app-cmd-chip__label">Search or jump to…</span>
        <span className="app-cmd-chip__kbd" aria-hidden="true">
          <kbd>{modifierGlyph}</kbd>
          <kbd>K</kbd>
        </span>
      </button>

      <div className="app-topbar__pop-wrap" ref={notifRef}>
        <button
          type="button"
          className="app-icon-btn app-topbar__bell"
          onClick={() => setNotifOpen((v) => !v)}
          aria-label="Notifications"
          aria-haspopup="menu"
          aria-expanded={notifOpen}
        >
          <BellIcon />
        </button>
        {notifOpen && (
          <div className="app-pop app-pop--right" role="menu">
            <div className="app-pop__title">Notifications</div>
            <div className="app-pop__empty">
              <Icon name="alert" size={20} />
              <div>No new alerts</div>
              <p>You are all caught up. New order &amp; stock alerts will land here.</p>
            </div>
          </div>
        )}
      </div>

      <span
        className={`app-topbar__env app-topbar__env--${env.tone}`}
        title={`Environment: ${env.label}`}
      >
        {env.label}
      </span>

      <div className="app-topbar__pop-wrap" ref={userMenuRef}>
        <button
          type="button"
          className="app-topbar__user-btn"
          onClick={() => setUserMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={userMenuOpen}
        >
          <span className="app-topbar__avatar" aria-hidden="true">
            {initials}
          </span>
          <span className="app-topbar__user-info">
            <span className="app-topbar__user-name">{user?.name ?? 'Staff'}</span>
            {contact && <span className="app-topbar__user-role">{contact}</span>}
          </span>
          <Icon name="chevron-down" size={14} />
        </button>
        {userMenuOpen && (
          <div className="app-pop app-pop--right app-pop--user" role="menu">
            <div className="app-pop__user">
              <div className="app-pop__user-name">{user?.name ?? 'Staff'}</div>
              {contact && <div className="app-pop__user-meta">{contact}</div>}
            </div>
            <div className="app-pop__divider" />
            <Link
              to={ROUTES.settings}
              className="app-pop__item"
              role="menuitem"
              onClick={closeUserMenu}
            >
              <Icon name="users" size={16} />
              <span>Profile</span>
            </Link>
            <Link
              to={ROUTES.settings}
              className="app-pop__item"
              role="menuitem"
              onClick={closeUserMenu}
            >
              <Icon name="sliders" size={16} />
              <span>Preferences</span>
            </Link>
            <div className="app-pop__divider" />
            <button
              type="button"
              className="app-pop__item app-pop__item--danger"
              role="menuitem"
              onClick={() => {
                closeUserMenu();
                logout();
              }}
            >
              <Icon name="logout" size={16} />
              <span>Sign out</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
