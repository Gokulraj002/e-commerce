/**
 * Category — premium listing page for a single category slug.
 *
 * Layout (v3):
 *   1. A full-bleed cinematic hero band (~360 px) — a darkened cover photo
 *      keyed off the slug (chicken / mutton / seafood / ready-to-cook / bulk)
 *      or the category's own imageUrl if present, a gold eyebrow, Playfair
 *      title, live product count and data-derived tag chips.
 *   2. Beneath: a sticky filter rail on ≥lg paired with a responsive
 *      1/2/3/4-column product grid that reuses the shared `ProductCard` v3
 *      (opted-in to the hover-image cross-fade and premium "Quick add" pill).
 *   3. Sort lives as a segmented pill top-right of the grid header.
 *      Loading shows 8 shaped skeletons; empty shows a butcher-knife panel
 *      with a clear-filters CTA; more results append via "Load more".
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import type { ProductDTO } from '@elite/shared';

import { Badge, Button, Drawer, Skeleton } from '@/components/ui';
import {
  ProductCard,
  isProductInStock,
  useCategories,
  useProducts,
  type CategoryNodeDTO,
  type ProductQuery,
  type ProductSort,
  type SortOrder,
} from '@/features/catalog';
import { paiseToRupees, rupeesToPaise } from '@/lib/money';
import { paths } from '@/routes/routes';

const PAGE_SIZE = 12;

// Price slider bounds in rupees. 100-rupee steps keep the dual thumbs snappy
// without JS work, and the max acts as an "unbounded" marker (₹5000+).
const PRICE_MIN = 0;
const PRICE_MAX = 5000;
const PRICE_STEP = 100;

type SortValue = 'newest' | 'price-asc' | 'price-desc' | 'rating';

interface SortOption {
  value: SortValue;
  /** Terse label for the segmented pill (fits on a single line at ≥lg). */
  short: string;
  /** Long label for aria + mobile drawer fallback. */
  label: string;
}

const SORT_OPTIONS: ReadonlyArray<SortOption> = [
  { value: 'newest', short: 'Newest', label: 'Newest first' },
  { value: 'price-asc', short: 'Price ↑', label: 'Price: low to high' },
  { value: 'price-desc', short: 'Price ↓', label: 'Price: high to low' },
  { value: 'rating', short: 'Top rated', label: 'Top rated' },
];

const SORT_TO_QUERY: Record<SortValue, { sort: ProductSort; order: SortOrder }> = {
  newest: { sort: 'newest', order: 'desc' },
  'price-asc': { sort: 'price', order: 'asc' },
  'price-desc': { sort: 'price', order: 'desc' },
  rating: { sort: 'rating', order: 'desc' },
};

interface AppliedFilters {
  minPaise?: number;
  maxPaise?: number;
  readyToCook: boolean;
  /** Client-side filter; keeps the paginated API contract unchanged. */
  inStockOnly: boolean;
  sort: SortValue;
}

const DEFAULT_FILTERS: AppliedFilters = {
  readyToCook: false,
  inStockOnly: false,
  sort: 'newest',
};

/**
 * Cinematic hero cover art per top-level slug. Stable Unsplash CDN ids so the
 * URLs don't drift; each shot was hand-picked for editorial contrast against
 * the cream palette and works after our dark scrim overlay. Any category not
 * in this table falls back to a neutral butcher-block image.
 *
 * `?auto=format&fit=crop&w=1600&q=70` keeps CLS-free responsive delivery.
 */
const HERO_COVER_BY_SLUG: Readonly<Record<string, string>> = {
  chicken:
    'https://images.unsplash.com/photo-1587593810167-a84920ea0781?auto=format&fit=crop&w=1600&q=70',
  mutton:
    'https://images.unsplash.com/photo-1602470520998-f4a52199a3d6?auto=format&fit=crop&w=1600&q=70',
  seafood:
    'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=1600&q=70',
  'ready-to-cook':
    'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1600&q=70',
  bulk:
    'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?auto=format&fit=crop&w=1600&q=70',
};

