/**
 * Search — full-page results view for the header search bar.
 *
 * V2 layout:
 *   1. Cinematic ink-tinted hero band with Playfair title, gold subtitle
 *      and an inline auto-focused search input at the bottom.
 *   2. Sort + filter bar: chip-style filter toggles (in-stock, ready-to-
 *      cook, bulk) and a native sort dropdown (relevance / price ↑ / price ↓
 *      / newest).
 *   3. Suggestions strip when the query is shorter than 3 chars.
 *   4. Skeleton grid on first load; ProductCard grid otherwise.
 *   5. Empty state with a "Popular searches" chip row so a dead end still
 *      hands the visitor a next step.
 *
 * Server pagination is unchanged — the "In stock", "Ready-to-cook" and
 * "Bulk" chips filter the accumulated `items` client-side so we don't
 * complicate the paginated API contract or throw away already-fetched
 * pages when a chip is toggled.
 */
import type { ProductDTO } from '@elite/shared';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { Button, Skeleton, TrustRow, type TrustRowItem } from '@/components/ui';
import {
  ProductCard,
  cheapestVariant,
  isProductInStock,
  useProducts,
  type ProductQuery,
  type ProductSort,
  type SortOrder,
} from '@/features/catalog';
import { paths } from '@/routes/routes';

const PAGE_SIZE = 12;

/** UX-facing sort tokens exposed by the dropdown. */
type SortValue = 'relevance' | 'price-asc' | 'price-desc' | 'newest';

interface SortOption {
  value: SortValue;
  label: string;
}

const SORT_OPTIONS: ReadonlyArray<SortOption> = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'price-asc', label: 'Price ↑' },
  { value: 'price-desc', label: 'Price ↓' },
  { value: 'newest', label: 'Newest' },
];

/**
 * Map dropdown sort to the API's (sort, order) pair. `relevance` maps to
 * `undefined` so the server picks its default match-quality ordering.
 */
function sortToQuery(
  value: SortValue,
): { sort?: ProductSort; order?: SortOrder } {
  switch (value) {
    case 'price-asc':
      return { sort: 'price', order: 'asc' };
    case 'price-desc':
      return { sort: 'price', order: 'desc' };
    case 'newest':
      return { sort: 'newest', order: 'desc' };
    case 'relevance':
    default:
      return {};
  }
}

const POPULAR_QUERIES: ReadonlyArray<string> = [
  'Chicken curry',
  'Mutton',
  'Prawns',
  'Bulk',
];

const TRUST_ITEMS: ReadonlyArray<TrustRowItem> = [
  { icon: '❄️', label: 'Cold-chain delivery' },
  { icon: '🔪', label: 'Cut to order' },
  { icon: '⚡', label: 'Same-day dispatch' },
  { icon: '✅', label: 'Antibiotic-free' },
];

/** Suggestion strip shown when the query is too short to trigger a real search. */
const SHORT_QUERY_LENGTH = 3;

interface ChipFilters {
  inStockOnly: boolean;
  readyToCook: boolean;
  bulk: boolean;
}

const DEFAULT_CHIPS: ChipFilters = {
  inStockOnly: false,
  readyToCook: false,
  bulk: false,
};

/**
 * Whether a product looks like a "bulk" cut. The catalog does not have a
 * first-class flag for bulk packs, so we detect it heuristically from tags
 * and from cheapest-variant weight — anything at or above 1 kg counts.
 */
function isBulkProduct(product: ProductDTO): boolean {
  if (product.tags.some((t) => /bulk|family|party|pack/i.test(t))) return true;
  const cheapest = cheapestVariant(product);
  return cheapest ? cheapest.weightG >= 1000 : false;
}

function ResultsSkeleton(): JSX.Element {
  return (
    <div className="en-search-v2-grid" aria-hidden>
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="en-search-v2-skel">
          <div className="en-search-v2-skel__media" />
          <div className="en-search-v2-skel__body">
            <Skeleton width="70%" height={18} />
            <Skeleton width="40%" height={14} />
            <Skeleton width="55%" height={22} className="mt-2" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface FilterChipProps {
  label: string;
  active: boolean;
  onToggle: () => void;
}

function FilterChip({ label, active, onToggle }: FilterChipProps): JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      className={`en-search-v2-chip${active ? ' is-active' : ''}`}
      onClick={onToggle}
    >
      <span className="en-search-v2-chip__dot" aria-hidden />
      {label}
    </button>
  );
}

