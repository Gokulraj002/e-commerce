export interface RatingProps {
  /** Rating 0–5. */
  value: number;
  /** Optional review count shown after the stars. */
  count?: number;
  /** Star glyph size in rem. */
  size?: number;
  className?: string;
}

function Star({ fill }: { fill: number }): JSX.Element {
  // fill: 0 (empty) → 1 (full). Uses a clipped overlay for partial stars.
  return (
    <span style={{ position: 'relative', display: 'inline-block', lineHeight: 1 }} aria-hidden>
      <span style={{ color: 'var(--en-border)' }}>★</span>
      <span
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          width: `${Math.max(0, Math.min(1, fill)) * 100}%`,
          color: 'var(--en-gold)',
        }}
      >
        ★
      </span>
    </span>
  );
}

/** Read-only 5-star rating with optional review count. */
export function Rating({ value, count, size = 0.9, className }: RatingProps): JSX.Element {
  const clamped = Math.max(0, Math.min(5, value));
  return (
    <span
      className={['en-rating', className].filter(Boolean).join(' ')}
      style={{ fontSize: `${size}rem` }}
      aria-label={`Rated ${clamped.toFixed(1)} out of 5`}
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <Star key={i} fill={clamped - i} />
      ))}
      {count !== undefined && <span className="en-rating__count">({count})</span>}
    </span>
  );
}
