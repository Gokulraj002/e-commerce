import { discountPercent, formatPaise } from '@/lib/money';

export interface PriceProps {
  /** Selling price in integer paise. */
  pricePaise: number;
  /** Optional MRP in paise; when higher than price, shows strike-through + % off. */
  mrpPaise?: number;
  /** Hide the "% OFF" chip even when there is a discount. */
  hideOff?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_STYLE: Record<NonNullable<PriceProps['size']>, string> = {
  sm: '0.95rem',
  md: '1.15rem',
  lg: '1.6rem',
};

/** Renders a paise price with optional MRP strike-through and discount chip. */
export function Price({
  pricePaise,
  mrpPaise,
  hideOff = false,
  size = 'md',
  className,
}: PriceProps): JSX.Element {
  const off = mrpPaise ? discountPercent(mrpPaise, pricePaise) : 0;
  const showMrp = mrpPaise !== undefined && mrpPaise > pricePaise;

  return (
    <span className={['en-price', 'd-inline-flex', 'align-items-baseline', className].filter(Boolean).join(' ')}>
      <span style={{ fontSize: SIZE_STYLE[size] }}>{formatPaise(pricePaise)}</span>
      {showMrp && <span className="en-price__mrp">{formatPaise(mrpPaise)}</span>}
      {showMrp && !hideOff && off > 0 && <span className="en-price__off">{off}% OFF</span>}
    </span>
  );
}
