/**
 * Product detail (PDP) — magazine v3 buy experience.
 *
 * Composition only: product data comes from the catalog feature, cart actions
 * from CartContext, wishlist + reviews from their features. No money math and
 * no hardcoded colours (tokens via `var(--en-*)`).
 *
 * v3 layout at a glance (evolves v2):
 *   - **Wider gallery** — desktop split is now 70 / 30 (was 60 / 40) so the
 *     hero image is the eye-catch and the buy-box reads as a poised sidebar.
 *   - **Editorial title treatment** — small-caps gold "ELITE NON VEG" crest,
 *     hairline gold rule, huge Playfair title with clamp() sizing, Playfair
 *     italic shortDesc as subtitle, rating below.
 *   - **Premium buy box** — big segmented pack pills with the per-kg
 *     equivalent under every pack; a bold circle stepper flanking a huge
 *     quantity number; one full-width crimson CTA with the price integrated
 *     to the right; ghost heart wishlist below; a delivery estimate strip
 *     ("Free delivery · Arrives tomorrow AM slot").
 *   - **Recipe cards** — a full-width horizontal rail of three curated
 *     recipes tied to the product slug. Each card opens a modal with an
 *     ingredient list + numbered steps.
 *   - **Provenance timeline** — five-step horizontal timeline (farm → cut →
 *     seal → dispatch → arrival) replacing the earlier 3-col promise strip.
 *   - **Info tabs** — WAI-ARIA tab pattern, active tab gets a gold underline,
 *     added a 5th "Cooking" tab that renders the recipe rail inline.
 *   - **Editorial related rail** — Playfair "You might also love" headline,
 *     larger tiles fed by `RelatedProductsRail`.
 *   - Sticky add-to-cart bar retained (IntersectionObserver via `useOnScreen`).
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import type { ProductVariantDTO } from '@elite/shared';

import { Reveal } from '@/components/motion';
import {
  Badge,
  Button,
  EmptyState,
  Price,
  Rating,
  Skeleton,
} from '@/components/ui';
import {
  ImageGallery,
  RecentlyViewed,
  RelatedProductsRail,
  rememberViewedProduct,
  useOnScreen,
  useProduct,
  type ProductAttributePairDTO,
} from '@/features/catalog';
import { useAuth } from '@/features/auth/useAuth';
import { RequireLoginError } from '@/features/cart';
import { useCart } from '@/features/cart/useCart';
import { useCartFly } from '@/features/cart/useCartFly';
import {
  RecipeCard,
  RecipeModal,
  getRecipesForSlug,
  type Recipe,
} from '@/features/recipes';
import { PageMeta, productSeo } from '@/features/seo';
import { useAddToWishlist, useRemoveFromWishlist, useWishlist } from '@/features/wishlist';
import { getApiErrorMessage } from '@/lib/apiClient';
import { formatPaise, formatWeight } from '@/lib/money';
import { paths } from '@/routes/routes';

import { ChefNote } from './components/ChefNote';
import { InfoTabs } from './components/InfoTabs';
import { ProvenanceStrip } from './components/ProvenanceStrip';
import { ReviewsSection } from './components/ReviewsSection';
import { VariantSelector } from './components/VariantSelector';

const MAX_QTY = 20;
type TabId = 'description' | 'freshness' | 'preparation' | 'cooking' | 'reviews';

/** Pick a sensible default variant: first in-stock, else the first listed. */
function defaultVariant(variants: ProductVariantDTO[]): ProductVariantDTO | null {
  return variants.find((v) => v.inStock) ?? variants[0] ?? null;
}

/** Case-insensitive pick from a product's attribute list. */
function pickAttributes(
  attrs: ProductAttributePairDTO[],
  matchers: readonly string[],
): ProductAttributePairDTO[] {
  const set = new Set(matchers.map((m) => m.toLowerCase()));
  return attrs.filter((a) => set.has(a.attribute.toLowerCase()));
}

const FRESHNESS_KEYS = [
  'freshness',
  'shelf life',
  'storage',
  'storage instructions',
  'best before',
] as const;

