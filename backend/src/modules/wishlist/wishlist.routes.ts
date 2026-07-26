import { Router } from 'express';

import { requireAuth } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { asyncHandler } from '../../utils/http.js';
import * as wishlistController from './wishlist.controller.js';
import { addWishlistItemSchema, productIdParamSchema } from './wishlist.schema.js';

export const wishlistRouter = Router();

// Every wishlist route belongs to the authenticated user.
wishlistRouter.use(requireAuth);

wishlistRouter.get('/', asyncHandler(wishlistController.getWishlist));

wishlistRouter.post(
  '/items',
  validate(addWishlistItemSchema, 'body'),
  asyncHandler(wishlistController.addItem),
);

wishlistRouter.delete(
  '/items/:productId',
  validate(productIdParamSchema, 'params'),
  asyncHandler(wishlistController.removeItem),
);

wishlistRouter.post(
  '/items/:productId/move-to-cart',
  validate(productIdParamSchema, 'params'),
  asyncHandler(wishlistController.moveToCart),
);
