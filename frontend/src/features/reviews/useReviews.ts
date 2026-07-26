/**
 * React-query hooks for product reviews.
 *
 * Query keys are `['reviews', productId, page, pageSize]` so each page caches
 * independently. After a successful submit we invalidate the product's review
 * lists (the new review is unapproved, so it will only surface once moderated)
 * and the product detail cache (whose embedded rating may be recomputed).
 */
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';

import type { Paginated } from '@elite/shared';

import { createReview, fetchProductReviews, type ReviewListParams } from './reviews.api';
import type { CreateReviewInput, ReviewDTO } from './reviews.types';

export const reviewKeys = {
  all: (productId: string) => ['reviews', productId] as const,
  list: (productId: string, page: number, pageSize: number) =>
    ['reviews', productId, page, pageSize] as const,
};

export interface UseProductReviewsOptions extends ReviewListParams {
  enabled?: boolean;
}

export function useProductReviews(
  productId: string,
  { page = 1, pageSize = 10, enabled = true }: UseProductReviewsOptions = {},
): UseQueryResult<Paginated<ReviewDTO>> {
  return useQuery({
    queryKey: reviewKeys.list(productId, page, pageSize),
    queryFn: () => fetchProductReviews(productId, { page, pageSize }),
    enabled: enabled && productId.length > 0,
    placeholderData: keepPreviousData,
  });
}

export interface CreateReviewVars {
  productId: string;
  input: CreateReviewInput;
}

export function useCreateReview() {
  const queryClient = useQueryClient();
  return useMutation<ReviewDTO, unknown, CreateReviewVars>({
    mutationFn: ({ productId, input }) => createReview(productId, input),
    onSuccess: (_review, { productId }) => {
      void queryClient.invalidateQueries({ queryKey: reviewKeys.all(productId) });
      void queryClient.invalidateQueries({ queryKey: ['product'] });
    },
  });
}
