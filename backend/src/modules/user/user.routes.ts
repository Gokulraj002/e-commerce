import { ROLES } from '@elite/shared';
import { Router } from 'express';

import { requireAuth, requireRole } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';

import { userController } from './user.controller.js';
import {
  addressSchema,
  addressUpdateSchema,
  customersQuerySchema,
  idParamSchema,
  updateProfileSchema,
} from './user.schema.js';

export const userRouter = Router();

/** Staff roles allowed to manage customers. */
const requireStaff = requireRole(
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.CUSTOMER_SUPPORT,
  ROLES.STORE_MANAGER,
);

// ── Profile ────────────────────────────────────────────────────────
userRouter.get('/profile', requireAuth, userController.getProfile);
userRouter.patch(
  '/profile',
  requireAuth,
  validate(updateProfileSchema),
  userController.updateProfile,
);

// ── Addresses ──────────────────────────────────────────────────────
userRouter.get('/addresses', requireAuth, userController.listAddresses);
userRouter.post('/addresses', requireAuth, validate(addressSchema), userController.createAddress);
userRouter.patch(
  '/addresses/:id',
  requireAuth,
  validate(idParamSchema, 'params'),
  validate(addressUpdateSchema),
  userController.updateAddress,
);
userRouter.delete(
  '/addresses/:id',
  requireAuth,
  validate(idParamSchema, 'params'),
  userController.deleteAddress,
);
userRouter.patch(
  '/addresses/:id/default',
  requireAuth,
  validate(idParamSchema, 'params'),
  userController.setDefaultAddress,
);

// ── Admin customer management ──────────────────────────────────────
userRouter.get(
  '/customers',
  requireAuth,
  requireStaff,
  validate(customersQuerySchema, 'query'),
  userController.listCustomers,
);
userRouter.get(
  '/customers/:id',
  requireAuth,
  requireStaff,
  validate(idParamSchema, 'params'),
  userController.getCustomer,
);
