/**
 * Debounced product-autocomplete hook used by the header search dropdown.
 *
 * Waits 250ms of keyboard idleness before calling
 * `GET /catalog/products?search=…&pageSize=8` (via the catalog feature's
 * `fetchProducts`). Short queries (< 2 chars) are skipped so we don't spam
 * the API on every keystroke while a user is still composing a word.
 */
import type { Paginated, ProductDTO } from '@elite/shared';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useEffect, useState } from 'react';


import { fetchProducts } from '@/features/catalog';

const DEBOUNCE_MS = 250;
const AUTOCOMPLETE_PAGE_SIZE = 8;
const MIN_QUERY_LENGTH = 2;

export const searchKeys = {
  autocomplete: (q: string): readonly ['search', 'autocomplete', string] =>
    ['search', 'autocomplete', q] as const,
};

/** Debounce a value: returns the trailing-edge value after `delay` ms of idleness. */
function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export interface UseSearchResult {
  /** The debounced (trailing-edge) query the query hook actually ran against. */
  debouncedQuery: string;
  /** True while the input has diverged from `debouncedQuery` and we're waiting. */
  isDebouncing: boolean;
  /** Underlying react-query result — `data.items` are the up-to-8 suggestions. */
  query: UseQueryResult<Paginated<ProductDTO>>;
}

/**
 * Autocomplete hook. Pass the raw input value; receive a debounced query
 * plus the resulting products for the dropdown.
 */
export function useSearch(rawQuery: string): UseSearchResult {
  const trimmed = rawQuery.trim();
  const debounced = useDebounced(trimmed, DEBOUNCE_MS);
  const enabled = debounced.length >= MIN_QUERY_LENGTH;

  const queryResult = useQuery({
    queryKey: searchKeys.autocomplete(debounced),
    queryFn: () => fetchProducts({ search: debounced, pageSize: AUTOCOMPLETE_PAGE_SIZE }),
    enabled,
  });

  return {
    debouncedQuery: debounced,
    isDebouncing: enabled && trimmed !== debounced,
    query: queryResult,
  };
}
