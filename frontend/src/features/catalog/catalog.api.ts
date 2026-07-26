/**
 * Thin apiClient wrappers for the catalog + CMS-banner reads. Each returns an
 * already-unwrapped DTO (the axios layer collapses the `{ success, data }`
 * envelope). Query hooks in `useCatalog.ts` layer react-query on top.
 */
import type { Paginated, ProductDTO } from '@elite/shared';

import { apiClient } from '@/lib/apiClient';

import type {
  BannerDTO,
  CategoryNodeDTO,
  ProductDetailDTO,
  ProductQuery,
} from './catalog.types';

/** Serialise a ProductQuery into the flat params the API expects. */
function toProductParams(q: ProductQuery): Record<string, string | number | boolean> {
  const params: Record<string, string | number | boolean> = {};
  if (q.category) params.category = q.category;
  if (q.brand) params.brand = q.brand;
  if (q.minPrice !== undefined) params.minPrice = q.minPrice;
  if (q.maxPrice !== undefined) params.maxPrice = q.maxPrice;
  if (q.tags && q.tags.length > 0) params.tags = q.tags.join(',');
  if (q.isReadyToCook !== undefined) params.isReadyToCook = q.isReadyToCook;
  if (q.isFeatured !== undefined) params.isFeatured = q.isFeatured;
  if (q.search) params.search = q.search;
  if (q.sort) params.sort = q.sort;
  if (q.order) params.order = q.order;
  if (q.page !== undefined) params.page = q.page;
  if (q.pageSize !== undefined) params.pageSize = q.pageSize;
  return params;
}

export async function fetchProducts(q: ProductQuery = {}): Promise<Paginated<ProductDTO>> {
  const { data } = await apiClient.get<Paginated<ProductDTO>>('/catalog/products', {
    params: toProductParams(q),
  });
  return data;
}

export async function fetchFeaturedProducts(): Promise<ProductDTO[]> {
  const { data } = await apiClient.get<ProductDTO[]>('/catalog/products/featured');
  return data;
}

/** Full product detail (attributes + review summary) for the product page. */
export async function fetchProduct(slug: string): Promise<ProductDetailDTO> {
  const { data } = await apiClient.get<ProductDetailDTO>(`/catalog/products/${slug}`);
  return data;
}

/** Products related to the given slug — powers the "You may also like" strip. */
export async function fetchRelatedProducts(slug: string): Promise<ProductDTO[]> {
  const { data } = await apiClient.get<ProductDTO[]>(`/catalog/products/related/${slug}`);
  return data;
}

export async function fetchCategories(): Promise<CategoryNodeDTO[]> {
  const { data } = await apiClient.get<CategoryNodeDTO[]>('/catalog/categories');
  return data;
}

export async function fetchBanners(position: string): Promise<BannerDTO[]> {
  const { data } = await apiClient.get<BannerDTO[]>('/cms/banners', { params: { position } });
  return data;
}
