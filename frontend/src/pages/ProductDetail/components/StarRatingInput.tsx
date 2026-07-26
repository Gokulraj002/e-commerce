import { useState } from 'react';

export interface StarRatingInputProps {
  value: number;
  onChange: (next: number) => void;
  disabled?: boolean;
}

/** Interactive 1–5 star picker used by the write-a-review form. */
export function StarRatingInput({ value, onChange, disabled = false }: StarRatingInputProps): JSX.Element {
  const [hover, setHover] = useState(0);
  const shown = hover || value;

  return (
    <div
      className="d-inline-flex gap-1"
      role="radiogroup"
      aria-label="Your rating"
      onMouseLeave={() => setHover(0)}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= shown;
        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} star${star > 1 ? 's' : ''}`}
            disabled={disabled}
            onMouseEnter={() => setHover(star)}
            onFocus={() => setHover(star)}
            onClick={() => onChange(star)}
            className="en-link-reset"
            style={{
              cursor: disabled ? 'not-allowed' : 'pointer',
              fontSize: '1.6rem',
              lineHeight: 1,
              color: filled ? 'var(--en-gold)' : 'var(--en-border)',
              transition: 'color 0.12s ease',
            }}
          >
            ★
          </button>
        );
      })}
    </div>
  );
}
