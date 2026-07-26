/**
 * Helper router: POST /:code/invoice → enqueues a job on the INVOICE queue.
 *
 * Auth model: authenticated + (order owner OR staff role).
 *
 * TODO(integrator): mount this in routes/index.ts (or mix into orderRouter)
 * so the endpoint is reachable. It is deliberately left disconnected here to
 * keep the invoice module opt-in until the integrator has decided whether it
 * belongs under the customer surface or an admin-only surface.
 *
 * Example:
 *   // in routes/index.ts
 *   import { invoiceRouter } from '../modules/order/invoice.routes.js';
 *   apiRouter.use('/orders', invoiceRouter);
 */
import { ROLES, type Role } from '@elite/shared';
import { Router } from 'express';

import { prisma } from '../../lib/prisma.js';
import { QUEUES, getQueue } from '../../lib/queue.js';
import { requireAuth } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { ApiError } from '../../utils/ApiError.js';
import { asyncHandler, ok } from '../../utils/http.js';

import { orderCodeParamSchema } from './order.schema.js';

/** Roles allowed to generate an invoice for any order (in addition to the order's owner). */
const STAFF_ROLES: ReadonlySet<Role> = new Set<Role>([
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.STORE_MANAGER,
  ROLES.CUSTOMER_SUPPORT,
]);

export const invoiceRouter = Router({ mergeParams: true });

invoiceRouter.post(
  '/:code/invoice',
  requireAuth,
  validate(orderCodeParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const auth = req.user;
    if (!auth) throw ApiError.unauthorized();

    const { code } = req.params as { code: string };
    const order = await prisma.order.findUnique({
      where: { code },
      select: { id: true, userId: true },
    });
    if (!order) throw ApiError.notFound('Order not found');

    const isStaff = STAFF_ROLES.has(auth.role);
    const isOwner = order.userId === auth.id;
    if (!isStaff && !isOwner) throw ApiError.forbidden('Not permitted');

    // Stable jobId collapses duplicate submissions into a single generation.
    await getQueue(QUEUES.INVOICE).add(
      'generate',
      { orderId: order.id },
      { jobId: `invoice:${order.id}`, removeOnComplete: true, removeOnFail: 100 },
    );

    return ok(res, { queued: true }, 'Invoice generation queued', 202);
  }),
);
