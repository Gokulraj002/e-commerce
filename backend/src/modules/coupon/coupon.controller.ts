import type { Request, Response } from 'express';

import { created, ok } from '../../utils/http.js';
import * as couponService from './coupon.service.js';
import type {
  CreateCouponInput,
  UpdateCouponInput,
  ValidateCouponInput,
} from './coupon.schema.js';

/** Thin controllers: parse req → call service → envelope. No logic, no Prisma. */

export async function validate(req: Request, res: Response) {
  const { code, cartSubtotalPaise } = req.body as ValidateCouponInput;
  const result = await couponService.validateCoupon(code, cartSubtotalPaise);
  return ok(res, result);
}

export async function list(_req: Request, res: Response) {
  const coupons = await couponService.listCoupons();
  return ok(res, coupons);
}

export async function create(req: Request, res: Response) {
  const coupon = await couponService.createCoupon(req.body as CreateCouponInput);
  return created(res, coupon, 'Coupon created');
}

export async function update(req: Request, res: Response) {
  const coupon = await couponService.updateCoupon(req.params.id, req.body as UpdateCouponInput);
  return ok(res, coupon, 'Coupon updated');
}

export async function remove(req: Request, res: Response) {
  await couponService.deleteCoupon(req.params.id);
  return ok(res, { id: req.params.id }, 'Coupon deleted');
}
