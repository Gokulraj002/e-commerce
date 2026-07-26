import type { Request, Response } from 'express';

import { ApiError } from '../../utils/ApiError.js';
import { created, ok } from '../../utils/http.js';
import * as service from './review.service.js';
import type { CreateReviewInput, ListQuery } from './review.schema.js';

/** Thin review controllers. */

export async function listApproved(req: Request, res: Response) {
  return ok(
    res,
    await service.listApproved(req.params.productId, req.query as unknown as ListQuery),
  );
}

export async function createReview(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  return created(
    res,
    await service.createReview(req.params.productId, req.user.id, req.body as CreateReviewInput),
  );
}

export async function listPending(req: Request, res: Response) {
  return ok(res, await service.listPending(req.query as unknown as ListQuery));
}

export async function approveReview(req: Request, res: Response) {
  return ok(res, await service.approveReview(req.params.id));
}

export async function deleteReview(req: Request, res: Response) {
  await service.deleteReview(req.params.id);
  return ok(res, { id: req.params.id }, 'Review deleted');
}
