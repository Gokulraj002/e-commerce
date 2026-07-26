import type { Request, Response } from 'express';

import { ok } from '../../utils/http.js';

import { notificationService } from './notification.service.js';

/** Thin controllers. requireAuth guarantees req.user is present. */
export const notificationController = {
  list: async (req: Request, res: Response) =>
    ok(res, await notificationService.list(req.user!.id, req.query as Record<string, unknown>)),

  markRead: async (req: Request, res: Response) =>
    ok(res, await notificationService.markRead(req.user!.id, req.params.id), 'Marked as read'),

  markAllRead: async (req: Request, res: Response) =>
    ok(res, await notificationService.markAllRead(req.user!.id), 'All notifications marked read'),
};
