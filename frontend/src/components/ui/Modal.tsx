import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Clicking the backdrop closes the modal (default true). */
  dismissOnBackdrop?: boolean;
}

/** Centered dialog rendered in a portal, with fade/scale motion. */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  dismissOnBackdrop = true,
}: ModalProps): JSX.Element | null {
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

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="en-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={dismissOnBackdrop ? onClose : undefined}
        >
          <motion.div
            className="en-modal"
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            {title && (
              <div className="en-modal__header">
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
            )}
            <div className="en-modal__body">{children}</div>
            {footer && <div className="en-modal__header" style={{ borderTop: '1px solid var(--en-border)', borderBottom: 0 }}>{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
