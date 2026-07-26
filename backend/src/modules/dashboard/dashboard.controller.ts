import type { Request, Response } from 'express';

import { ok } from '../../utils/http.js';

import { dashboardService } from './dashboard.service.js';

export const dashboardController = {
  getStats: async (_req: Request, res: Response) => ok(res, await dashboardService.getStats()),
};
