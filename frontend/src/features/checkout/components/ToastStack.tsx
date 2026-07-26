import { AnimatePresence, motion } from 'framer-motion';

import type { Toast, ToastTone } from './useToasts';

export interface ToastStackProps {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}

const TONE_BORDER: Record<ToastTone, string> = {
  success: 'var(--en-green)',
  error: 'var(--en-crimson)',
  info: 'var(--en-gold)',
};

const TONE_ICON: Record<ToastTone, string> = {
  success: '✓',
  error: '!',
  info: 'i',
};

/** Fixed, top-right toast stack. Presentational — state lives in `useToasts`. */
export function ToastStack({ toasts, onDismiss }: ToastStackProps): JSX.Element {
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      style={{
        position: 'fixed',
        top: '1rem',
        right: '1rem',
        zIndex: 1080,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        maxWidth: 'min(360px, calc(100vw - 2rem))',
      }}
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            role="status"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.2 }}
            onClick={() => onDismiss(toast.id)}
            className="en-card"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 1rem',
              cursor: 'pointer',
              borderLeft: `3px solid ${TONE_BORDER[toast.tone]}`,
            }}
          >
            <span
              aria-hidden
              style={{
                flex: '0 0 auto',
                width: 22,
                height: 22,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                fontSize: '0.8rem',
                fontWeight: 700,
                color: 'var(--en-bg)',
                background: TONE_BORDER[toast.tone],
              }}
            >
              {TONE_ICON[toast.tone]}
            </span>
            <span className="small" style={{ color: 'var(--en-text)' }}>
              {toast.message}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