const HERO_DEFAULT_COVER =
  'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?auto=format&fit=crop&w=1600&q=70';

/** Pick a hero cover URL — category.imageUrl wins, then slug lookup, then default. */
function pickHeroCover(category: CategoryNodeDTO | null, slug: string): string {
  if (category?.imageUrl) return category.imageUrl;
  return HERO_COVER_BY_SLUG[slug] ?? HERO_DEFAULT_COVER;
}

/** Depth-first search of the category tree for a node matching `slug`. */
function findCategory(nodes: CategoryNodeDTO[] | undefined, slug: string): CategoryNodeDTO | null {
  if (!nodes) return null;
  for (const node of nodes) {
    if (node.slug === slug) return node;
    const found = findCategory(node.children, slug);
    if (found) return found;
  }
  return null;
}

/**
 * Derive a compact set of tag chips for the hero from the currently loaded
 * products. Prepends "Ready to cook" when any item is flagged, then adds the
 * two most-common product tags. Result is deduplicated and capped at 3.
 */
function deriveHeroChips(items: ProductDTO[]): string[] {
  const chips: string[] = [];
  if (items.some((p) => p.isReadyToCook)) chips.push('Ready to cook');

  const tagCounts = new Map<string, number>();
  for (const p of items) {
    for (const tag of p.tags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
  }
  const sorted = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag);
  for (const tag of sorted) {
    if (chips.length >= 3) break;
    if (!chips.includes(tag)) chips.push(tag);
  }
  return chips;
}

interface PriceRangeSliderProps {
  min: number;
  max: number;
  step: number;
  valueMin: number;
  valueMax: number;
  onChange: (nextMin: number, nextMax: number) => void;
}

/**
 * Dual-thumb range slider using two overlaid `<input type="range">` elements.
 * The fill band between the thumbs is a positioned div; both sit on top of a
 * shared cream track. No JS is needed to redraw on drag — CSS custom
 * properties on the fill compute the highlight from the two draft values.
 */
function PriceRangeSlider({
  min,
  max,
  step,
  valueMin,
  valueMax,
  onChange,
}: PriceRangeSliderProps): JSX.Element {
  const safeMin = Math.max(min, Math.min(valueMin, valueMax));
  const safeMax = Math.min(max, Math.max(valueMin, valueMax));
  const leftPct = ((safeMin - min) / (max - min)) * 100;
  const rightPct = 100 - ((safeMax - min) / (max - min)) * 100;

  return (
    <div className="en-cat-v2-range" role="group" aria-label="Price range">
      <div className="en-cat-v2-range__track" aria-hidden />
      <div
        className="en-cat-v2-range__fill"
        aria-hidden
        style={{ left: `${leftPct}%`, right: `${rightPct}%` }}
      />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={safeMin}
        aria-label="Minimum price in rupees"
        onChange={(e) => {
          const next = Math.min(Number(e.target.value), safeMax - step);
          onChange(Math.max(min, next), safeMax);
        }}
      />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={safeMax}
        aria-label="Maximum price in rupees"
        onChange={(e) => {
          const next = Math.max(Number(e.target.value), safeMin + step);
          onChange(safeMin, Math.min(max, next));
        }}
      />
    </div>
  );
}

interface FiltersPanelProps {
  filters: AppliedFilters;
  onChange: (next: AppliedFilters) => void;
  onReset: () => void;
  activeCount: number;
}

