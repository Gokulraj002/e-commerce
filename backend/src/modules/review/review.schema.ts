import { z } from 'zod';

/** Zod request schemas for the review module. */

export const productIdParamSchema = z.object({ productId: z.string().min(1) });
export const reviewIdParamSchema = z.object({ id: z.string().min(1) });

export const listQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional(),
    pageSize: z.coerce.number().int().min(1).max(100).optional(),
  })
  .strip();
export type ListQuery = z.infer<typeof listQuerySchema>;

export const createReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().min(1).max(120).optional(),
  body: z.string().min(1).max(2000).optional(),
});
export type CreateReviewInput = z.infer<typeof createReviewSchema>;
