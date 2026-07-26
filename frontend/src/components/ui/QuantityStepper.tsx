export interface QuantityStepperProps {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  /** Accessible label describing what is being counted. */
  ariaLabel?: string;
}

/** Compact +/- counter used on product tiles and in the cart. */
export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99,
  step = 1,
  disabled = false,
  ariaLabel = 'Quantity',
}: QuantityStepperProps): JSX.Element {
  const dec = (): void => onChange(Math.max(min, value - step));
  const inc = (): void => onChange(Math.min(max, value + step));

  return (
    <div className="en-stepper" role="group" aria-label={ariaLabel}>
      <button type="button" onClick={dec} disabled={disabled || value <= min} aria-label="Decrease">
        −
      </button>
      <span className="en-stepper__value" aria-live="polite">
        {value}
      </span>
      <button type="button" onClick={inc} disabled={disabled || value >= max} aria-label="Increase">
        +
      </button>
    </div>
  );
}