/** The filter controls — shared by the sticky sidebar and mobile drawer. */
function FiltersPanel({
  filters,
  onChange,
  onReset,
  activeCount,
}: FiltersPanelProps): JSX.Element {
  // Draft the range values locally so we only commit when the user releases.
  const [rangeMin, setRangeMin] = useState<number>(
    filters.minPaise !== undefined ? paiseToRupees(filters.minPaise) : PRICE_MIN,
  );
  const [rangeMax, setRangeMax] = useState<number>(
    filters.maxPaise !== undefined ? paiseToRupees(filters.maxPaise) : PRICE_MAX,
  );

  useEffect(() => {
    setRangeMin(filters.minPaise !== undefined ? paiseToRupees(filters.minPaise) : PRICE_MIN);
    setRangeMax(filters.maxPaise !== undefined ? paiseToRupees(filters.maxPaise) : PRICE_MAX);
  }, [filters.minPaise, filters.maxPaise]);

  const commitPrice = (): void => {
    // Full-range = unset, so the query key stays stable when the user hasn't
    // actually narrowed either bound.
    const minSet = rangeMin > PRICE_MIN;
    const maxSet = rangeMax < PRICE_MAX;
    onChange({
      ...filters,
      minPaise: minSet ? rupeesToPaise(rangeMin) : undefined,
      maxPaise: maxSet ? rupeesToPaise(rangeMax) : undefined,
    });
  };

  const rangeChanged =
    (filters.minPaise ?? rupeesToPaise(PRICE_MIN)) !== rupeesToPaise(rangeMin) ||
    (filters.maxPaise ?? rupeesToPaise(PRICE_MAX)) !== rupeesToPaise(rangeMax);

  return (
    <div>
      <div className="en-cat-v2-filters__title">
        <span>Refine</span>
        {activeCount > 0 && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onReset}>
            Clear all
          </button>
        )}
      </div>

      <div className="en-cat-v2-filters__section">
        <span className="en-cat-v2-filters__label">Price range</span>
        <PriceRangeSlider
          min={PRICE_MIN}
          max={PRICE_MAX}
          step={PRICE_STEP}
          valueMin={rangeMin}
          valueMax={rangeMax}
          onChange={(nextMin, nextMax) => {
            setRangeMin(nextMin);
            setRangeMax(nextMax);
          }}
        />
        <div className="en-cat-v2-range__labels">
          <span>{'₹'}{rangeMin}</span>
          <span>{rangeMax >= PRICE_MAX ? `₹${PRICE_MAX}+` : `₹${rangeMax}`}</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          fullWidth
          className="mt-3"
          onClick={commitPrice}
          disabled={!rangeChanged}
        >
          Apply price
        </Button>
      </div>

      <div className="en-cat-v2-filters__section">
        <span className="en-cat-v2-filters__label">Preparation</span>
        <label className="en-toggle">
          <input
            type="checkbox"
            checked={filters.readyToCook}
            onChange={(e) => onChange({ ...filters, readyToCook: e.target.checked })}
          />
          <span className="en-toggle__track" aria-hidden />
          <span>Ready to cook only</span>
        </label>
      </div>

      <div className="en-cat-v2-filters__section">
        <span className="en-cat-v2-filters__label">Availability</span>
        <label className="en-toggle">
          <input
            type="checkbox"
            checked={filters.inStockOnly}
            onChange={(e) => onChange({ ...filters, inStockOnly: e.target.checked })}
          />
          <span className="en-toggle__track" aria-hidden />
          <span>In stock only</span>
        </label>
      </div>
    </div>
  );
}

/** 8 shaped skeleton tiles matching the new card silhouette. */
function ProductGridSkeleton(): JSX.Element {
  return (
    <div className="en-cat-v2-grid" aria-hidden>
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="en-cat-v2-skel">
          <div className="en-cat-v2-skel__media" />
          <div className="en-cat-v2-skel__body">
            <Skeleton width="70%" height={18} />
            <Skeleton width="40%" height={14} />
            <Skeleton width="55%" height={22} className="mt-2" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface SortPillProps {
  value: SortValue;
  onChange: (next: SortValue) => void;
}

function SortPill({ value, onChange }: SortPillProps): JSX.Element {
  return (
    <div className="en-cat-v2-sort" role="tablist" aria-label="Sort products">
      {SORT_OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={opt.label}
            className={`en-cat-v2-sort__btn${active ? ' is-active' : ''}`}
            onClick={() => onChange(opt.value)}
          >
            {opt.short}
          </button>
        );
      })}
    </div>
  );
}

