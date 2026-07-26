/**
 * Membership — a.k.a. "The Elite Club".
 *
 * The page is a five-act composition:
 *   1. Hero band — Playfair headline over a soft gold gradient.
 *   2. Tier progress ladder (for signed-in users) or a sign-in prompt.
 *   3. "How it works" strip — Cook / Earn / Redeem.
 *   4. Full 4-column tier comparison table with the user's rank highlighted.
 *   5. FAQ accordion at the bottom.
 *
 * The page is intentionally single-file: it composes a lot of markup but
 * every reusable primitive (Card, Badge, Button, TierProgressCard,
 * useLoyaltyStatus) lives elsewhere.
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

import { Badge, Button, Card } from '@/components/ui';
import { useAuth } from '@/features/auth/useAuth';
import { TIERS, TIER_ICON } from '@/features/loyalty/tiers';
import { TierProgressCard } from '@/features/loyalty/TierProgressCard';
import { useLoyaltyStatus } from '@/features/loyalty/useLoyaltyStatus';
import { formatPaise } from '@/lib/money';
import { paths } from '@/routes/routes';
import { MONEY } from '@elite/shared';

interface HowStep {
  step: string;
  title: string;
  body: string;
  icon: string;
}

const HOW_STEPS: readonly HowStep[] = [
  {
    step: '01',
    title: 'Cook',
    body: 'Order any cut — fresh chicken, mutton, seafood or eggs — and every rupee counts toward your rank.',
    icon: '\u{1F373}',
  },
  {
    step: '02',
    title: 'Earn credits',
    body: 'Higher ranks unlock bigger cash-back credits deposited straight into your wallet after each delivery.',
    icon: '\u{1FA99}',
  },
  {
    step: '03',
    title: 'Redeem',
    body: 'Spend credits like cash on your next order — no coupon codes, no minimums, no expiry games.',
    icon: '\u{1F381}',
  },
];

interface FaqItem {
  q: string;
  a: string;
}

const FAQ: readonly FaqItem[] = [
  {
    q: 'How is my rank calculated?',
    a: 'Ranks are based on your lifetime paid-order count AND your lifetime spend. You clear a rank once you’ve hit both numbers — this way big-basket shoppers and regulars both get rewarded fairly.',
  },
  {
    q: 'Do cancelled orders count?',
    a: 'No. Cancelled, returned or failed-delivery orders are refunded to you, so they aren’t counted toward your rank progress. Only orders you actually kept move the needle.',
  },
  {
    q: 'When are cash-back credits added?',
    a: 'Credits land in your wallet within 24 hours of your order being marked delivered. You’ll see them at checkout on your next order — apply as much or as little as you like.',
  },
  {
    q: 'Can I lose my rank?',
    a: 'Never. Once you’ve earned a rank it’s yours to keep. We only look at lifetime totals — we don’t reset your progress at the end of the year.',
  },
  {
    q: 'Is there a membership fee?',
    a: 'Not for ranks. The Elite Club is our free loyalty programme — every customer is automatically enrolled as a Sous Chef the moment they place their first order.',
  },
];

/**
 * Render one row of the comparison table. Splitting this out keeps the
 * `Membership` component readable and lets the current-tier highlight logic
 * live in one spot.
 */
