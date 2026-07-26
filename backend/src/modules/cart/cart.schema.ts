import { z } from 'zod';

export const addItemSchema = z.object({
  variantId: z.string().min(1, 'variantId is required'),
  quantity: z.number().int().positive().max(99).default(1),
});

export const updateItemSchema = z.object({
  quantity: z.number().int().positive().max(99),
});

export const itemIdParamSchema = z.object({
  itemId: z.string().min(1),
});

export const applyCouponSchema = z.object({
  code: z
    .string()
    .min(1, 'Coupon code is required')
    .transform((s) => s.trim().toUpperCase()),
});

export type AddItemInput = z.infer<typeof addItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type ApplyCouponInput = z.infer<typeof applyCouponSchema>;
