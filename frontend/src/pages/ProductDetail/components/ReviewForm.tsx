import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui';
import { useCreateReview } from '@/features/reviews';
import { getApiErrorMessage } from '@/lib/apiClient';

import { StarRatingInput } from './StarRatingInput';

/** Mirrors the backend contract: rating required; title/body optional & bounded. */
const reviewFormSchema = z.object({
  rating: z
    .number({ invalid_type_error: 'Please pick a rating' })
    .int()
    .min(1, 'Please pick a rating')
    .max(5),
  title: z.string().trim().max(120, 'Keep the title under 120 characters').optional(),
  body: z.string().trim().max(2000, 'Keep your review under 2000 characters').optional(),
});

type ReviewFormValues = z.infer<typeof reviewFormSchema>;

export interface ReviewFormProps {
  productId: string;
}

/** Write-a-review form (logged-in users). New reviews await moderation. */
export function ReviewForm({ productId }: ReviewFormProps): JSX.Element {
  const createReview = useCreateReview();
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewFormSchema),
    defaultValues: { rating: 0, title: '', body: '' },
  });

  const onSubmit = handleSubmit((values) => {
    createReview.mutate(
      {
        productId,
        input: {
          rating: values.rating,
          title: values.title?.trim() ? values.title.trim() : undefined,
          body: values.body?.trim() ? values.body.trim() : undefined,
        },
      },
      { onSuccess: () => reset({ rating: 0, title: '', body: '' }) },
    );
  });

  if (createReview.isSuccess) {
    return (
      <div
        className="p-3"
        style={{
          borderRadius: 'var(--en-radius)',
          background: 'rgba(46, 125, 50, 0.12)',
          border: '1px solid var(--en-green)',
        }}
        role="status"
      >
        <p className="mb-1 fw-semibold" style={{ color: 'var(--en-text)' }}>
          Thanks for your review!
        </p>
        <p className="mb-0 small" style={{ color: 'var(--en-text-dim)' }}>
          It will appear here once our team has approved it.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="d-flex flex-column gap-3">
      <div>
        <label className="form-label d-block mb-1">Your rating</label>
        <Controller
          control={control}
          name="rating"
          render={({ field }) => (
            <StarRatingInput
              value={field.value}
              onChange={field.onChange}
              disabled={createReview.isPending}
            />
          )}
        />
        {errors.rating && (
          <div className="small mt-1" style={{ color: 'var(--en-accent)' }}>
            {errors.rating.message}
          </div>
        )}
      </div>

      <div>
        <label htmlFor="review-title" className="form-label">
          Title <span style={{ color: 'var(--en-muted)' }}>(optional)</span>
        </label>
        <input
          id="review-title"
          type="text"
          className="form-control"
          placeholder="Loved the freshness"
          disabled={createReview.isPending}
          {...register('title')}
        />
        {errors.title && (
          <div className="small mt-1" style={{ color: 'var(--en-accent)' }}>
            {errors.title.message}
          </div>
        )}
      </div>

      <div>
        <label htmlFor="review-body" className="form-label">
          Review <span style={{ color: 'var(--en-muted)' }}>(optional)</span>
        </label>
        <textarea
          id="review-body"
          className="form-control"
          rows={4}
          placeholder="Tell other shoppers what you thought…"
          disabled={createReview.isPending}
          {...register('body')}
        />
        {errors.body && (
          <div className="small mt-1" style={{ color: 'var(--en-accent)' }}>
            {errors.body.message}
          </div>
        )}
      </div>

      {createReview.isError && (
        <div className="small" style={{ color: 'var(--en-accent)' }}>
          {getApiErrorMessage(createReview.error, 'Could not submit your review')}
        </div>
      )}

      <div>
        <Button type="submit" variant="gold" isLoading={createReview.isPending}>
          Submit review
        </Button>
      </div>
    </form>
  );
}
