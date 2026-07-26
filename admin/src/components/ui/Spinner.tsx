interface SpinnerProps {
  label?: string;
  /** 'sm' for inline use, default for standalone. */
  size?: 'sm' | 'md';
  className?: string;
}

/** Bootstrap spinner with an optional label. */
export function Spinner({ label, size = 'md', className = '' }: SpinnerProps) {
  return (
    <div className={`d-inline-flex align-items-center gap-2 ${className}`}>
      <span
        className={`spinner-border text-danger ${size === 'sm' ? 'spinner-border-sm' : ''}`}
        role="status"
        aria-hidden="true"
      />
      {label && <span className="text-muted-2 small">{label}</span>}
    </div>
  );
}
