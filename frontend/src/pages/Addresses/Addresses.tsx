import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { addressSchema, type AddressDTO, type AddressInput } from '@elite/shared';

import { Badge, Button, Card, EmptyState, Modal, Skeleton } from '@/components/ui';
import {
  AccountLayout,
  useAddresses,
  useCreateAddress,
  useDeleteAddress,
  useSetDefaultAddress,
  useUpdateAddress,
} from '@/features/account';
import { getApiErrorMessage } from '@/lib/apiClient';

type Editing = { mode: 'create' } | { mode: 'edit'; address: AddressDTO } | null;

const EMPTY_FORM: AddressInput = {
  label: '',
  name: '',
  phone: '',
  line1: '',
  line2: '',
  city: '',
  pincode: '',
  isDefault: false,
};

interface AddressFormProps {
  initial: AddressInput;
  submitting: boolean;
  error: string | null;
  onSubmit: (values: AddressInput) => void;
  onCancel: () => void;
}

function AddressForm({ initial, submitting, error, onSubmit, onCancel }: AddressFormProps): JSX.Element {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AddressInput>({
    resolver: zodResolver(addressSchema),
    defaultValues: initial,
  });

  return (
    <form
      onSubmit={handleSubmit((values) =>
        onSubmit({ ...values, line2: values.line2?.trim() ? values.line2.trim() : undefined }),
      )}
      noValidate
    >
      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      <div className="row g-3">
        <div className="col-12 col-sm-6">
          <label htmlFor="ad-label" className="form-label">
            Label
          </label>
          <input
            id="ad-label"
            className={`form-control${errors.label ? ' is-invalid' : ''}`}
            placeholder="Home, Office…"
            {...register('label')}
          />
          {errors.label && <div className="invalid-feedback">{errors.label.message}</div>}
        </div>

        <div className="col-12 col-sm-6">
          <label htmlFor="ad-name" className="form-label">
            Contact name
          </label>
          <input
            id="ad-name"
            className={`form-control${errors.name ? ' is-invalid' : ''}`}
            {...register('name')}
          />
          {errors.name && <div className="invalid-feedback">{errors.name.message}</div>}
        </div>

        <div className="col-12 col-sm-6">
          <label htmlFor="ad-phone" className="form-label">
            Phone
          </label>
          <input
            id="ad-phone"
            type="tel"
            inputMode="numeric"
            className={`form-control${errors.phone ? ' is-invalid' : ''}`}
            placeholder="9876543210"
            {...register('phone')}
          />
          {errors.phone && <div className="invalid-feedback">{errors.phone.message}</div>}
        </div>

        <div className="col-12 col-sm-6">
          <label htmlFor="ad-pincode" className="form-label">
            Pincode
          </label>
          <input
            id="ad-pincode"
            inputMode="numeric"
            className={`form-control${errors.pincode ? ' is-invalid' : ''}`}
            placeholder="500001"
            {...register('pincode')}
          />
          {errors.pincode && <div className="invalid-feedback">{errors.pincode.message}</div>}
        </div>

        <div className="col-12">
          <label htmlFor="ad-line1" className="form-label">
            Address line 1
          </label>
          <input
            id="ad-line1"
            className={`form-control${errors.line1 ? ' is-invalid' : ''}`}
            placeholder="Flat / House no, Building, Street"
            {...register('line1')}
          />
          {errors.line1 && <div className="invalid-feedback">{errors.line1.message}</div>}
        </div>

        <div className="col-12">
          <label htmlFor="ad-line2" className="form-label">
            Address line 2 <span className="en-text-muted">(optional)</span>
          </label>
          <input
            id="ad-line2"
            className={`form-control${errors.line2 ? ' is-invalid' : ''}`}
            placeholder="Area, Landmark"
            {...register('line2')}
          />
          {errors.line2 && <div className="invalid-feedback">{errors.line2.message}</div>}
        </div>

        <div className="col-12">
          <label htmlFor="ad-city" className="form-label">
            City
          </label>
          <input
            id="ad-city"
            className={`form-control${errors.city ? ' is-invalid' : ''}`}
            {...register('city')}
          />
          {errors.city && <div className="invalid-feedback">{errors.city.message}</div>}
        </div>

        <div className="col-12">
          <div className="form-check">
            <input id="ad-default" type="checkbox" className="form-check-input" {...register('isDefault')} />
            <label htmlFor="ad-default" className="form-check-label">
              Set as default delivery address
            </label>
          </div>
        </div>
      </div>

      <div className="d-flex gap-2 mt-4">
        <Button type="submit" variant="gold" isLoading={submitting}>
          Save address
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function AddressTile({
  address,
  onEdit,
  onDelete,
  onSetDefault,
  busy,
}: {
  address: AddressDTO;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
  busy: boolean;
}): JSX.Element {
  return (
    <Card padding="md" className="h-100 d-flex flex-column">
      <div className="d-flex align-items-center gap-2 mb-2">
        <span className="fw-semibold">{address.label}</span>
        {address.isDefault && <Badge tone="gold">Default</Badge>}
      </div>
      <div className="en-text-dim small flex-grow-1">
        <div className="text-body">{address.name}</div>
        {address.line1}
        {address.line2 ? `, ${address.line2}` : ''}
        <br />
        {address.city} — {address.pincode}
        <br />
        {address.phone}
      </div>
      <div className="d-flex flex-wrap gap-2 mt-3">
        <Button variant="outline" size="sm" onClick={onEdit} disabled={busy}>
          Edit
        </Button>
        {!address.isDefault && (
          <Button variant="ghost" size="sm" onClick={onSetDefault} disabled={busy}>
            Set default
          </Button>
        )}
        <Button variant="ghost" size="sm" className="text-danger" onClick={onDelete} disabled={busy}>
          Delete
        </Button>
      </div>
    </Card>
  );
}

export default function Addresses(): JSX.Element {
  const { data: addresses, isLoading, isError, error } = useAddresses();
  const createMut = useCreateAddress();
  const updateMut = useUpdateAddress();
  const deleteMut = useDeleteAddress();
  const setDefaultMut = useSetDefaultAddress();

  const [editing, setEditing] = useState<Editing>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const anyMutating =
    createMut.isPending || updateMut.isPending || deleteMut.isPending || setDefaultMut.isPending;

  async function handleSubmit(values: AddressInput): Promise<void> {
    setFormError(null);
    try {
      if (editing?.mode === 'edit') {
        await updateMut.mutateAsync({ id: editing.address.id, input: values });
      } else {
        await createMut.mutateAsync(values);
      }
      setEditing(null);
    } catch (err) {
      setFormError(getApiErrorMessage(err, 'Could not save the address.'));
    }
  }

  async function handleDelete(id: string): Promise<void> {
    setListError(null);
    try {
      await deleteMut.mutateAsync(id);
    } catch (err) {
      setListError(getApiErrorMessage(err, 'Could not delete the address.'));
    }
  }

  async function handleSetDefault(id: string): Promise<void> {
    setListError(null);
    try {
      await setDefaultMut.mutateAsync(id);
    } catch (err) {
      setListError(getApiErrorMessage(err, 'Could not update the default address.'));
    }
  }

  const initialValues: AddressInput =
    editing?.mode === 'edit'
      ? {
          label: editing.address.label,
          name: editing.address.name,
          phone: editing.address.phone,
          line1: editing.address.line1,
          line2: editing.address.line2 ?? '',
          city: editing.address.city,
          pincode: editing.address.pincode,
          isDefault: editing.address.isDefault,
        }
      : EMPTY_FORM;

  return (
    <AccountLayout
      eyebrow="My Account"
      title="Addresses"
      actions={
        <Button
          variant="gold"
          onClick={() => {
            setFormError(null);
            setEditing({ mode: 'create' });
          }}
        >
          Add address
        </Button>
      }
    >
      {listError && (
        <div className="alert alert-danger" role="alert">
          {listError}
        </div>
      )}

      {isLoading ? (
        <div className="row g-3">
          {[0, 1].map((i) => (
            <div key={i} className="col-12 col-md-6">
              <Skeleton height={180} radius={16} />
            </div>
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          icon="⚠️"
          title="Could not load addresses"
          description={getApiErrorMessage(error, 'Please try again in a moment.')}
        />
      ) : !addresses || addresses.length === 0 ? (
        <EmptyState
          icon="📍"
          title="No saved addresses"
          description="Add a delivery address to speed up checkout."
          action={
            <Button variant="gold" onClick={() => setEditing({ mode: 'create' })}>
              Add address
            </Button>
          }
        />
      ) : (
        <div className="row g-3">
          {addresses.map((address) => (
            <div key={address.id} className="col-12 col-md-6">
              <AddressTile
                address={address}
                busy={anyMutating}
                onEdit={() => {
                  setFormError(null);
                  setEditing({ mode: 'edit', address });
                }}
                onDelete={() => void handleDelete(address.id)}
                onSetDefault={() => void handleSetDefault(address.id)}
              />
            </div>
          ))}
        </div>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.mode === 'edit' ? 'Edit address' : 'Add a new address'}
      >
        {editing !== null && (
          <AddressForm
            initial={initialValues}
            submitting={createMut.isPending || updateMut.isPending}
            error={formError}
            onSubmit={(values) => void handleSubmit(values)}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>
    </AccountLayout>
  );
}
