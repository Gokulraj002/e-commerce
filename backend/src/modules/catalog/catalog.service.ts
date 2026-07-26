import { Prisma } from '@prisma/client';
import type { Category } from '@prisma/client';
import type { CategoryDTO, Paginated, ProductDTO, ProductVariantDTO } from '@elite/shared';

import { redis } from '../../lib/redis.js';
import { ApiError } from '../../utils/ApiError.js';
import { parsePagination } from '../../utils/http.js';
import * as repo from './catalog.repository.js';
import type {
  AttributeRow,
  ProductDetailRow,
  ProductListRow,
} from './catalog.repository.js';
import type {
  CreateAttributeInput,
  CreateBrandInput,
  CreateCategoryInput,
  CreateImageInput,
  CreateProductInput,
  CreateVariantInput,
  ProductListQuery,
  UpdateBrandInput,
  UpdateCategoryInput,
  UpdateProductInput,
  UpdateVariantInput,
} from './catalog.schema.js';
import type {
  AttributeDTO,
  BrandDTO,
  CategoryTreeNodeDTO,
  ProductDetailDTO,
} from './catalog.types.js';

/**
 * Business logic for the catalog. Repositories touch Prisma; this layer maps to
 * shared DTOs, enforces rules, and caches hot reads in Redis.
 */

// ── Redis cache helpers ────────────────────────────────────────────
const CACHE_TTL_SECONDS = 60;
const CACHE_KEYS = {
  categoryTree: 'catalog:category-tree',
  featured: 'catalog:featured',
} as const;

async function readCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await redis.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null; // never let a cache hiccup break a read
  }
}

async function writeCache(key: string, value: unknown): Promise<void> {
  try {
    await redis.set(key, JSON.stringify(value), 'EX', CACHE_TTL_SECONDS);
  } catch {
    /* best-effort cache */
  }
}

async function invalidate(...keys: string[]): Promise<void> {
  try {
    await redis.del(...keys);
  } catch {
    /* best-effort cache */
  }
}

// ── Mappers (Prisma entity → shared DTO) ───────────────────────────
function isVariantInStock(
  variant: ProductListRow['variants'][number],
): boolean {
  if (!variant.inventory) return false;
  const available = variant.inventory.stockG - variant.inventory.reservedG;
  return available >= variant.weightG;
}

function mapVariant(
  variant: ProductListRow['variants'][number],
): ProductVariantDTO {
  return {
    id: variant.id,
    weightG: variant.weightG,
    mrpPaise: variant.mrpPaise,
    pricePaise: variant.pricePaise,
    inStock: isVariantInStock(variant),
  };
}

function mapProduct(row: ProductListRow): ProductDTO {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    shortDesc: row.shortDesc,
    description: row.description,
    categoryId: row.categoryId,
    brandId: row.brandId,
    images: row.images.map((img) => img.url),
    tags: row.tags,
    isReadyToCook: row.isReadyToCook,
    rating: row.rating,
    ratingCount: row.ratingCount,
    variants: row.variants.map(mapVariant),
  };
}

function mapCategory(cat: Category): CategoryDTO {
  return {
    id: cat.id,
    name: cat.name,
    slug: cat.slug,
    imageUrl: cat.imageUrl,
    parentId: cat.parentId,
    sortOrder: cat.sortOrder,
  };
}

function mapBrand(brand: {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
}): BrandDTO {
  return { id: brand.id, name: brand.name, slug: brand.slug, logoUrl: brand.logoUrl };
}

function mapAttribute(attr: AttributeRow): AttributeDTO {
  return {
    id: attr.id,
    name: attr.name,
    values: attr.values.map((v) => ({ id: v.id, value: v.value })),
  };
}

function mapProductDetail(row: ProductDetailRow): ProductDetailDTO {
  return {
    ...mapProduct(row),
    attributes: row.attributes.map((pa) => ({
      attribute: pa.attributeValue.attribute.name,
      value: pa.attributeValue.value,
    })),
    reviewSummary: {
      rating: row.rating,
      ratingCount: row.ratingCount,
      recent: row.reviews.slice(0, 5).map((rev) => ({
        id: rev.id,
        rating: rev.rating,
        title: rev.title,
        body: rev.body,
        authorName: rev.user.name,
        createdAt: rev.createdAt.toISOString(),
      })),
    },
  };
}