const PREPARATION_KEYS = [
  'preparation',
  'cooking',
  'cooking style',
  'cook time',
  'marination',
] as const;

function PdpSkeleton(): JSX.Element {
  return (
    <div className="en-pdp-v2__layout">
      <div className="en-pdp-v2__gallery-col">
        <Skeleton height={0} className="en-card" radius="var(--en-radius-lg)" />
        <div style={{ aspectRatio: '4 / 3' }} />
      </div>
      <div className="en-pdp-v2__buybox-col d-flex flex-column gap-3">
        <Skeleton width="35%" height={14} />
        <Skeleton width="70%" height={40} />
        <Skeleton width="40%" height={20} />
        <Skeleton width="55%" height={28} />
        <Skeleton height={72} />
        <Skeleton width="80%" height={56} />
      </div>
    </div>
  );
}

/** Small helper that renders a spec table when there are rows to show. */
function AttributeList({ rows }: { rows: ProductAttributePairDTO[] }): JSX.Element | null {
  if (rows.length === 0) return null;
  return (
    <dl className="en-pdp-v2__specs">
      {rows.map((attr) => (
        <div key={`${attr.attribute}-${attr.value}`} className="en-pdp-v2__spec-row">
          <dt>{attr.attribute}</dt>
          <dd>{attr.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * v3 recipe rail — full-width horizontal scroll of up to 3 recipe cards.
 * Consumed both under the buy area and inline in the "Cooking" tab.
 */
interface RecipeRailProps {
  recipes: readonly Recipe[];
  onOpen: (recipe: Recipe) => void;
  /** True when rendered inside a tab panel — tightens the outer margin. */
  compact?: boolean;
}

function RecipeRail({ recipes, onOpen, compact = false }: RecipeRailProps): JSX.Element | null {
  if (recipes.length === 0) return null;
  return (
    <div
      className={`en-pdp-v3__recipes${compact ? ' is-compact' : ''}`}
      aria-label="Curated recipes for this cut"
    >
      {!compact && (
        <Reveal className="en-pdp-v3__recipes-head">
          <span className="en-eyebrow d-block mb-2">Cook it tonight</span>
          <h2 className="en-display en-pdp-v3__recipes-headline">
            Three ways to make it sing
          </h2>
          <p className="en-pdp-v3__recipes-sub">
            Recipes hand-picked by our chef — tap a card for the full method.
          </p>
        </Reveal>
      )}
      <div className="en-pdp-v3__recipes-rail" role="list">
        {recipes.map((recipe, i) => (
          <div key={recipe.id} className="en-pdp-v3__recipes-slide" role="listitem">
            <RecipeCard recipe={recipe} onOpen={onOpen} index={i} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Custom big-circle stepper used only by the v3 buy box. */
interface BigStepperProps {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}
function BigStepper({
  value,
  onChange,
  min = 1,
  max = 99,
  disabled = false,
}: BigStepperProps): JSX.Element {
  const dec = (): void => onChange(Math.max(min, value - 1));
  const inc = (): void => onChange(Math.min(max, value + 1));
  return (
    <div className="en-pdp-v3__stepper" role="group" aria-label="Quantity">
      <button
        type="button"
        onClick={dec}
        disabled={disabled || value <= min}
        aria-label="Decrease quantity"
        className="en-pdp-v3__stepper-btn"
      >
        −
      </button>
      <span className="en-pdp-v3__stepper-value" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        onClick={inc}
        disabled={disabled || value >= max}
        aria-label="Increase quantity"
        className="en-pdp-v3__stepper-btn"
      >
        +
      </button>
    </div>
  );
}

export default function ProductDetail(): JSX.Element {
  const { slug = '' } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const { data: product, isLoading, isError, error } = useProduct(slug);
  const { addItem, isMutating } = useCart();
  const { flyToCart } = useCartFly();
  const { isAuthenticated } = useAuth();

  const { data: wishlist } = useWishlist();
  const addToWishlist = useAddToWishlist();
  const removeFromWishlist = useRemoveFromWishlist();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [pending, setPending] = useState<null | 'cart'>(null);
  const [justAdded, setJustAdded] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('description');
  const [activeRecipe, setActiveRecipe] = useState<Recipe | null>(null);

  const tabsRef = useRef<HTMLDivElement>(null);
  const recipesRef = useRef<HTMLDivElement>(null);

  // Recipes rail is fully client-side — cheap to look up per slug.
  const recipes = useMemo(() => getRecipesForSlug(slug), [slug]);

  // Sticky bar visibility — observe the inline CTA row and flip when it
  // scrolls off. A small negative rootMargin buys a comfortable overlap so
  // the bar does not swap in exactly at the fold.
  const [buyBoxRef, buyBoxOnScreen] = useOnScreen<HTMLDivElement>({
    rootMargin: '-80px 0px 0px 0px',
    threshold: 0,
  });

  // Reset selection/quantity whenever a new product loads.
  useEffect(() => {
    setSelectedId(product ? defaultVariant(product.variants)?.id ?? null : null);
    setQuantity(1);
    setJustAdded(false);
    setActionError(null);
    setActiveTab('description');
    setActiveRecipe(null);
  }, [product]);

  // Remember this product in the recently-viewed rail (localStorage) once
  // we know the slug is valid (a real product came back).
  useEffect(() => {
    if (product) rememberViewedProduct(product.slug);
  }, [product]);

  const selectedVariant = useMemo(
    () => product?.variants.find((v) => v.id === selectedId) ?? null,
    [product, selectedId],
  );

  const isWishlisted = useMemo(
    () => (product ? (wishlist?.items.some((i) => i.productId === product.id) ?? false) : false),
    [wishlist, product],
  );

  const loginRedirect = useCallback((): void => {
    navigate(`${paths.login()}?redirect=${encodeURIComponent(paths.product(slug))}`);
  }, [navigate, slug]);

  const addToCart = useCallback(async (): Promise<boolean> => {
    if (!selectedVariant) return false;
    setActionError(null);
    try {
      await addItem({ variantId: selectedVariant.id, quantity });
      return true;
    } catch (err) {
      if (err instanceof RequireLoginError) {
        loginRedirect();
        return false;
      }
      setActionError(getApiErrorMessage(err, 'Could not add to cart'));
      return false;
    }
  }, [addItem, loginRedirect, quantity, selectedVariant]);

  const handleAddToCart = useCallback(
    async (e?: MouseEvent<HTMLElement>): Promise<void> => {
      // Launch the fly-in from the exact button the user pressed. Kicks off
      // before the network call so it feels responsive; harmless if the
      // mutation later errors out.
      const source = e?.currentTarget ?? null;
      const heroImage = product?.images[0] ?? null;
      if (source) flyToCart(source.getBoundingClientRect(), heroImage);

      setPending('cart');
      const ok = await addToCart();
      setPending(null);
      if (ok) {
        setJustAdded(true);
        window.setTimeout(() => setJustAdded(false), 1800);
      }
    },
    [addToCart, flyToCart, product],
  );

  const handleWishlistToggle = useCallback((): void => {
    if (!product) return;
    if (!isAuthenticated) {
      loginRedirect();
      return;
    }
    if (isWishlisted) removeFromWishlist.mutate(product.id);
    else addToWishlist.mutate(product.id);
  }, [addToWishlist, isAuthenticated, isWishlisted, loginRedirect, product, removeFromWishlist]);

  const openReviewsTab = useCallback((): void => {
    setActiveTab('reviews');
    // Focus the tablist after the state flush so keyboard users land in the
    // right context without smashing scroll for pointer users.
    window.requestAnimationFrame(() => {
      tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  const handleOpenRecipe = useCallback((recipe: Recipe): void => {
    setActiveRecipe(recipe);
  }, []);

  const handleCloseRecipe = useCallback((): void => {
    setActiveRecipe(null);
  }, []);

  // ── Loading / not-found ──────────────────────────────────────────
  if (isLoading) {
    return (
      <section className="en-section en-container en-pdp-v2 en-pdp-v3">
        <PdpSkeleton />
      </section>
    );
  }

  if (isError || !product) {
    return (
      <section className="en-section en-container en-pdp-v2 en-pdp-v3">
        <EmptyState
          icon="🔎"
          title="Product not found"
          description={
            isError
              ? getApiErrorMessage(error, "We couldn't find this cut.")
              : "We couldn't find this cut. It may have sold out or been removed."
          }
          action={
            <Link to={paths.home()} className="btn btn-gold">
              Back to shop
            </Link>
          }
        />
      </section>
    );
  }

  const inStock = selectedVariant?.inStock ?? false;
  const wishlistBusy = addToWishlist.isPending || removeFromWishlist.isPending;
  const canBuy = inStock && !!selectedVariant && !isMutating;

  // Accordion content — prefer real spec rows, fall back to premium defaults.
  const freshnessRows = pickAttributes(product.attributes, FRESHNESS_KEYS);
  const preparationRows = pickAttributes(product.attributes, PREPARATION_KEYS);

  const descriptionPanel: ReactNode = (
    <div className="row g-4 g-lg-5">
      <div className="col-12 col-lg-7">
        {product.description ? (
          <p className="mb-3" style={{ color: 'var(--en-text-dim)', whiteSpace: 'pre-line' }}>
            {product.description}
          </p>
        ) : (
          <p className="mb-3" style={{ color: 'var(--en-text-dim)' }}>
            {product.shortDesc ??
              'A premium cut selected by our butchers — crafted for cooks who care about texture and taste.'}
          </p>
        )}
        {product.tags.length > 0 && (
          <div className="d-flex flex-wrap gap-2 mt-3">
            {product.tags.map((tag) => (
              <Badge key={tag} tone="neutral">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>
      {product.attributes.length > 0 && (
        <div className="col-12 col-lg-5">
          <h3 className="en-display h5 mb-3">Specs</h3>
          <AttributeList rows={product.attributes} />
        </div>
      )}
    </div>
  );

  const freshnessPanel: ReactNode = (
    <div className="en-pdp-v2__prose">
      <AttributeList rows={freshnessRows} />
      <p>
        Cut to order and delivered chilled within 24 hours of butchering,
        sealed in tamper-evident, food-safe packaging.
      </p>
      <p>
        Store at 0&ndash;4&deg;C and consume within 2 days for peak flavour,
        or freeze at &minus;18&deg;C for up to 30 days. Never refreeze once thawed.
      </p>
    </div>
  );

  const preparationPanel: ReactNode = (
    <div className="en-pdp-v2__prose">
      <AttributeList rows={preparationRows} />
      <p>
        Best cooked from thawed. Bring to room temperature for 15 minutes
        before pan-frying or grilling for even doneness.
      </p>
      <p>
        For curries, marinate 30 minutes with salt, ginger&ndash;garlic and
        lemon. Rest cooked meat 5 minutes off the heat before serving to lock
        in the juices.
      </p>
    </div>
  );

  const cookingPanel: ReactNode = (
    <div className="en-pdp-v2__prose">
      <p>
        Three recipes our chef reaches for when this cut lands on the counter —
        each tuned to the texture and flavour of{' '}
        <span className="fw-semibold" style={{ color: 'var(--en-ink-900, #1b1a17)' }}>
          {product.name}
        </span>
        .
      </p>
      <RecipeRail recipes={recipes} onOpen={handleOpenRecipe} compact />
    </div>
  );

  const reviewsPanel: ReactNode = (
    <div id="reviews">
      <ReviewsSection
        productId={product.id}
        rating={product.reviewSummary.rating}
        ratingCount={product.reviewSummary.ratingCount}
      />
    </div>
  );

  return (
    <section className="en-section en-container en-pdp-v2 en-pdp-v3">
      <PageMeta {...productSeo(product.name, slug, product.shortDesc)} />

      {/* Breadcrumb */}
      <nav className="en-pdp-v2__breadcrumb" aria-label="Breadcrumb">
        <Link to={paths.home()} className="en-link-reset">
          Home
        </Link>
        <span aria-hidden> / </span>
        <span className="en-pdp-v2__breadcrumb-current">{product.name}</span>
      </nav>

      <div className="en-pdp-v2__layout">
        {/* Gallery column — sticky on desktop */}
        <div className="en-pdp-v2__gallery-col">
          <div className="en-pdp-v2__gallery-sticky">
            <ImageGallery images={product.images} name={product.name} />
          </div>
        </div>

        {/* Buy-box column */}
        <div className="en-pdp-v2__buybox-col">
          <div className="en-pdp-v2__badges">
            {product.isReadyToCook && <Badge tone="gold">Ready to cook</Badge>}
            {inStock ? (
              <Badge tone="fresh">● In stock</Badge>
            ) : (
              <Badge tone="neutral">Out of stock</Badge>
            )}
          </div>

          <span className="en-pdp-v3__crest">Elite Non Veg</span>
          <hr className="en-pdp-v3__rule" aria-hidden />

          <h1 className="en-pdp-v3__title">{product.name}</h1>

          {product.shortDesc && (
            <p className="en-pdp-v3__subtitle">{product.shortDesc}</p>
          )}

          {product.ratingCount > 0 && (
            <button
              type="button"
              onClick={openReviewsTab}
              className="en-pdp-v2__rating-link en-link-reset"
            >
              <Rating value={product.rating} />
              <span className="en-pdp-v2__rating-count">
                {product.rating.toFixed(1)} &middot; {product.ratingCount}{' '}
                {product.ratingCount === 1 ? 'review' : 'reviews'}
              </span>
            </button>
          )}

          <div className="en-pdp-v2__pack-wrap">
            <span className="en-pdp-v2__label">Choose your pack</span>
            <VariantSelector
              variants={product.variants}
              selectedId={selectedId}
              onSelect={setSelectedId}
              variant="premium"
            />
          </div>

          <div ref={buyBoxRef} className="en-pdp-v2__cta-wrap">
            <div className="en-pdp-v3__cta-row">
              <BigStepper
                value={quantity}
                onChange={setQuantity}
                min={1}
                max={MAX_QTY}
                disabled={!inStock}
              />

              <button
                type="button"
                onClick={handleAddToCart}
                disabled={!canBuy || pending === 'cart'}
                aria-busy={pending === 'cart' || undefined}
                className={`en-pdp-v2__cta en-pdp-v3__cta${justAdded ? ' is-added' : ''}`}
              >
                <span className="en-pdp-v2__cta-label">
                  <span aria-hidden className="en-pdp-v3__cta-arrow">
                    →
                  </span>
                  <span>
                    {pending === 'cart'
                      ? 'Adding…'
                      : justAdded
                        ? 'Added to cart'
                        : 'Add to cart'}
                  </span>
                </span>
                {selectedVariant && (
                  <span className="en-pdp-v2__cta-price">
                    <Price
                      pricePaise={selectedVariant.pricePaise * quantity}
                      hideOff
                      size="md"
                    />
                  </span>
                )}
              </button>
            </div>

            <button
              type="button"
              onClick={handleWishlistToggle}
              disabled={wishlistBusy}
              aria-pressed={isWishlisted}
              className="en-pdp-v2__heart"
              data-active={isWishlisted ? 'true' : 'false'}
            >
              <span aria-hidden className="en-pdp-v2__heart-icon">
                {isWishlisted ? '♥' : '♡'}
              </span>
              <span>{isWishlisted ? 'Saved to wishlist' : 'Save to wishlist'}</span>
            </button>
          </div>

          {/* Delivery estimate row */}
          <div className="en-pdp-v3__delivery" aria-label="Delivery estimate">
            <span aria-hidden className="en-pdp-v3__delivery-icon">
              🚚
            </span>
            <span className="en-pdp-v3__delivery-text">
              <span className="en-pdp-v3__delivery-strong">Free delivery</span>
              {' '}on this order · Arrives{' '}
              <span className="en-pdp-v3__delivery-strong">tomorrow, AM slot</span>
            </span>
          </div>

          {selectedVariant && (
            <p className="en-pdp-v2__tax-note">
              {formatPaise(selectedVariant.pricePaise)} per {formatWeight(selectedVariant.weightG)} pack
              &middot; inclusive of all taxes
            </p>
          )}

          {!inStock && (
            <p className="en-pdp-v2__oos">
              This pack is currently out of stock. Try another pack size above.
            </p>
          )}

          {actionError && (
            <p className="en-pdp-v2__error" role="alert">
              {actionError}
            </p>
          )}
        </div>
      </div>

      {/* Chef's note — full-width editorial callout under the split */}
      <ChefNote productName={product.name} attributes={product.attributes} />

      {/* Recipe cards — full-width horizontal rail (NEW in v3) */}
      <div ref={recipesRef}>
        <RecipeRail recipes={recipes} onOpen={handleOpenRecipe} />
      </div>

      {/* Provenance timeline — farm → cut → seal → dispatch → arrival */}
      <ProvenanceStrip />

      {/* Info tabs — Description / Freshness / Preparation / Cooking / Reviews */}
      <div ref={tabsRef} className="en-pdp-v2__tabs-wrap">
        <InfoTabs
          activeTabId={activeTab}
          onTabChange={(id) => setActiveTab(id as TabId)}
          ariaLabel="Product details"
          tabs={[
            { id: 'description', label: 'Description', content: descriptionPanel },
            { id: 'freshness', label: 'Freshness', content: freshnessPanel },
            { id: 'preparation', label: 'Preparation', content: preparationPanel },
            { id: 'cooking', label: 'Cooking', content: cookingPanel },
            {
              id: 'reviews',
              label: `Reviews${
                product.reviewSummary.ratingCount > 0
                  ? ` (${product.reviewSummary.ratingCount})`
                  : ''
              }`,
              content: reviewsPanel,
            },
          ]}
        />
      </div>

      {/* Related editorial rail */}
      <div className="en-pdp-v2__related">
        <Reveal className="en-pdp-v2__related-head">
          <span className="en-eyebrow d-block mb-2">Curated pairings</span>
          <h2 className="en-display en-pdp-v2__related-headline">You might also love</h2>
        </Reveal>
        <RelatedProductsRail slug={slug} />
      </div>

      {/* Recently viewed (localStorage-backed) */}
      <div className="mt-5 pt-2">
        <RecentlyViewed currentSlug={slug} />
      </div>

      {/* Sticky add-to-cart bar — always mounted, CSS toggles visibility. */}
      <div
        className={`en-sticky-buy${!buyBoxOnScreen ? ' is-visible' : ''}`}
        aria-hidden={buyBoxOnScreen}
      >
        <div className="en-container en-sticky-buy__inner">
          <div className="en-sticky-buy__thumb" aria-hidden>
            {product.images[0] ? <img src={product.images[0]} alt="" loading="lazy" /> : '🍖'}
          </div>
          <div className="en-sticky-buy__meta">
            <span className="en-sticky-buy__name">{product.name}</span>
            {selectedVariant && (
              <span className="en-sticky-buy__weight">
                {formatWeight(selectedVariant.weightG)} · qty {quantity}
              </span>
            )}
          </div>
          {selectedVariant && (
            <div className="en-sticky-buy__price">
              <Price
                pricePaise={selectedVariant.pricePaise * quantity}
                hideOff
                size="md"
              />
            </div>
          )}
          <Button
            variant="gold"
            onClick={handleAddToCart}
            disabled={!canBuy}
            isLoading={pending === 'cart'}
            className="en-sticky-buy__cta"
            tabIndex={buyBoxOnScreen ? -1 : 0}
          >
            {justAdded ? '✓ Added' : 'Add to cart'}
          </Button>
        </div>
      </div>

      {/* Recipe modal — controlled by the rail (both the standalone section
          and the inline "Cooking" tab share the same modal state). */}
      <RecipeModal open={activeRecipe !== null} recipe={activeRecipe} onClose={handleCloseRecipe} />
    </section>
  );
}
