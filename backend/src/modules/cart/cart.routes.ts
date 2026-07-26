import { Router } from 'express';

import { requireAuth } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { asyncHandler } from '../../utils/http.js';
import * as cartController from './cart.controller.js';
import {
  addItemSchema,
  applyCouponSchema,
  itemIdParamSchema,
  updateItemSchema,
} from './cart.schema.js';

export const cartRouter = Router();

// Every cart route belongs to the authenticated user.
cartRouter.use(requireAuth);

cartRouter.get('/', asyncHandler(cartController.getCart));

cartRouter.post(
  '/items',
  validate(addItemSchema, 'body'),
  asyncHandler(cartController.addItem),
);

cartRouter.patch(
  '/items/:itemId',
  validate(itemIdParamSchema, 'params'),
  validate(updateItemSchema, 'body'),
  asyncHandler(cartController.updateItem),
);

cartRouter.delete(
  '/items/:itemId',
  validate(itemIdParamSchema, 'params'),
  asyncHandler(cartController.removeItem),
);

cartRouter.delete('/', asyncHandler(cartController.clearCart));

cartRouter.post(
  '/apply-coupon',
  validate(applyCouponSchema, 'body'),
  asyncHandler(cartController.applyCoupon),
);

cartRouter.delete('/coupon', asyncHandler(cartController.removeCoupon));
