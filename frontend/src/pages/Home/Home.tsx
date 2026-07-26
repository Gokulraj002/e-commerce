/**
 * Home v3 — cinematic premium storefront.
 *
 * Kills entrance-fade animations on the hero content (they stalled earlier
 * and the CSS override on `.en-hero__content > *` forces opacity 1 anyway),
 * and adds three unique storefront features on top of the existing v2 layout:
 *
 *   1. Butcher's Block — an interactive SVG chicken diagram. Clicking a cut
 *      deep-links to the matching product; a tab row lets us tease Mutton
 *      and Seafood as "coming next week".
 *   2. Freshness Countdown — a sticky top strip that appears once the visitor
 *      scrolls past the hero and counts down live to today's 2pm cutoff.
 *      Dismissable, with a 6h localStorage-backed snooze.
 *   3. Reorder card — appears near the top for authenticated visitors whose
 *      most recent order is present; one tap re-visits it. Skips silently
 *      for guests and for authed users with no order history.
 *
 * All entrance motion on the hero uses plain HTML (no framer-motion). Below
 * the fold we still use `whileInView` / `whileHover` for polish because those
 * only trigger on intersection, not on mount.
 *
 * Layout (top → bottom):
 *   0. FreshnessTicker (sticky, above header once scrolled)
 *   1. Full-bleed cinematic hero (ken-burns bg + text + marquee strip)
 *   2. ReorderCard (conditional)
 *   3. PincodePrompt (conditional, unchanged)
 *   4. Trust strip (unchanged)
 *   5. Butcher's Block interactive SVG (unique)
 *   6. Category collections rail
 *   7. Featured cuts editorial
 *   8. Story block
 *   9. How it works
 *   10. Trust proof (testimonials + mosaic)
 *   11. WhatsApp fab (floating)
 */
import type { OrderDTO, ProductDTO } from '@elite/shared';
import { STORE } from '@elite/shared';
import { motion } from 'framer-motion';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent,
} from 'react';
import { Link, useNavigate } from 'react-router-dom';


import { NAV_CATEGORIES } from '@/components/layout/navData';
import { Reveal } from '@/components/motion';
import { Badge, Button, Modal, Price, Skeleton } from '@/components/ui';
import { useMyOrders } from '@/features/account';
import { useAuth } from '@/features/auth/useAuth';
import {
  ProductCard,
  cheapestVariant,
  isProductInStock,
  useBanners,
  useCategories,
  useFeaturedProducts,
} from '@/features/catalog';
import type { CategoryNodeDTO } from '@/features/catalog';
import { PageMeta, homeSeo } from '@/features/seo';
import { ServiceabilityModal, useServiceability } from '@/features/serviceability';
import { paths } from '@/routes/routes';

const HERO_POSITION = 'HOME_HERO';

// ─────────────────────────────────────────────────────────────
// Copy constants (kept at module scope so they aren't re-allocated per render)
// ─────────────────────────────────────────────────────────────

const TRUST_ITEMS: ReadonlyArray<{ icon: string; label: string; sub: string }> = [
  { icon: '🚫', label: 'No antibiotics', sub: 'No hormones or chemicals' },
  { icon: '❄️', label: 'Unbroken cold-chain', sub: 'Farm to doorstep at 0–4°C' },
  {
    icon: '🚚',
    label: 'Free shipping',
    sub: `On orders over ${STORE.CURRENCY_SYMBOL}${STORE.FREE_SHIPPING_THRESHOLD}`,
  },
  { icon: '🔪', label: 'Cut to order', sub: 'Hand-cut by expert butchers' },
];

const TICKER_ITEMS: ReadonlyArray<string> = [
  '❄  Cold-chain to your doorstep',
  '🐓  No antibiotics, no hormones',
  '🔪  Cut fresh to order',
  `🚚  Free delivery over ${STORE.CURRENCY_SYMBOL}${STORE.FREE_SHIPPING_THRESHOLD}`,
  '★★★★★  4.8 / 5 from 12,000+ homes',
  '⚡  Same-day dispatch across ' + STORE.CITY,
];

const HOW_STEPS: ReadonlyArray<{ num: string; title: string; body: string }> = [
  {
    num: '01',
    title: 'Order online',
    body: 'Pick your cuts and check out in a minute. Save addresses, reorder in a tap.',
  },
  {
    num: '02',
    title: 'Cut fresh',
    body: 'Expert butchers hand-cut, clean and vacuum-seal to your order — never in advance.',
  },
  {
    num: '03',
    title: 'Cold-chain pack',
    body: 'Sealed in ice-gel packs and dispatched at 0–4°C to lock in freshness.',
  },
  {
    num: '04',
    title: 'Same-day delivery',
    body: `Chilled to your door within hours, anywhere in ${STORE.CITY}.`,
  },
];

