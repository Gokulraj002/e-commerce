import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { addressSchema, type AddressDTO, type AddressInput } from '@elite/shared';

import { Button, Spinner } from '@/components/ui';
import { getApiErrorMessage } from '@/lib/apiClient';

import { useCreateAddress } from '../useCreateAddress';
import { useServiceability } from '../useServiceability';

export interface AddressFormProps {
  /** Prefill name/phone from the signed-in user. */
  defaultName?: string;
  defaultPhone?: string;
  onCreated: (address: AddressDTO) => void;
  onCancel?: () => void;
}

/**
 * Add-a-new-address form (react-hook-form + shared zod `addressSchema`).
 * The pincode is checked against delivery serviceability live; a non-serviceable
 * pincode blocks submission so we never save an undeliverable address.
 */
export function AddressForm({
  defaultName,
  defaultPhone,
  onCreated,
  onCancel,
}: AddressFormProps): JSX.Element {
  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm<AddressInput>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      label: 'Home',
      name: defaultName ?? '',
      phone: defaultPhone ?? '',
      line1: '',
      line2: '',
      city: 'Hyderabad',
      pincode: '',
      isDefault: false,
    },
  });

  const createMutation = useCreateAddress();
  const pincode = watch('pincode') ?? '';
  const serviceability = useServiceability(pincode);
  const isServiceable = serviceability.data?.serviceable === true;

  const onSubmit = handleSubmit(async (values) => {
    if (serviceability.data && !serviceability.data.serviceable) {
      setError('pincode', { message: 'We do not deliver to this pincode yet' });
      return;
    }
    try {
      const created = await createMutation.mutateAsync(values);
      onCreated(created);
    } catch (err) {
      setError('root', { message: getApiErrorMessage(err, 'Could not save address') });
    }
  });

  return (
    <form onSubmit={onSubmit} className="d-flex flex-column gap-3" noValidate>
      <div className="row g-3">
        <div className="col-12 col-md-4">
          <label className="form-label" htmlFor="addr-label">Label</label>
          <input id="addr-label" className="form-control" placeholder="Home / Work" {...register('label')} />
          <FieldError message={errors.label?.message} />
        </div>
        <div className="col-12 col-md-8">
          <label className="form-label" htmlFor="addr-name">Full name</label>
          <input id="addr-name" className="form-control" {...register('name')} />
          <FieldError message={errors.name?.message} />
        </div>

        <div className="col-12">
          <label className="form-label" htmlFor="addr-phone">Phone</label>
          <input id="addr-phone" className="form-control" inputMode="tel" {...register('phone')} />
          <FieldError message={errors.phone?.message} />
        </div>

        <div className="col-12">
          <label className="form-label" htmlFor="addr-line1">Address line 1</label>
          <input id="addr-line1" className="form-control" placeholder="Flat, building, street" {...register('line1')} />
          <FieldError message={errors.line1?.message} />
        </div>
        <div className="col-12">
          <label className="form-label" htmlFor="addr-line2">Address line 2 <span className="en-text-muted">(optional)</span></label>
          <input id="addr-line2" className="form-control" placeholder="Area, landmark" {...register('line2')} />
          <FieldError message={errors.line2?.message} />
        </div>

        <div className="col-12 col-md-7">
          <label className="form-label" htmlFor="addr-city">City</label>
          <input id="addr-city" className="form-control" {...register('city')} />
          <FieldError message={errors.city?.message} />
        </div>
        <div className="col-12 col-md-5">
          <label className="form-label" htmlFor="addr-pincode">Pincode</label>
          <input id="addr-pincode" className="form-control" inputMode="numeric" maxLength={6} {...register('pincode')} />
          <FieldError message={errors.pincode?.message} />
          <ServiceabilityHint
            pincode={pincode}
            isFetching={serviceability.isFetching}
            data={serviceability.data ?? null}
          />
        </div>

        <div className="col-12">
          <div className="form-check">
            <input id="addr-default" type="checkbox" className="form-check-input" {...register('isDefault')} />
            <label className="form-check-label" htmlFor="addr-default">Set as default address</label>
          </div>
        </div>
      </div>

      {errors.root?.message && (
        <p className="text-danger small mb-0" role="alert">{errors.root.message}</p>
      )}

      <div className="d-flex gap-2">
        <Button
          type="submit"
          variant="gold"
          isLoading={createMutation.isPending}
          disabled={!isServiceable}
        >
          Save address
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={createMutation.isPending}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

function FieldError({ message }: { message?: string }): JSX.Element | null {
  if (!message) return null;
  return <p className="text-danger small mb-0 mt-1">{message}</p>;
}

interface ServiceabilityHintProps {
  pincode: string;
  isFetching: boolean;
  data: { serviceable: boolean; zone: string | null } | null;
}

function ServiceabilityHint({ pincode, isFetching, data }: ServiceabilityHintProps): JSX.Element | null {
  if (!/^\d{6}$/.test(pincode)) return null;
  if (isFetching) {
    return (
      <p className="en-text-muted small mb-0 mt-1 d-inline-flex align-items-center gap-2">
        <Spinner size={14} /> Checking serviceability…
      </p>
    );
  }
  if (!data) return null;
  if (data.serviceable) {
    return (
      <p className="small mb-0 mt-1" style={{ color: 'var(--en-green)' }}>
        ✓ We deliver here{data.zone ? ` (${data.zone})` : ''}
      </p>
    );
  }
  return (
    <p className="text-danger small mb-0 mt-1">We do not deliver to this pincode yet.</p>
  );
}
