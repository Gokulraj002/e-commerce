import { z } from 'zod';
import { COUPON_TYPE } from '@elite/shared';

/** Public: validate a coupon against a given cart subtotal. */
export const validateCouponSchema = z.object({
  code: z
    .string()
    .min(1, 'Coupon code is required')
    .transform((s) => s.trim().toUpperCase()),
  cartSubtotalPaise: z.number().int().nonnegative(),
});

/** Shared field shape for admin create/update. */
const couponFields = z.object({
  code: z
    .string()
    .min(1, 'Coupon code is required')
    .max(40)
    .transform((s) => s.trim().toUpperCase()),
  type: z.nativeEnum(COUPON_TYPE),
  valuePaise: z.number().int().positive().nullable().optional(),
  percent: z.number().int().min(1).max(100).nullable().optional(),
  maxDiscountPaise: z.number().int().positive().nullable().optional(),
  minCartPaise: z.number().int().nonnegative().default(0),
  usageLimit: z.number().int().positive().nullable().optional(),
  perUserLimit: z.number().int().positive().nullable().optional(),
  startsAt: z.coerce.date().nullable().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
  isActive: z.boolean().default(true),
  description: z.string().max(200).nullable().optional(),
});

/** Enforce that the discount value matching the coupon type is present. */
function assertTypeValue(
  data: { type?: string; percent?: number | null; valuePaise?: number | null },
  ctx: z.RefinementCtx,
) {
  if (data.type === COUPON_TYPE.PERCENT && (data.percent === undefined || data.percent === null)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'percent is required for PERCENT coupons',
      path: ['percent'],
    });
  }
  if (
    data.type === COUPON_TYPE.FLAT &&
    (data.valuePaise === undefined || data.valuePaise === null)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'valuePaise is required for FLAT coupons',
      path: ['valuePaise'],
    });
  }
}

export const createCouponSchema = couponFields.superRefine(assertTypeValue);

/** All fields optional for PATCH; type/value consistency checked only when type is present. */
export const updateCouponSchema = couponFields.partial().superRefine((data, ctx) => {
  if (data.type !== undefined) assertTypeValue(data, ctx);
});

export const couponIdParamSchema = z.object({
  id: z.string().min(1),
});

export type ValidateCouponInput = z.infer<typeof validateCouponSchema>;
export type CreateCouponInput = z.infer<typeof createCouponSchema>;
export type UpdateCouponInput = z.infer<typeof updateCouponSchema>;
