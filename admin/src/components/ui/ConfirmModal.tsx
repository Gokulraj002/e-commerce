import { useEffect } from 'react';

import { Spinner } from './Spinner';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Use the danger style for destructive confirmations. */
  tone?: 'primary' | 'danger';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Accessible confirmation dialog built on Bootstrap's modal markup. */
export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'primary',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, loading, onCancel]);

  if (!open) return null;

  return (
    <>
      <div className="modal-backdrop show" />
      <div className="modal d-block" role="dialog" aria-modal="true" tabIndex={-1}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">{title}</h5>
              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                disabled={loading}
                onClick={onCancel}
              />
            </div>
            <div className="modal-body text-body-secondary">{message}</div>
            <div className="modal-footer">
              <button type="button" className="btn btn-light" disabled={loading} onClick={onCancel}>
                {cancelLabel}
              </button>
              <button
                type="button"
                className={`btn btn-${tone}`}
                disabled={loading}
                onClick={onConfirm}
              >
                {loading ? <Spinner size="sm" /> : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
