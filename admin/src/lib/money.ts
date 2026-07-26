import { MONEY, STORE } from '@elite/shared';

/**
 * Money & weight formatting helpers.
 * Money is stored/transported as integer paise (₹1 = 100 paise).
 * Stock/pack weight is stored in grams.
 */

const rupeeFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: STORE.CURRENCY,
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

/** Format integer paise as an Indian-Rupee string, e.g. 45000 → "₹450". */
export function formatPaise(paise: number | null | undefined): string {
  if (paise == null || Number.isNaN(paise)) return '—';
  return rupeeFormatter.format(paise / MONEY.UNIT_PER_RUPEE);
}

/** Convert rupees (from a form input) to integer paise for the API. */
export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * MONEY.UNIT_PER_RUPEE);
}

/** Convert integer paise to rupees (for editing in a form). */
export function paiseToRupees(paise: number): number {
  return paise / MONEY.UNIT_PER_RUPEE;
}

/** Format grams as a human weight, e.g. 250 → "250 g", 1000 → "1 kg". */
export function formatWeight(grams: number | null | undefined): string {
  if (grams == null || Number.isNaN(grams)) return '—';
  if (grams >= 1000) {
    const kg = grams / 1000;
    return `${Number.isInteger(kg) ? kg : kg.toFixed(2)} kg`;
  }
  return `${grams} g`;
}

/** Compact number, e.g. 12500 → "12.5K" (for stat tiles). */
export function formatCompact(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(
    value,
  );
}
