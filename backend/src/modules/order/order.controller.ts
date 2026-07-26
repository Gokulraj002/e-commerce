import type { Request, Response } from 'express';

import { ApiError } from '../../utils/ApiError.js';
import { ok } from '../../utils/http.js';
import type {
  AdminListOrdersInput,
  ListMyOrdersInput,
  UpdateStatusInput,
} from './order.schema.js';
import * as service from './order.service.js';

/** Thin controllers: pull validated input, delegate to the service, send the envelope. */

export async function listMyOrders(req: Request, res: Response) {
  const userId = req.user!.id;
  const { page = 1, pageSize = 20 } = req.query as unknown as ListMyOrdersInput;
  const result = await service.listMyOrders(userId, page, pageSize);
  return ok(res, result);
}

export async function getMyOrder(req: Request, res: Response) {
  const userId = req.user!.id;
  const { code } = req.params as { code: string };
  const order = await service.getMyOrder(userId, code);
  return ok(res, order);
}

export async function cancelMyOrder(req: Request, res: Response) {
  const userId = req.user!.id;
  const { code } = req.params as { code: string };
  const { reason } = req.body as { reason?: string };
  const order = await service.cancelMyOrder(userId, code, reason);
  return ok(res, order, 'Order cancelled');
}

export async function adminListOrders(req: Request, res: Response) {
  const input = req.query as unknown as AdminListOrdersInput;
  const result = await service.adminListOrders(input);
  return ok(res, result);
}

export async function updateOrderStatus(req: Request, res: Response) {
  const actorId = req.user?.id;
  if (!actorId) throw ApiError.unauthorized();
  const { id } = req.params as { id: string };
  const input = req.body as UpdateStatusInput;
  const order = await service.updateOrderStatus(id, input, actorId);
  return ok(res, order, 'Order status updated');
}
