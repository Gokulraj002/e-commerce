/**
 * ProductCard — v3 magazine-editorial tile shared by the Home, Category,
 * Search grids and PDP rails.
 *
 * Editorial anatomy:
 *   ┌─────────────────────────┐
 *   │  5:4 media (cover)      │  ← lifts + scales on hover, crossfade to
 *   │   ┌ badges  heart ┐     │    second image if the product has one.
 *   │   └──────────────┘      │
 *   │      "Sold out" veil    │  ← translucent cream veil when every
 *   │                         │    variant is out of stock.
 *   ├─────────────────────────┤
 *   │  category eyebrow (au)  │
 *   │  Playfair name (2 line) │
 *   │  ★★★★☆  4.6 (128)      │ ← real SVG stars, not glyphs.
 *   │                         │
 *   │  ₹499  ₹599  −17%       │ ← tabular price, MRP strike, SAVE pill.
 *   │  per pack (500 g)       │
 *   │                         │
 *   │  [ Add to cart ]        │
 *   └─────────────────────────┘
 *
 * Presentational apart from three server-owned actions:
 *  - Add-to-cart (`useCart().addItem`) — the primary crimson pill in the
 *    action row (or the media-overlay pill when `showQuickAdd` is on)
 *    flips to a checkmark once the cheapest variant is in the cart.
 *  - Wishlist toggle (`useWishlist()` add/remove) — a small heart top-right,
 *  - Guests attempting either mutation are bounced to /login with a
 *    `redirect` back to this product.
 *
 * The whole card is a stretched `<Link>`; the Add + Wishlist buttons
 * sit above it (`z-index: 2`) and `stopPropagation` so a tap on either does
 * not also navigate to the PDP.
 *
 * Motion layered here (all guarded on `prefers-reduced-motion`):
 *  - Entrance fade + lift (`whileInView`), staggered by grid `index`.
 *  - Cross-fade from primary → `hoverImage` on card hover.
 *  - Cart-fly-in from the clicked Add button to the header cart icon
 *    (`useCartFly`).
 *  - Wishlist heart pop + six-particle burst when the heart activates.
 *  - Idle pulse on the primary Add CTA when it is in view and the user has
 *    been still for a few seconds (`useIdlePulse`).
 */
import { motion, useReducedMotion } from 'framer-motion';
import { useCallback, useMemo, useRef, useState, type MouseEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import type { ProductDTO } from '@elite/shared';

import { useIdlePulse } from '@/components/motion';
import { useAuth } from '@/features/auth/useAuth';
import { RequireLoginError } from '@/features/cart';
import { useCart } from '@/features/cart/useCart';
import { useCartFly } from '@/features/cart/useCartFly';
import {
  HeartBurst,
  useAddToWishlist,
  useRemoveFromWishlist,
  useWishlist,
} from '@/features/wishlist';
import { discountPercent, formatPaise, formatWeight } from '@/lib/money';
import { paths } from '@/routes/routes';

import type { CategoryNodeDTO } from '../catalog.types';
import { cheapestVariant, isProductInStock } from '../productHelpers';
import { useCategories } from '../useCatalog';

/** Card layout variant — controls badge/description density in a grid vs. a rail. */
export type ProductCardVariant = 'default' | 'compact' | 'wide';

export interface ProductCardProps {
  product: ProductDTO;
  /** Optional entrance-animation index for staggered grids. */
  index?: number;
  /**
   * Optional second image URL to cross-fade to on card hover. `null` (or
   * omitted) auto-falls-back to `product.images[1]` when a second image is
   * available; pass an explicit URL to override.
   */
  hoverImage?: string | null;
  /**
   * When true, overlays a premium "Quick add" pill at the bottom of the media
   * area that fades in on hover. The Add row still renders below, so both
   * affordances stay in sync (the pill mirrors state and disabled flags).
   */
  showQuickAdd?: boolean;
  /**
   * Layout variant — controls which chrome is shown. `compact` hides the
   * badge stack and description for dense rails; `wide` shows the short
   * description for feature strips. Defaults to `'default'`.
   */
  variant?: ProductCardVariant;
}

const MAX_VISIBLE_BADGES = 2;

/**
 * Marketing badges surfaced from a product's flags/tags, deduped and ordered.
 * "Ready to cook" is promoted to first when set so it dominates the stack.
 */
function collectBadges(product: ProductDTO): string[] {
  const out: string[] = [];
  if (product.isReadyToCook) out.push('Ready to cook');
  for (const tag of product.tags) {
    if (!out.includes(tag)) out.push(tag);
  }
  return out;
}

/** "per 500 g" / "per pack" copy derived from the cheapest variant's weight. */
function soldByLabel(weightG: number): string {
  return weightG > 0 ? `per pack (${formatWeight(weightG)})` : 'per pack';
}

/**
 * Depth-first search of the cached category tree for a matching id. Returns
 * `null` while categories are still loading or when a stale product refers to
 * a category that no longer exists.
 */
function findCategoryName(
  nodes: readonly CategoryNodeDTO[] | undefined,
  targetId: string,
): string | null {
  if (!nodes) return null;
  const stack: CategoryNodeDTO[] = [...nodes];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) continue;
    if (node.id === targetId) return node.name;
    if (node.children.length > 0) stack.push(...node.children);
  }
  return null;
}

