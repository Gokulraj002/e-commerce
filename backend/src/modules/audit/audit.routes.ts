import { ROLES } from '@elite/shared';
import { Router } from 'express';

import { requireAuth, requireRole } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { asyncHandler } from '../../utils/http.js';

import { auditController } from './audit.controller.js';
import { listAuditQuerySchema } from './audit.schema.js';

/**
 * Audit module — read-only admin surface over `audit_logs`.
 *
 * Writes into `audit_logs` happen automatically via `middlewares/audit.ts`
 * (`auditMiddleware(entity)`) attached to each staff-facing router.
 *
 * TODO(integration): mount this router in `src/routes/index.ts`:
 *   import { auditRouter } from '../modules/audit/audit.routes.js';
 *   apiRouter.use('/audit', auditRouter);
 */
export const auditRouter = Router();

// Every endpoint here is admin-only.
auditRouter.use(requireAuth, requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN));

auditRouter.get(
  '/entities',
  asyncHandler(auditController.entities),
);

auditRouter.get(
  '/',
  validate(listAuditQuerySchema, 'query'),
  asyncHandler(auditController.list),
);
