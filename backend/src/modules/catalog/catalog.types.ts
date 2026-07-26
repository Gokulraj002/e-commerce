import type { CategoryDTO, ProductDTO } from '@elite/shared';

/**
 * Module-local DTOs that extend the shared shapes with catalog-only detail
 * (the shared ProductDTO/CategoryDTO deliberately stay lean for list views).
 */

/** Category node with nested children — used by the category-tree endpoint. */
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

export interface ReviewPreviewDTO {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  authorName: string;
  createdAt: string;
}

export interface ReviewSummaryDTO {
  rating: number;
  ratingCount: number;
  recent: ReviewPreviewDTO[];
}

/** Full product view returned by GET /products/:slug. */
export interface ProductDetailDTO extends ProductDTO {
  attributes: ProductAttributePairDTO[];
  reviewSummary: ReviewSummaryDTO;
}
