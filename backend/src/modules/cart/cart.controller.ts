import type { Request, Response } from 'express';

import { ok } from '../../utils/http.js';
import * as cartService from './cart.service.js';
import type { AddItemInput, ApplyCouponInput, UpdateItemInput } from './cart.schema.js';

/** All handlers assume requireAuth ran, so req.user is present. */

export async function getCart(req: Request, res: Response) {
  const cart = await cartService.getCart(req.user!.id);
  return ok(res, cart);
}

export async function addItem(req: Request, res: Response) {
  const { variantId, quantity } = req.body as AddItemInput;
  const cart = await cartService.addItem(req.user!.id, variantId, quantity);
  return ok(res, cart, 'Item added to cart');
}

export async function updateItem(req: Request, res: Response) {
  const { quantity } = req.body as UpdateItemInput;
  const cart = await cartService.updateItem(req.user!.id, req.params.itemId, quantity);
  return ok(res, cart, 'Cart updated');
}

export async function removeItem(req: Request, res: Response) {
  const cart = await cartService.removeItem(req.user!.id, req.params.itemId);
  return ok(res, cart, 'Item removed');
}

export async function clearCart(req: Request, res: Response) {
  const cart = await cartService.clearCart(req.user!.id);
  return ok(res, cart, 'Cart cleared');
}

export async function applyCoupon(req: Request, res: Response) {
  const { code } = req.body as ApplyCouponInput;
  const cart = await cartService.applyCoupon(req.user!.id, code);
  return ok(res, cart, 'Coupon applied');
}

export async function removeCoupon(req: Request, res: Response) {
  const cart = await cartService.removeCoupon(req.user!.id);
  return ok(res, cart, 'Coupon removed');
}