function ComparisonTable({ currentTierId }: { currentTierId: string | null }): JSX.Element {
  // We aggregate every benefit string across every tier so each row in the
  // table represents ONE perk, and each column shows whether that tier has it.
  const rows = Array.from(
    new Set(TIERS.flatMap((t) => t.benefits.map((b) => b))),
  );

  return (
    <div className="en-tier-table-wrap">
      <table className="en-tier-table">
        <thead>
          <tr>
            <th scope="col" className="en-tier-table__perk-col">Benefit</th>
            {TIERS.map((tier) => (
              <th
                key={tier.id}
                scope="col"
                className={`en-tier-table__col en-tier-table__col--${tier.id}${
                  currentTierId === tier.id ? ' is-current' : ''
                }`}
              >
                <span className="en-tier-table__col-icon" aria-hidden>
                  {TIER_ICON[tier.id]}
                </span>
                <span className="en-tier-table__col-name">{tier.name}</span>
                <span className="en-tier-table__col-thresh">
                  {tier.minOrders}+ orders · {formatPaise(tier.minSpendRupees * MONEY.UNIT_PER_RUPEE)}+
                </span>
                {currentTierId === tier.id && (
                  <span className="en-tier-table__you">You&rsquo;re here</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((perk) => (
            <tr key={perk}>
              <th scope="row" className="en-tier-table__perk-cell">{perk}</th>
              {TIERS.map((tier) => {
                const has = tier.benefits.includes(perk);
                return (
                  <td
                    key={tier.id}
                    className={`en-tier-table__cell${
                      currentTierId === tier.id ? ' is-current' : ''
                    }`}
                  >
                    {has ? (
                      <span className="en-tier-table__check" aria-label="Included">&#10003;</span>
                    ) : (
                      <span className="en-tier-table__dash" aria-label="Not included">&mdash;</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** FAQ accordion — a controlled disclosure list. */
function FaqAccordion(): JSX.Element {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  return (
    <div className="en-tier-faq">
      {FAQ.map((item, i) => {
        const open = i === openIdx;
        return (
          <div key={item.q} className={`en-tier-faq__item${open ? ' is-open' : ''}`}>
            <button
              type="button"
              className="en-tier-faq__q"
              aria-expanded={open}
              onClick={() => setOpenIdx(open ? null : i)}
            >
              <span>{item.q}</span>
              <span className="en-tier-faq__chev" aria-hidden>
                {open ? '–' : '+'}
              </span>
            </button>
            {open && <div className="en-tier-faq__a">{item.a}</div>}
          </div>
        );
      })}
    </div>
  );
}

export default function Membership(): JSX.Element {
  const { user } = useAuth();
  const status = useLoyaltyStatus();
  const currentTierId = status?.tier.id ?? null;

  return (
    <div className="en-container en-tier-page">
      {/* ── 1. Hero band ─────────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="en-tier-hero"
      >
        <div className="en-tier-hero__inner">
          <div className="en-eyebrow">The Elite Club</div>
          <h1 className="en-display en-tier-hero__title">
            Cook more, <span className="en-tier-hero__accent">earn more.</span>
          </h1>
          <p className="en-tier-hero__lede">
            A four-rank loyalty programme built for the way real kitchens work.
            The more you cook with us, the bigger your cash-back credits, the earlier
            you see limited drops, and the shorter your line to our head butcher.
          </p>
          <div className="en-tier-hero__cta">
            {user ? (
              <Badge tone="gold">
                <span aria-hidden style={{ marginRight: 6 }}>{TIER_ICON[currentTierId ?? 'sous']}</span>
                Currently: {status?.tier.name ?? 'Sous Chef'}
              </Badge>
            ) : (
              <Link to={paths.login()}>
                <Button variant="gold" size="lg">Sign in to see your rank</Button>
              </Link>
            )}
          </div>
        </div>
        <div className="en-tier-hero__glow" aria-hidden />
      </motion.section>

      {/* ── 2. Tier ladder OR sign-in prompt ─────────────────────── */}
      <section className="en-tier-section">
        {user && status ? (
          <TierProgressCard status={status} variant="full" />
        ) : (
          <Card padding="lg" className="en-tier-signin">
            <div className="en-tier-signin__icon" aria-hidden>{TIER_ICON.master}</div>
            <div>
              <div className="en-eyebrow">Members only</div>
              <h2 className="en-display h3 mb-2 mt-1">See your rank &amp; unlocked perks</h2>
              <p className="en-text-dim mb-3">
                Sign in with your phone number to view your current tier, live progress
                to the next rank, and the cash-back credits waiting in your wallet.
              </p>
              <Link to={paths.login()}>
                <Button variant="primary" size="lg">Sign in</Button>
              </Link>
            </div>
          </Card>
        )}
      </section>

      {/* ── 3. How it works ──────────────────────────────────────── */}
      <section className="en-tier-section">
        <header className="en-tier-section__head">
          <div className="en-eyebrow">How it works</div>
          <h2 className="en-display h2 mb-0 mt-1">Three steps. No fine print.</h2>
        </header>
        <div className="row g-3">
          {HOW_STEPS.map((s) => (
            <div key={s.step} className="col-12 col-md-4">
              <Card padding="lg" className="en-tier-how h-100">
                <div className="en-tier-how__step">{s.step}</div>
                <div className="en-tier-how__icon" aria-hidden>{s.icon}</div>
                <div className="en-tier-how__title">{s.title}</div>
                <div className="en-tier-how__body">{s.body}</div>
              </Card>
            </div>
          ))}
        </div>
      </section>

      {/* ── 4. Comparison table ──────────────────────────────────── */}
      <section className="en-tier-section">
        <header className="en-tier-section__head">
          <div className="en-eyebrow">Rank benefits</div>
          <h2 className="en-display h2 mb-0 mt-1">Every perk, side by side.</h2>
        </header>
        <ComparisonTable currentTierId={currentTierId} />
      </section>

      {/* ── 5. FAQ ───────────────────────────────────────────────── */}
      <section className="en-tier-section">
        <header className="en-tier-section__head">
          <div className="en-eyebrow">Questions</div>
          <h2 className="en-display h2 mb-0 mt-1">The fine print, made big.</h2>
        </header>
        <FaqAccordion />
      </section>
    </div>
  );
}
