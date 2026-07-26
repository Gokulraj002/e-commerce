import type { CartDTO } from '@elite/shared';

import { ApiError } from '../../utils/ApiError.js';
import { addItem as addItemToCart } from '../cart/cart.service.js';
import {
  wishlistRepository,
  type ProductForWishlist,
  type WishlistWithItems,
} from './wishlist.repository.js';
import type { WishlistDTO, WishlistItemDTO } from './wishlist.types.js';

/** Lowest active-variant price for a product, or null when none is purchasable. */
function lowestPricePaise(product: ProductForWishlist | undefined): number | null {
  if (!product || product.variants.length === 0) return null;
  return product.variants.reduce(
    (min, v) => (v.pricePaise < min ? v.pricePaise : min),
    product.variants[0].pricePaise,
  );
}

async function getOrCreateWishlist(userId: string): Promise<WishlistWithItems> {
  const existing = await wishlistRepository.findByUserId(userId);
  if (existing) return existing;
  await wishlistRepository.createForUser(userId);
  const created = await wishlistRepository.findByUserId(userId);
  if (!created) throw ApiError.notFound('Wishlist could not be created');
  return created;
}

async function toWishlistDTO(wishlist: WishlistWithItems): Promise<WishlistDTO> {
  const productIds = wishlist.items.map((i) => i.productId);
  const products = await wishlistRepository.findProductsByIds(productIds);
  const byId = new Map(products.map((p) => [p.id, p]));

  const items: WishlistItemDTO[] = wishlist.items
    .map((item): WishlistItemDTO | null => {
      const product = byId.get(item.productId);
      if (!product) return null; // product deleted since it was wishlisted
      return {
        id: item.id,
        productId: item.productId,
        name: product.name,
        slug: product.slug,
        image: product.images[0]?.url ?? null,
        pricePaise: lowestPricePaise(product),
        addedAt: item.addedAt.toISOString(),
      };
    })
    .filter((i): i is WishlistItemDTO => i !== null);

  return { id: wishlist.id, items };
}

// ── Public service API ─────────────────────────────────────────────

export async function getWishlist(userId: string): Promise<WishlistDTO> {
  const wishlist = await getOrCreateWishlist(userId);
  return toWishlistDTO(wishlist);
}

export async function addProduct(userId: string, productId: string): Promise<WishlistDTO> {
  const product = await wishlistRepository.findProductById(productId);
  if (!product || !product.isActive) throw ApiError.notFound('Product not found');

  const wishlist = await getOrCreateWishlist(userId);
  await wishlistRepository.addItem(wishlist.id, productId);

  return getWishlist(userId);
}

export async function removeProduct(userId: string, productId: string): Promise<WishlistDTO> {
  const wishlist = await getOrCreateWishlist(userId);
  await wishlistRepository.removeItem(wishlist.id, productId);
  return getWishlist(userId);
}

/** Move a wishlisted product into the cart (its cheapest active variant) and drop it. */
export async function moveToCart(userId: string, productId: string): Promise<CartDTO> {
  const wishlist = await getOrCreateWishlist(userId);
  const product = await wishlistRepository.findProductWithVariants(productId);
  if (!product || !product.isActive) throw ApiError.notFound('Product not found');

  const variant = product.variants[0]; // active variants, cheapest weight first
  if (!variant) throw ApiError.badRequest('This product has no purchasable variant');

  // addItem enforces stock/active checks and throws on failure.
  const cart = await addItemToCart(userId, variant.id, 1);
  await wishlistRepository.removeItem(wishlist.id, productId);

  return cart;
}
