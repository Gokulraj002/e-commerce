export interface SpinnerProps {
  /** Diameter in pixels. */
  size?: number;
  className?: string;
  label?: string;
}

/** Minimal gold-accented loading spinner. */
export function Spinner({ size = 20, className, label = 'Loading' }: SpinnerProps): JSX.Element {
  return (
    <span
      className={['en-spinner', className].filter(Boolean).join(' ')}
      style={{ width: size, height: size }}
      role="status"
      aria-label={label}
    />
  );
}
