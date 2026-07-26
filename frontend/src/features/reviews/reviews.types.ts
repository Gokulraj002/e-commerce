/**
 * Review DTO — mirrors the backend's client-safe shape (never leaks the
 * reviewer's user id). Newly created reviews arrive unapproved and are held for
 * moderation, so they will not appear in the approved list until published.
 */
export interface ReviewDTO {
  id: string;
  productId: string;
  rating: number;
  title: string | null;
  body: string | null;
  authorName: string;
  isApproved: boolean;
  createdAt: string;
}

/** Payload for submitting a review (`POST /reviews/products/:productId`). */
export interface CreateReviewInput {
  rating: number;
  title?: string;
  body?: string;
}
