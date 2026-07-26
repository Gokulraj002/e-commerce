import { z } from 'zod';

/**
 * Zod form schemas for the catalog admin pages. Money is entered in rupees and
 * converted to integer paise before hitting the API (see catalog.api.ts).
 */

const kebabSlug = z
  .string()
  .min(1, 'Slug is required')
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase words separated by hyphens');

/** Optional URL field that also accepts an empty string (treated as "unset"). */
const optionalUrl = z.union([z.literal(''), z.string().url('Enter a valid URL')]);

// ── Product ────────────────────────────────────────────────────────
export const variantFormSchema = z
  .object({
    id: z.string().optional(),
    weightG: z.coerce.number().int().positive('Pick a pack size'),
    mrpRupees: z.coerce.number().positive('MRP must be greater than 0'),
    priceRupees: z.coerce.number().positive('Price must be greater than 0'),
  })
  .refine((v) => v.priceRupees <= v.mrpRupees, {
    message: 'Price cannot exceed MRP',
    path: ['priceRupees'],
  });
export type VariantFormValues = z.infer<typeof variantFormSchema>;

export const productFormSchema = z.object({
  name: z.string().min(2, 'Name is too short').max(160),
  slug: kebabSlug,
  categoryId: z.string().min(1, 'Select a category'),
  brandId: z.string().optional(),
  shortDesc: z.string().max(280).optional(),
  description: z.string().max(4000).optional(),
  tags: z.string().optional(), // comma-separated in the form
  isReadyToCook: z.boolean(),
  isFeatured: z.boolean(),
  images: z.array(z.object({ url: z.string().url('Enter a valid image URL') })),
  variants: z.array(variantFormSchema).min(1, 'Add at least one variant'),
});
export type ProductFormValues = z.infer<typeof productFormSchema>;

// ── Category ───────────────────────────────────────────────────────
export const categoryFormSchema = z.object({
  name: z.string().min(2, 'Name is too short').max(80),
  slug: kebabSlug,
  parentId: z.string().optional(),
  imageUrl: optionalUrl.optional(),
  sortOrder: z.coerce.number().int().min(0),
});
export type CategoryFormValues = z.infer<typeof categoryFormSchema>;

// ── Brand ──────────────────────────────────────────────────────────
export const brandFormSchema = z.object({
  name: z.string().min(2, 'Name is too short').max(80),
  slug: kebabSlug,
  logoUrl: optionalUrl.optional(),
});
export type BrandFormValues = z.infer<typeof brandFormSchema>;

// ── Attribute ──────────────────────────────────────────────────────
export const attributeFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(60),
  values: z
    .array(z.object({ value: z.string().min(1, 'Value is required').max(60) }))
    .min(1, 'Add at least one value'),
});
export type AttributeFormValues = z.infer<typeof attributeFormSchema>;

/** Turn a product/category name into a kebab-case slug suggestion. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
