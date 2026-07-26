import { STAFF_ROLES } from '@elite/shared';
import { Router } from 'express';

import { requireAuth, requireRole } from '../../middlewares/auth.js';
import { asyncHandler } from '../../utils/http.js';

import { dashboardController } from './dashboard.controller.js';

/** Dashboard module — admin KPI numbers ready for charts. Staff only. */
export const dashboardRouter = Router();

dashboardRouter.get(
  '/stats',
  requireAuth,
  requireRole(...STAFF_ROLES),
  asyncHandler(dashboardController.getStats),
);