/** Suggestion strip shown while the query is too short for the API. */
function SuggestionsStrip(): JSX.Element {
  return (
    <div className="en-search-v2-suggest" role="note">
      <span className="en-search-v2-suggest__label">Try:</span>
      <div className="en-search-v2-suggest__chips">
        {POPULAR_QUERIES.map((term) => (
          <Link
            key={term}
            to={paths.search(term)}
            className="en-search-v2-suggest__chip en-link-reset"
          >
            {term}
          </Link>
        ))}
      </div>
    </div>
  );
}

interface HeroBandProps {
  query: string;
  total: number;
  isInitialLoading: boolean;
  onSubmit: (next: string) => void;
}

function HeroBand({
  query,
  total,
  isInitialLoading,
  onSubmit,
}: HeroBandProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [draft, setDraft] = useState(query);

  // Keep the local draft in sync when the URL query changes (e.g. via
  // Popular Searches chip click or browser back/forward).
  useEffect(() => {
    setDraft(query);
  }, [query]);

  // Auto-focus the hero input on mount so a user landing on /search can
  // immediately refine — the header's focus follows the last blurred input
  // so we take the focus back here explicitly.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (trimmed.length === 0) return;
    onSubmit(trimmed);
  };

  const subtitle = isInitialLoading
    ? 'Fetching cuts…'
    : query.length === 0
      ? 'Start typing to find fresh chicken, mutton, seafood and more.'
      : `${total} ${total === 1 ? 'cut' : 'cuts'} for "${query}"`;

  return (
    <header className="en-search-v2-hero">
      <div className="en-search-v2-hero__inner">
        <nav className="en-search-v2-hero__crumbs" aria-label="Breadcrumb">
          <Link to={paths.home()}>Home</Link>
          <span aria-hidden>/</span>
          <span aria-current="page">Search</span>
        </nav>

        <h1 className="en-search-v2-hero__title">Search results</h1>
        <p className="en-search-v2-hero__subtitle">{subtitle}</p>

        <form
          className="en-search-v2-hero__form"
          role="search"
          onSubmit={handleSubmit}
        >
          <span className="en-search-v2-hero__form-icon" aria-hidden>
            🔍
          </span>
          <input
            ref={inputRef}
            type="search"
            className="en-search-v2-hero__input"
            placeholder="Search chicken curry cut, prawns, tandoori mutton…"
            value={draft}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setDraft(e.target.value)}
            aria-label="Search products"
          />
          <button
            type="submit"
            className="en-search-v2-hero__submit"
            aria-label="Run search"
          >
            Search
          </button>
        </form>
      </div>
    </header>
  );
}

