import type { Prisma } from '@prisma/client';

import { prisma } from '../../lib/prisma.js';

/** Full include used whenever we need to price / render a cart. */
export const cartInclude = {
  items: {
    orderBy: { id: 'asc' },
    include: {
      variant: {
        include: {
          inventory: true,
          product: {
            include: { images: { orderBy: { sortOrder: 'asc' }, take: 1 } },
          },
        },
      },
    },
  },
} satisfies Prisma.CartInclude;

export type CartWithItems = Prisma.CartGetPayload<{ include: typeof cartInclude }>;
export type CartItemWithVariant = CartWithItems['items'][number];
export type VariantForCart = Prisma.ProductVariantGetPayload<{ include: { inventory: true } }>;

/** Prisma access only. Returns plain data; no business logic. */
export const cartRepository = {
  findByUserId(userId: string): Promise<CartWithItems | null> {
    return prisma.cart.findUnique({ where: { userId }, include: cartInclude });
  },

  createForUser(userId: string) {
    return prisma.cart.create({ data: { userId } });
  },

  findVariantById(variantId: string): Promise<VariantForCart | null> {
    return prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { inventory: true },
    });
  },

  findItem(cartId: string, variantId: string) {
    return prisma.cartItem.findUnique({
      where: { cartId_variantId: { cartId, variantId } },
    });
  },

  findItemById(itemId: string) {
    return prisma.cartItem.findUnique({
      where: { id: itemId },
      include: {
        cart: true,
        variant: { include: { inventory: true } },
      },
    });
  },

  upsertItem(cartId: string, variantId: string, quantity: number) {
    return prisma.cartItem.upsert({
      where: { cartId_variantId: { cartId, variantId } },
      create: { cartId, variantId, quantity },
      update: { quantity },
    });
  },

  updateItemQuantity(itemId: string, quantity: number) {
    return prisma.cartItem.update({ where: { id: itemId }, data: { quantity } });
  },

  deleteItem(itemId: string) {
    return prisma.cartItem.delete({ where: { id: itemId } });
  },

  clearItems(cartId: string) {
    return prisma.cartItem.deleteMany({ where: { cartId } });
  },

  setCoupon(cartId: string, couponCode: string | null) {
    return prisma.cart.update({ where: { id: cartId }, data: { couponCode } });
  },
};