const TESTIMONIALS: ReadonlyArray<{ quote: string; author: string; role: string }> = [
  {
    quote:
      'The chicken tasted exactly like the country farm birds from my grandmother’s village. Fresh, clean, unmistakable.',
    author: 'Priya S.',
    role: 'Banjara Hills',
  },
  {
    quote:
      'I have stopped going to the butcher entirely. Cold-chain delivery, expert cuts, and it lands within 90 minutes — every single time.',
    author: 'Rahul V.',
    role: 'Gachibowli',
  },
  {
    quote:
      'Sunday biryani has never been better. The mutton was perfectly cut, aged just right, and there was zero smell.',
    author: 'Anjali M.',
    role: 'Jubilee Hills',
  },
];

const STORY_BULLETS: ReadonlyArray<string> = [
  'Sourced from farms we personally audit — no antibiotics, no hormones, no compromise.',
  'Hand-cut by second-generation butchers who trained on the block, not on a spreadsheet.',
  'Delivered on an unbroken cold-chain, so what lands is exactly what left the block.',
];

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Emoji fallback for categories without imagery, matched by slug. */
function emojiForSlug(slug: string): string {
  return NAV_CATEGORIES.find((c) => c.slug === slug)?.emoji ?? '🍖';
}
function blurbForSlug(slug: string): string | undefined {
  return NAV_CATEGORIES.find((c) => c.slug === slug)?.blurb;
}

// ─────────────────────────────────────────────────────────────
// 0 · Freshness countdown ticker — sticky top strip that lights up
// once the visitor scrolls past the hero. Counts down to today's
// 14:00 cutoff (or tomorrow's, if it's already past). Dismissable
// with a 6h snooze in localStorage.
// ─────────────────────────────────────────────────────────────

const FRESHNESS_DISMISS_KEY = 'en:freshness-dismissed-until';
const FRESHNESS_SNOOZE_MS = 6 * 60 * 60 * 1000; // 6h
const CUTOFF_HOUR = 14; // 2pm local

interface CountdownParts {
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
}

function nextCutoff(now: Date): Date {
  const cutoff = new Date(now);
  cutoff.setHours(CUTOFF_HOUR, 0, 0, 0);
  if (cutoff.getTime() <= now.getTime()) {
    cutoff.setDate(cutoff.getDate() + 1);
  }
  return cutoff;
}

function computeCountdown(now: Date = new Date()): CountdownParts {
  const totalMs = Math.max(0, nextCutoff(now).getTime() - now.getTime());
  const totalSec = Math.floor(totalMs / 1000);
  return {
    hours: Math.floor(totalSec / 3600),
    minutes: Math.floor((totalSec % 3600) / 60),
    seconds: totalSec % 60,
    totalMs,
  };
}

