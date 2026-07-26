import type { ReactNode } from 'react';

import { Icon, type IconName } from './Icon';

interface EmptyStateProps {
  /** Optional icon shown above the title. */
  icon?: IconName;
  title: string;
  /** Supporting copy that explains what to do next. */
  message?: ReactNode;
  /** Primary call-to-action, usually a button. */
  action?: ReactNode;
  /** Compact variant used inside DataTable cells. */
  compact?: boolean;
  className?: string;
}

/** Friendly empty placeholder — heading, subtext, optional primary action. */
export function EmptyState({ icon, title, message, action, compact, className = '' }: EmptyStateProps) {
  return (
    <div
      className={`ui-empty text-center ${compact ? 'py-3' : 'py-5'} ${className}`}
      role="status"
    >
      {icon && (
        <div className="text-muted-2 mb-2" aria-hidden="true">
          <Icon name={icon} size={compact ? 22 : 28} />
        </div>
      )}
      <div className={`fw-semibold ${compact ? '' : 'fs-6'}`}>{title}</div>
      {message && <div className="text-muted-2 small mt-1">{message}</div>}
      {action && <div className="mt-3 d-inline-flex gap-2">{action}</div>}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  message?: ReactNode;
  /** Optional retry callback — renders a "Retry" button. */
  onRetry?: () => void;
  className?: string;
}

/** Inline error banner for failed queries. Renders a Bootstrap alert. */
export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  className = '',
}: ErrorStateProps) {
  return (
    <div className={`alert alert-danger d-flex align-items-start gap-2 ${className}`} role="alert">
      <span aria-hidden="true" className="mt-1">
        <Icon name="alert" size={18} />
      </span>
      <div className="flex-grow-1">
        <div className="fw-semibold">{title}</div>
        {message && <div className="small mt-1">{message}</div>}
      </div>
      {onRetry && (
        <button type="button" className="btn btn-sm btn-outline-danger" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}
