import { ROLES } from '@elite/shared';
import { Router } from 'express';

import { requireAuth, requireRole } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { asyncHandler } from '../../utils/http.js';

import { settingsController } from './settings.controller.js';
import { settingKeyParamSchema, updateSettingSchema } from './settings.schema.js';

/** Settings module — public safe subset + admin read/write of Setting rows. */
export const settingsRouter = Router();

const requireSettingsAdmin = requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN);

// Public safe subset.
settingsRouter.get('/public', asyncHandler(settingsController.getPublic));

// Admin.
settingsRouter.get('/', requireAuth, requireSettingsAdmin, asyncHandler(settingsController.listAll));
settingsRouter.put(
  '/:key',
  requireAuth,
  requireSettingsAdmin,
  validate(settingKeyParamSchema, 'params'),
  validate(updateSettingSchema),
  asyncHandler(settingsController.update),
);
