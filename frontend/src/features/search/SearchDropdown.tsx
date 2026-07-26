/**
 * Autocomplete panel that hangs below the header search input. Renders loading,
 * empty and "keep typing" states plus up to 8 product suggestions with a
 * thumbnail, name and the cheapest variant price. Supports keyboard nav via a
 * window-level keydown listener (the input keeps focus): ArrowUp/Down cycles
 * the highlight, Enter navigates when a row is highlighted (falling through
 * to the form's onSubmit — i.e. /search?q=… — when nothing is highlighted),
 * and Escape closes.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Spinner } from '@/components/ui';
import { cheapestVariant } from '@/features/catalog';
import { useSearch } from '@/features/search/useSearch';
import { formatPaise } from '@/lib/money';
import { paths } from '@/routes/routes';

export interface SearchDropdownProps {
  /** Raw value from the header search input. Debouncing happens in useSearch. */
  query: string;
  /** Called when a suggestion is chosen or Escape is pressed. */
  onClose: () => void;
}

const MIN_QUERY_LENGTH = 2;

export function SearchDropdown({ query, onClose }: SearchDropdownProps): JSX.Element | null {
  const navigate = useNavigate();
  const { debouncedQuery, isDebouncing, query: result } = useSearch(query);
  const trimmed = query.trim();

  const items = useMemo(() => result.data?.items ?? [], [result.data]);
  const [activeIndex, setActiveIndex] = useState(-1);

  // Reset the highlight whenever the results list changes underneath us.
  useEffect(() => {
    setActiveIndex(-1);
  }, [items]);

  // Keyboard navigation. The input keeps focus, so we listen at the window
  // level and preventDefault on Arrow* / Escape / Enter-when-highlighted.
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'ArrowDown') {
        if (items.length === 0) return;
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % items.length);
      } else if (e.key === 'ArrowUp') {
        if (items.length === 0) return;
        e.preventDefault();
        setActiveIndex((i) => (i <= 0 ? items.length - 1 : i - 1));
      } else if (e.key === 'Enter') {
        const chosen = activeIndex >= 0 ? items[activeIndex] : undefined;
        if (chosen) {
          e.preventDefault();
          navigate(paths.product(chosen.slug));
          onClose();
        }
        // else: let the form's onSubmit run → Header navigates to /search?q=…
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeIndex, items, navigate, onClose]);

  if (trimmed.length === 0) return null;

  const showTooShort = trimmed.length < MIN_QUERY_LENGTH;
  const showLoading = !showTooShort && (isDebouncing || result.isLoading);
  const showEmpty = !showLoading && !showTooShort && result.data !== undefined && items.length === 0;

  return (
    <div
      className="en-search-dropdown"
      role="listbox"
      aria-label="Search suggestions"
      onMouseDown={(e) => e.preventDefault() /* keep focus on the input */}
    >
      {showTooShort && (
        <div className="en-search-dropdown__state">
          <span aria-hidden>⌨️</span>
          <span>Keep typing to see suggestions…</span>
        </div>
      )}

      {showLoading && (
        <div className="en-search-dropdown__state">
          <Spinner size={16} />
          <span>Searching for &ldquo;{trimmed}&rdquo;…</span>
        </div>
      )}

      {showEmpty && (
        <div className="en-search-dropdown__state">
          <span aria-hidden>🕵️</span>
          <span>No results for &ldquo;{debouncedQuery}&rdquo;</span>
        </div>
      )}

      {!showTooShort && !showLoading && items.length > 0 && (
        <ul className="en-search-dropdown__list">
          {items.map((product, i) => {
            const variant = cheapestVariant(product);
            const image = product.images[0];
            const isActive = i === activeIndex;
            return (
              <li key={product.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  className={
                    'en-search-dropdown__item' + (isActive ? ' is-active' : '')
                  }
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => {
                    navigate(paths.product(product.slug));
                    onClose();
                  }}
                >
                  <span className="en-search-dropdown__thumb" aria-hidden>
                    {image ? <img src={image} alt="" loading="lazy" /> : <span>🍖</span>}
                  </span>
                  <span className="en-search-dropdown__name">{product.name}</span>
                  {variant && (
                    <span className="en-search-dropdown__price">
                      {formatPaise(variant.pricePaise)}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {!showTooShort && (
        <Link
          to={paths.search(trimmed)}
          className="en-search-dropdown__all en-link-reset"
          onClick={onClose}
        >
          See all results for &ldquo;{trimmed}&rdquo; →
        </Link>
      )}
    </div>
  );
}
