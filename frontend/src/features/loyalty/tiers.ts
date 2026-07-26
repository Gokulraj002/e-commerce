/**
 * Loyalty tier catalogue — "Elite Chef Ranks".
 *
 * Tiers are unlocked when BOTH thresholds are met (order count AND lifetime
 * spend). This lets us reward both regular buyers of small orders and rarer
 * big-basket shoppers proportionally, without a single-metric loophole.
 *
 * Keeping this as a single source-of-truth constant means the progress ladder,
 * comparison table, badges and the Account widget all stay in sync when a
 * threshold or benefit copy changes.
 */

/** Machine id used for CSS hooks and the `useLoyaltyStatus` return value. */
export type TierId = 'sous' | 'chef' | 'master' | 'grandmaster';

export interface Tier {
  id: TierId;
  /** Human-readable rank, shown on badges and the comparison table. */
  name: string;
  /** Minimum lifetime paid orders to sit at this tier. */
  minOrders: number;
  /** Minimum lifetime spend (in rupees, not paise) to sit at this tier. */
  minSpendRupees: number;
  /**
   * Short marketing benefits list — copy is intentionally punchy so the same
   * strings work on the badge tooltip AND the comparison table row.
   */
  benefits: readonly string[];
}

/**
 * Ordered lowest → highest. `useLoyaltyStatus` scans from the top down to
 * find the highest tier the user has cleared, so the order matters.
 */
export const TIERS: readonly Tier[] = [
  {
    id: 'sous',
    name: 'Sous Chef',
    minOrders: 0,
    minSpendRupees: 0,
    benefits: ['Welcome discount', 'Order tracking'],
  },
  {
    id: 'chef',
    name: 'Chef',
    minOrders: 5,
    minSpendRupees: 5000,
    benefits: ['5% back credits', 'Priority slots', 'Free delivery over ₹499'],
  },
  {
    id: 'master',
    name: 'Master Chef',
    minOrders: 20,
    minSpendRupees: 25000,
    benefits: [
      '10% back credits',
      'Free delivery always',
      'Exclusive cuts',
      'Chef concierge on WhatsApp',
    ],
  },
  {
    id: 'grandmaster',
    name: 'Grand Master',
    minOrders: 50,
    minSpendRupees: 100000,
    benefits: [
      '15% back credits',
      'Free premium cuts monthly',
      'Private butcher line',
      'Early access to limited drops',
    ],
  },
] as const;

/** Quick lookup by id — handy when the calling code already knows the tier. */
export function getTierById(id: TierId): Tier {
  const tier = TIERS.find((t) => t.id === id);
  // TIERS is a closed set typed by TierId, so this branch is unreachable
  // at runtime — the throw exists to satisfy strict return typing.
  if (!tier) throw new Error(`Unknown loyalty tier: ${id}`);
  return tier;
}

/**
 * Symbol used on tier badges. A hand-picked mapping (not an emoji-per-name
 * guess) so we can tune the visual weight of each rank later.
 */
export const TIER_ICON: Record<TierId, string> = {
  sous: '\u{1F52A}', // kitchen knife
  chef: '\u{1F373}', // cooking pot
  master: '\u{1F451}', // crown
  grandmaster: '\u{1F3C6}', // trophy
};
