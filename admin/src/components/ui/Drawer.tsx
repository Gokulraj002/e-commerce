import { useEffect, type ReactNode } from 'react';

import { Icon } from './Icon';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Sticky footer, typically holding action buttons. */
  footer?: ReactNode;
}

/**
 * Right-side slide-over panel for quick create/edit forms and detail peeks
 * without leaving the current list. Closes on backdrop click or Escape.
 */
export function Drawer({ open, onClose, title, children, footer }: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="ui-drawer-backdrop" onClick={onClose} />
      <aside className="ui-drawer" role="dialog" aria-modal="true" aria-label={title}>
        <header className="ui-drawer__header">
          <h2 className="ui-card-title">{title}</h2>
          <button type="button" className="app-icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </header>
        <div className="ui-drawer__body">{children}</div>
        {footer && <footer className="ui-drawer__footer">{footer}</footer>}
      </aside>
    </>
  );
}
