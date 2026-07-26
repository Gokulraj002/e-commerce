import { z } from 'zod';

/**
 * Zod request schemas for the catalog module. Query schemas coerce the raw
 * string query-string values into typed primitives.
 */

/** Booleans arrive as the strings "true"/"false" over the query string. */
const booleanString = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true');

const slug = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be kebab-case');

// ── Params ─────────────────────────────────────────────────────────
export const slugParamSchema = z.object({ slug: z.string().min(1) });
export const idParamSchema = z.object({ id: z.string().min(1) });
export const productIdParamSchema = z.object({ id: z.string().min(1) });
export const variantParamSchema = z.object({
  id: z.string().min(1),
  variantId: z.string().min(1),
});
export const imageParamSchema = z.object({
  id: z.string().min(1),
  imageId: z.string().min(1),
});

// ── Product list query ─────────────────────────────────────────────
export const productListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional(),
    pageSize: z.coerce.number().int().min(1).max(100).optional(),
    category: z.string().min(1).optional(),
    brand: z.string().min(1).optional(),
    minPrice: z.coerce.number().int().min(0).optional(),
    maxPrice: z.coerce.number().int().min(0).optional(),
    tags: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .transform((v) =>
        v === undefined
          ? undefined
          : (Array.isArray(v) ? v : v.split(','))
              .map((t) => t.trim())
              .filter(Boolean),
      ),
    isReadyToCook: booleanString.optional(),
    isFeatured: booleanString.optional(),
    search: z.string().min(1).max(120).optional(),
    sort: z.enum(['price', 'rating', 'newest']).optional(),
    order: z.enum(['asc', 'desc']).optional(),
  })
  .strip();
export type ProductListQuery = z.infer<typeof productListQuerySchema>;

// ── Category admin ─────────────────────────────────────────────────
export const createCategorySchema = z.object({
  name: z.string().min(2).max(80),
  slug,
  imageUrl: z.string().url().optional(),
  parentId: z.string().min(1).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = createCategorySchema.partial();
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

// ── Brand admin ────────────────────────────────────────────────────
export const createBrandSchema = z.object({
  name: z.string().min(2).max(80),
  slug,
  logoUrl: z.string().url().optional(),
  isActive: z.boolean().optional(),
});
export type CreateBrandInput = z.infer<typeof createBrandSchema>;

export const updateBrandSchema = createBrandSchema.partial();
export type UpdateBrandInput = z.infer<typeof updateBrandSchema>;

// ── Attribute admin ────────────────────────────────────────────────
export const createAttributeSchema = z.object({
  name: z.string().min(1).max(60),
  values: z.array(z.string().min(1).max(60)).min(1),
});
export type CreateAttributeInput = z.infer<typeof createAttributeSchema>;

// ── Variant admin ──────────────────────────────────────────────────
export const createVariantSchema = z.object({
  sku: z.string().min(1).max(60),
  weightG: z.number().int().positive(),
  mrpPaise: z.number().int().positive(),
  pricePaise: z.number().int().positive(),
  isActive: z.boolean().optional(),
});
export type CreateVariantInput = z.infer<typeof createVariantSchema>;

export const updateVariantSchema = createVariantSchema.partial();
export type UpdateVariantInput = z.infer<typeof updateVariantSchema>;

// ── Image admin ────────────────────────────────────────────────────
export const createImageSchema = z.object({
  url: z.string().url(),
  alt: z.string().max(160).optional(),
  sortOrder: z.number().int().min(0).optional(),
});
export type CreateImageInput = z.infer<typeof createImageSchema>;

// ── Product admin ──────────────────────────────────────────────────
export const createProductSchema = z.object({
  name: z.string().min(2).max(160),
  slug,
  shortDesc: z.string().max(280).optional(),
  description: z.string().max(4000).optional(),
  categoryId: z.string().min(1),
  brandId: z.string().min(1).optional(),
  isReadyToCook: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  tags: z.array(z.string().min(1).max(40)).optional(),
  variants: z.array(createVariantSchema).optional(),
  images: z.array(createImageSchema).optional(),
});
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = z.object({
  name: z.string().min(2).max(160).optional(),
  slug: slug.optional(),
  shortDesc: z.string().max(280).nullable().optional(),
  description: z.string().max(4000).nullable().optional(),
  categoryId: z.string().min(1).optional(),
  brandId: z.string().min(1).nullable().optional(),
  isReadyToCook: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  isActive: z.boolean().optional(),
  tags: z.array(z.string().min(1).max(40)).optional(),
});
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
