import type { Coupon } from '@prisma/client';
import { COUPON_TYPE, MONEY, STORE } from '@elite/shared';

import { computeDiscount } from '../coupon/coupon.service.js';

/**
 * SINGLE SOURCE OF PRICING TRUTH.
 * Computes subtotal, discount, shipping and total for a set of priced line
 * items and an optional (already-validated) coupon. Reused by the cart module
 * now and by checkout later — keep all pricing rules here.
 */

/** Flat shipping fee (paise) charged below the free-shipping threshold. */
export const FLAT_SHIPPING_PAISE = 4000;

/** ₹699 → 69900 paise. */
export const FREE_SHIPPING_THRESHOLD_PAISE = STORE.FREE_SHIPPING_THRESHOLD * MONEY.UNIT_PER_RUPEE;

export interface PricingLine {
  lineTotalPaise: number;
}

export interface CartPricing {
  subtotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  totalPaise: number;
}

export function computeCartPricing(lines: PricingLine[], coupon: Coupon | null): CartPricing {
  const subtotalPaise = lines.reduce((sum, line) => sum + line.lineTotalPaise, 0);

  const discountPaise = coupon ? computeDiscount(coupon, subtotalPaise) : 0;

  const freeShippingCoupon = coupon?.type === COUPON_TYPE.FREE_SHIPPING;
  const qualifiesForFreeShipping = subtotalPaise >= FREE_SHIPPING_THRESHOLD_PAISE;

  let shippingPaise = FLAT_SHIPPING_PAISE;
  if (subtotalPaise === 0 || freeShippingCoupon || qualifiesForFreeShipping) {
    shippingPaise = 0;
  }

  const totalPaise = subtotalPaise - discountPaise + shippingPaise;

  return { subtotalPaise, discountPaise, shippingPaise, totalPaise };
}
