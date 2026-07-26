/**
 * Toast notification provider.
 *
 * Renders a small stack of dismissible toasts in a portal (fixed top-right).
 * Toasts auto-dismiss after 4s and can be closed on click. Access the API
 * through `useToast()` which returns `{ success, error, info }`.
 *
 * The provider also registers itself with `toastBridge` (a plain module-level
 * setter) so non-React modules like `apiClient` can surface toasts without
 * needing to consume React context.
 */
import { AnimatePresence, motion } from 'framer-motion';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

import { setToastHandler } from './toastBridge';

export type ToastVariant = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
}

export interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const AUTO_DISMISS_MS = 4000;

/** Icon per variant — kept as short glyphs to avoid extra icon deps. */
const VARIANT_ICON: Record<ToastVariant, string> = {
  success: '✓',
  error: '⚠',
  info: 'ℹ',
};

/** Border accent color per variant, sourced from design tokens. */
const VARIANT_ACCENT: Record<ToastVariant, string> = {
  success: 'var(--en-green)',
  error: 'var(--en-accent)',
  info: 'var(--en-gold)',
};

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }): JSX.Element {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 40, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 40, scale: 0.96 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      role="status"
      aria-live={toast.variant === 'error' ? 'assertive' : 'polite'}
      onClick={() => onDismiss(toast.id)}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        minWidth: 260,
        maxWidth: 380,
        padding: '0.85rem 1rem',
        background: 'var(--en-surface-raised)',
        color: 'var(--en-text)',
        borderRadius: 'var(--en-radius)',
        border: '1px solid var(--en-border)',
        borderLeft: `4px solid ${VARIANT_ACCENT[toast.variant]}`,
        boxShadow: 'var(--en-shadow)',
        cursor: 'pointer',
        fontFamily: 'var(--en-font-body)',
        fontSize: '0.925rem',
        lineHeight: 1.4,
      }}
    >
      <span
        aria-hidden
        style={{
          color: VARIANT_ACCENT[toast.variant],
          fontSize: '1.1rem',
          lineHeight: 1.2,
          flexShrink: 0,
        }}
      >
        {VARIANT_ICON[toast.variant]}
      </span>
      <span style={{ flex: 1 }}>{toast.message}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(toast.id);
        }}
        aria-label="Dismiss notification"
        style={{
          appearance: 'none',
          background: 'transparent',
          border: 0,
          padding: 0,
          color: 'var(--en-muted)',
          cursor: 'pointer',
          fontSize: '1rem',
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        ✕
      </button>
    </motion.div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }): JSX.Element {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextIdRef = useRef(1);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    const timer = timersRef.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message: string, variant: ToastVariant): void => {
      const id = nextIdRef.current++;
      setToasts((prev) => [...prev, { id, message, variant }]);
      const timer = setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
      timersRef.current.set(id, timer);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (message) => push(message, 'success'),
      error: (message) => push(message, 'error'),
      info: (message) => push(message, 'info'),
    }),
    [push],
  );

  // Register the imperative bridge for non-React callers (apiClient, etc.).
  useEffect(() => {
    setToastHandler(api);
    return () => setToastHandler(null);
  }, [api]);

  // Clear any pending timers on unmount so we don't leak.
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div
          aria-live="polite"
          aria-label="Notifications"
          style={{
            position: 'fixed',
            top: '1rem',
            right: '1rem',
            zIndex: 1100,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            pointerEvents: 'none',
          }}
        >
          <AnimatePresence initial={false}>
            {toasts.map((toast) => (
              <div key={toast.id} style={{ pointerEvents: 'auto' }}>
                <ToastCard toast={toast} onDismiss={dismiss} />
              </div>
            ))}
          </AnimatePresence>
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

/** Access the toast API. Must be called from inside a `<ToastProvider>`. */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}
