/**
 * Thin apiClient wrappers for the review endpoints. Reads are public; creating a
 * review requires an authenticated session (enforced server-side).
 */
import type { Paginated } from '@elite/shared';

import { apiClient } from '@/lib/apiClient';

import type { CreateReviewInput, ReviewDTO } from './reviews.types';

export interface ReviewListParams {
  page?: number;
  pageSize?: number;
}

/** Approved reviews for a product, newest first (server-ordered), paginated. */
export async function fetchProductReviews(
  productId: string,
  params: ReviewListParams = {},
): Promise<Paginated<ReviewDTO>> {
  const { data } = await apiClient.get<Paginated<ReviewDTO>>(
    `/reviews/products/${productId}`,
    { params },
  );
  return data;
}

/** Submit a review; returns the (unapproved, pending-moderation) review. */
export async function createReview(
  productId: string,
  input: CreateReviewInput,
): Promise<ReviewDTO> {
  const { data } = await apiClient.post<ReviewDTO>(`/reviews/products/${productId}`, input);
  return data;
}
