import { Router } from 'express';

import { requireAuth } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { asyncHandler } from '../../utils/http.js';
import * as controller from './checkout.controller.js';
import { placeOrderSchema, summaryQuerySchema } from './checkout.schema.js';

export const checkoutRouter = Router();

checkoutRouter.get(
  '/summary',
  requireAuth,
  validate(summaryQuerySchema, 'query'),
  asyncHandler(controller.getSummary),
);

checkoutRouter.post(
  '/place',
  requireAuth,
  validate(placeOrderSchema, 'body'),
  asyncHandler(controller.placeOrder),
);
