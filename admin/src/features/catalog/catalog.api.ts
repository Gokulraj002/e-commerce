import type { Paginated, ProductDTO, ProductVariantDTO } from '@elite/shared';

import { api } from '@/lib/apiClient';
import { rupeesToPaise } from '@/lib/money';

import type {
  AttributeDTO,
  BrandDTO,
  CategoryTreeNodeDTO,
  ProductDetailDTO,
} from './catalog.types';
import type {
  AttributeFormValues,
  BrandFormValues,
  CategoryFormValues,
  ProductFormValues,
} from './catalog.schema';

/** Filters accepted by the admin product list. */
export interface AdminProductQuery {
  page: number;
  pageSize: number;
  search?: string;
  category?: string; // category slug
  brand?: string; // brand slug
  isFeatured?: boolean;
  sort?: string;
  order?: 'asc' | 'desc';
}

/** Sort keys the backend actually understands (see productListQuerySchema). */
const SORTABLE = new Set(['price', 'rating', 'newest']);

// ── Products ───────────────────────────────────────────────────────
export function listAdminProducts(query: AdminProductQuery) {
  const params: Record<string, string | number | boolean> = {
    page: query.page,
    pageSize: query.pageSize,
  };
  if (query.search?.trim()) params.search = query.search.trim();
  if (query.category) params.category = query.category;
  if (query.brand) params.brand = query.brand;
  if (typeof query.isFeatured === 'boolean') params.isFeatured = query.isFeatured;
  if (query.sort && SORTABLE.has(query.sort)) {
    params.sort = query.sort;
    if (query.order) params.order = query.order;
  }
  return api.get<Paginated<ProductDTO>>('/catalog/products', { params });
}

/** PATCH a product's active flag (used by bulk deactivate). */
export function setProductActive(id: string, isActive: boolean) {
  return api.patch<{ id: string }>(`/catalog/products/${id}`, { isActive });
}

export function getProductBySlug(slug: string) {
  return api.get<ProductDetailDTO>(`/catalog/products/${slug}`);
}

export function deleteProduct(id: string) {
  return api.delete<{ id: string }>(`/catalog/products/${id}`);
}

function parseTags(raw?: string): string[] {
  if (!raw) return [];
  return Array.from(
    new Set(
      raw
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    ),
  );
}

/** Deterministic-ish unique SKU for a freshly added variant row. */
function makeSku(slug: string, weightG: number, index: number): string {
  const base = slug || 'sku';
  return `${base}-${weightG}g-${Date.now().toString(36)}${index}`;
}

/**
 * Create or update a product from form values. On create, variants and images
 * are sent inline. On edit the core fields are PATCHed, then variants are
 * reconciled (add/patch/delete) and any brand-new image URLs are POSTed —
 * the product-detail payload exposes no image ids, so existing images cannot be
 * deleted through this contract.
 */
