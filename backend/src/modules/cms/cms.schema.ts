import { z } from 'zod';

const slug = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9-]+$/, 'slug must be lowercase alphanumeric with dashes');

export const slugParamSchema = z.object({ slug: z.string().min(1) });
export const idParamSchema = z.object({ id: z.string().min(1) });

export const bannerQuerySchema = z.object({
  position: z.string().min(1).max(60).optional(),
});

export const createPageSchema = z.object({
  slug,
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  isPublished: z.boolean().optional(),
});

export const updatePageSchema = z
  .object({
    slug: slug.optional(),
    title: z.string().min(1).max(200).optional(),
    content: z.string().min(1).optional(),
    isPublished: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'At least one field is required');

export const createBannerSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  imageUrl: z.string().url(),
  link: z.string().url().optional(),
  position: z.string().min(1).max(60).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const updateBannerSchema = z
  .object({
    title: z.string().min(1).max(200).nullable().optional(),
    imageUrl: z.string().url().optional(),
    link: z.string().url().nullable().optional(),
    position: z.string().min(1).max(60).optional(),
    sortOrder: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'At least one field is required');

export type CreatePageInput = z.infer<typeof createPageSchema>;
export type UpdatePageInput = z.infer<typeof updatePageSchema>;
export type CreateBannerInput = z.infer<typeof createBannerSchema>;
export type UpdateBannerInput = z.infer<typeof updateBannerSchema>;
