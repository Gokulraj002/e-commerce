/**
 * Pincode serviceability modal.
 *
 * Prompts the user for a 6-digit pincode with react-hook-form (validated by
 * the shared `pincodeSchema`), calls the backend via `useCheckServiceability`
 * and renders the inline result (green — deliverable, or warning — not yet).
 * On a successful check the answer is stored in the ServiceabilityContext
 * (which persists it to localStorage) so the header pill updates immediately.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { pincodeSchema } from '@elite/shared';

import { Button, Modal } from '@/components/ui';
import { getApiErrorMessage } from '@/lib/apiClient';
import { formatPaise } from '@/lib/money';

import { useCheckServiceability, useServiceability } from './useServiceability';

const formSchema = z.object({ pincode: pincodeSchema });
type FormValues = z.infer<typeof formSchema>;

export interface ServiceabilityModalProps {
  open: boolean;
  onClose: () => void;
}

export function ServiceabilityModal({ open, onClose }: ServiceabilityModalProps): JSX.Element {
  const { record } = useServiceability();
  const check = useCheckServiceability();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { pincode: record?.pincode ?? '' },
    mode: 'onSubmit',
  });

  // Reset the form + mutation state each time the modal reopens so a repeat
  // visit starts with the persisted pincode and no stale success/error alerts.
  useEffect(() => {
    if (!open) return;
    reset({ pincode: record?.pincode ?? '' });
    check.reset();
    // Intentional: we only reset when the modal transitions to open. Including
    // `check`/`reset` here would loop as their identities change on each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onSubmit = handleSubmit(async (values) => {
    // Swallow rejection — the mutation exposes error state via check.isError.
    await check.mutateAsync(values.pincode).catch(() => undefined);
  });

  const result = check.data ?? null;
  const attemptedPincode = check.variables ?? '';

  return (
    <Modal open={open} onClose={onClose} title="Check delivery to your pincode">
      <form onSubmit={onSubmit} noValidate>
        <p className="en-text-dim small mb-3">
          Enter your 6-digit pincode so we can confirm fresh delivery to your door.
        </p>

        <div className="mb-3">
          <label htmlFor="serviceability-pincode" className="form-label">
            Pincode
          </label>
          <input
            id="serviceability-pincode"
            type="text"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={6}
            className={`form-control${errors.pincode ? ' is-invalid' : ''}`}
            placeholder="500001"
            aria-invalid={errors.pincode ? true : undefined}
            {...register('pincode')}
          />
          {errors.pincode && <div className="invalid-feedback">{errors.pincode.message}</div>}
        </div>

        {check.isError && (
          <div className="alert alert-danger" role="alert">
            {getApiErrorMessage(check.error, 'Could not check that pincode. Try again.')}
          </div>
        )}

        {result && !check.isError && (
          result.serviceable ? (
            <div className="alert alert-success" role="status">
              <strong>We deliver to {attemptedPincode}.</strong>
              {result.zone && <> Zone {result.zone}.</>} Delivery fee{' '}
              {formatPaise(result.feePaise)}.
            </div>
          ) : (
            <div className="alert alert-warning" role="status">
              Sorry, we don&rsquo;t deliver to {attemptedPincode} yet. We&rsquo;re expanding
              fast — please check back soon.
            </div>
          )
        )}

        <div className="d-flex gap-2 justify-content-end mt-3">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button type="submit" variant="gold" isLoading={isSubmitting || check.isPending}>
            Check pincode
          </Button>
        </div>
      </form>
    </Modal>
  );
}
