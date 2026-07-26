import type { Paginated } from '@elite/shared';

import { ApiError } from '../../utils/ApiError.js';
import { parsePagination } from '../../utils/http.js';
import * as repo from './review.repository.js';
import type { ReviewRow } from './review.repository.js';
import type { CreateReviewInput, ListQuery } from './review.schema.js';
import type { ReviewDTO } from './review.types.js';

/** Business logic for product reviews: moderation + rating recomputation. */

function mapReview(row: ReviewRow): ReviewDTO {
  return {
    id: row.id,
    productId: row.productId,
    rating: row.rating,
    title: row.title,
    body: row.body,
    authorName: row.user.name,
    isApproved: row.isApproved,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Recompute and persist a product's rating from its approved reviews. */
async function recomputeProductRating(productId: string): Promise<void> {
  const agg = await repo.aggregateApproved(productId);
  const count = agg._count._all;
  const average = count > 0 ? Number((agg._avg.rating ?? 0).toFixed(2)) : 0;
  await repo.updateProductRating(productId, average, count);
}

export async function listApproved(
  productId: string,
  query: ListQuery,
): Promise<Paginated<ReviewDTO>> {
  const { page, pageSize, skip, take } = parsePagination({
    page: query.page,
    pageSize: query.pageSize,
  });
  const [rows, total] = await Promise.all([
    repo.findApprovedByProduct(productId, skip, take),
    repo.countApprovedByProduct(productId),
  ]);
  return {
    items: rows.map(mapReview),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function createReview(
  productId: string,
  userId: string,
  input: CreateReviewInput,
): Promise<ReviewDTO> {
  if (!(await repo.findProductById(productId))) {
    throw ApiError.notFound('Product not found');
  }
  if (await repo.findByProductAndUser(productId, userId)) {
    throw ApiError.conflict('You have already reviewed this product');
  }
  const review = await repo.createReview({
    productId,
    userId,
    rating: input.rating,
    title: input.title,
    body: input.body,
  });
  // New reviews are unapproved by default; recompute keeps rating consistent
  // if the moderation policy ever auto-approves.
  await recomputeProductRating(productId);
  return mapReview(review);
}

export async function listPending(query: ListQuery): Promise<Paginated<ReviewDTO>> {
  const { page, pageSize, skip, take } = parsePagination({
    page: query.page,
    pageSize: query.pageSize,
  });
  const [rows, total] = await Promise.all([
    repo.findPending(skip, take),
    repo.countPending(),
  ]);
  return {
    items: rows.map(mapReview),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function approveReview(id: string): Promise<ReviewDTO> {
  const existing = await repo.findReviewById(id);
  if (!existing) throw ApiError.notFound('Review not found');
  const approved = await repo.approveReview(id);
  await recomputeProductRating(approved.productId);
  return mapReview(approved);
}

export async function deleteReview(id: string): Promise<void> {
  const existing = await repo.findReviewById(id);
  if (!existing) throw ApiError.notFound('Review not found');
  await repo.deleteReview(id);
  await recomputeProductRating(existing.productId);
}
