import type { ProductVariantDTO } from '@elite/shared';

import { formatPaise, formatWeight } from '@/lib/money';

export interface VariantSelectorProps {
  variants: ProductVariantDTO[];
  selectedId: string | null;
  onSelect: (variantId: string) => void;
  /**
   * `default` — legacy standalone card pills (used elsewhere).
   * `premium` — magazine PDP segmented pills with a per-kg equivalent line.
   */
  variant?: 'default' | 'premium';
}

/**
 * Weight/pack pills (250 g / 500 g / 1 kg …).
 *
 * The `default` skin keeps the historical standalone card look. The `premium`
 * skin, used by the editorial PDP, renders segmented pills with a small
 * ₹-per-kg equivalent under each option so shoppers can price-compare packs at
 * a glance. Out-of-stock packs stay visible but disabled either way.
 */
export function VariantSelector({
  variants,
  selectedId,
  onSelect,
  variant = 'default',
}: VariantSelectorProps): JSX.Element {
  if (variant === 'premium') {
    return (
      <div
        role="radiogroup"
        aria-label="Select a pack size"
        className="en-pdp-v2__pack"
      >
        {variants.map((v) => {
          const isSelected = v.id === selectedId;
          const disabled = !v.inStock;
          // Per-kg equivalent so a 250 g pack can be compared against 1 kg.
          const perKgPaise = v.weightG > 0 ? Math.round((v.pricePaise * 1000) / v.weightG) : 0;
          return (
            <button
              key={v.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={disabled}
              onClick={() => onSelect(v.id)}
              className={`en-pdp-v2__pack-pill${isSelected ? ' is-selected' : ''}`}
            >
              <span className="en-pdp-v2__pack-weight">{formatWeight(v.weightG)}</span>
              <span className="en-pdp-v2__pack-price">
                {disabled ? 'Out of stock' : formatPaise(v.pricePaise)}
              </span>
              {!disabled && perKgPaise > 0 && (
                <span className="en-pdp-v2__pack-perkg">
                  {formatPaise(perKgPaise)} / kg
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div role="radiogroup" aria-label="Select a pack size" className="d-flex flex-wrap gap-2">
      {variants.map((v) => {
        const isSelected = v.id === selectedId;
        const disabled = !v.inStock;
        return (
          <button
            key={v.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={disabled}
            onClick={() => onSelect(v.id)}
            className="en-link-reset text-start"
            style={{
              minWidth: 104,
              padding: '0.55rem 0.85rem',
              borderRadius: 'var(--en-radius)',
              cursor: disabled ? 'not-allowed' : 'pointer',
              background: isSelected ? 'rgba(212, 160, 23, 0.12)' : 'var(--en-surface)',
              border: `1.5px solid ${isSelected ? 'var(--en-gold)' : 'var(--en-border)'}`,
              opacity: disabled ? 0.5 : 1,
              transition: 'border-color 0.15s ease, background 0.15s ease',
            }}
          >
            <span className="d-block fw-semibold" style={{ color: 'var(--en-text)' }}>
              {formatWeight(v.weightG)}
            </span>
            <span className="d-block small" style={{ color: 'var(--en-text-dim)' }}>
              {disabled ? 'Out of stock' : formatPaise(v.pricePaise)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
