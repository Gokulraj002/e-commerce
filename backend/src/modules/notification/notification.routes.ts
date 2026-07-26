import { Router } from 'express';

import { requireAuth } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { asyncHandler } from '../../utils/http.js';

import { notificationController } from './notification.controller.js';
import { idParamSchema, listQuerySchema } from './notification.schema.js';

/** Notification module — a signed-in user's own in-app notifications. */
export const notificationRouter = Router();

notificationRouter.use(requireAuth);

notificationRouter.get(
  '/',
  validate(listQuerySchema, 'query'),
  asyncHandler(notificationController.list),
);

notificationRouter.patch('/read-all', asyncHandler(notificationController.markAllRead));

notificationRouter.patch(
  '/:id/read',
  validate(idParamSchema, 'params'),
  asyncHandler(notificationController.markRead),
);
