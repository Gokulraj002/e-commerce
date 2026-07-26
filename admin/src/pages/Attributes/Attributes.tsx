import { useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ROLES } from '@elite/shared';

import {
  Drawer,
  EmptyState,
  ErrorState,
  PageHeader,
  Spinner,
  TextField,
} from '@/components/ui';
import { RoleGate } from '@/features/auth';
import {
  attributeFormSchema,
  useAttributes,
  useCreateAttribute,
  type AttributeFormValues,
} from '@/features/catalog';
import { getApiErrorMessage } from '@/lib/apiClient';

const ADMIN_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STORE_MANAGER];

export default function Attributes() {
  const { data, isLoading, isError, error, refetch } = useAttributes();
  const create = useCreateAttribute();
  const [open, setOpen] = useState(false);

  const openCreate = () => setOpen(true);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AttributeFormValues>({
    resolver: zodResolver(attributeFormSchema),
    defaultValues: { name: '', values: [{ value: '' }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'values' });

  const onSubmit = handleSubmit(async (values) => {
    await create.mutateAsync(values);
    reset({ name: '', values: [{ value: '' }] });
    setOpen(false);
  });

  return (
    <>
      <PageHeader
        title="Attributes"
        subtitle="Product options like Cut, Bone type, Spice level."
        actions={
          <RoleGate allow={ADMIN_ROLES}>
            <button type="button" className="btn btn-primary" onClick={openCreate}>+ New attribute</button>
          </RoleGate>
        }
      />

      {isError && (
        <ErrorState
          title="Couldn't load attributes"
          message={getApiErrorMessage(error)}
          onRetry={() => refetch()}
        />
      )}

      {isLoading ? (
        <div className="d-flex justify-content-center py-5">
          <Spinner label="Loading attributes…" />
        </div>
      ) : (data ?? []).length === 0 ? (
        <EmptyState
          icon="tag"
          title="No attributes defined yet"
          message="Attributes like Cut, Bone type or Spice level power product variants."
          action={
            <RoleGate allow={ADMIN_ROLES}>
              <button type="button" className="btn btn-primary" onClick={openCreate}>
                + New attribute
              </button>
            </RoleGate>
          }
        />
      ) : (
        <div className="row g-3">
          {(data ?? []).map((a) => (
            <div className="col-12 col-md-6 col-lg-4" key={a.id}>
              <div className="card h-100">
                <div className="card-body">
                  <div className="fw-semibold">{a.name}</div>
                  <div className="d-flex flex-wrap gap-1 mt-2">
                    {a.values.map((v) => (
                      <span
                        key={v.id}
                        className="badge text-bg-light border"
                        style={{ fontWeight: 500 }}
                      >
                        {v.value}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Drawer open={open} onClose={() => setOpen(false)} title="New attribute">
        <form onSubmit={onSubmit} className="d-flex flex-column gap-3">
          <TextField label="Name" placeholder="e.g. Cut" {...register('name')} error={errors.name} />
          <div>
            <label className="form-label">Values</label>
            <div className="d-flex flex-column gap-2">
              {fields.map((f, i) => (
                <div className="d-flex gap-2" key={f.id}>
                  <input
                    className="form-control"
                    placeholder="e.g. Curry cut"
                    aria-label={`Value ${i + 1}`}
                    {...register(`values.${i}.value` as const)}
                  />
                  <button
                    type="button"
                    className="btn btn-outline-danger"
                    onClick={() => remove(i)}
                    disabled={fields.length === 1}
                    aria-label={`Remove value ${i + 1}`}
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary align-self-start"
                onClick={() => append({ value: '' })}
              >
                + Add value
              </button>
              {errors.values && (
                <div className="text-danger small mt-1">
                  {(errors.values as { message?: string })?.message}
                </div>
              )}
            </div>
          </div>
          <div className="d-flex justify-content-end gap-2 mt-2">
            <button type="button" className="btn btn-outline-secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={create.isPending}>
              Create attribute
            </button>
          </div>
        </form>
      </Drawer>
    </>
  );
}
