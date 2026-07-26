/**
 * Horizontal "You may also like" rail.
 *
 * Uses `useRelatedProducts` from the catalog feature and the shared
 * `ProductCard`. The rail is a scroll-snap track — chevron buttons appear on
 * desktop to nudge the track by ~80% of its visible width; on touch devices
 * the arrows hide and users swipe. Buttons are visually suppressed once the
 * track hits its start / end edges so we never suggest a scroll that goes
 * nowhere.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { Skeleton } from '@/components/ui';

import { useRelatedProducts } from '../useCatalog';
import { ProductCard } from './ProductCard';

export interface RelatedProductsRailProps {
  slug: string;
}

interface EdgeState {
  atStart: boolean;
  atEnd: boolean;
}

const EDGE_SLOP = 4;

function readEdges(el: HTMLElement): EdgeState {
  const atStart = el.scrollLeft <= EDGE_SLOP;
  const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - EDGE_SLOP;
  return { atStart, atEnd };
}

export function RelatedProductsRail({ slug }: RelatedProductsRailProps): JSX.Element | null {
  const { data: products, isLoading } = useRelatedProducts(slug);
  const trackRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState<EdgeState>({ atStart: true, atEnd: false });

  // Keep the arrow disabled states in sync with actual scroll position.
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const update = (): void => setEdges(readEdges(el));
    update();
    el.addEventListener('scroll', update, { passive: true });
    const resize = new ResizeObserver(update);
    resize.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      resize.disconnect();
    };
  }, [products]);

  const scrollBy = useCallback((direction: 1 | -1): void => {
    const el = trackRef.current;
    if (!el) return;
    const step = Math.max(240, Math.round(el.clientWidth * 0.8));
    el.scrollBy({ left: step * direction, behavior: 'smooth' });
  }, []);

  if (isLoading) {
    return (
      <div className="en-rail" aria-busy="true">
        <div className="en-rail__track">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="en-rail__slide">
              <div className="en-card p-3 h-100">
                <Skeleton height={150} className="mb-3" />
                <Skeleton width="70%" height={18} className="mb-2" />
                <Skeleton width="40%" height={16} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!products || products.length === 0) return null;

  return (
    <div className="en-rail">
      <button
        type="button"
        className="en-rail__nav en-rail__nav--prev"
        onClick={() => scrollBy(-1)}
        aria-label="Scroll to previous items"
        disabled={edges.atStart}
      >
        <span aria-hidden>‹</span>
      </button>

      <div
        ref={trackRef}
        className="en-rail__track"
        role="list"
        aria-label="Related products"
      >
        {products.map((product, i) => (
          <div key={product.id} className="en-rail__slide" role="listitem">
            <ProductCard product={product} index={i} />
          </div>
        ))}
      </div>

      <button
        type="button"
        className="en-rail__nav en-rail__nav--next"
        onClick={() => scrollBy(1)}
        aria-label="Scroll to more items"
        disabled={edges.atEnd}
      >
        <span aria-hidden>›</span>
      </button>
    </div>
  );
}
