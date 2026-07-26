/**
 * Money & weight formatting helpers.
 *
 * All monetary values move through the system as integer paise (₹1 = 100).
 * Products are sold by weight in grams. Keep every rupee/gram string in the
 * UI going through these helpers so formatting stays consistent.
 */
import { MONEY, STORE } from '@elite/shared';

const inr = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 0,
});

const inrWithPaise = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Format integer paise as a rupee string, e.g. `49900 → "₹499"`.
 * Whole-rupee amounts drop the decimals; fractional amounts keep two.
 */
export function formatPaise(paise: number): string {
  const rupees = paise / MONEY.UNIT_PER_RUPEE;
  const isWhole = paise % MONEY.UNIT_PER_RUPEE === 0;
  return `${STORE.CURRENCY_SYMBOL}${isWhole ? inr.format(rupees) : inrWithPaise.format(rupees)}`;
}

/** Convert integer paise to a plain rupee number (for calculations, not display). */
export function paiseToRupees(paise: number): number {
  return paise / MONEY.UNIT_PER_RUPEE;
}

/** Convert a rupee amount to integer paise. */
export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * MONEY.UNIT_PER_RUPEE);
}

/**
 * Percentage saved of MRP vs selling price, rounded. Returns 0 when there is
 * no discount so callers can hide the badge.
 */
export function discountPercent(mrpPaise: number, pricePaise: number): number {
  if (mrpPaise <= 0 || pricePaise >= mrpPaise) return 0;
  return Math.round(((mrpPaise - pricePaise) / mrpPaise) * 100);
}

/**
 * Format a weight in grams for display, e.g. `250 → "250 g"`, `1000 → "1 kg"`,
 * `1500 → "1.5 kg"`.
 */
export function formatWeight(grams: number): string {
  if (grams >= 1000) {
    const kg = grams / 1000;
    return `${Number.isInteger(kg) ? kg : kg.toFixed(1)} kg`;
  }
  return `${grams} g`;
}
