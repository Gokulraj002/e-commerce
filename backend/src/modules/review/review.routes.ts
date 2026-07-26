import { Router } from 'express';
import { ROLES } from '@elite/shared';

import { optionalAuth, requireAuth, requireRole } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { asyncHandler } from '../../utils/http.js';
import * as ctrl from './review.controller.js';
import {
  createReviewSchema,
  listQuerySchema,
  productIdParamSchema,
  reviewIdParamSchema,
} from './review.schema.js';

/**
 * Review router — public reads, authenticated writes, staff moderation.
 * Wired into the API router later by the integrator (exported as reviewRouter).
 */
export const reviewRouter = Router();

/** Staff allowed to moderate reviews. */
const requireStaff = requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STORE_MANAGER);

// ── Admin moderation (specific paths before the :productId reads) ──
reviewRouter.get(
  '/pending',
  requireAuth,
  requireStaff,
  validate(listQuerySchema, 'query'),
  asyncHandler(ctrl.listPending),
);
reviewRouter.patch(
  '/:id/approve',
  requireAuth,
  requireStaff,
  validate(reviewIdParamSchema, 'params'),
  asyncHandler(ctrl.approveReview),
);
reviewRouter.delete(
  '/:id',
  requireAuth,
  requireStaff,
  validate(reviewIdParamSchema, 'params'),
  asyncHandler(ctrl.deleteReview),
);

// ── Public / customer ──────────────────────────────────────────────
reviewRouter.get(
  '/products/:productId',
  optionalAuth,
  validate(productIdParamSchema, 'params'),
  validate(listQuerySchema, 'query'),
  asyncHandler(ctrl.listApproved),
);
reviewRouter.post(
  '/products/:productId',
  requireAuth,
  validate(productIdParamSchema, 'params'),
  validate(createReviewSchema),
  asyncHandler(ctrl.createReview),
);
