/**
 * Framework-agnostic bridge to the toast API.
 *
 * Non-React modules (e.g. `apiClient`) can call `notifyToast('error', msg)` to
 * surface a toast without importing React. The `<ToastProvider>` registers the
 * live handler on mount via `setToastHandler` and unregisters on unmount, so
 * calls made before mount (or after unmount) are silently no-ops.
 */

export type ToastVariant = 'success' | 'error' | 'info';

export interface ToastHandler {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

let handler: ToastHandler | null = null;

export function setToastHandler(next: ToastHandler | null): void {
  handler = next;
}

export function notifyToast(variant: ToastVariant, message: string): void {
  if (!handler) return;
  handler[variant](message);
}
