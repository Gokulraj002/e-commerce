import type { Coupon } from '@prisma/client';
import type { CouponDTO } from '@elite/shared';
import { COUPON_TYPE, MONEY } from '@elite/shared';

import { ApiError } from '../../utils/ApiError.js';
import { couponRepository } from './coupon.repository.js';
import type { CreateCouponInput, UpdateCouponInput } from './coupon.schema.js';

/** Map a Coupon entity to the client-safe DTO. */
export function toCouponDTO(coupon: Coupon): CouponDTO {
  return {
    code: coupon.code,
    type: coupon.type,
    valuePaise: coupon.valuePaise,
    percent: coupon.percent,
    minCartPaise: coupon.minCartPaise,
    description: coupon.description ?? '',
  };
}

/**
 * Single source of truth for coupon discount math (reused by cart pricing).
 * Returns the discount applied to the item subtotal, in paise.
 * FREE_SHIPPING coupons yield no item discount — pricing waives shipping instead.
 */
export function computeDiscount(coupon: Coupon, subtotalPaise: number): number {
  if (subtotalPaise <= 0) return 0;

  switch (coupon.type) {
    case COUPON_TYPE.FLAT: {
      const value = coupon.valuePaise ?? 0;
      return Math.min(value, subtotalPaise);
    }
    case COUPON_TYPE.PERCENT: {
      const percent = coupon.percent ?? 0;
      let discount = Math.floor((subtotalPaise * percent) / 100);
      if (coupon.maxDiscountPaise != null) discount = Math.min(discount, coupon.maxDiscountPaise);
      return Math.min(discount, subtotalPaise);
    }
    case COUPON_TYPE.FREE_SHIPPING:
    default:
      return 0;
  }
}

/** Throw ApiError if the coupon cannot be applied to a cart of this subtotal. */
export function assertCouponUsable(coupon: Coupon, subtotalPaise: number): void {
  const now = new Date();
  if (!coupon.isActive) throw ApiError.badRequest('This coupon is not active');
  if (coupon.startsAt && coupon.startsAt > now) throw ApiError.badRequest('This coupon is not yet valid');
  if (coupon.expiresAt && coupon.expiresAt < now) throw ApiError.badRequest('This coupon has expired');
  if (subtotalPaise < coupon.minCartPaise) {
    const min = (coupon.minCartPaise / MONEY.UNIT_PER_RUPEE).toFixed(0);
    throw ApiError.badRequest(`Add items worth ₹${min} to use this coupon`);
  }
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
    throw ApiError.badRequest('This coupon has reached its usage limit');
  }
}

/** Fetch a coupon by code and assert it is usable; throws otherwise. */
export async function getValidatedCoupon(code: string, subtotalPaise: number): Promise<Coupon> {
  const coupon = await couponRepository.findByCode(code);
  if (!coupon) throw ApiError.notFound('Coupon not found');
  assertCouponUsable(coupon, subtotalPaise);
  return coupon;
}

/** Return a coupon only if it is currently usable, else null (never throws). */
export async function findUsableCoupon(
  code: string,
  subtotalPaise: number,
): Promise<Coupon | null> {
  const coupon = await couponRepository.findByCode(code);
  if (!coupon) return null;
  try {
    assertCouponUsable(coupon, subtotalPaise);
    return coupon;
  } catch {
    return null;
  }
}

/** Public /validate: return the DTO plus the discount it would grant. */
export async function validateCoupon(
  code: string,
  subtotalPaise: number,
): Promise<{ coupon: CouponDTO; discountPaise: number }> {
  const coupon = await getValidatedCoupon(code, subtotalPaise);
  return { coupon: toCouponDTO(coupon), discountPaise: computeDiscount(coupon, subtotalPaise) };
}

// ── Admin management ───────────────────────────────────────────────

export async function listCoupons(): Promise<Coupon[]> {
  return couponRepository.list();
}

export async function createCoupon(input: CreateCouponInput): Promise<Coupon> {
  const existing = await couponRepository.findByCode(input.code);
  if (existing) throw ApiError.conflict('A coupon with this code already exists');
  return couponRepository.create(input);
}

export async function updateCoupon(id: string, input: UpdateCouponInput): Promise<Coupon> {
  const coupon = await couponRepository.findById(id);
  if (!coupon) throw ApiError.notFound('Coupon not found');
  if (input.code && input.code !== coupon.code) {
    const clash = await couponRepository.findByCode(input.code);
    if (clash) throw ApiError.conflict('A coupon with this code already exists');
  }
  return couponRepository.update(id, input);
}

export async function deleteCoupon(id: string): Promise<void> {
  const coupon = await couponRepository.findById(id);
  if (!coupon) throw ApiError.notFound('Coupon not found');
  await couponRepository.remove(id);
}
