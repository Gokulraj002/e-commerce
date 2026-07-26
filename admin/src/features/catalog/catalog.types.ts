import type { CategoryDTO, ProductDTO } from '@elite/shared';

/**
 * Admin-local catalog DTOs. `@elite/shared` deliberately keeps the customer-safe
 * shapes lean, so the richer admin/detail shapes (which mirror the backend's
 * `catalog.types.ts`) are declared here rather than re-exported from shared.
 */

/** Category node with nested children — returned by GET /catalog/categories. */
export interface CategoryTreeNodeDTO extends CategoryDTO {
  children: CategoryTreeNodeDTO[];
}

export interface BrandDTO {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
}

export interface AttributeValueDTO {
  id: string;
  value: string;
}

export interface AttributeDTO {
  id: string;
  name: string;
  values: AttributeValueDTO[];
}

export interface ProductAttributePairDTO {
  attribute: string;
  value: string;
}

export interface ReviewSummaryDTO {
  rating: number;
  ratingCount: number;
}

/** Full product view returned by GET /catalog/products/:slug. */
export interface ProductDetailDTO extends ProductDTO {
  attributes: ProductAttributePairDTO[];
  reviewSummary: ReviewSummaryDTO;
}
