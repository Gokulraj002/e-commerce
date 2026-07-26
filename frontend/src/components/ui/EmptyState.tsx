import type { ReactNode } from 'react';

export interface EmptyStateProps {
  /** Emoji or icon node shown above the title. */
  icon?: ReactNode;
  title: string;
  description?: string;
  /** Optional call-to-action (e.g. a <Button> or <Link>). */
  action?: ReactNode;
  className?: string;
}

/** Friendly placeholder for empty lists — cart, wishlist, orders, search. */
export function EmptyState({
  icon = '🍽️',
  title,
  description,
  action,
  className,
}: EmptyStateProps): JSX.Element {
  return (
    <div className={['en-empty', className].filter(Boolean).join(' ')}>
      <div className="en-empty__icon" aria-hidden>
        {icon}
      </div>
      <h3 className="en-display h4 mb-0">{title}</h3>
      {description && <p className="en-text-dim mb-0">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
