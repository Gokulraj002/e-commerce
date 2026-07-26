import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { Icon } from '../Icon';

export type ToastTone = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  message?: string;
}

interface ToastOptions {
  title: string;
  message?: string;
  /** Auto-dismiss delay in ms. Default 4000. Pass 0 to keep it sticky. */
  duration?: number;
}

interface ToastApi {
  success: (opts: ToastOptions) => void;
  error: (opts: ToastOptions) => void;
  info: (opts: ToastOptions) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const TONE_ICON: Record<ToastTone, 'star' | 'alert' | 'refresh'> = {
  success: 'star',
  error: 'alert',
  info: 'refresh',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (tone: ToastTone, { title, message, duration = 4000 }: ToastOptions) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, tone, title, message }]);
      if (duration > 0) {
        window.setTimeout(() => dismiss(id), duration);
      }
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (opts) => push('success', opts),
      error: (opts) => push('error', opts),
      info: (opts) => push('info', opts),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="ui-toast-stack" role="region" aria-label="Notifications">
        {toasts.map((t) => (
          <div key={t.id} className={`ui-toast ui-toast--${t.tone}`} role="alert">
            <Icon name={TONE_ICON[t.tone]} size={18} />
            <div className="flex-grow-1">
              <div className="ui-toast__title">{t.title}</div>
              {t.message && <div className="ui-toast__msg">{t.message}</div>}
            </div>
            <button
              type="button"
              className="app-icon-btn"
              style={{ width: 28, height: 28 }}
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
            >
              <Icon name="close" size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** Fire toasts from anywhere under <ToastProvider>. */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a <ToastProvider>');
  return ctx;
}
