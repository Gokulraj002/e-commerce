import type { CSSProperties } from 'react';

export interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  /** Border radius; `pill` for circular avatars/chips. */
  radius?: number | string | 'pill';
  /** Render N stacked lines (useful for text placeholders). */
  count?: number;
  className?: string;
}

/** Shimmering placeholder for loading states. */
export function Skeleton({
  width = '100%',
  height = '1rem',
  radius = 'var(--en-radius)',
  count = 1,
  className,
}: SkeletonProps): JSX.Element {
  const borderRadius = radius === 'pill' ? '999px' : radius;

  const line = (key: number): JSX.Element => {
    const style: CSSProperties = { width, height, borderRadius };
    return (
      <span
        key={key}
        className={['en-skeleton', 'd-block', className].filter(Boolean).join(' ')}
        style={style}
      />
    );
  };

  if (count === 1) return line(0);

  return (
    <span className="d-flex flex-column gap-2">
      {Array.from({ length: count }, (_, i) => line(i))}
    </span>
  );
}
