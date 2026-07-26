/** Client-safe review shape (never leaks the reviewer's user id / PII). */
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
