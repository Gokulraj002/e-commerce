/**
 * Catalog feature-local types.
 *
 * The shared package keeps `ProductDTO` / `CategoryDTO` lean; the catalog
 * endpoints return a couple of richer shapes (a nested category tree, marketing
 * banners) that are catalog-only, so they live here rather than in `@elite/shared`.
 */
import type { CategoryDTO, ProductDTO } from '@elite/shared';

/** Category node with nested children — returned by GET /catalog/categories. */
export interface CategoryNodeDTO extends CategoryDTO {
  children: CategoryNodeDTO[];
}

/** A single spec row (e.g. "Cut → Boneless") shown on the product page. */
export interface ProductAttributePairDTO {
  attribute: string;
  value: string;
}

/** Lightweight review shown inline in a product's review summary. */
export interface ReviewPreviewDTO {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  authorName: string;
  createdAt: string;
}

/** Aggregate rating + a few recent reviews, embedded in the product detail. */
export interface ReviewSummaryDTO {
  rating: number;
  ratingCount: number;
  recent: ReviewPreviewDTO[];
}

/**
 * Full product view returned by `GET /catalog/products/:slug`. Extends the lean
 * shared `ProductDTO` (used by list views) with attributes and a review summary.
 */
export interface ProductDetailDTO extends ProductDTO {
  attributes: ProductAttributePairDTO[];
  reviewSummary: ReviewSummaryDTO;
}

/** Marketing banner — returned by GET /cms/banners. */
export interface BannerDTO {
  id: string;
  title: string | null;
  imageUrl: string;
  link: string | null;
  position: string;
  sortOrder: number;
  isActive: boolean;
}

export type ProductSort = 'newest' | 'price' | 'rating';
export type SortOrder = 'asc' | 'desc';

/**
 * Filters accepted by GET /catalog/products. Prices are integer **paise** to
 * match the rest of the money pipeline; the API layer serialises these to the
 * query string.
 */
export interface ProductQuery {
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  tags?: string[];
  isReadyToCook?: boolean;
  isFeatured?: boolean;
  search?: string;
  sort?: ProductSort;
  order?: SortOrder;
  page?: number;
  pageSize?: number;
}