function readDismissedUntil(): number {
  if (typeof window === 'undefined') return 0;
  const raw = window.localStorage.getItem(FRESHNESS_DISMISS_KEY);
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function FreshnessTicker(): JSX.Element | null {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    return readDismissedUntil() > Date.now();
  });
  const [tick, setTick] = useState<CountdownParts>(() => computeCountdown());

  // Show once the user scrolls a screen worth — cheap and robust.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onScroll = (): void => {
      setVisible(window.scrollY > 320);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Re-compute every 30s (checked once per tick — the seconds ticker isn't
  // shown so a per-minute cadence would also be fine).
  useEffect(() => {
    if (dismissed) return;
    setTick(computeCountdown());
    const id = window.setInterval(() => setTick(computeCountdown()), 30_000);
    return () => window.clearInterval(id);
  }, [dismissed]);

  const onDismiss = useCallback((): void => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(
        FRESHNESS_DISMISS_KEY,
        String(Date.now() + FRESHNESS_SNOOZE_MS),
      );
    }
    setDismissed(true);
  }, []);

  if (dismissed || !visible) return null;

  const hh = String(tick.hours).padStart(2, '0');
  const mm = String(tick.minutes).padStart(2, '0');

  return (
    <div className="en-freshness" role="status" aria-live="polite">
      <div className="en-freshness__inner en-container">
        <span className="en-freshness__clock" aria-hidden>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </span>
        <span className="en-freshness__body">
          <strong className="en-freshness__lead">Today&rsquo;s cuts locked at 5am.</strong>
          <span className="en-freshness__sep" aria-hidden>
            ·
          </span>
          <span>
            Order in{' '}
            <span className="en-freshness__time" aria-label={`${tick.hours} hours ${tick.minutes} minutes`}>
              {hh}
              <span className="en-freshness__blink">:</span>
              {mm}
            </span>{' '}
            for evening delivery.
          </span>
        </span>
        <button
          type="button"
          className="en-freshness__close"
          onClick={onDismiss}
          aria-label="Dismiss freshness reminder for 6 hours"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 1 · Hero v3 — full-bleed, plain HTML, ken-burns backdrop,
// eyebrow / display / body / CTA row, and a scrolling marquee strip.
// ─────────────────────────────────────────────────────────────

function HeroTicker(): JSX.Element {
  return (
    <div className="en-hero-ticker" aria-hidden>
      <div className="en-hero-ticker__track">
        {/* Duplicated twice so the -50% translate loop is seamless. */}
        {[0, 1].map((cycle) => (
          <div key={cycle} className="en-hero-ticker__cycle">
            {TICKER_ITEMS.map((item, i) => (
              <span key={`${cycle}-${i}`} className="en-hero-ticker__item">
                {item}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Hero({ shopSlug }: { shopSlug: string }): JSX.Element {
  const { data: banners } = useBanners(HERO_POSITION);
  const banner = banners?.find((b) => b.isActive) ?? banners?.[0] ?? null;
  const [videoOpen, setVideoOpen] = useState(false);

  return (
    <section className="en-section en-section--flush">
      <div className="en-hero en-hero--fullbleed en-hero--v3">
        <div className="en-hero__bg en-hero__bg--kenburns">
          {banner && <img src={banner.imageUrl} alt={banner.title ?? ''} />}
        </div>
        <div className="en-hero__overlay en-hero__overlay--v3" />

        {/* Plain HTML — the CSS override at .en-hero__content > * forces
           opacity 1 so text is legible even if any parent script fails. */}
        <div className="en-hero__content en-hero__content--wide en-hero__content--v3">
          <span className="en-eyebrow en-hero__eyebrow d-block mb-3">
            {STORE.CITY}&rsquo;s premium meat, delivered
          </span>
          <h1 className="en-display en-hero__title mb-3">
            {banner?.title ?? (
              <>
                Fresh cuts worthy of{' '}
                <span className="en-text-gradient">your table.</span>
              </>
            )}
          </h1>
          <p className="en-hero__lede mb-4">
            Antibiotic-free chicken, mutton and seafood — hand-cut to order and
            delivered on an unbroken cold-chain, the same day.
          </p>
          <div className="en-hero__ctas d-flex flex-wrap gap-3">
            <Link to={paths.category(shopSlug)}>
              <Button variant="primary" size="lg">
                Shop fresh cuts
              </Button>
            </Link>
            <Link to={paths.membership()}>
              <Button variant="outline" size="lg">
                Explore Elite Club
              </Button>
            </Link>
            <button
              type="button"
              className="en-hero__play"
              onClick={() => setVideoOpen(true)}
              aria-haspopup="dialog"
            >
              <span className="en-hero__play-icon" aria-hidden>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
                  <polygon points="7,4 20,12 7,20" />
                </svg>
              </span>
              <span>Watch our block</span>
            </button>
          </div>
        </div>

        <HeroTicker />
      </div>

      <Modal
        open={videoOpen}
        onClose={() => setVideoOpen(false)}
        title="Behind the block"
      >
        <div className="en-hero-video-placeholder">
          <div className="en-hero-video-placeholder__frame">
            <div className="en-hero-video-placeholder__ring">
              <svg viewBox="0 0 24 24" width="34" height="34" fill="currentColor" aria-hidden>
                <polygon points="7,4 20,12 7,20" />
              </svg>
            </div>
            <p className="mt-4 mb-1 en-display h5">
              Behind-the-block film — coming this week.
            </p>
            <p className="en-text-dim small mb-0">
              A short walk-through of the shop, from farm-audit to the last
              cold-pack seal. We&rsquo;re editing the final cut.
            </p>
          </div>
        </div>
      </Modal>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Reorder card — visible to authenticated visitors whose latest
// order is present. Skips silently for guests / empty history.
// ─────────────────────────────────────────────────────────────

function ReorderCard(): JSX.Element | null {
  const { isAuthenticated } = useAuth();
  const orders = useMyOrders({ page: 1, pageSize: 1 });

  if (!isAuthenticated) return null;
  const last: OrderDTO | undefined = orders.data?.items[0];
  if (!last) return null;

  const items = last.items.slice(0, 4);
  const extra = Math.max(0, last.items.length - items.length);

  return (
    <section className="en-container en-reorder-wrap">
      <motion.div
        className="en-reorder"
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="en-reorder__lead">
          <span className="en-eyebrow d-block mb-2">Welcome back</span>
          <h2 className="en-display en-reorder__title mb-2">
            Ready for round two?
          </h2>
          <p className="en-text-dim mb-0">
            Your last box was <strong>#{last.code}</strong> — {last.items.length}{' '}
            {last.items.length === 1 ? 'cut' : 'cuts'}, packed {' '}
            {new Date(last.placedAt).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
            })}
            . One tap and it&rsquo;s on its way again.
          </p>
        </div>

        <div className="en-reorder__thumbs" aria-hidden>
          {items.map((it) => (
            <span key={it.id} className="en-reorder__thumb" title={it.productName}>
              <span className="en-reorder__thumb-glyph">🍖</span>
              <span className="en-reorder__thumb-qty">×{it.quantity}</span>
            </span>
          ))}
          {extra > 0 && (
            <span className="en-reorder__thumb en-reorder__thumb--more">
              +{extra}
            </span>
          )}
        </div>

        <div className="en-reorder__cta">
          <Link to={paths.orderTracking(last.code)}>
            <Button variant="primary" size="lg">
              Reorder my box
            </Button>
          </Link>
          <Link
            to={paths.orders()}
            className="en-link-reset en-text-dim small en-reorder__ghost"
          >
            All my orders&nbsp;→
          </Link>
        </div>
      </motion.div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Trust strip — unchanged content, sits under a soft divider.
// ─────────────────────────────────────────────────────────────

function TrustStrip(): JSX.Element {
  return (
    <section className="en-container en-trust-wrap">
      <div className="en-divider-soft" aria-hidden />
      <div className="en-trust-strip">
        {TRUST_ITEMS.map((item) => (
          <div key={item.label} className="en-trust-item">
            <span className="en-trust-item__icon" aria-hidden>
              {item.icon}
            </span>
            <span>
              <span className="d-block fw-semibold">{item.label}</span>
              <span className="en-text-muted small">{item.sub}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Butcher's Block — interactive SVG chicken diagram. Regions are
// keyboard-accessible buttons that navigate to the matching product.
// The tabs above tease Mutton and Seafood as "coming next week".
// ─────────────────────────────────────────────────────────────

type BlockTab = 'chicken' | 'mutton' | 'seafood';

interface ChickenRegion {
  id: 'wings' | 'breast' | 'thigh' | 'drumsticks' | 'whole';
  label: string;
  blurb: string;
  slug: string; // → paths.product(slug)
  /** SVG path for the highlight region (empty for `whole` which is a CTA). */
  path?: string;
  /** Anchor point for the label callout (viewBox coords). */
  labelXY?: readonly [number, number];
}

const CHICKEN_REGIONS: ReadonlyArray<ChickenRegion> = [
  {
    id: 'wings',
    label: 'Wings',
    blurb: 'Party-ready, drum + flat',
    slug: 'chicken-wings',
    path:
      'M 220 178 Q 275 152 335 168 Q 360 190 355 222 Q 335 250 275 250 Q 215 245 220 178 Z',
    labelXY: [285, 205],
  },
  {
    id: 'breast',
    label: 'Breast',
    blurb: 'Boneless, skinless',
    slug: 'boneless-chicken',
    path:
      'M 345 208 Q 405 218 425 250 Q 425 305 375 315 Q 320 312 328 260 Q 335 225 345 208 Z',
    labelXY: [378, 275],
  },
  {
    id: 'thigh',
    label: 'Thigh',
    blurb: 'Curry cut, bone-in',
    slug: 'chicken-curry-cut',
    path:
      'M 160 250 Q 215 275 260 275 Q 268 322 218 328 Q 152 322 160 250 Z',
    labelXY: [205, 300],
  },
  {
    id: 'drumsticks',
    label: 'Drumsticks',
    blurb: 'Fry-ready, skin-on',
    slug: 'chicken-drumsticks',
    path:
      'M 240 320 Q 285 328 335 320 L 345 388 Q 320 400 292 400 L 285 400 Q 260 400 245 400 L 240 320 Z',
    labelXY: [293, 365],
  },
  {
    id: 'whole',
    label: 'Whole bird',
    blurb: 'Party pack, cut to order',
    slug: 'chicken-party-pack',
  },
];

function ButchersBlock(): JSX.Element {
  const navigate = useNavigate();
  const [tab, setTab] = useState<BlockTab>('chicken');
  const [hover, setHover] = useState<ChickenRegion['id'] | null>(null);

  const activeRegion = useMemo(
    () => CHICKEN_REGIONS.find((r) => r.id === hover) ?? null,
    [hover],
  );

  const onPick = useCallback(
    (region: ChickenRegion) => (): void => {
      navigate(paths.product(region.slug));
    },
    [navigate],
  );

  const onKey = useCallback(
    (region: ChickenRegion) => (e: KeyboardEvent<SVGPathElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        navigate(paths.product(region.slug));
      }
    },
    [navigate],
  );

  return (
    <section className="en-section en-container">
      <Reveal>
        <div className="en-block-head">
          <span className="en-eyebrow d-block mb-2">The block, laid bare</span>
          <h2 className="en-home-title en-display mb-2">
            Pick your cut, we&rsquo;ll do the rest.
          </h2>
          <p className="en-text-dim mb-0" style={{ maxWidth: 560 }}>
            Tap a part of the bird to jump straight to that cut. Every piece is
            hand-broken by our butchers the morning it ships.
          </p>
        </div>
      </Reveal>

      <div className="en-block">
        <div className="en-block__tabs" role="tablist" aria-label="Choose a protein">
          {(['chicken', 'mutton', 'seafood'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              className={`en-block__tab${tab === t ? ' is-active' : ''}`}
              onClick={() => setTab(t)}
            >
              <span className="en-block__tab-glyph" aria-hidden>
                {t === 'chicken' ? '🐓' : t === 'mutton' ? '🐐' : '🦐'}
              </span>
              <span>{t[0].toUpperCase() + t.slice(1)}</span>
              {t !== 'chicken' && (
                <span className="en-block__tab-badge">Soon</span>
              )}
            </button>
          ))}
        </div>

        {tab === 'chicken' ? (
          <div className="en-block__body">
            <div className="en-block__diagram">
              <svg
                viewBox="0 0 600 440"
                xmlns="http://www.w3.org/2000/svg"
                role="img"
                aria-label="Chicken cuts diagram"
                className="en-block-svg"
              >
                {/* Butcher-paper backdrop grid */}
                <defs>
                  <pattern
                    id="en-block-grid"
                    width="24"
                    height="24"
                    patternUnits="userSpaceOnUse"
                  >
                    <path
                      d="M 24 0 L 0 0 0 24"
                      fill="none"
                      stroke="rgba(27,26,23,0.05)"
                      strokeWidth="1"
                    />
                  </pattern>
                </defs>
                <rect width="600" height="440" fill="url(#en-block-grid)" />

                {/* Decorative outline — poster-line-art chicken */}
                <g className="en-block-svg__deco" fill="none" stroke="#1b1a17" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  {/* Body */}
                  <ellipse cx="290" cy="230" rx="180" ry="98" />
                  {/* Head */}
                  <circle cx="470" cy="145" r="42" />
                  {/* Neck bridge (body ↔ head) */}
                  <path d="M 435 175 Q 425 205 415 225" />
                  {/* Comb (three bumps atop the head) */}
                  <path d="M 445 108 q 8 -14 16 0 q 8 -14 16 0 q 8 -14 16 0" />
                  {/* Beak */}
                  <polygon points="510,146 538,155 510,164" fill="#1b1a17" />
                  {/* Wattle (crimson) */}
                  <circle cx="494" cy="180" r="7" fill="#b01a22" stroke="#8b1219" />
                  {/* Eye */}
                  <circle cx="482" cy="138" r="3.4" fill="#1b1a17" />
                  {/* Tail feathers (three swoops) */}
                  <path d="M 118 195 C 55 130, 40 190, 92 232" />
                  <path d="M 108 220 C 40 210, 55 260, 108 258" />
                  <path d="M 118 250 C 60 265, 75 300, 128 285" />
                  {/* Legs */}
                  <line x1="252" y1="322" x2="248" y2="405" />
                  <line x1="330" y1="322" x2="334" y2="405" />
                  {/* Feet — three toes each */}
                  <path d="M 224 405 L 272 405 M 248 405 L 240 418 M 248 405 L 256 418" />
                  <path d="M 310 405 L 358 405 M 334 405 L 326 418 M 334 405 L 342 418" />
                </g>

                {/* Interactive regions — dashed outline hints they're clickable */}
                <g className="en-block-svg__regions">
                  {CHICKEN_REGIONS.filter((r) => r.path).map((region) => (
                    <path
                      key={region.id}
                      d={region.path}
                      className={`en-block-svg__region${hover === region.id ? ' is-hover' : ''}`}
                      data-region={region.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`Shop ${region.label} — ${region.blurb}`}
                      onMouseEnter={() => setHover(region.id)}
                      onMouseLeave={() => setHover(null)}
                      onFocus={() => setHover(region.id)}
                      onBlur={() => setHover(null)}
                      onClick={onPick(region)}
                      onKeyDown={onKey(region)}
                    />
                  ))}
                </g>

                {/* Callout labels */}
                <g className="en-block-svg__labels">
                  {CHICKEN_REGIONS.filter((r) => r.labelXY).map((region) => {
                    const [x, y] = region.labelXY as readonly [number, number];
                    return (
                      <g
                        key={region.id}
                        className={`en-block-svg__label${hover === region.id ? ' is-hover' : ''}`}
                      >
                        <text x={x} y={y} textAnchor="middle">
                          {region.label}
                        </text>
                      </g>
                    );
                  })}
                </g>
              </svg>
            </div>

            <div className="en-block__side">
              <div className="en-block__hint">
                <span className="en-eyebrow d-block mb-2">Hovering</span>
                <p className="en-block__hint-name en-display">
                  {activeRegion ? activeRegion.label : 'Any part of the bird'}
                </p>
                <p className="en-block__hint-sub en-text-dim mb-0">
                  {activeRegion
                    ? activeRegion.blurb
                    : 'Point at a cut to see what it becomes on the block.'}
                </p>
              </div>

              <ul className="en-block__list" role="list">
                {CHICKEN_REGIONS.map((region) => (
                  <li key={region.id} className="en-block__list-item">
                    <button
                      type="button"
                      className={`en-block__list-btn${hover === region.id ? ' is-hover' : ''}`}
                      onMouseEnter={() => setHover(region.id)}
                      onMouseLeave={() => setHover(null)}
                      onFocus={() => setHover(region.id)}
                      onBlur={() => setHover(null)}
                      onClick={onPick(region)}
                    >
                      <span className="en-block__list-dot" aria-hidden />
                      <span className="en-block__list-name">{region.label}</span>
                      <span className="en-block__list-sub en-text-dim small">
                        {region.blurb}
                      </span>
                      <span className="en-block__list-arrow" aria-hidden>
                        →
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="en-block__placeholder">
            <div className="en-block__placeholder-inner">
              <span className="en-eyebrow d-block mb-2">Next on the block</span>
              <h3 className="en-display h3 mb-2">
                {tab === 'mutton' ? 'Mutton' : 'Seafood'} diagram coming next week
              </h3>
              <p className="en-text-dim mb-4">
                We&rsquo;re finishing the illustration.{' '}
                {tab === 'mutton'
                  ? 'Curry cut, biryani cut, mince and boti — all interactive.'
                  : 'Prawns, fillets and crab — grade-picked and cold-shipped.'}
              </p>
              <Link to={paths.category(tab)}>
                <Button variant="outline">Browse {tab} anyway &nbsp;→</Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Pincode nudge (unchanged behaviour)
// ─────────────────────────────────────────────────────────────

function PincodePrompt(): JSX.Element | null {
  const { record } = useServiceability();
  const [open, setOpen] = useState(false);

  if (record) return null;

  return (
    <>
      <section className="en-container pt-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="en-link-reset d-flex align-items-center justify-content-between w-100 gap-3 px-3 py-2"
          style={{
            border: '1px dashed var(--en-border)',
            borderRadius: 'var(--en-radius)',
            background: 'rgba(212, 160, 23, 0.06)',
            color: 'var(--en-text-dim)',
            font: 'inherit',
          }}
          aria-haspopup="dialog"
        >
          <span className="d-inline-flex align-items-center gap-2">
            <span aria-hidden>📍</span>
            <span>Check delivery to your pincode in {STORE.CITY}</span>
          </span>
          <span aria-hidden style={{ color: 'var(--en-gold)', fontWeight: 600 }}>
            →
          </span>
        </button>
      </section>
      <ServiceabilityModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Category collections rail
// ─────────────────────────────────────────────────────────────

function CategoryCollectionRail({
  categories,
  isLoading,
}: {
  categories: CategoryNodeDTO[] | undefined;
  isLoading: boolean;
}): JSX.Element {
  return (
    <section className="en-section en-container">
      <Reveal>
        <div className="en-section-head">
          <div>
            <span className="en-eyebrow d-block mb-2">Shop by collection</span>
            <h2 className="en-home-title en-display mb-0">Pick your protein</h2>
          </div>
          <span className="en-text-dim small d-none d-md-inline">Swipe to browse →</span>
        </div>
      </Reveal>

      <div className="en-cat-rail">
        {isLoading &&
          Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="en-cat-rail__cell">
              <div className="en-cat-rail__tile en-skeleton" aria-hidden />
            </div>
          ))}
        {categories?.map((cat, i) => {
          const blurb = blurbForSlug(cat.slug);
          return (
            <motion.div
              key={cat.id}
              className="en-cat-rail__cell"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.45, delay: Math.min(i, 6) * 0.06 }}
            >
              <Link to={paths.category(cat.slug)} className="en-cat-rail__tile en-link-reset">
                {cat.imageUrl ? (
                  <img
                    src={cat.imageUrl}
                    alt={cat.name}
                    loading="lazy"
                    className="en-cat-rail__img"
                  />
                ) : (
                  <span className="en-cat-rail__emoji" aria-hidden>
                    {emojiForSlug(cat.slug)}
                  </span>
                )}
                <span className="en-cat-rail__scrim" aria-hidden />
                <div className="en-cat-rail__meta">
                  <span className="en-cat-rail__eyebrow">Collection</span>
                  <span className="en-cat-rail__name en-display">{cat.name}</span>
                  {blurb && <span className="en-cat-rail__sub">{blurb}</span>}
                  <span className="en-cat-rail__cta">
                    Shop <span aria-hidden>→</span>
                  </span>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Featured cuts — editorial layout
// ─────────────────────────────────────────────────────────────

function ChefsPickCard({ product }: { product: ProductDTO }): JSX.Element {
  const variant = cheapestVariant(product);
  const inStock = isProductInStock(product);
  const image = product.images[0] ?? null;
  const to = paths.product(product.slug);

  return (
    <motion.article
      className="en-chef-pick"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link to={to} className="en-link-reset en-chef-pick__media">
        {image ? (
          <img src={image} alt={product.name} loading="lazy" />
        ) : (
          <div className="en-chef-pick__placeholder" aria-hidden>
            🍖
          </div>
        )}
        <span className="en-chef-pick__scrim" aria-hidden />
        <span className="en-chef-pick__ribbon">
          <span aria-hidden>★</span> Chef&rsquo;s pick
        </span>
      </Link>
      <div className="en-chef-pick__body">
        <span className="en-eyebrow d-block mb-2">This week</span>
        <h3 className="en-chef-pick__title en-display">{product.name}</h3>
        {product.shortDesc && (
          <p className="en-chef-pick__desc en-text-dim">{product.shortDesc}</p>
        )}
        <div className="en-chef-pick__foot">
          {variant && (
            <div>
              <span className="en-text-muted small d-block">Starts at</span>
              <Price
                pricePaise={variant.pricePaise}
                mrpPaise={variant.mrpPaise}
                size="lg"
              />
            </div>
          )}
          <Link to={to}>
            <Button variant="primary" size="lg" disabled={!inStock}>
              {inStock ? 'Order the pick' : 'Sold out'}
            </Button>
          </Link>
        </div>
      </div>
    </motion.article>
  );
}

function FeaturedEditorial(): JSX.Element {
  const { data: products, isLoading } = useFeaturedProducts();

  const [chefPick, ...rest] = products ?? [];
  const grid = rest.slice(0, 4);

  return (
    <section className="en-section en-container">
      <Reveal>
        <div className="en-section-head">
          <div>
            <span className="en-eyebrow d-block mb-2">Handpicked this week</span>
            <h2 className="en-home-title en-display mb-0">Featured cuts</h2>
          </div>
          <Badge tone="crimson">Chef favourites</Badge>
        </div>
      </Reveal>

      {isLoading ? (
        <div className="en-featured-editorial">
          <div
            className="en-chef-pick en-skeleton"
            style={{ minHeight: 420 }}
            aria-hidden
          />
          <div className="en-featured-editorial__grid">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="en-card p-3">
                <Skeleton height={150} className="mb-3" />
                <Skeleton width="70%" height={18} className="mb-2" />
                <Skeleton width="40%" height={16} />
              </div>
            ))}
          </div>
        </div>
      ) : chefPick ? (
        <div className="en-featured-editorial">
          <ChefsPickCard product={chefPick} />
          <div className="en-featured-editorial__grid">
            {grid.map((product, i) => (
              <ProductCard key={product.id} product={product} index={i} />
            ))}
          </div>
        </div>
      ) : (
        <p className="en-text-dim">Featured cuts are being restocked — check back soon.</p>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Story block — full-bleed 2-col narrative
// ─────────────────────────────────────────────────────────────

function StoryBlock({ heroImage }: { heroImage: string | null }): JSX.Element {
  return (
    <section className="en-story">
      <div className="en-story__inner en-container">
        <motion.div
          className="en-story__media"
          initial={{ opacity: 0, x: -24 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          {heroImage ? (
            <img src={heroImage} alt="Our butchers at work" loading="lazy" />
          ) : (
            <div className="en-story__placeholder" aria-hidden>
              🔪
            </div>
          )}
          <span className="en-story__scrim" aria-hidden />
          <span className="en-story__badge">Est. 2015 · {STORE.CITY}</span>
        </motion.div>

        <motion.div
          className="en-story__body"
          initial={{ opacity: 0, x: 24 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="en-eyebrow d-block mb-3">Our craft</span>
          <h2 className="en-home-title en-display mb-4">
            From our block to your plate.
          </h2>
          <p className="en-text-dim fs-5 mb-4">
            {STORE.NAME} was built by butchers, not marketers. Every cut we ship
            starts as a bird or a goat we know by name — raised right, aged
            right, and finished by hand the morning it leaves the shop.
          </p>
          <ul className="en-story__bullets">
            {STORY_BULLETS.map((point) => (
              <li key={point} className="en-story__bullet">
                <span className="en-story__bullet-mark" aria-hidden>
                  ✦
                </span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <Link to={paths.membership()}>
              <Button variant="ghost" size="lg">
                About our craft &nbsp;→
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// How it works — 4 numbered steps with a connecting rule
// ─────────────────────────────────────────────────────────────

function HowItWorks(): JSX.Element {
  return (
    <section className="en-section en-container">
      <Reveal className="text-center mb-5">
        <span className="en-eyebrow d-block mb-2">The Elite process</span>
        <h2 className="en-home-title en-display mb-0">
          How your cut lands, chilled.
        </h2>
      </Reveal>
      <div className="en-steps" role="list">
        <span className="en-steps__line" aria-hidden />
        {HOW_STEPS.map((step, i) => (
          <motion.div
            key={step.num}
            role="listitem"
            className="en-steps__step"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.45, delay: i * 0.08 }}
          >
            <span className="en-steps__num" aria-hidden>
              {step.num}
            </span>
            <h3 className="en-display h5 mt-3 mb-2">{step.title}</h3>
            <p className="en-text-dim small mb-0">{step.body}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Trust proof — testimonials + insta-style mosaic + WA fab
// ─────────────────────────────────────────────────────────────

function TestimonialsCarousel(): JSX.Element {
  const [active, setActive] = useState(0);
  const t = TESTIMONIALS[active];

  return (
    <div className="en-testimonials">
      <motion.blockquote
        key={active}
        className="en-testimonial"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <span className="en-testimonial__mark" aria-hidden>
          “
        </span>
        <p className="en-testimonial__quote">{t.quote}</p>
        <footer className="en-testimonial__foot">
          <span className="en-testimonial__author">{t.author}</span>
          <span className="en-text-muted small">{t.role}</span>
        </footer>
      </motion.blockquote>

      <div className="en-testimonials__ctrl" role="tablist" aria-label="Testimonials">
        {TESTIMONIALS.map((quote, i) => (
          <button
            key={quote.author}
            type="button"
            role="tab"
            aria-selected={i === active}
            aria-label={`Show testimonial ${i + 1} of ${TESTIMONIALS.length}`}
            className={`en-testimonials__dot${i === active ? ' is-active' : ''}`}
            onClick={() => setActive(i)}
          />
        ))}
      </div>
    </div>
  );
}

function InstaMosaic({
  sources,
  shopSlug,
}: {
  sources: string[];
  shopSlug: string;
}): JSX.Element {
  return (
    <div className="en-mosaic">
      {Array.from({ length: 6 }, (_, i) => {
        const src = sources[i] ?? null;
        return (
          <Link
            key={i}
            to={paths.category(shopSlug)}
            className="en-mosaic__tile en-link-reset"
            aria-label="Browse the shop"
          >
            {src ? (
              <img src={src} alt="" loading="lazy" />
            ) : (
              <span className="en-mosaic__ph" aria-hidden>
                🍖
              </span>
            )}
            <span className="en-mosaic__glyph" aria-hidden>
              ◈
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function WhatsAppFab(): JSX.Element {
  const href = `https://wa.me/${STORE.SUPPORT_WHATSAPP.replace(/\D/g, '')}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="en-wa-fab"
      aria-label="Chat with us on WhatsApp"
    >
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden
        focusable="false"
      >
        <path d="M20.52 3.48A11.86 11.86 0 0 0 12.05 0C5.52 0 .21 5.31.21 11.85c0 2.09.55 4.13 1.59 5.92L0 24l6.4-1.68a11.85 11.85 0 0 0 5.66 1.44h.01c6.53 0 11.84-5.31 11.84-11.84 0-3.16-1.23-6.13-3.39-8.44Zm-8.47 18.2h-.01a9.83 9.83 0 0 1-5.02-1.37l-.36-.21-3.8 1 1.02-3.7-.24-.38a9.85 9.85 0 0 1-1.5-5.17c0-5.44 4.43-9.86 9.87-9.86 2.64 0 5.11 1.03 6.97 2.89a9.79 9.79 0 0 1 2.89 6.97c0 5.44-4.43 9.83-9.82 9.83Zm5.4-7.36c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.15-.17.2-.35.22-.65.07-.3-.15-1.24-.46-2.36-1.46a8.86 8.86 0 0 1-1.64-2.03c-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.6-.92-2.19-.24-.58-.49-.5-.67-.5l-.57-.01c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.06 2.87 1.21 3.07.15.2 2.09 3.19 5.06 4.47.71.3 1.26.48 1.69.61.71.22 1.35.19 1.86.11.57-.08 1.75-.72 2-1.4.25-.68.25-1.27.17-1.4-.07-.13-.27-.2-.57-.35Z" />
      </svg>
    </a>
  );
}

function TrustProof({
  sources,
  shopSlug,
}: {
  sources: string[];
  shopSlug: string;
}): JSX.Element {
  return (
    <>
      <section className="en-section en-container">
        <Reveal className="text-center mb-5">
          <span className="en-eyebrow d-block mb-2">Loved in {STORE.CITY}</span>
          <h2 className="en-home-title en-display mb-0">
            What our home cooks say
          </h2>
        </Reveal>
        <TestimonialsCarousel />
      </section>

      <section className="en-section en-container">
        <Reveal>
          <div className="en-section-head">
            <div>
              <span className="en-eyebrow d-block mb-2">On the block, this week</span>
              <h2 className="en-home-title en-display mb-0">Fresh drops</h2>
            </div>
            <Link to={paths.category(shopSlug)} className="en-link-reset en-text-dim small">
              Follow the shop &nbsp;→
            </Link>
          </div>
        </Reveal>
        <InstaMosaic sources={sources} shopSlug={shopSlug} />
      </section>

      <WhatsAppFab />
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Root
// ─────────────────────────────────────────────────────────────

export default function Home(): JSX.Element {
  const { data: categories, isLoading } = useCategories();
  const { data: featured } = useFeaturedProducts();

  const shopSlug = categories?.[0]?.slug ?? NAV_CATEGORIES[0].slug;

  const mosaicSources = useMemo(() => {
    const productImages = (featured ?? []).flatMap((p) => p.images).filter(Boolean);
    const categoryImages = (categories ?? [])
      .map((c) => c.imageUrl)
      .filter((u): u is string => !!u);
    return [...productImages, ...categoryImages];
  }, [featured, categories]);

  const storyImage =
    featured?.[0]?.images?.[0] ??
    categories?.find((c) => !!c.imageUrl)?.imageUrl ??
    null;

  return (
    <>
      <PageMeta {...homeSeo()} />
      <FreshnessTicker />
      <Hero shopSlug={shopSlug} />
      <ReorderCard />
      <PincodePrompt />
      <TrustStrip />
      <ButchersBlock />
      <CategoryCollectionRail categories={categories} isLoading={isLoading} />
      <FeaturedEditorial />
      <StoryBlock heroImage={storyImage} />
      <HowItWorks />
      <TrustProof sources={mosaicSources} shopSlug={shopSlug} />
    </>
  );
}
