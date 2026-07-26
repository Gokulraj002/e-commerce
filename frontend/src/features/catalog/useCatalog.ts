/**
 * React-query hooks for the catalog. Query keys are arrays, most-specific-last,
 * so cached reads and invalidations stay predictable across pages.
 */
import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query';

import type { Paginated, ProductDTO } from '@elite/shared';

import {
  fetchBanners,
  fetchCategories,
  fetchFeaturedProducts,
  fetchProduct,
  fetchProducts,
  fetchRelatedProducts,
} from './catalog.api';
import type {
  BannerDTO,
  CategoryNodeDTO,
  ProductDetailDTO,
  ProductQuery,
} from './catalog.types';

export const catalogKeys = {
  products: (q: ProductQuery) => ['products', q] as const,
  featured: () => ['products', 'featured'] as const,
  product: (slug: string) => ['product', slug] as const,
  related: (slug: string) => ['product', slug, 'related'] as const,
  categories: () => ['categories'] as const,
  banners: (position: string) => ['banners', position] as const,
};

/** Paginated product list. Keeps the previous page visible while the next loads. */
export function useProducts(query: ProductQuery = {}): UseQueryResult<Paginated<ProductDTO>> {
  return useQuery({
    queryKey: catalogKeys.products(query),
    queryFn: () => fetchProducts(query),
    placeholderData: keepPreviousData,
  });
}

export function useFeaturedProducts(): UseQueryResult<ProductDTO[]> {
  return useQuery({
    queryKey: catalogKeys.featured(),
    queryFn: fetchFeaturedProducts,
  });
}

export function useProduct(slug: string): UseQueryResult<ProductDetailDTO> {
  return useQuery({
    queryKey: catalogKeys.product(slug),
    queryFn: () => fetchProduct(slug),
    enabled: slug.length > 0,
  });
}

export function useRelatedProducts(slug: string): UseQueryResult<ProductDTO[]> {
  return useQuery({
    queryKey: catalogKeys.related(slug),
    queryFn: () => fetchRelatedProducts(slug),
    enabled: slug.length > 0,
  });
}

export function useCategories(): UseQueryResult<CategoryNodeDTO[]> {
  return useQuery({
    queryKey: catalogKeys.categories(),
    queryFn: fetchCategories,
  });
}

export function useBanners(position: string): UseQueryResult<BannerDTO[]> {
  return useQuery({
    queryKey: catalogKeys.banners(position),
    queryFn: () => fetchBanners(position),
  });
}
