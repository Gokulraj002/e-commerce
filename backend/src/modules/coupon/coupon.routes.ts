import { Router } from 'express';
import { ROLES } from '@elite/shared';

import { requireAuth, requireRole } from '../../middlewares/auth.js';
import { validate as validateRequest } from '../../middlewares/validate.js';
import { asyncHandler } from '../../utils/http.js';
import * as couponController from './coupon.controller.js';
import {
  couponIdParamSchema,
  createCouponSchema,
  updateCouponSchema,
  validateCouponSchema,
} from './coupon.schema.js';

export const couponRouter = Router();

// ── Public ─────────────────────────────────────────────────────────
couponRouter.post(
  '/validate',
  validateRequest(validateCouponSchema, 'body'),
  asyncHandler(couponController.validate),
);

// ── Admin (staff only) ─────────────────────────────────────────────
const adminOnly = [
  requireAuth,
  requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STORE_MANAGER),
];

couponRouter.get('/', ...adminOnly, asyncHandler(couponController.list));

couponRouter.post(
  '/',
  ...adminOnly,
  validateRequest(createCouponSchema, 'body'),
  asyncHandler(couponController.create),
);

couponRouter.patch(
  '/:id',
  ...adminOnly,
  validateRequest(couponIdParamSchema, 'params'),
  validateRequest(updateCouponSchema, 'body'),
  asyncHandler(couponController.update),
);

couponRouter.delete(
  '/:id',
  ...adminOnly,
  validateRequest(couponIdParamSchema, 'params'),
  asyncHandler(couponController.remove),
);
