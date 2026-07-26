/**
 * Payment routes. Exposes:
 *   POST /init                 (auth)            — open a gateway checkout
 *   POST /verify               (auth)            — verify the client-side return
 *   POST /webhook/razorpay     (no auth)         — server-to-server confirmation
 *   POST /webhook/phonepe      (no auth)
 *   POST /webhook/cashfree     (no auth)
 *   POST /:paymentId/refund    (SUPER_ADMIN|ADMIN)
 *
 * RAW BODY NOTE: webhook signature checks must run over the exact bytes the
 * gateway signed. The global `express.json({ verify })` in app.ts stashes those
 * bytes on `req.rawBody`, which the webhook controller reads. No per-route
 * raw-body middleware is required here; if the global capture is ever removed,
 * mount an `express.raw` body parser (matching all content types) on the webhook
 * paths BEFORE the global express.json parser runs.
 * Webhooks are intentionally auth-free (they authenticate via signature) and are
 * declared before the `/:paymentId/...` param route so the literal segment wins.
 */
import { ROLES } from '@elite/shared';
import { Router } from 'express';

import { requireAuth, requireRole } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { asyncHandler } from '../../utils/http.js';
import * as controller from './payment.controller.js';
import { initSchema, paymentIdParamSchema, refundSchema, verifySchema } from './payment.schema.js';

export const paymentRouter = Router();

// ── Customer checkout ──
paymentRouter.post(
  '/init',
  requireAuth,
  validate(initSchema, 'body'),
  asyncHandler(controller.init),
);

paymentRouter.post(
  '/verify',
  requireAuth,
  validate(verifySchema, 'body'),
  asyncHandler(controller.verify),
);

// ── Gateway webhooks (no auth; verified by signature over the raw body) ──
paymentRouter.post('/webhook/razorpay', asyncHandler(controller.webhook('razorpay')));
paymentRouter.post('/webhook/phonepe', asyncHandler(controller.webhook('phonepe')));
paymentRouter.post('/webhook/cashfree', asyncHandler(controller.webhook('cashfree')));

// ── Admin refunds ──
paymentRouter.post(
  '/:paymentId/refund',
  requireAuth,
  requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  validate(paymentIdParamSchema, 'params'),
  validate(refundSchema, 'body'),
  asyncHandler(controller.refund),
);
