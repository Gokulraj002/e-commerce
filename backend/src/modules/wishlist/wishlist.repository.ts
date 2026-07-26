import type { Prisma } from '@prisma/client';

import { prisma } from '../../lib/prisma.js';

/** WishlistItem has no direct Product relation, so products are fetched separately. */
export const wishlistInclude = {
  items: { orderBy: { addedAt: 'desc' } },
} satisfies Prisma.WishlistInclude;

export type WishlistWithItems = Prisma.WishlistGetPayload<{ include: typeof wishlistInclude }>;

/** Product shape used to enrich wishlist items and to move an item to the cart. */
export const productForWishlistInclude = {
  images: { orderBy: { sortOrder: 'asc' }, take: 1 },
  variants: { where: { isActive: true }, orderBy: { weightG: 'asc' } },
} satisfies Prisma.ProductInclude;

export type ProductForWishlist = Prisma.ProductGetPayload<{
  include: typeof productForWishlistInclude;
}>;

export const wishlistRepository = {
  findByUserId(userId: string): Promise<WishlistWithItems | null> {
    return prisma.wishlist.findUnique({ where: { userId }, include: wishlistInclude });
  },

  createForUser(userId: string) {
    return prisma.wishlist.create({ data: { userId } });
  },

  findProductById(productId: string) {
    return prisma.product.findUnique({ where: { id: productId } });
  },

  findProductsByIds(ids: string[]): Promise<ProductForWishlist[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return prisma.product.findMany({
      where: { id: { in: ids } },
      include: productForWishlistInclude,
    });
  },

  findProductWithVariants(productId: string): Promise<ProductForWishlist | null> {
    return prisma.product.findUnique({
      where: { id: productId },
      include: productForWishlistInclude,
    });
  },

  addItem(wishlistId: string, productId: string) {
    return prisma.wishlistItem.upsert({
      where: { wishlistId_productId: { wishlistId, productId } },
      create: { wishlistId, productId },
      update: {},
    });
  },

  removeItem(wishlistId: string, productId: string) {
    return prisma.wishlistItem.deleteMany({ where: { wishlistId, productId } });
  },
};
