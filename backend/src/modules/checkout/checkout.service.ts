import {
  MONEY,
  ORDER_STATUS,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  type OrderDTO,
  type PaymentMethod,
} from '@elite/shared';
import { Prisma, type Coupon } from '@prisma/client';
import { customAlphabet } from 'nanoid';

import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { QUEUES, getQueue } from '../../lib/queue.js';
import { ApiError } from '../../utils/ApiError.js';
import { toOrderDTO } from '../order/order.service.js';
import * as repo from './checkout.repository.js';
import type { PlaceOrderInput, SummaryQueryInput } from './checkout.schema.js';
import type {
  CartItemLoaded,
  CartWithItems,
  PricingBreakdown,
} from './checkout.types.js';

/**
 * Fallback flat shipping fee (paise) when no delivery zone quotes a price.
 * TODO(integrator): replace with delivery.service.quoteShipping() once available.
 */
const DEFAULT_SHIPPING_PAISE = 4900;

/** Human-friendly order code suffix — unambiguous alphabet (no O/0/I/1). */
const nano = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);

function makeOrderCode(now = new Date()): string {
  const ymd = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(
    now.getUTCDate(),
  ).padStart(2, '0')}`;
  return `EN-${ymd}-${nano()}`;
}

// ── Pricing (authoritative, server-side) ───────────────────────────

function freeShippingThresholdPaise(): number {
  return env.FREE_SHIPPING_THRESHOLD * MONEY.UNIT_PER_RUPEE;
}

interface AppliedCoupon {
  code: string;
  discountPaise: number;
  freeShipping: boolean;
}

/** Validate a coupon against the subtotal; returns null if it is not applicable. */
function applyCouponIfValid(coupon: Coupon | null, subtotalPaise: number): AppliedCoupon | null {
  if (!coupon || !coupon.isActive) return null;

  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) return null;
  if (coupon.expiresAt && coupon.expiresAt < now) return null;
  if (subtotalPaise < coupon.minCartPaise) return null;
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) return null;

  if (coupon.type === 'FREE_SHIPPING') {
    return { code: coupon.code, discountPaise: 0, freeShipping: true };
  }

  let discount = 0;
  if (coupon.type === 'PERCENT' && coupon.percent) {
    discount = Math.floor((subtotalPaise * coupon.percent) / 100);
    if (coupon.maxDiscountPaise) discount = Math.min(discount, coupon.maxDiscountPaise);
  } else if (coupon.type === 'FLAT' && coupon.valuePaise) {
    discount = coupon.valuePaise;
  }
  discount = Math.min(discount, subtotalPaise); // never discount below zero
  return { code: coupon.code, discountPaise: discount, freeShipping: false };
}

function lineTotal(item: CartItemLoaded): number {
  return item.variant.pricePaise * item.quantity;
}

/** Recompute the full money breakdown from server data — never trust the client. */
async function buildPricing(
  cart: CartWithItems,
  pincode: string,
  db?: Prisma.TransactionClient,
): Promise<PricingBreakdown> {
  const client = db ?? prisma;
  const subtotalPaise = cart.items.reduce((sum, item) => sum + lineTotal(item), 0);

  const coupon = cart.couponCode
    ? await repo.findActiveCoupon(cart.couponCode, client)
    : null;
  const applied = applyCouponIfValid(coupon, subtotalPaise);

  const zone = await repo.findServiceableZone(pincode, client);
  const shippingBase = zone?.feePaise ?? DEFAULT_SHIPPING_PAISE;

  const freeShipping = applied?.freeShipping || subtotalPaise >= freeShippingThresholdPaise();
  const shippingPaise = freeShipping ? 0 : shippingBase;
  const discountPaise = applied?.discountPaise ?? 0;

  return {
    subtotalPaise,
    discountPaise,
    shippingPaise,
    totalPaise: subtotalPaise - discountPaise + shippingPaise,
    couponCode: applied?.code ?? null,
  };
}

// ── Validation helpers ─────────────────────────────────────────────

function assertCartNotEmpty(cart: CartWithItems | null): asserts cart is CartWithItems {
  if (!cart || cart.items.length === 0) throw ApiError.badRequest('Your cart is empty');
}

function assertSlotBookable(slot: Awaited<ReturnType<typeof repo.findSlot>>): void {
  if (!slot) throw ApiError.notFound('Delivery slot not found');
  if (!slot.isActive) throw ApiError.badRequest('Delivery slot is not available');
  if (slot.booked >= slot.capacity) throw ApiError.conflict('Delivery slot is fully booked');
  if (slot.cutoffAt < new Date()) throw ApiError.badRequest('Delivery slot cutoff has passed');
}

/** Re-validate that every line still has enough free (unreserved) stock. */
function assertStockAvailable(cart: CartWithItems): void {
  for (const item of cart.items) {
    const inv = item.variant.inventory;
    const needG = item.variant.weightG * item.quantity;
    const availableG = inv ? inv.stockG - inv.reservedG : 0;
    if (availableG < needG) {
      throw ApiError.conflict(`${item.variant.product.name} is out of stock`);
    }
  }
}

// ── Public API ─────────────────────────────────────────────────────

/** GET /summary — recompute pricing authoritatively; validate address + slot. */
export async function getSummary(userId: string, query: SummaryQueryInput) {
  const cart = await repo.getCart(userId);
  assertCartNotEmpty(cart);

  const address = await repo.findAddress(query.addressId, userId);
  if (!address) throw ApiError.notFound('Address not found');

  // Serviceability: delegate to delivery module when present; otherwise accept.
  // TODO(integrator): call delivery.service.isServiceable(address.pincode).

  let slotLabel: string | null = null;
  if (query.slotId) {
    const slot = await repo.findSlot(query.slotId);
    assertSlotBookable(slot);
    slotLabel = slot!.label;
  }

  const pricing = await buildPricing(cart, address.pincode);
  return { pricing, slotLabel, address };
}

export interface PlaceOrderResult {
  order: OrderDTO;
  paymentMethod: PaymentMethod;
  requiresPaymentInit: boolean;
}

/** POST /place — the critical flow, fully transactional. */
export async function placeOrder(userId: string, input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const order = await prisma.$transaction(async (tx) => {
    // a) load cart + items
    const cart = await repo.getCart(userId, tx);
    assertCartNotEmpty(cart);

    // address + slot validation
    const address = await repo.findAddress(input.addressId, userId, tx);
    if (!address) throw ApiError.notFound('Address not found');

    let slotLabel: string | null = null;
    if (input.slotId) {
      const slot = await repo.findSlot(input.slotId, tx);
      assertSlotBookable(slot);
      slotLabel = slot!.label;
    }

    // b) re-validate stock per variant
    assertStockAvailable(cart);

    // c) recompute totals from server data
    const pricing = await buildPricing(cart, address.pincode, tx);

    // d) create Order + snapshot OrderItems
    const isCod = input.paymentMethod === PAYMENT_METHOD.COD;
    const status = isCod ? ORDER_STATUS.CREATED : ORDER_STATUS.PENDING_PAYMENT;

    const created = await repo.createOrder(
      {
        code: makeOrderCode(),
        status,
        paymentMethod: input.paymentMethod,
        paymentStatus: PAYMENT_STATUS.PENDING,
        subtotalPaise: pricing.subtotalPaise,
        discountPaise: pricing.discountPaise,
        shippingPaise: pricing.shippingPaise,
        totalPaise: pricing.totalPaise,
        couponCode: pricing.couponCode,
        slotLabel,
        note: input.note,
        user: { connect: { id: userId } },
        address: { connect: { id: address.id } },
        ...(input.slotId ? { slot: { connect: { id: input.slotId } } } : {}),
        items: {
          create: cart.items.map((item) => ({
            productName: item.variant.product.name,
            weightG: item.variant.weightG,
            pricePaise: item.variant.pricePaise,
            quantity: item.quantity,
            lineTotalPaise: lineTotal(item),
            variant: { connect: { id: item.variantId } },
          })),
        },
      },
      tx,
    );

    // e) reserve stock (decrement stockG happens on delivery confirm)
    await repo.reserveStock(
      cart.items.map((item) => ({
        variantId: item.variantId,
        weightG: item.variant.weightG,
        quantity: item.quantity,
      })),
      tx,
    );

    // f) create Payment row (PENDING)
    await repo.createPayment(
      {
        orderId: created.id,
        method: input.paymentMethod,
        status: PAYMENT_STATUS.PENDING,
        amountPaise: pricing.totalPaise,
      },
      tx,
    );

    // g) initial status history + clear cart
    await repo.addHistory(created.id, status, isCod ? 'Order placed (COD)' : 'Awaiting payment', userId, tx);
    if (input.slotId) await repo.incrementSlotBooked(input.slotId, tx);
    await repo.clearCart(cart.id, tx);

    return created;
  });

  // h) enqueue notification (outside the transaction)
  await getQueue(QUEUES.NOTIFICATIONS).add('order.placed', {
    orderId: order.id,
    orderCode: order.code,
    userId,
  });

  return {
    order: toOrderDTO(order),
    paymentMethod: input.paymentMethod,
    requiresPaymentInit: input.paymentMethod !== PAYMENT_METHOD.COD,
  };
}
