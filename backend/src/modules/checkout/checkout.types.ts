import { Prisma } from '@prisma/client';
import type { PaymentMethod } from '@elite/shared';

/**
 * Cart loaded with everything checkout needs to price and reserve stock:
 * each item carries its variant (price + pack weight) and that variant's
 * inventory row (available + reserved grams, warehouse).
 */
export const cartInclude = {
  items: {
    include: {
      variant: {
        include: {
          product: { select: { id: true, name: true } },
          inventory: true,
        },
      },
    },
  },
} satisfies Prisma.CartInclude;

export type CartWithItems = Prisma.CartGetPayload<{ include: typeof cartInclude }>;
export type CartItemLoaded = CartWithItems['items'][number];

/** Authoritative, server-computed money breakdown (all paise). */
export interface PricingBreakdown {
  subtotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  totalPaise: number;
  couponCode: string | null;
}

/** Result of validating an address + slot + serviceability for a checkout. */
export interface CheckoutContext {
  pricing: PricingBreakdown;
  slotLabel: string | null;
}

export interface PlaceOrderParams {
  addressId: string;
  slotId?: string;
  paymentMethod: PaymentMethod;
  note?: string;
}

/**
 * ── Integration seam ────────────────────────────────────────────────
 * Pricing, coupon validation and pincode serviceability are implemented
 * locally here so checkout compiles standalone. When the cart / coupon /
 * delivery modules expose their own services, the integrator should swap the
 * local implementations in `checkout.service.ts` for these contracts.
 *
 * TODO(integrator): import { priceCart } from '../cart/cart.service.js'
 * TODO(integrator): import { validateCoupon } from '../coupon/coupon.service.js'
 * TODO(integrator): import { isServiceable, quoteShipping } from '../delivery/delivery.service.js'
 */
export interface DeliveryServiceContract {
  isServiceable(pincode: string): Promise<boolean>;
  quoteShippingPaise(pincode: string, subtotalPaise: number): Promise<number>;
}
