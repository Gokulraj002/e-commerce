/**
 * Delivery module router. Mounted at /delivery by src/routes/index.ts.
 * Thin wiring only: auth → role → validate → asyncHandler(controller).
 */
import { ROLES } from '@elite/shared';
import { Router } from 'express';

import { optionalAuth, requireAuth, requireRole } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { asyncHandler } from '../../utils/http.js';

import * as ctrl from './delivery.controller.js';
import {
  assignmentsQuerySchema,
  autoAssignSchema,
  createZoneSchema,
  failDeliverySchema,
  generateSlotsSchema,
  idParamsSchema,
  manualAssignSchema,
  orderIdParamsSchema,
  serviceabilityQuerySchema,
  slotsQuerySchema,
  updateSlotSchema,
  updateZoneSchema,
  verifyOtpSchema,
} from './delivery.schema.js';

export const deliveryRouter = Router();

// Roles that manage delivery config + dispatch.
const ZONE_ADMIN = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.DELIVERY_MANAGER] as const;
const DISPATCH = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.DELIVERY_MANAGER] as const;

// ── Public ──────────────────────────────────────────────────────────

deliveryRouter.get(
  '/serviceability',
  validate(serviceabilityQuerySchema, 'query'),
  asyncHandler(ctrl.getServiceability),
);

deliveryRouter.get(
  '/slots',
  optionalAuth,
  validate(slotsQuerySchema, 'query'),
  asyncHandler(ctrl.getSlots),
);

// ── Zones (admin CRUD) ──────────────────────────────────────────────

deliveryRouter.get('/zones', requireAuth, requireRole(...ZONE_ADMIN), asyncHandler(ctrl.listZones));

deliveryRouter.post(
  '/zones',
  requireAuth,
  requireRole(...ZONE_ADMIN),
  validate(createZoneSchema, 'body'),
  asyncHandler(ctrl.createZone),
);

deliveryRouter.patch(
  '/zones/:id',
  requireAuth,
  requireRole(...ZONE_ADMIN),
  validate(idParamsSchema, 'params'),
  validate(updateZoneSchema, 'body'),
  asyncHandler(ctrl.updateZone),
);

deliveryRouter.delete(
  '/zones/:id',
  requireAuth,
  requireRole(...ZONE_ADMIN),
  validate(idParamsSchema, 'params'),
  asyncHandler(ctrl.deleteZone),
);

// ── Slots (admin: generate range / update / delete) ─────────────────

deliveryRouter.post(
  '/slots',
  requireAuth,
  requireRole(...ZONE_ADMIN),
  validate(generateSlotsSchema, 'body'),
  asyncHandler(ctrl.generateSlots),
);

deliveryRouter.patch(
  '/slots/:id',
  requireAuth,
  requireRole(...ZONE_ADMIN),
  validate(idParamsSchema, 'params'),
  validate(updateSlotSchema, 'body'),
  asyncHandler(ctrl.updateSlot),
);

deliveryRouter.delete(
  '/slots/:id',
  requireAuth,
  requireRole(...ZONE_ADMIN),
  validate(idParamsSchema, 'params'),
  asyncHandler(ctrl.deleteSlot),
);

// ── Assignment board (dispatch) ─────────────────────────────────────

deliveryRouter.get(
  '/assignments',
  requireAuth,
  requireRole(...DISPATCH),
  validate(assignmentsQuerySchema, 'query'),
  asyncHandler(ctrl.getAssignments),
);

deliveryRouter.post(
  '/assignments/:orderId/assign',
  requireAuth,
  requireRole(...DISPATCH),
  validate(orderIdParamsSchema, 'params'),
  validate(manualAssignSchema, 'body'),
  asyncHandler(ctrl.assignManually),
);

deliveryRouter.post(
  '/assignments/:orderId/auto',
  requireAuth,
  requireRole(...DISPATCH),
  validate(orderIdParamsSchema, 'params'),
  validate(autoAssignSchema, 'body'),
  asyncHandler(ctrl.autoAssign),
);

// ── Partner app (own assignments) ───────────────────────────────────

deliveryRouter.get(
  '/my/assignments',
  requireAuth,
  requireRole(ROLES.DELIVERY_PARTNER),
  asyncHandler(ctrl.getMyAssignments),
);

deliveryRouter.post(
  '/my/assignments/:id/accept',
  requireAuth,
  requireRole(ROLES.DELIVERY_PARTNER),
  validate(idParamsSchema, 'params'),
  asyncHandler(ctrl.acceptAssignment),
);

deliveryRouter.post(
  '/my/assignments/:id/pickup',
  requireAuth,
  requireRole(ROLES.DELIVERY_PARTNER),
  validate(idParamsSchema, 'params'),
  asyncHandler(ctrl.pickupAssignment),
);

deliveryRouter.post(
  '/my/assignments/:id/out-for-delivery',
  requireAuth,
  requireRole(ROLES.DELIVERY_PARTNER),
  validate(idParamsSchema, 'params'),
  asyncHandler(ctrl.outForDelivery),
);

deliveryRouter.post(
  '/my/assignments/:id/verify-otp',
  requireAuth,
  requireRole(ROLES.DELIVERY_PARTNER),
  validate(idParamsSchema, 'params'),
  validate(verifyOtpSchema, 'body'),
  asyncHandler(ctrl.verifyOtp),
);

deliveryRouter.post(
  '/my/assignments/:id/fail',
  requireAuth,
  requireRole(ROLES.DELIVERY_PARTNER),
  validate(idParamsSchema, 'params'),
  validate(failDeliverySchema, 'body'),
  asyncHandler(ctrl.failDelivery),
);

deliveryRouter.post(
  '/my/assignments/:id/return-to-store',
  requireAuth,
  requireRole(ROLES.DELIVERY_PARTNER),
  validate(idParamsSchema, 'params'),
  asyncHandler(ctrl.returnToStore),
);