export default function Search(): JSX.Element {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rawQ = searchParams.get('q') ?? '';
  const q = rawQ.trim();

  const [page, setPage] = useState(1);
  const [items, setItems] = useState<ProductDTO[]>([]);
  const [chips, setChips] = useState<ChipFilters>(DEFAULT_CHIPS);
  const [sort, setSort] = useState<SortValue>('relevance');

  // A fresh `q` or sort restart both pagination and the accumulated list —
  // the accumulated array holds pages against a *fixed* base query.
  useEffect(() => {
    setPage(1);
    setItems([]);
  }, [q, sort]);

  const query = useMemo<ProductQuery>(() => {
    const { sort: apiSort, order } = sortToQuery(sort);
    return {
      search: q,
      page,
      pageSize: PAGE_SIZE,
      sort: apiSort,
      order,
    };
  }, [q, page, sort]);

  const { data, isLoading, isFetching, isPlaceholderData } = useProducts(query);

  // Append newly-fetched pages; page 1 replaces (fresh query/sort).
  useEffect(() => {
    if (!data) return;
    setItems((prev) => (data.page === 1 ? data.items : [...prev, ...data.items]));
  }, [data]);

  // Client-side chip filtering — keeps the paginated API contract simple.
  const visibleItems = useMemo(() => {
    let out = items;
    if (chips.inStockOnly) out = out.filter(isProductInStock);
    if (chips.readyToCook) out = out.filter((p) => p.isReadyToCook);
    if (chips.bulk) out = out.filter(isBulkProduct);
    return out;
  }, [items, chips]);

  const total = data?.total ?? 0;
  const displayCount = visibleItems.length;
  const hasMore = data ? data.page < data.totalPages : false;
  const isInitialLoading = q.length > 0 && isLoading && items.length === 0;
  const isShortQuery = q.length > 0 && q.length < SHORT_QUERY_LENGTH;

  const activeChipCount =
    (chips.inStockOnly ? 1 : 0) +
    (chips.readyToCook ? 1 : 0) +
    (chips.bulk ? 1 : 0);

  const gotoQuery = (next: string): void => {
    navigate(paths.search(next));
  };

  return (
    <>
      <HeroBand
        query={q}
        total={total}
        isInitialLoading={isInitialLoading}
        onSubmit={gotoQuery}
      />

      <div className="en-container en-search-v2-body">
        {q.length === 0 ? (
          <div className="en-search-v2-empty">
            <div className="en-search-v2-empty__icon" aria-hidden>
              🔎
            </div>
            <h2 className="en-search-v2-empty__title">Search Elite NonVeg</h2>
            <p className="en-search-v2-empty__desc">
              Search the catalog for chicken, mutton, seafood, kebabs and more —
              or start with a popular query below.
            </p>
            <div className="en-search-v2-empty__chips">
              {POPULAR_QUERIES.map((term) => (
                <Link
                  key={term}
                  to={paths.search(term)}
                  className="en-search-v2-chip is-suggest en-link-reset"
                >
                  {term}
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="en-search-v2-toolbar">
              <div
                className="en-search-v2-toolbar__chips"
                role="group"
                aria-label="Refine results"
              >
                <FilterChip
                  label="In stock"
                  active={chips.inStockOnly}
                  onToggle={() =>
                    setChips((c) => ({ ...c, inStockOnly: !c.inStockOnly }))
                  }
                />
                <FilterChip
                  label="Ready-to-cook"
                  active={chips.readyToCook}
                  onToggle={() =>
                    setChips((c) => ({ ...c, readyToCook: !c.readyToCook }))
                  }
                />
                <FilterChip
                  label="Bulk"
                  active={chips.bulk}
                  onToggle={() => setChips((c) => ({ ...c, bulk: !c.bulk }))}
                />
                {activeChipCount > 0 && (
                  <button
                    type="button"
                    className="en-search-v2-chip__clear"
                    onClick={() => setChips(DEFAULT_CHIPS)}
                  >
                    Clear
                  </button>
                )}
              </div>

              <label className="en-search-v2-toolbar__sort">
                <span className="en-search-v2-toolbar__sort-label">Sort</span>
                <select
                  value={sort}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                    setSort(e.target.value as SortValue)
                  }
                  aria-label="Sort search results"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {isShortQuery && <SuggestionsStrip />}

            {isInitialLoading ? (
              <ResultsSkeleton />
            ) : visibleItems.length === 0 ? (
              <div className="en-search-v2-empty en-search-v2-empty--noresults">
                <div className="en-search-v2-empty__icon" aria-hidden>
                  🥩
                </div>
                <h2 className="en-search-v2-empty__title">
                  No cuts match &ldquo;{q}&rdquo;
                </h2>
                <p className="en-search-v2-empty__desc">
                  Try a broader term, check the spelling, or start with one of
                  the popular searches below.
                </p>
                <div className="en-search-v2-empty__chips">
                  {POPULAR_QUERIES.map((term) => (
                    <Link
                      key={term}
                      to={paths.search(term)}
                      className="en-search-v2-chip is-suggest en-link-reset"
                    >
                      {term}
                    </Link>
                  ))}
                </div>
                <div className="en-search-v2-empty__cta">
                  <Link to={paths.home()}>
                    <Button variant="gold">Browse categories</Button>
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <div className="en-search-v2-count">
                  <strong>{displayCount}</strong>{' '}
                  {displayCount === 1 ? 'cut' : 'cuts'}
                  {activeChipCount > 0 && displayCount !== items.length && (
                    <span className="en-text-muted ms-2">
                      (of {items.length} loaded)
                    </span>
                  )}
                </div>

                <div className="en-search-v2-grid">
                  {visibleItems.map((product, i) => (
                    <div key={product.id} className="en-search-v2-tile">
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
                  <div className="en-search-v2-loadmore">
                    <Button
                      variant="outline"
                      size="lg"
                      isLoading={isFetching && isPlaceholderData}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Load more results
                    </Button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        <div className="en-search-v2-trust">
          <TrustRow items={TRUST_ITEMS} tone="cream" />
        </div>
      </div>
    </>
  );
}
