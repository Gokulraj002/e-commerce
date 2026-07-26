import type { Request, Response } from 'express';

import { ok } from '../../utils/http.js';

import { auditService } from './audit.service.js';
import type { ListAuditQuery } from './audit.schema.js';

/** Thin controllers. requireAuth + requireRole guarantee a staff req.user. */
export const auditController = {
  list: async (req: Request, res: Response) =>
    ok(res, await auditService.list(req.query as unknown as ListAuditQuery)),

  entities: async (_req: Request, res: Response) =>
    ok(res, await auditService.entities()),
};
