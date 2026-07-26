import { ROLES } from '@elite/shared';
import { Router } from 'express';

import { requireAuth, requireRole } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { asyncHandler } from '../../utils/http.js';
import * as controller from './order.controller.js';
import {
  adminListOrdersSchema,
  cancelOrderSchema,
  listMyOrdersSchema,
  orderCodeParamSchema,
  orderIdParamSchema,
  updateStatusSchema,
} from './order.schema.js';

export const orderRouter = Router();

// ── Admin / staff routes (declared before "/:code" so they don't collide) ──
const staff = requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STORE_MANAGER);

orderRouter.get(
  '/admin/all',
  requireAuth,
  staff,
  validate(adminListOrdersSchema, 'query'),
  asyncHandler(controller.adminListOrders),
);

orderRouter.patch(
  '/:id/status',
  requireAuth,
  staff,
  validate(orderIdParamSchema, 'params'),
  validate(updateStatusSchema, 'body'),
  asyncHandler(controller.updateOrderStatus),
);

// ── Customer routes ──
orderRouter.get(
  '/',
  requireAuth,
  validate(listMyOrdersSchema, 'query'),
  asyncHandler(controller.listMyOrders),
);

orderRouter.get(
  '/:code',
  requireAuth,
  validate(orderCodeParamSchema, 'params'),
  asyncHandler(controller.getMyOrder),
);

orderRouter.post(
  '/:code/cancel',
  requireAuth,
  validate(orderCodeParamSchema, 'params'),
  validate(cancelOrderSchema, 'body'),
  asyncHandler(controller.cancelMyOrder),
);