/** A single product tile: image, name, weight/price, rating, quick add. */
export function ProductCard({
  product,
  index = 0,
  hoverImage = null,
  showQuickAdd = false,
  variant: layout = 'default',
}: ProductCardProps): JSX.Element {
  const navigate = useNavigate();
  const { addItem, cart, isMutating } = useCart();
  const { flyToCart } = useCartFly();
  const { data: categories } = useCategories();

  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  const cheapest = cheapestVariant(product);
  const inStock = isProductInStock(product);
  const primaryImage = product.images[0] ?? null;
  // Fall back to a second image on the product itself when the caller does
  // not explicitly supply one — this lets any grid opt into cross-fade for
  // free. An explicit non-null URL overrides; an explicit `null` still allows
  // the fallback (matches the historical opt-in-by-passing shape).
  const resolvedHoverImage = hoverImage ?? product.images[1] ?? null;
  const secondaryImage =
    resolvedHoverImage && resolvedHoverImage !== primaryImage ? resolvedHoverImage : null;
  const to = paths.product(product.slug);

  // Idle pulse — attached to whichever "Add" affordance is on-screen. The hook
  // itself no-ops when the user prefers reduced motion.
  const addBtnRef = useIdlePulse<HTMLButtonElement>();
  const quickAddRef = useIdlePulse<HTMLButtonElement>();

  const inCart = useMemo(
    () => (cheapest && cart ? cart.items.some((i) => i.variantId === cheapest.id) : false),
    [cart, cheapest],
  );

  const badges = useMemo(() => collectBadges(product), [product]);
  const visibleBadges = badges.slice(0, MAX_VISIBLE_BADGES);
  const extraBadgeCount = Math.max(0, badges.length - visibleBadges.length);

  const categoryName = useMemo(
    () => findCategoryName(categories, product.categoryId),
    [categories, product.categoryId],
  );

  const off = cheapest ? discountPercent(cheapest.mrpPaise, cheapest.pricePaise) : 0;

  const launchFly = useCallback(
    (btn: HTMLElement | null): void => {
      if (!btn) return;
      flyToCart(btn.getBoundingClientRect(), primaryImage);
    },
    [flyToCart, primaryImage],
  );

  const onAdd = async (btn: HTMLElement | null): Promise<void> => {
    if (!cheapest || inCart) return;
    // Fire the fly-in immediately — it looks better if the animation starts
    // before the network round-trip, and it's harmless if the mutation fails.
    launchFly(btn);
    setAdding(true);
    try {
      await addItem({ variantId: cheapest.id, quantity: 1 });
      setAdded(true);
      window.setTimeout(() => setAdded(false), 1400);
    } catch (error) {
      if (error instanceof RequireLoginError) {
        navigate(`${paths.login()}?redirect=${encodeURIComponent(to)}`);
        return;
      }
      // Surface stock/other failures without crashing the grid.
      // eslint-disable-next-line no-console
      console.error('Add to cart failed', error);
    } finally {
      setAdding(false);
    }
  };

  const onInlineAdd = (e: MouseEvent<HTMLButtonElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    void onAdd(addBtnRef.current);
  };

  // The overlay pill lives above the stretched-link media, so stopPropagation
  // is required to keep the click from also navigating.
  const onOverlayQuickAdd = (e: MouseEvent<HTMLButtonElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    void onAdd(quickAddRef.current);
  };

  const showBadges = layout !== 'compact' && visibleBadges.length > 0 && inStock;
  const showDescription = layout === 'wide' && !!product.shortDesc;
  const showEyebrow = layout !== 'compact' && !!categoryName;
  const showOverlayAdd = showQuickAdd && !!cheapest && inStock;

  const primaryAddLabel = !inStock
    ? 'Sold out'
    : inCart
      ? 'In cart'
      : added
        ? 'Added'
        : adding
          ? 'Adding…'
          : 'Add to cart';

  const rootClass = ['en-pc', `en-pc--${layout}`, !inStock ? 'is-oos' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <motion.article
      className={rootClass}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{
        duration: 0.4,
        delay: Math.min(index, 8) * 0.05,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {/* Stretched link — covers the whole card so keyboard + pointer users
         navigate from anywhere on the tile. Buttons and the heart sit above
         (z-index 2+) and stopPropagation to shadow this click zone. */}
      <Link to={to} className="en-pc__link" aria-label={`View ${product.name}`}>
        <span className="visually-hidden">View {product.name}</span>
      </Link>

      {/* Media */}
      <div className={`en-pc__media${secondaryImage ? ' has-hover' : ''}`}>
        {primaryImage ? (
          <img
            src={primaryImage}
            alt={product.name}
            loading="lazy"
            className="en-pc__img en-pc__img--primary"
          />
        ) : (
          <div className="en-pc__placeholder" aria-hidden>
            {'🍖'}
          </div>
        )}
        {secondaryImage && (
          <img
            src={secondaryImage}
            alt=""
            aria-hidden
            loading="lazy"
            className="en-pc__img en-pc__img--secondary"
          />
        )}

        {showBadges && (
          <div className="en-pc__badges">
            {visibleBadges.map((label) => (
              <span key={label} className="en-badge en-badge--gold en-pc__badge">
                {label}
              </span>
            ))}
            {extraBadgeCount > 0 && (
              <span className="en-badge en-badge--neutral en-pc__badge">
                +{extraBadgeCount}
              </span>
            )}
          </div>
        )}

        {/* Wishlist heart — floats top-right over the media. */}
        <WishlistHeart productId={product.id} productName={product.name} returnTo={to} />

        {!inStock && (
          <div className="en-pc__oos-veil" aria-hidden>
            <span className="en-pc__oos-word">Sold out</span>
          </div>
        )}

        {showOverlayAdd && (
          <motion.button
            ref={quickAddRef}
            type="button"
            className="en-pc__quickadd en-pulse"
            onClick={onOverlayQuickAdd}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
            disabled={adding || isMutating || inCart}
            aria-label={
              inCart ? `${product.name} is in your cart` : `Quick add ${product.name} to cart`
            }
          >
            {inCart ? '✓ In cart' : added ? '✓ Added' : adding ? 'Adding…' : 'Quick add'}
          </motion.button>
        )}
      </div>

      {/* Body */}
      <div className="en-pc__body">
        {showEyebrow && <p className="en-pc__eyebrow">{categoryName}</p>}

        <h3 className="en-pc__name">{product.name}</h3>

        {showDescription && product.shortDesc && (
          <p className="en-pc__desc">{product.shortDesc}</p>
        )}

        {product.ratingCount > 0 && (
          <div className="en-pc__rating">
            <StarRating value={product.rating} count={product.ratingCount} />
          </div>
        )}

        <div className="en-pc__price">
          {cheapest ? (
            <>
              <div className="en-pc__price-line">
                <span className="en-pc__price-now">{formatPaise(cheapest.pricePaise)}</span>
                {cheapest.mrpPaise > cheapest.pricePaise && (
                  <span className="en-pc__price-mrp">{formatPaise(cheapest.mrpPaise)}</span>
                )}
                {off > 0 && (
                  <span className="en-pc__save" aria-label={`Save ${off} percent`}>
                    SAVE {off}%
                  </span>
                )}
              </div>
              <span className="en-pc__soldby">{soldByLabel(cheapest.weightG)}</span>
            </>
          ) : (
            <span className="en-pc__price-now">—</span>
          )}
        </div>

        {/* Bottom action row — primary Add fills the row; a ghost "Quick view"
           link sits to the right when the underlying variant has enough
           information to justify a shortcut into the PDP. */}
        <div className="en-pc__actions">
          <button
            ref={addBtnRef}
            type="button"
            className={`en-pc__add en-pulse${inCart ? ' is-in-cart' : ''}${
              added ? ' is-added' : ''
            }`}
            onClick={onInlineAdd}
            disabled={!cheapest || !inStock || adding || isMutating || inCart}
            aria-label={
              !inStock
                ? `${product.name} is sold out`
                : inCart
                  ? `${product.name} is in your cart`
                  : `Add ${product.name} to cart`
            }
          >
            {adding ? (
              <span
                className="en-spinner"
                aria-hidden
                style={{ width: 16, height: 16, borderWidth: 2 }}
              />
            ) : (
              <>
                {(inCart || added) && (
                  <svg
                    aria-hidden
                    viewBox="0 0 24 24"
                    className="en-pc__add-icon"
                    width="16"
                    height="16"
                  >
                    <path
                      d="M5 12.5l4 4L19 6"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
                <span>{primaryAddLabel}</span>
              </>
            )}
          </button>

          {inStock && (
            <Link
              to={to}
              className="en-pc__quickview"
              onClick={(e) => e.stopPropagation()}
              aria-label={`Quick view ${product.name}`}
            >
              Quick view
              <span aria-hidden> →</span>
            </Link>
          )}
        </div>
      </div>
    </motion.article>
  );
}

// ─────────────────────────────────────────────────────────────
// Star row — 5 crisp SVG stars with partial fills via clipPath.
// A single <svg> holds the mask + full row so alignment stays
// perfectly baseline-aligned regardless of font metrics.
// ─────────────────────────────────────────────────────────────

interface StarRatingProps {
  value: number;
  count: number;
}

function StarRating({ value, count }: StarRatingProps): JSX.Element {
  const clamped = Math.max(0, Math.min(5, value));
  // Percentage of a 5-star row that should be filled — clipPath cuts the
  // gold overlay so partial stars look natural.
  const fillPct = (clamped / 5) * 100;

  const stars = [0, 1, 2, 3, 4];
  const star = (
    <path
      d="M10 1.5l2.6 5.27 5.82.84-4.21 4.1.99 5.79L10 14.77 4.8 17.5l.99-5.79L1.58 7.6l5.82-.84L10 1.5z"
      strokeLinejoin="round"
    />
  );

  return (
    <span
      className="en-pc__stars"
      aria-label={`Rated ${clamped.toFixed(1)} out of 5, ${count} review${
        count === 1 ? '' : 's'
      }`}
    >
      <span className="en-pc__stars-row" aria-hidden>
        <span className="en-pc__stars-track">
          {stars.map((i) => (
            <svg key={`e${i}`} viewBox="0 0 20 20" width="14" height="14" aria-hidden>
              {star}
            </svg>
          ))}
        </span>
        <span
          className="en-pc__stars-fill"
          style={{ width: `${fillPct}%` }}
          aria-hidden
        >
          {stars.map((i) => (
            <svg key={`f${i}`} viewBox="0 0 20 20" width="14" height="14" aria-hidden>
              {star}
            </svg>
          ))}
        </span>
      </span>
      <span className="en-pc__stars-value">{clamped.toFixed(1)}</span>
      <span className="en-pc__stars-count">({count})</span>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// Wishlist heart — pop + 6-particle burst on activate.
// Kept internal to ProductCard so the tile stays self-contained;
// the PDP retains its own larger heart affordance.
// ─────────────────────────────────────────────────────────────

interface WishlistHeartProps {
  productId: string;
  productName: string;
  /** Path to preserve if we bounce the guest to /login. */
  returnTo: string;
}

function WishlistHeart({ productId, productName, returnTo }: WishlistHeartProps): JSX.Element {
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const { isAuthenticated } = useAuth();
  const { data: wishlist } = useWishlist();
  const addToWishlist = useAddToWishlist();
  const removeFromWishlist = useRemoveFromWishlist();

  const active = wishlist?.items.some((i) => i.productId === productId) ?? false;
  const busy = addToWishlist.isPending || removeFromWishlist.isPending;

  // Boolean baton passed to HeartBurst — flip it briefly on each add-click,
  // and the burst component detects the false → true edge and plays itself.
  // A removal doesn't celebrate, so we only flip on add.
  const [burstActive, setBurstActive] = useState(false);
  const lastToggleRef = useRef<'add' | 'remove' | null>(null);

  const triggerBurst = useCallback((): void => {
    setBurstActive(true);
    // A rAF-tick reset is enough for HeartBurst to observe the edge and start
    // its own self-managed animation window.
    window.requestAnimationFrame(() => setBurstActive(false));
  }, []);

  const onClick = useCallback(
    (e: MouseEvent<HTMLButtonElement>): void => {
      e.preventDefault();
      e.stopPropagation();
      if (busy) return;
      if (!isAuthenticated) {
        navigate(`${paths.login()}?redirect=${encodeURIComponent(returnTo)}`);
        return;
      }
      if (active) {
        lastToggleRef.current = 'remove';
        removeFromWishlist.mutate(productId);
      } else {
        lastToggleRef.current = 'add';
        addToWishlist.mutate(productId);
        triggerBurst();
      }
    },
    [
      active,
      addToWishlist,
      busy,
      isAuthenticated,
      navigate,
      productId,
      removeFromWishlist,
      returnTo,
      triggerBurst,
    ],
  );

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-pressed={active}
      aria-label={active ? `Remove ${productName} from wishlist` : `Save ${productName} to wishlist`}
      className="en-pc__wish"
      data-active={active ? 'true' : 'false'}
      whileTap={reduce ? undefined : { scale: 0.88 }}
      animate={
        reduce
          ? { scale: 1 }
          : lastToggleRef.current === 'add' && active
            ? { scale: [1, 1.35, 1], transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } }
            : { scale: 1 }
      }
    >
      <span aria-hidden className="en-pc__wish-icon">
        {active ? '♥' : '♡'}
      </span>

      {/* Six-particle burst — self-cleans after ~700ms via HeartBurst. */}
      <HeartBurst active={burstActive} />
    </motion.button>
  );
}