export async function saveProduct(
  values: ProductFormValues,
  existing?: ProductDetailDTO,
): Promise<ProductDetailDTO> {
  const tags = parseTags(values.tags);
  const images = values.images.map((img) => ({ url: img.url }));

  if (!existing) {
    return api.post<ProductDetailDTO>('/catalog/products', {
      name: values.name,
      slug: values.slug,
      shortDesc: values.shortDesc || undefined,
      description: values.description || undefined,
      categoryId: values.categoryId,
      brandId: values.brandId || undefined,
      isReadyToCook: values.isReadyToCook,
      isFeatured: values.isFeatured,
      tags,
      images,
      variants: values.variants.map((v, i) => ({
        sku: makeSku(values.slug, v.weightG, i),
        weightG: v.weightG,
        mrpPaise: rupeesToPaise(v.mrpRupees),
        pricePaise: rupeesToPaise(v.priceRupees),
      })),
    });
  }

  const productId = existing.id;

  await api.patch<ProductDetailDTO>(`/catalog/products/${productId}`, {
    name: values.name,
    slug: values.slug,
    shortDesc: values.shortDesc ? values.shortDesc : null,
    description: values.description ? values.description : null,
    categoryId: values.categoryId,
    brandId: values.brandId ? values.brandId : null,
    isReadyToCook: values.isReadyToCook,
    isFeatured: values.isFeatured,
    tags,
  });

  // Delete removed variants.
  const keptIds = new Set(values.variants.map((v) => v.id).filter(Boolean));
  await Promise.all(
    existing.variants
      .filter((v) => !keptIds.has(v.id))
      .map((v) => api.delete<{ id: string }>(`/catalog/products/${productId}/variants/${v.id}`)),
  );

  // Patch existing / add new variants.
  await Promise.all(
    values.variants.map((v, i) => {
      const body = {
        weightG: v.weightG,
        mrpPaise: rupeesToPaise(v.mrpRupees),
        pricePaise: rupeesToPaise(v.priceRupees),
      };
      if (v.id) {
        return api.patch<ProductVariantDTO>(
          `/catalog/products/${productId}/variants/${v.id}`,
          body,
        );
      }
      return api.post<ProductVariantDTO>(`/catalog/products/${productId}/variants`, {
        sku: makeSku(values.slug, v.weightG, i),
        ...body,
      });
    }),
  );

  // Add newly-entered image URLs.
  const existingUrls = new Set(existing.images);
  await Promise.all(
    images
      .filter((img) => !existingUrls.has(img.url))
      .map((img) => api.post(`/catalog/products/${productId}/images`, img)),
  );

  return getProductBySlug(values.slug);
}

// ── Categories ─────────────────────────────────────────────────────
export function getCategoryTree() {
  return api.get<CategoryTreeNodeDTO[]>('/catalog/categories');
}

function categoryPayload(values: CategoryFormValues) {
  return {
    name: values.name,
    slug: values.slug,
    parentId: values.parentId || undefined,
    imageUrl: values.imageUrl ? values.imageUrl : undefined,
    sortOrder: values.sortOrder,
  };
}

export function createCategory(values: CategoryFormValues) {
  return api.post('/catalog/categories', categoryPayload(values));
}

export function updateCategory(id: string, values: CategoryFormValues) {
  return api.patch(`/catalog/categories/${id}`, categoryPayload(values));
}

export function deleteCategory(id: string) {
  return api.delete<{ id: string }>(`/catalog/categories/${id}`);
}

// ── Brands ─────────────────────────────────────────────────────────
export function getBrands() {
  return api.get<BrandDTO[]>('/catalog/brands');
}

function brandPayload(values: BrandFormValues) {
  return {
    name: values.name,
    slug: values.slug,
    logoUrl: values.logoUrl ? values.logoUrl : undefined,
  };
}

export function createBrand(values: BrandFormValues) {
  return api.post<BrandDTO>('/catalog/brands', brandPayload(values));
}

export function updateBrand(id: string, values: BrandFormValues) {
  return api.patch<BrandDTO>(`/catalog/brands/${id}`, brandPayload(values));
}

export function deleteBrand(id: string) {
  return api.delete<{ id: string }>(`/catalog/brands/${id}`);
}

// ── Attributes ─────────────────────────────────────────────────────
export function getAttributes() {
  return api.get<AttributeDTO[]>('/catalog/attributes');
}

export function createAttribute(values: AttributeFormValues) {
  return api.post<AttributeDTO>('/catalog/attributes', {
    name: values.name,
    values: values.values.map((v) => v.value),
  });
}

/** Flatten the category tree into a depth-annotated list for tables & selects. */
export interface FlatCategory {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  sortOrder: number;
  imageUrl: string | null;
  depth: number;
}

export function flattenCategories(
  nodes: CategoryTreeNodeDTO[],
  depth = 0,
  out: FlatCategory[] = [],
): FlatCategory[] {
  for (const node of nodes) {
    out.push({
      id: node.id,
      name: node.name,
      slug: node.slug,
      parentId: node.parentId,
      sortOrder: node.sortOrder,
      imageUrl: node.imageUrl,
      depth,
    });
    if (node.children.length) flattenCategories(node.children, depth + 1, out);
  }
  return out;
}
