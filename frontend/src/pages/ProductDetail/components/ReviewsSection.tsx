import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { Button, Card, Rating, Skeleton } from '@/components/ui';
import { useAuth } from '@/features/auth/useAuth';
import { useProductReviews } from '@/features/reviews';
import type { ReviewDTO } from '@/features/reviews';
import { getApiErrorMessage } from '@/lib/apiClient';
import { paths } from '@/routes/routes';

import { ReviewForm } from './ReviewForm';

const PAGE_STEP = 10;

export interface ReviewsSectionProps {
  productId: string;
  rating: number;
  ratingCount: number;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function ReviewItem({ review }: { review: ReviewDTO }): JSX.Element {
  return (
    <Card padding="md">
      <div className="d-flex justify-content-between align-items-start gap-3 mb-1">
        <span className="fw-semibold" style={{ color: 'var(--en-text)' }}>
          {review.authorName}
        </span>
        <span className="small" style={{ color: 'var(--en-muted)' }}>
          {formatDate(review.createdAt)}
        </span>
      </div>
      <Rating value={review.rating} className="mb-2" />
      {review.title && (
        <h4 className="h6 mb-1" style={{ color: 'var(--en-text)' }}>
          {review.title}
        </h4>
      )}
      {review.body && (
        <p className="mb-0" style={{ color: 'var(--en-text-dim)' }}>
          {review.body}
        </p>
      )}
    </Card>
  );
}

/** Reviews block: aggregate score, approved-review list + a write-review path. */
export function ReviewsSection({ productId, rating, ratingCount }: ReviewsSectionProps): JSX.Element {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const [pageSize, setPageSize] = useState(PAGE_STEP);

  const { data, isLoading, isError, error, isFetching } = useProductReviews(productId, {
    page: 1,
    pageSize,
  });

  const reviews = data?.items ?? [];
  const total = data?.total ?? 0;
  const canLoadMore = reviews.length < total;

  const loginTo = `${paths.login()}?redirect=${encodeURIComponent(location.pathname)}`;

  return (
    <div className="row g-4">
      {/* Write-review column */}
      <div className="col-12 col-lg-5">
        <Card padding="lg">
          <div className="d-flex align-items-baseline gap-2 mb-2">
            <span className="en-display" style={{ fontSize: '2.4rem', color: 'var(--en-text)' }}>
              {rating.toFixed(1)}
            </span>
            <span style={{ color: 'var(--en-muted)' }}>/ 5</span>
          </div>
          <Rating value={rating} count={ratingCount} className="mb-1" />
          <p className="small mb-4" style={{ color: 'var(--en-muted)' }}>
            Based on {ratingCount} verified {ratingCount === 1 ? 'review' : 'reviews'}
          </p>

          <h3 className="h5 mb-3">Write a review</h3>
          {isAuthenticated ? (
            <ReviewForm productId={productId} />
          ) : (
            <div>
              <p className="mb-3" style={{ color: 'var(--en-text-dim)' }}>
                Sign in to share your experience with this cut.
              </p>
              <Link to={loginTo} className="btn btn-gold">
                Sign in to review
              </Link>
            </div>
          )}
        </Card>
      </div>

      {/* Review list column */}
      <div className="col-12 col-lg-7">
        {isLoading ? (
          <div className="d-flex flex-column gap-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Card key={i} padding="md">
                <Skeleton width="30%" height={16} className="mb-2" />
                <Skeleton width="50%" height={14} className="mb-2" />
                <Skeleton count={2} />
              </Card>
            ))}
          </div>
        ) : isError ? (
          <p style={{ color: 'var(--en-accent)' }}>
            {getApiErrorMessage(error, 'Could not load reviews')}
          </p>
        ) : reviews.length === 0 ? (
          <Card padding="lg">
            <p className="mb-0" style={{ color: 'var(--en-text-dim)' }}>
              No reviews yet — be the first to review this product.
            </p>
          </Card>
        ) : (
          <div className="d-flex flex-column gap-3">
            {reviews.map((review) => (
              <ReviewItem key={review.id} review={review} />
            ))}
            {canLoadMore && (
              <div>
                <Button
                  variant="outline"
                  isLoading={isFetching}
                  onClick={() => setPageSize((size) => size + PAGE_STEP)}
                >
                  Load more reviews
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
