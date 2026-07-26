import { COUPON_TYPE } from '@elite/shared';
import { z } from 'zod';

import { rupeesToPaise } from '@/lib/money';

import type { AdminCoupon, CouponWriteInput } from './sales.types';
import { toDateInputValue } from './format';

/** Empty string (untouched number input) → undefined, else pass through. */
const emptyToUndefined = (v: unknown) => (v === '' || v === null ? undefined : v);

const optionalPositive = z.preprocess(
  emptyToUndefined,
  z.coerce.number().positive('Must be greater than 0').optional(),
);

const optionalPositiveInt = z.preprocess(
  emptyToUndefined,
  z.coerce.number().int().positive('Must be a positive whole number').optional(),
);

/**
 * Coupon create/edit form. Money is captured in rupees (converted to paise on
 * submit); `percent` for PERCENT coupons and `valueRupees` for FLAT coupons are
 * conditionally required to mirror the backend schema.
 */
export const couponFormSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(1, 'Coupon code is required')
      .max(40, 'Code is too long'),
    type: z.nativeEnum(COUPON_TYPE),
    percent: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int().min(1, 'Between 1 and 100').max(100, 'Between 1 and 100').optional(),
    ),
    valueRupees: optionalPositive,
    maxDiscountRupees: optionalPositive,
    minCartRupees: z.preprocess(
      emptyToUndefined,
      z.coerce.number().min(0, 'Cannot be negative').optional(),
    ),
    usageLimit: optionalPositiveInt,
    perUserLimit: optionalPositiveInt,
    startsAt: z.string().optional(),
    expiresAt: z.string().optional(),
    isActive: z.boolean(),
    description: z.string().trim().max(200, 'Keep it under 200 characters').optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === COUPON_TYPE.PERCENT && data.percent == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Percentage is required for a % coupon',
        path: ['percent'],
      });
    }
    if (data.type === COUPON_TYPE.FLAT && data.valueRupees == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Discount amount is required for a flat coupon',
        path: ['valueRupees'],
      });
    }
  });

export type CouponFormValues = z.infer<typeof couponFormSchema>;

/** Build the API request body from validated form values. */
export function toCouponWriteInput(values: CouponFormValues): CouponWriteInput {
  const isPercent = values.type === COUPON_TYPE.PERCENT;
  const isFlat = values.type === COUPON_TYPE.FLAT;
  return {
    code: values.code.trim().toUpperCase(),
    type: values.type,
    percent: isPercent ? (values.percent ?? null) : null,
    valuePaise: isFlat && values.valueRupees != null ? rupeesToPaise(values.valueRupees) : null,
    maxDiscountPaise:
      isPercent && values.maxDiscountRupees != null
        ? rupeesToPaise(values.maxDiscountRupees)
        : null,
    minCartPaise: values.minCartRupees != null ? rupeesToPaise(values.minCartRupees) : 0,
    usageLimit: values.usageLimit ?? null,
    perUserLimit: values.perUserLimit ?? null,
    startsAt: values.startsAt ? new Date(values.startsAt).toISOString() : null,
    expiresAt: values.expiresAt ? new Date(values.expiresAt).toISOString() : null,
    isActive: values.isActive,
    description: values.description?.trim() ? values.description.trim() : null,
  };
}

/** Seed the form from an existing coupon (paise → rupees, ISO → date input). */
export function toCouponFormValues(coupon: AdminCoupon | null): CouponFormValues {
  if (!coupon) {
    return {
      code: '',
      type: COUPON_TYPE.PERCENT,
      percent: undefined,
      valueRupees: undefined,
      maxDiscountRupees: undefined,
      minCartRupees: 0,
      usageLimit: undefined,
      perUserLimit: undefined,
      startsAt: '',
      expiresAt: '',
      isActive: true,
      description: undefined,
    };
  }
  return {
    code: coupon.code,
    type: coupon.type,
    percent: coupon.percent ?? undefined,
    valueRupees: coupon.valuePaise != null ? coupon.valuePaise / 100 : undefined,
    maxDiscountRupees: coupon.maxDiscountPaise != null ? coupon.maxDiscountPaise / 100 : undefined,
    minCartRupees: coupon.minCartPaise / 100,
    usageLimit: coupon.usageLimit ?? undefined,
    perUserLimit: coupon.perUserLimit ?? undefined,
    startsAt: toDateInputValue(coupon.startsAt),
    expiresAt: toDateInputValue(coupon.expiresAt),
    isActive: coupon.isActive,
    description: coupon.description ?? undefined,
  };
}
