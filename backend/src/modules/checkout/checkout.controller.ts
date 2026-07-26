import type { Request, Response } from 'express';

import { created, ok } from '../../utils/http.js';
import type { PlaceOrderInput, SummaryQueryInput } from './checkout.schema.js';
import * as service from './checkout.service.js';

/** Thin controllers: read validated input, delegate to the service, send envelope. */

export async function getSummary(req: Request, res: Response) {
  const userId = req.user!.id;
  const query = req.query as unknown as SummaryQueryInput;
  const summary = await service.getSummary(userId, query);
  return ok(res, summary);
}

export async function placeOrder(req: Request, res: Response) {
  const userId = req.user!.id;
  const input = req.body as PlaceOrderInput;
  const result = await service.placeOrder(userId, input);
  return created(res, result, 'Order placed');
}
