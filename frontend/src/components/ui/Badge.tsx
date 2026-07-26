import type { ReactNode } from 'react';

export type BadgeTone = 'fresh' | 'gold' | 'crimson' | 'neutral';

const TONE_CLASS: Record<BadgeTone, string> = {
  fresh: 'en-badge--fresh',
  gold: 'en-badge--gold',
  crimson: 'en-badge--crimson',
  neutral: 'en-badge--neutral',
};

export interface BadgeProps {
  tone?: BadgeTone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Small status pill — e.g. "Fresh", "Bestseller", "20% OFF". */
export function Badge({ tone = 'neutral', icon, children, className }: BadgeProps): JSX.Element {
  return (
    <span className={['en-badge', TONE_CLASS[tone], className].filter(Boolean).join(' ')}>
      {icon}
      {children}
    </span>
  );
}