/** Build a nested tree from a flat, active category list. */
function buildCategoryTree(categories: Category[]): CategoryTreeNodeDTO[] {
  const nodes = new Map<string, CategoryTreeNodeDTO>();
  for (const cat of categories) {
    nodes.set(cat.id, { ...mapCategory(cat), children: [] });
  }
  const roots: CategoryTreeNodeDTO[] = [];
  for (const cat of categories) {
    const node = nodes.get(cat.id)!;
    const parent = cat.parentId ? nodes.get(cat.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

// ── Categories ─────────────────────────────────────────────────────
export async function getCategoryTree(): Promise<CategoryTreeNodeDTO[]> {
  const cached = await readCache<CategoryTreeNodeDTO[]>(CACHE_KEYS.categoryTree);
  if (cached) return cached;

  const tree = buildCategoryTree(await repo.findAllCategories());
  await writeCache(CACHE_KEYS.categoryTree, tree);
  return tree;
}

export async function getCategoryBySlug(slug: string): Promise<CategoryDTO> {
  const cat = await repo.findCategoryBySlug(slug);
  if (!cat || !cat.isActive) throw ApiError.notFound('Category not found');
  return mapCategory(cat);
}

export async function createCategory(input: CreateCategoryInput): Promise<CategoryDTO> {
  if (input.parentId && !(await repo.findCategoryById(input.parentId))) {
    throw ApiError.badRequest('Parent category does not exist');
  }
  const created = await repo.createCategory(input);
  await invalidate(CACHE_KEYS.categoryTree);
  return mapCategory(created);
}

export async function updateCategory(
  id: string,
  input: UpdateCategoryInput,
): Promise<CategoryDTO> {
  if (!(await repo.findCategoryById(id))) throw ApiError.notFound('Category not found');
  if (input.parentId === id) throw ApiError.badRequest('A category cannot be its own parent');
  const updated = await repo.updateCategory(id, input);
  await invalidate(CACHE_KEYS.categoryTree);
  return mapCategory(updated);
}

export async function deleteCategory(id: string): Promise<void> {
  if (!(await repo.findCategoryById(id))) throw ApiError.notFound('Category not found');
  if ((await repo.countCategoryChildren(id)) > 0) {
    throw ApiError.conflict('Cannot delete a category that has active sub-categories');
  }
  await repo.deactivateCategory(id);
  await invalidate(CACHE_KEYS.categoryTree);
}

// ── Brands ─────────────────────────────────────────────────────────
export async function getBrands(): Promise<BrandDTO[]> {
  return (await repo.findAllBrands()).map(mapBrand);
}

export async function createBrand(input: CreateBrandInput): Promise<BrandDTO> {
  return mapBrand(await repo.createBrand(input));
}

export async function updateBrand(id: string, input: UpdateBrandInput): Promise<BrandDTO> {
  if (!(await repo.findBrandById(id))) throw ApiError.notFound('Brand not found');
  return mapBrand(await repo.updateBrand(id, input));
}

export async function deleteBrand(id: string): Promise<void> {
  if (!(await repo.findBrandById(id))) throw ApiError.notFound('Brand not found');
  await repo.deactivateBrand(id);
}

// ── Attributes ─────────────────────────────────────────────────────
export async function getAttributes(): Promise<AttributeDTO[]> {
  return (await repo.findAllAttributes()).map(mapAttribute);
}

export async function createAttribute(input: CreateAttributeInput): Promise<AttributeDTO> {
  return mapAttribute(await repo.createAttributeWithValues(input));
}

// ── Products ───────────────────────────────────────────────────────
function buildProductWhere(q: ProductListQuery): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = { isActive: true };

  if (q.category) where.category = { slug: q.category, isActive: true };
  if (q.brand) where.brand = { slug: q.brand, isActive: true };
  if (q.isReadyToCook !== undefined) where.isReadyToCook = q.isReadyToCook;
  if (q.isFeatured !== undefined) where.isFeatured = q.isFeatured;
  if (q.tags && q.tags.length) where.tags = { hasSome: q.tags };
  if (q.search) {
    where.OR = [
      { name: { contains: q.search, mode: 'insensitive' } },
      { shortDesc: { contains: q.search, mode: 'insensitive' } },
    ];
  }
  if (q.minPrice !== undefined || q.maxPrice !== undefined) {
    const pricePaise: Prisma.IntFilter = {};
    if (q.minPrice !== undefined) pricePaise.gte = q.minPrice;
    if (q.maxPrice !== undefined) pricePaise.lte = q.maxPrice;
    where.variants = { some: { isActive: true, pricePaise } };
  }
  return where;
}

function buildProductOrderBy(
  q: ProductListQuery,
): Prisma.ProductOrderByWithRelationInput {
  const order = q.order ?? 'desc';
  if (q.sort === 'rating') return { rating: order };
  // 'price' is resolved from the cheapest variant after fetch (variants are a
  // relation and cannot be ordered at the product level); default is newest.
  return { createdAt: order };
}

/** Lowest active-variant price for a product (used for price sorting). */
function minVariantPrice(row: ProductListRow): number {
  if (!row.variants.length) return Number.POSITIVE_INFINITY;
  return Math.min(...row.variants.map((v) => v.pricePaise));
}

export async function listProducts(q: ProductListQuery): Promise<Paginated<ProductDTO>> {
  const { page, pageSize, skip, take } = parsePagination({
    page: q.page,
    pageSize: q.pageSize,
  });
  const where = buildProductWhere(q);
  const orderBy = buildProductOrderBy(q);

  const [rows, total] = await Promise.all([
    repo.findProducts({ where, orderBy, skip, take }),
    repo.countProducts(where),
  ]);

  let items = rows;
  if (q.sort === 'price') {
    const direction = (q.order ?? 'asc') === 'asc' ? 1 : -1;
    items = [...rows].sort(
      (a, b) => (minVariantPrice(a) - minVariantPrice(b)) * direction,
    );
  }

  return {
    items: items.map(mapProduct),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getProductBySlug(slug: string): Promise<ProductDetailDTO> {
  const row = await repo.findProductDetailBySlug(slug);
  if (!row) throw ApiError.notFound('Product not found');
  return mapProductDetail(row);
}

export async function getFeaturedProducts(): Promise<ProductDTO[]> {
  const cached = await readCache<ProductDTO[]>(CACHE_KEYS.featured);
  if (cached) return cached;

  const products = (await repo.findFeaturedProducts(12)).map(mapProduct);
  await writeCache(CACHE_KEYS.featured, products);
  return products;
}

export async function getRelatedProducts(slug: string): Promise<ProductDTO[]> {
  const product = await repo.findProductDetailBySlug(slug);
  if (!product) throw ApiError.notFound('Product not found');
  const related = await repo.findRelatedProducts(product.categoryId, product.id, 8);
  return related.map(mapProduct);
}

export async function createProduct(input: CreateProductInput): Promise<ProductDetailDTO> {
  if (!(await repo.findCategoryById(input.categoryId))) {
    throw ApiError.badRequest('Category does not exist');
  }
  if (input.brandId && !(await repo.findBrandById(input.brandId))) {
    throw ApiError.badRequest('Brand does not exist');
  }
  const created = await repo.createProduct(input);
  await invalidate(CACHE_KEYS.featured);
  return mapProductDetail(created);
}

export async function updateProduct(
  id: string,
  input: UpdateProductInput,
): Promise<ProductDetailDTO> {
  if (!(await repo.findProductById(id))) throw ApiError.notFound('Product not found');
  if (input.categoryId && !(await repo.findCategoryById(input.categoryId))) {
    throw ApiError.badRequest('Category does not exist');
  }
  if (input.brandId && !(await repo.findBrandById(input.brandId))) {
    throw ApiError.badRequest('Brand does not exist');
  }
  const updated = await repo.updateProduct(id, input);
  await invalidate(CACHE_KEYS.featured);
  return mapProductDetail(updated);
}

export async function deleteProduct(id: string): Promise<void> {
  if (!(await repo.findProductById(id))) throw ApiError.notFound('Product not found');
  await repo.softDeleteProduct(id);
  await invalidate(CACHE_KEYS.featured);
}

// ── Variants ───────────────────────────────────────────────────────
async function assertProductExists(productId: string): Promise<void> {
  if (!(await repo.findProductById(productId))) {
    throw ApiError.notFound('Product not found');
  }
}

export async function addVariant(
  productId: string,
  input: CreateVariantInput,
): Promise<ProductVariantDTO> {
  await assertProductExists(productId);
  const variant = await repo.createVariant(productId, input);
  await invalidate(CACHE_KEYS.featured);
  return {
    id: variant.id,
    weightG: variant.weightG,
    mrpPaise: variant.mrpPaise,
    pricePaise: variant.pricePaise,
    inStock: false,
  };
}

export async function updateVariant(
  productId: string,
  variantId: string,
  input: UpdateVariantInput,
): Promise<ProductVariantDTO> {
  const variant = await repo.findVariantById(variantId);
  if (!variant || variant.productId !== productId) {
    throw ApiError.notFound('Variant not found');
  }
  const updated = await repo.updateVariant(variantId, input);
  await invalidate(CACHE_KEYS.featured);
  return {
    id: updated.id,
    weightG: updated.weightG,
    mrpPaise: updated.mrpPaise,
    pricePaise: updated.pricePaise,
    inStock: false,
  };
}

export async function removeVariant(
  productId: string,
  variantId: string,
): Promise<void> {
  const variant = await repo.findVariantById(variantId);
  if (!variant || variant.productId !== productId) {
    throw ApiError.notFound('Variant not found');
  }
  await repo.deleteVariant(variantId);
  await invalidate(CACHE_KEYS.featured);
}

// ── Images ─────────────────────────────────────────────────────────
export async function addImage(
  productId: string,
  input: CreateImageInput,
): Promise<{ id: string; url: string; alt: string | null; sortOrder: number }> {
  await assertProductExists(productId);
  const image = await repo.createImage(productId, input);
  await invalidate(CACHE_KEYS.featured);
  return { id: image.id, url: image.url, alt: image.alt, sortOrder: image.sortOrder };
}

export async function removeImage(productId: string, imageId: string): Promise<void> {
  const image = await repo.findImageById(imageId);
  if (!image || image.productId !== productId) {
    throw ApiError.notFound('Image not found');
  }
  await repo.deleteImage(imageId);
  await invalidate(CACHE_KEYS.featured);
}
