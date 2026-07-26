import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { COUPON_TYPE } from '@elite/shared';

import { SelectField, TextField, TextareaField } from '@/components/ui';

import {
  couponFormSchema,
  toCouponFormValues,
  toCouponWriteInput,
  type CouponFormValues,
} from '../coupon.schema';
import type { AdminCoupon, CouponWriteInput } from '../sales.types';

interface CouponFormProps {
  /** Existing coupon to edit, or null to create. */
  coupon: AdminCoupon | null;
  submitting: boolean;
  onSubmit: (body: CouponWriteInput) => void;
  onCancel: () => void;
}

const FORM_ID = 'coupon-form';

/** Create / edit form for a coupon, rendered inside a Drawer. */
export function CouponForm({ coupon, submitting, onSubmit, onCancel }: CouponFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CouponFormValues>({
    resolver: zodResolver(couponFormSchema),
    defaultValues: toCouponFormValues(coupon),
  });

  const type = watch('type');

  const submit = handleSubmit((values) => onSubmit(toCouponWriteInput(values)));

  return (
    <form id={FORM_ID} onSubmit={submit} className="d-flex flex-column gap-1">
      <TextField
        id="code"
        label="Coupon code"
        placeholder="WELCOME10"
        required
        error={errors.code}
        {...register('code')}
      />

      <SelectField id="type" label="Type" required error={errors.type} {...register('type')}>
        <option value={COUPON_TYPE.PERCENT}>Percentage off</option>
        <option value={COUPON_TYPE.FLAT}>Flat amount off</option>
        <option value={COUPON_TYPE.FREE_SHIPPING}>Free shipping</option>
      </SelectField>

      {type === COUPON_TYPE.PERCENT && (
        <>
          <TextField
            id="percent"
            label="Discount percentage"
            type="number"
            min={1}
            max={100}
            hint="1–100%"
            required
            error={errors.percent}
            {...register('percent')}
          />
          <TextField
            id="maxDiscountRupees"
            label="Max discount (₹)"
            type="number"
            min={0}
            step="0.01"
            hint="Optional cap on the percentage discount"
            error={errors.maxDiscountRupees}
            {...register('maxDiscountRupees')}
          />
        </>
      )}

      {type === COUPON_TYPE.FLAT && (
        <TextField
          id="valueRupees"
          label="Discount amount (₹)"
          type="number"
          min={0}
          step="0.01"
          required
          error={errors.valueRupees}
          {...register('valueRupees')}
        />
      )}

      <TextField
        id="minCartRupees"
        label="Minimum cart value (₹)"
        type="number"
        min={0}
        step="0.01"
        hint="0 for no minimum"
        error={errors.minCartRupees}
        {...register('minCartRupees')}
      />

      <div className="row g-2">
        <div className="col-6">
          <TextField
            id="usageLimit"
            label="Total usage limit"
            type="number"
            min={1}
            hint="Blank = unlimited"
            error={errors.usageLimit}
            {...register('usageLimit')}
          />
        </div>
        <div className="col-6">
          <TextField
            id="perUserLimit"
            label="Per-customer limit"
            type="number"
            min={1}
            hint="Blank = unlimited"
            error={errors.perUserLimit}
            {...register('perUserLimit')}
          />
        </div>
      </div>

      <div className="row g-2">
        <div className="col-6">
          <TextField
            id="startsAt"
            label="Starts on"
            type="date"
            error={errors.startsAt}
            {...register('startsAt')}
          />
        </div>
        <div className="col-6">
          <TextField
            id="expiresAt"
            label="Expires on"
            type="date"
            error={errors.expiresAt}
            {...register('expiresAt')}
          />
        </div>
      </div>

      <TextareaField
        id="description"
        label="Description"
        rows={2}
        placeholder="Shown to customers at checkout"
        error={errors.description}
        {...register('description')}
      />

      <div className="form-check mt-1">
        <input
          id="isActive"
          type="checkbox"
          className="form-check-input"
          {...register('isActive')}
        />
        <label className="form-check-label" htmlFor="isActive">
          Active
        </label>
      </div>

      <div className="ui-drawer__footer-actions d-flex justify-content-end gap-2 mt-3">
        <button type="button" className="btn btn-light" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Saving…' : coupon ? 'Save changes' : 'Create coupon'}
        </button>
      </div>
    </form>
  );
}
