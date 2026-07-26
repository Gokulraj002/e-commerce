/**
 * TierProgressCard — the star of the loyalty experience.
 *
 * Renders a 4-badge ladder (Sous → Chef → Master → Grand Master) with a
 * progress bar animating between the user's current rank and the next one,
 * a plain-English "N more orders or ₹X more spend" nudge, and a two-column
 * benefits split (current benefits + next-tier tease in gold).
 *
 * Accepts a `variant` so the same component powers both the full Membership
 * page ladder and the compact widget on the Account dashboard — one design,
 * two entry points, zero drift.
 */
import { motion } from 'framer-motion';

import { Card } from '@/components/ui';
import { formatPaise } from '@/lib/money';
import { MONEY } from '@elite/shared';

import { TIERS, TIER_ICON, type Tier } from './tiers';
import type { LoyaltyStatus } from './useLoyaltyStatus';

export type TierProgressCardVariant = 'full' | 'compact';

export interface TierProgressCardProps {
  status: LoyaltyStatus;
  /** `full` = Membership page hero card. `compact` = Account dashboard. */
  variant?: TierProgressCardVariant;
}

/** Convert lifetime rupees back to paise so `formatPaise` renders it. */
function rupeesLine(rupees: number): string {
  return formatPaise(rupees * MONEY.UNIT_PER_RUPEE);
}

/**
 * A single badge in the ladder. The "state" prop drives the visual weight —
 * `earned` gets a gold ring, `current` adds a pulsing glow, `locked` is muted.
 * Splitting state into a discriminated string (not two booleans) keeps
 * later CSS additions honest — you can't accidentally be both.
 */
type BadgeState = 'earned' | 'current' | 'locked';

function TierBadge({
  tier,
  state,
  variant,
}: {
  tier: Tier;
  state: BadgeState;
  variant: TierProgressCardVariant;
}): JSX.Element {
  const size = variant === 'compact' ? 40 : 56;
  return (
    <div
      className={`en-tier-badge en-tier-badge--${state}`}
      data-tier={tier.id}
      title={`${tier.name} · ${tier.minOrders}+ orders · ${rupeesLine(tier.minSpendRupees)}+ spend`}
    >
      <div
        className="en-tier-badge__disc"
        style={{ width: size, height: size, fontSize: size * 0.42 }}
        aria-hidden
      >
        <span>{TIER_ICON[tier.id]}</span>
      </div>
      <div className="en-tier-badge__label">{tier.name}</div>
    </div>
  );
}

export function TierProgressCard({
  status,
  variant = 'full',
}: TierProgressCardProps): JSX.Element {
  const { tier, next, progressPct, ordersCount, spendRupees, ordersToNext, spendToNext } = status;
  const currentIdx = TIERS.findIndex((t) => t.id === tier.id);
  const isMaxed = next === null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card
        padding={variant === 'compact' ? 'md' : 'lg'}
        className={`en-tier-progress en-tier-progress--${variant}`}
      >
        {/* Header row: eyebrow + current rank */}
        <div className="en-tier-progress__header">
          <div>
            <div className="en-eyebrow">Your rank</div>
            <div className={`en-display ${variant === 'compact' ? 'h4' : 'h2'} mb-0 mt-1`}>
              {tier.name}
            </div>
          </div>
          <div className="en-tier-progress__stats">
            <div>
              <div className="en-tier-progress__stat-value">{ordersCount}</div>
              <div className="en-tier-progress__stat-label">orders</div>
            </div>
            <div className="en-tier-progress__stat-sep" aria-hidden />
            <div>
              <div className="en-tier-progress__stat-value">{rupeesLine(spendRupees)}</div>
              <div className="en-tier-progress__stat-label">lifetime</div>
            </div>
          </div>
        </div>

        {/* The ladder. Progress bar sits UNDER the badge row so the badges
            visually anchor the "you are here" moment. */}
        <div className="en-tier-progress__ladder" role="list">
          {TIERS.map((t, idx) => {
            const state: BadgeState =
              idx < currentIdx ? 'earned' : idx === currentIdx ? 'current' : 'locked';
            return (
              <div key={t.id} className="en-tier-progress__step" role="listitem">
                <TierBadge tier={t} state={state} variant={variant} />
              </div>
            );
          })}
          <div className="en-tier-progress__rail" aria-hidden>
            {/* Fill is calculated across all tier segments, not just the
                current one — so at Chef with 40% of the gap done, the fill
                stretches roughly 33% + 40% × 33% of the total rail. */}
            <motion.div
              className="en-tier-progress__rail-fill"
              initial={{ width: 0 }}
              animate={{
                width: isMaxed
                  ? '100%'
                  : `${Math.min(
                      100,
                      (currentIdx / (TIERS.length - 1)) * 100 +
                        (progressPct / 100) * (100 / (TIERS.length - 1)),
                    )}%`,
              }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
            />
          </div>
        </div>

        {/* Nudge line: "5 more orders or ₹4,200 more spend to unlock Chef" */}
        {!isMaxed && (
          <div className="en-tier-progress__nudge">
            <span className="en-tier-progress__nudge-icon" aria-hidden>{TIER_ICON[next.id]}</span>
            <span>
              {ordersToNext > 0 && (
                <>
                  <strong>{ordersToNext} more order{ordersToNext === 1 ? '' : 's'}</strong>
                  {spendToNext > 0 ? ' or ' : ' '}
                </>
              )}
              {spendToNext > 0 && (
                <>
                  <strong>{rupeesLine(spendToNext)} more spend</strong>{' '}
                </>
              )}
              to unlock <span className="en-tier-progress__nudge-tier">{next.name}</span>
            </span>
          </div>
        )}
        {isMaxed && (
          <div className="en-tier-progress__nudge en-tier-progress__nudge--maxed">
            <span aria-hidden>{TIER_ICON[tier.id]}</span>
            <span>
              You&rsquo;ve reached the top rank. Every order keeps your Grand Master perks live.
            </span>
          </div>
        )}

        {/* Benefit split — current on the left, next tier teased in gold on
            the right. Hidden on the compact variant to keep the widget tight. */}
        {variant === 'full' && (
          <div className="en-tier-progress__benefits">
            <div className="en-tier-progress__benefits-col">
              <div className="en-eyebrow" style={{ color: 'var(--en-text-dim)' }}>
                Unlocked
              </div>
              <ul className="en-tier-progress__list">
                {tier.benefits.map((b) => (
                  <li key={b}>
                    <span aria-hidden>&#10003;</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
            {next && (
              <div className="en-tier-progress__benefits-col en-tier-progress__benefits-col--next">
                <div className="en-eyebrow">Coming up in {next.name}</div>
                <ul className="en-tier-progress__list en-tier-progress__list--locked">
                  {next.benefits.map((b) => (
                    <li key={b}>
                      <span aria-hidden>&#9733;</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Card>
    </motion.div>
  );
}
