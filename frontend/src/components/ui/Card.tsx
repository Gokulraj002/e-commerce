import type { HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Adds a lift-on-hover interaction (use for clickable product tiles). */
  hoverable?: boolean;
  /** Frosted-glass variant for overlays on imagery. */
  glass?: boolean;
  /** Inner padding preset. */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children: ReactNode;
}

const PADDING_CLASS: Record<NonNullable<CardProps['padding']>, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-4 p-lg-5',
};

/** Rounded, soft-shadowed surface — the primary content container. */
export function Card({
  hoverable = false,
  glass = false,
  padding = 'md',
  className,
  children,
  ...rest
}: CardProps): JSX.Element {
  const classes = [
    'en-card',
    hoverable ? 'en-card--hover' : '',
    glass ? 'en-card--glass' : '',
    PADDING_CLASS[padding],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
}