export default function Category(): JSX.Element {
  const { slug = '' } = useParams<{ slug: string }>();

  const { data: categories } = useCategories();
  const category = findCategory(categories, slug);

  const [filters, setFilters] = useState<AppliedFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<ProductDTO[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Reset pagination + accumulated results whenever the filters or slug change.
  useEffect(() => {
    setPage(1);
    setItems([]);
  }, [slug, filters]);

  const query = useMemo<ProductQuery>(() => {
    const { sort, order } = SORT_TO_QUERY[filters.sort];
    return {
      category: slug,
      minPrice: filters.minPaise,
      maxPrice: filters.maxPaise,
      isReadyToCook: filters.readyToCook ? true : undefined,
      sort,
      order,
      page,
      pageSize: PAGE_SIZE,
    };
  }, [slug, filters, page]);

  const { data, isLoading, isFetching, isPlaceholderData } = useProducts(query);

  // Append newly-fetched pages; page 1 replaces (fresh filter/slug).
  useEffect(() => {
    if (!data) return;
    setItems((prev) => (data.page === 1 ? data.items : [...prev, ...data.items]));
  }, [data]);

  // "In stock only" is applied client-side so we don't have to change the
  // paginated API contract. The visible count adjusts, "Load more" still
  // drives new pages from the server for the base query.
  const visibleItems = useMemo(
    () => (filters.inStockOnly ? items.filter(isProductInStock) : items),
    [items, filters.inStockOnly],
  );

  const total = data?.total ?? 0;
  const displayCount = visibleItems.length;
  const hasMore = data ? data.page < data.totalPages : false;
  const isInitialLoading = isLoading && items.length === 0;

  const activeFilterCount =
    (filters.readyToCook ? 1 : 0) +
    (filters.inStockOnly ? 1 : 0) +
    (filters.minPaise !== undefined ? 1 : 0) +
    (filters.maxPaise !== undefined ? 1 : 0);
  const isFiltered = activeFilterCount > 0 || filters.sort !== 'newest';

  const resetFilters = (): void => setFilters(DEFAULT_FILTERS);
  const setSort = (sort: SortValue): void => setFilters((f) => ({ ...f, sort }));

  const heading = category?.name ?? slug.replace(/-/g, ' ');
  const chips = useMemo(() => {
    const derived = deriveHeroChips(items);
    // While the first page is still loading, seed the chip row with tasteful
    // defaults so the hero doesn't sit empty.
    if (derived.length > 0) return derived;
    if (!isInitialLoading) return [];
    return ['Fresh · never frozen', 'Cut to order'];
  }, [items, isInitialLoading]);
  const heroCover = pickHeroCover(category, slug);
  const productCountLine = isInitialLoading
    ? 'Loading fresh cuts…'
    : `${total} ${total === 1 ? 'cut' : 'cuts'} · delivered in Hyderabad`;

  return (
    <>
      <header
        className="en-cat-v3-hero"
        style={{ backgroundImage: `url(${heroCover})` }}
        role="banner"
      >
        <div className="en-cat-v3-hero__scrim" aria-hidden />
        <div className="en-cat-v3-hero__inner">
          <nav className="en-cat-v3-crumbs" aria-label="Breadcrumb">
            <Link to={paths.home()}>Home</Link>
            <span className="en-cat-v3-crumbs__sep" aria-hidden>
              /
            </span>
            <span className="text-capitalize" aria-current="page">
              {heading}
            </span>
          </nav>

          <p className="en-cat-v3-hero__eyebrow">Fresh &amp; cut to order</p>
          <h1 className="en-cat-v3-hero__title text-capitalize">{heading}</h1>
          <p className="en-cat-v3-hero__meta">{productCountLine}</p>

          {chips.length > 0 && (
            <div className="en-cat-v3-hero__chips">
              {chips.map((chip) => (
                <Badge key={chip} tone="gold" className="text-capitalize en-cat-v3-hero__chip">
                  {chip}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </header>

      <div className="en-container en-cat-v2-body">
        <div className="row g-4">
          <aside className="col-lg-3 d-none d-lg-block">
            <div className="en-cat-v2-filters">
              <FiltersPanel
                filters={filters}
                onChange={setFilters}
                onReset={resetFilters}
                activeCount={activeFilterCount}
              />
            </div>
          </aside>

          <div className="col-12 col-lg-9">
            <div className="en-cat-v2-grid-head">
              <div className="en-cat-v2-grid-head__count">
                {isInitialLoading ? (
                  <span className="en-text-muted">Fetching cuts…</span>
                ) : (
                  <>
                    <strong>{displayCount}</strong>{' '}
                    {displayCount === 1 ? 'product' : 'products'}
                    {filters.inStockOnly && displayCount !== items.length && (
                      <span className="en-text-muted ms-2">
                        (of {items.length} loaded)
                      </span>
                    )}
                  </>
                )}
              </div>

              <div className="en-cat-v2-grid-head__actions">
                <Button
                  variant="outline"
                  size="sm"
                  className="d-lg-none en-cat-v2-mobiletrig"
                  onClick={() => setDrawerOpen(true)}
                >
                  {'⚙'} Filters
                  {activeFilterCount > 0 && (
                    <span className="en-cat-v2-count-pill">{activeFilterCount}</span>
                  )}
                </Button>
                <SortPill value={filters.sort} onChange={setSort} />
              </div>
            </div>

            {isInitialLoading ? (
              <ProductGridSkeleton />
            ) : visibleItems.length === 0 ? (
              <div className="en-cat-v3-empty">
                <svg
                  className="en-cat-v3-empty__icon"
                  viewBox="0 0 96 96"
                  aria-hidden
                  fill="none"
                >
                  {/* Butcher's cleaver — a warm-cream glyph on a soft gold
                     back-plate. Kept as a single <svg> so the empty panel
                     doesn't ship an extra asset. */}
                  <circle cx="48" cy="48" r="46" fill="rgba(183,134,40,0.10)" />
                  <path
                    d="M20 34c22-14 42-14 56-2l6 6-14 14-8-8c-10-4-24-2-40 8l0-18z"
                    fill="var(--en-crimson)"
                    fillOpacity="0.9"
                  />
                  <path
                    d="M56 52l18 18a4 4 0 0 1-6 6L50 58l6-6z"
                    fill="var(--en-ink-900)"
                    fillOpacity="0.85"
                  />
                  <path
                    d="M20 34c22-14 42-14 56-2"
                    stroke="var(--en-gold)"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
                <h3 className="en-cat-v3-empty__title">No cuts match those filters</h3>
                <p className="en-cat-v3-empty__desc">
                  Try widening the price range, turning off toggles, or clearing filters
                  to see the full range of {heading.toLowerCase()}.
                </p>
                {isFiltered && (
                  <Button variant="gold" onClick={resetFilters}>
                    Clear filters
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="en-cat-v2-grid">
                  {visibleItems.map((product, i) => (
                    <div key={product.id} className="en-cat-v2-tile">
                      <ProductCard
                        product={product}
                        index={i}
                        hoverImage={product.images[1] ?? null}
                        showQuickAdd
                      />
                    </div>
                  ))}
                </div>

                {hasMore && (
                  <div className="en-cat-v2-loadmore">
                    <Button
                      variant="outline"
                      size="lg"
                      isLoading={isFetching && isPlaceholderData}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Load more cuts
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Filters" side="left">
        <FiltersPanel
          filters={filters}
          onChange={(next) => setFilters(next)}
          onReset={resetFilters}
          activeCount={activeFilterCount}
        />
      </Drawer>
    </>
  );
}
