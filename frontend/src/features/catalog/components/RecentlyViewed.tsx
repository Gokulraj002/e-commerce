/**
 * "Recently viewed" rail.
 *
 * Persists the last five product slugs the shopper looked at in localStorage
 * (client-only history — the server never sees it). Renders below the related
 * products rail on the PDP when the shopper has more than one entry, so
 * first-time visitors do not see an empty rail.
 *
 * Fetching: each slug hydrates via `useQueries` on top of `fetchProduct`,
 * sharing the react-query cache with `useProduct` — so opening a previously
 * viewed product costs nothing extra.
 */
import { useEffect, useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';

import type { ProductDTO } from '@elite/shared';

import { Skeleton } from '@/components/ui';

import { fetchProduct } from '../catalog.api';
import { catalogKeys } from '../useCatalog';
import { ProductCard } from './ProductCard';

const STORAGE_KEY = 'en:recently-viewed:v1';
const MAX_ITEMS = 5;

/** Safe JSON parse — returns an empty list on any failure (missing / corrupt / SSR). */
function readSlugs(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s): s is string => typeof s === 'string' && s.length > 0).slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
}

function writeSlugs(slugs: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(slugs.slice(0, MAX_ITEMS)));
  } catch {
    // Quota / private-mode failures — recently viewed is best-effort UX.
  }
}

/** Prepend `slug` to the recently-viewed list, deduped and trimmed. Call on PDP mount. */
export function rememberViewedProduct(slug: string): void {
  if (!slug) return;
  const current = readSlugs().filter((s) => s !== slug);
  writeSlugs([slug, ...current]);
}

export interface RecentlyViewedProps {
  /** Slug of the product currently on screen — excluded from the rail. */
  currentSlug: string;
  /** Section title. */
  title?: string;
}

export function RecentlyViewed({
  currentSlug,
  title = 'Recently viewed',
}: RecentlyViewedProps): JSX.Element | null {
  // Read the stored list once per current-slug so the rail is stable while the
  // shopper interacts with the page — writes are still handled by the caller
  // and picked up on the next navigation.
  const [slugs, setSlugs] = useState<string[]>(() => readSlugs());

  useEffect(() => {
    setSlugs(readSlugs());
  }, [currentSlug]);

  const otherSlugs = useMemo(
    () => slugs.filter((s) => s !== currentSlug).slice(0, MAX_ITEMS),
    [slugs, currentSlug],
  );

  const queries = useQueries({
    queries: otherSlugs.map((slug) => ({
      queryKey: catalogKeys.product(slug),
      queryFn: () => fetchProduct(slug),
      staleTime: 5 * 60 * 1000,
    })),
  });

  const products = useMemo<ProductDTO[]>(() => {
    const out: ProductDTO[] = [];
    for (const q of queries) {
      if (q.data) out.push(q.data);
    }
    return out;
  }, [queries]);

  // Guard: the spec asks for "more than one entry" in storage — first-time
  // visitors (whose only slug is the current one) will not see this section.
  if (slugs.length <= 1) return null;

  const anyLoading = queries.some((q) => q.isLoading);

  if (anyLoading && products.length === 0) {
    return (
      <section className="en-recent" aria-labelledby="en-recent-heading" aria-busy="true">
        <div className="en-section-head">
          <h2 id="en-recent-heading" className="en-display h4 mb-0">
            {title}
          </h2>
        </div>
        <div className="en-recent__rail">
          {otherSlugs.map((s) => (
            <div key={s} className="en-recent__slide">
              <div className="en-card p-3 h-100">
                <Skeleton height={110} className="mb-2" />
                <Skeleton width="60%" height={14} />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (products.length === 0) return null;

  return (
    <section className="en-recent" aria-labelledby="en-recent-heading">
      <div className="en-section-head">
        <h2 id="en-recent-heading" className="en-display h4 mb-0">
          {title}
        </h2>
      </div>
      <div className="en-recent__rail" role="list">
        {products.map((product, i) => (
          <div key={product.id} className="en-recent__slide" role="listitem">
            <ProductCard product={product} index={i} />
          </div>
        ))}
      </div>
    </section>
  );
}
