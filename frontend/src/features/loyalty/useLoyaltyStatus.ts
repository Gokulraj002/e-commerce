/**
 * Derives a user's current loyalty tier from their order history.
 *
 * Real loyalty data (server-authoritative wallet balance, redeemed credits,
 * lifetime aggregates) is a backend TODO — for now we compute everything
 * client-side by summing the paginated order feed. The hook shape is designed
 * so that once the server exposes a `/loyalty/status` endpoint, we can swap
 * the implementation without touching a single caller.
 */
import { useMemo } from 'react';

import { ORDER_STATUS, type OrderStatus } from '@elite/shared';

import { useAuth } from '@/features/auth/useAuth';
import { paiseToRupees } from '@/lib/money';

import { useMyOrders } from '@/features/account/useOrders';

import { TIERS, type Tier } from './tiers';

/**
 * A generous page size — the ceiling here dictates how many orders we
 * consider for the client-side lifetime aggregate. 200 is far above what
 * any real customer will have while we wait for the server aggregate.
 */
const HISTORY_PAGE_SIZE = 200;

/**
 * Orders that count toward tier progression. We deliberately exclude
 * cancelled / returned / failed-delivery orders — those refund the customer,
 * so they should not push a rank up. Pending-payment orders are also
 * excluded because they haven't crossed the "customer committed" line yet.
 */
const COUNTABLE_STATUSES: readonly OrderStatus[] = [
  ORDER_STATUS.CREATED,
  ORDER_STATUS.CONFIRMED,
  ORDER_STATUS.PACKING,
  ORDER_STATUS.READY,
  ORDER_STATUS.ASSIGNED,
  ORDER_STATUS.PICKED_UP,
  ORDER_STATUS.OUT_FOR_DELIVERY,
  ORDER_STATUS.DELIVERED,
];

export interface LoyaltyStatus {
  /** The tier the user currently occupies. Never null for signed-in users. */
  tier: Tier;
  /**
   * The next tier up. `null` when the user has already hit Grand Master —
   * consumers should render a "you're at the top" state in that case.
   */
  next: Tier | null;
  /** 0–100 progress towards `next`. When at the max tier this is 100. */
  progressPct: number;
  /** Lifetime paid-order count that fed the tier calculation. */
  ordersCount: number;
  /** Lifetime spend in rupees (not paise) used for the tier calculation. */
  spendRupees: number;
  /** Orders still required to unlock `next`. Zero when spend is the blocker. */
  ordersToNext: number;
  /** Rupees still required to unlock `next`. Zero when order count is the blocker. */
  spendToNext: number;
  /** True while order history is loading — UI should render a skeleton. */
  isLoading: boolean;
}

/**
 * Pick the highest tier the user has cleared. Tiers are stored ordered
 * lowest → highest; the reverse `.find` returns the first tier whose
 * thresholds are met by both metrics.
 */
function resolveCurrentTier(orders: number, spend: number): Tier {
  // Iterate from the top so the returned tier is always the strongest match.
  for (let i = TIERS.length - 1; i >= 0; i -= 1) {
    const tier = TIERS[i];
    if (tier && orders >= tier.minOrders && spend >= tier.minSpendRupees) {
      return tier;
    }
  }
  // TIERS[0] has zero thresholds so the loop always matches for real data;
  // the fallback below keeps TS strict-mode happy without a non-null assert.
  const fallback = TIERS[0];
  if (!fallback) throw new Error('TIERS is empty — check tiers.ts');
  return fallback;
}

/**
 * Progress bar %: what fraction of the *gap between current and next tier*
 * has the user completed? We take the min of the two axes so a user who is
 * ahead on orders but behind on spend still sees the honest "further to go"
 * signal, not a misleadingly full bar.
 */
function computeProgress(
  current: Tier,
  next: Tier | null,
  orders: number,
  spend: number,
): number {
  if (!next) return 100;
  const orderSpan = Math.max(next.minOrders - current.minOrders, 1);
  const spendSpan = Math.max(next.minSpendRupees - current.minSpendRupees, 1);
  const orderProgress = Math.max(orders - current.minOrders, 0) / orderSpan;
  const spendProgress = Math.max(spend - current.minSpendRupees, 0) / spendSpan;
  const combined = Math.min(orderProgress, spendProgress);
  return Math.round(Math.min(Math.max(combined, 0), 1) * 100);
}

/**
 * Client-side derivation of the current loyalty tier from the order feed.
 * Returns `null` when the user isn't signed in — callers should render a
 * sign-in prompt in that case rather than an empty ladder.
 */
export function useLoyaltyStatus(): LoyaltyStatus | null {
  const { user } = useAuth();
  // Pull a wide page so the aggregate is meaningful. Once a `/loyalty/status`
  // endpoint exists, replace this with a single query keyed by user id.
  const ordersQuery = useMyOrders({ page: 1, pageSize: HISTORY_PAGE_SIZE });

  return useMemo(() => {
    if (!user) return null;

    const items = ordersQuery.data?.items ?? [];
    const countable = items.filter((o) => COUNTABLE_STATUSES.includes(o.status));
    const ordersCount = countable.length;
    const spendRupees = countable.reduce(
      (sum, order) => sum + paiseToRupees(order.totalPaise),
      0,
    );

    const tier = resolveCurrentTier(ordersCount, spendRupees);
    const currentIdx = TIERS.findIndex((t) => t.id === tier.id);
    const next = currentIdx >= 0 && currentIdx < TIERS.length - 1
      ? TIERS[currentIdx + 1] ?? null
      : null;

    const progressPct = computeProgress(tier, next, ordersCount, spendRupees);
    const ordersToNext = next ? Math.max(next.minOrders - ordersCount, 0) : 0;
    const spendToNext = next
      ? Math.max(next.minSpendRupees - Math.floor(spendRupees), 0)
      : 0;

    return {
      tier,
      next,
      progressPct,
      ordersCount,
      spendRupees: Math.floor(spendRupees),
      ordersToNext,
      spendToNext,
      isLoading: ordersQuery.isLoading,
    };
  }, [user, ordersQuery.data, ordersQuery.isLoading]);
}
