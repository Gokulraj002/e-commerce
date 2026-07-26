import type { CartDTO, CartItemDTO } from '@elite/shared';

import { ApiError } from '../../utils/ApiError.js';
import { findUsableCoupon, getValidatedCoupon } from '../coupon/coupon.service.js';
import { computeCartPricing } from './cart.pricing.js';
import {
  cartRepository,
  type CartItemWithVariant,
  type CartWithItems,
  type VariantForCart,
} from './cart.repository.js';

/** Map a cart item (with variant + product) to the client DTO. */
function toCartItemDTO(item: CartItemWithVariant): CartItemDTO {
  const { variant } = item;
  return {
    id: item.id,
    productId: variant.productId,
    variantId: variant.id,
    name: variant.product.name,
    image: variant.product.images[0]?.url ?? null,
    weightG: variant.weightG,
    pricePaise: variant.pricePaise,
    quantity: item.quantity,
    lineTotalPaise: variant.pricePaise * item.quantity,
  };
}

/** Available stock in grams for a variant (stock minus what's reserved). */
function availableStockG(variant: VariantForCart | CartItemWithVariant['variant']): number {
  return variant.inventory ? variant.inventory.stockG - variant.inventory.reservedG : 0;
}

/** Guard: variant must be active and have enough stock for the requested quantity. */
function assertVariantPurchasable(
  variant: VariantForCart | CartItemWithVariant['variant'],
  quantity: number,
): void {
  if (!variant.isActive) throw ApiError.badRequest('This item is no longer available');
  const requiredG = variant.weightG * quantity;
  if (availableStockG(variant) < requiredG) {
    throw ApiError.badRequest('Not enough stock for the requested quantity');
  }
}

async function getOrCreateCart(userId: string): Promise<CartWithItems> {
  const existing = await cartRepository.findByUserId(userId);
  if (existing) return existing;
  await cartRepository.createForUser(userId);
  // Re-fetch with the full include so the shape is consistent.
  const created = await cartRepository.findByUserId(userId);
  if (!created) throw ApiError.notFound('Cart could not be created');
  return created;
}

/** Build the priced CartDTO. Applies the stored coupon only if still usable. */
async function toCartDTO(cart: CartWithItems): Promise<CartDTO> {
  const items = cart.items.map(toCartItemDTO);
  const subtotalPaise = items.reduce((sum, i) => sum + i.lineTotalPaise, 0);

  const coupon = cart.couponCode
    ? await findUsableCoupon(cart.couponCode, subtotalPaise)
    : null;

  const pricing = computeCartPricing(items, coupon);

  return {
    id: cart.id,
    items,
    ...pricing,
    couponCode: cart.couponCode,
  };
}

// ── Public service API ─────────────────────────────────────────────

export async function getCart(userId: string): Promise<CartDTO> {
  const cart = await getOrCreateCart(userId);
  return toCartDTO(cart);
}

export async function addItem(
  userId: string,
  variantId: string,
  quantity: number,
): Promise<CartDTO> {
  const cart = await getOrCreateCart(userId);
  const variant = await cartRepository.findVariantById(variantId);
  if (!variant) throw ApiError.notFound('Product variant not found');

  const existing = await cartRepository.findItem(cart.id, variantId);
  const nextQuantity = (existing?.quantity ?? 0) + quantity;

  assertVariantPurchasable(variant, nextQuantity);
  await cartRepository.upsertItem(cart.id, variantId, nextQuantity);

  return getCart(userId);
}

export async function updateItem(
  userId: string,
  itemId: string,
  quantity: number,
): Promise<CartDTO> {
  const item = await cartRepository.findItemById(itemId);
  if (!item || item.cart.userId !== userId) throw ApiError.notFound('Cart item not found');

  assertVariantPurchasable(item.variant, quantity);
  await cartRepository.updateItemQuantity(itemId, quantity);

  return getCart(userId);
}

export async function removeItem(userId: string, itemId: string): Promise<CartDTO> {
  const item = await cartRepository.findItemById(itemId);
  if (!item || item.cart.userId !== userId) throw ApiError.notFound('Cart item not found');

  await cartRepository.deleteItem(itemId);
  return getCart(userId);
}

export async function clearCart(userId: string): Promise<CartDTO> {
  const cart = await getOrCreateCart(userId);
  await cartRepository.clearItems(cart.id);
  return getCart(userId);
}

export async function applyCoupon(userId: string, code: string): Promise<CartDTO> {
  const cart = await getOrCreateCart(userId);
  const subtotalPaise = cart.items.reduce(
    (sum, item) => sum + item.variant.pricePaise * item.quantity,
    0,
  );

  // Throws if the coupon is invalid / expired / min-not-met / limit exceeded.
  const coupon = await getValidatedCoupon(code, subtotalPaise);
  await cartRepository.setCoupon(cart.id, coupon.code);

  return getCart(userId);
}

export async function removeCoupon(userId: string): Promise<CartDTO> {
  const cart = await getOrCreateCart(userId);
  await cartRepository.setCoupon(cart.id, null);
  return getCart(userId);
}
