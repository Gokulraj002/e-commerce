import type { Request, Response } from 'express';

import { created, ok } from '../../utils/http.js';
import * as wishlistService from './wishlist.service.js';
import type { AddWishlistItemInput } from './wishlist.schema.js';

/** All handlers assume requireAuth ran, so req.user is present. */

export async function getWishlist(req: Request, res: Response) {
  const wishlist = await wishlistService.getWishlist(req.user!.id);
  return ok(res, wishlist);
}

export async function addItem(req: Request, res: Response) {
  const { productId } = req.body as AddWishlistItemInput;
  const wishlist = await wishlistService.addProduct(req.user!.id, productId);
  return created(res, wishlist, 'Added to wishlist');
}

export async function removeItem(req: Request, res: Response) {
  const wishlist = await wishlistService.removeProduct(req.user!.id, req.params.productId);
  return ok(res, wishlist, 'Removed from wishlist');
}

export async function moveToCart(req: Request, res: Response) {
  const cart = await wishlistService.moveToCart(req.user!.id, req.params.productId);
  return ok(res, cart, 'Moved to cart');
}
