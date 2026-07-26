import type { Request, Response } from 'express';

import { ok } from '../../utils/http.js';

import { settingsService } from './settings.service.js';

export const settingsController = {
  getPublic: async (_req: Request, res: Response) => ok(res, await settingsService.getPublic()),

  listAll: async (_req: Request, res: Response) => ok(res, await settingsService.listAll()),

  update: async (req: Request, res: Response) => {
    const { value, group } = req.body as { value: unknown; group?: string };
    return ok(res, await settingsService.update(req.params.key, value, group), 'Setting saved');
  },
};
