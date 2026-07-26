import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Which edge the panel slides in from. */
  side?: 'right' | 'left';
}

/** Slide-in panel rendered in a portal — used for the mini-cart & filters. */
export function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
  side = 'right',
}: DrawerProps): JSX.Element | null {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  const offscreen = side === 'right' ? '100%' : '-100%';
  const anchor = side === 'right' ? { right: 0 } : { left: 0, borderRight: '1px solid var(--en-border)', borderLeft: 0 };

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="en-drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.aside
            className="en-drawer"
            style={anchor}
            role="dialog"
            aria-modal="true"
            initial={{ x: offscreen }}
            animate={{ x: 0 }}
            exit={{ x: offscreen }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="en-drawer__header">
              <h3 className="en-display h5 mb-0">{title}</h3>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={onClose}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="en-drawer__body">{children}</div>
            {footer && <div className="en-drawer__footer">{footer}</div>}
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
