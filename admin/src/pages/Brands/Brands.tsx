import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ColumnDef } from '@tanstack/react-table';
import { ROLES } from '@elite/shared';

import {
  ConfirmModal,
  DataTable,
  DEFAULT_TABLE_QUERY,
  Drawer,
  Icon,
  PageHeader,
  Spinner,
  TextField,
  type DataTableQuery,
} from '@/components/ui';
import { RoleGate } from '@/features/auth';
import {
  brandFormSchema,
  slugify,
  useBrands,
  useDeleteBrand,
  useSaveBrand,
  type BrandDTO,
  type BrandFormValues,
} from '@/features/catalog';

const WRITE_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STORE_MANAGER];

const EMPTY: BrandFormValues = { name: '', slug: '', logoUrl: '' };

export default function Brands() {
  const [query, setQuery] = useState<DataTableQuery>(DEFAULT_TABLE_QUERY);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<BrandDTO | null>(null);
  const [pendingDelete, setPendingDelete] = useState<BrandDTO | null>(null);
  const [slugLocked, setSlugLocked] = useState(false);

  const { data: brands, isLoading, isFetching } = useBrands();
  const saveBrand = useSaveBrand();
  const deleteBrand = useDeleteBrand();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<BrandFormValues>({ resolver: zodResolver(brandFormSchema), defaultValues: EMPTY });

  const nameValue = watch('name');
  useEffect(() => {
    if (slugLocked) return;
    setValue('slug', slugify(nameValue ?? ''));
  }, [nameValue, slugLocked, setValue]);

  const openCreate = () => {
    setEditing(null);
    setSlugLocked(false);
    reset(EMPTY);
    setDrawerOpen(true);
  };

  const openEdit = (brand: BrandDTO) => {
    setEditing(brand);
    setSlugLocked(true);
    reset({ name: brand.name, slug: brand.slug, logoUrl: brand.logoUrl ?? '' });
    setDrawerOpen(true);
  };

  const onSubmit = (values: BrandFormValues) => {
    saveBrand.mutate({ id: editing?.id, values }, { onSuccess: () => setDrawerOpen(false) });
  };

  const filtered = useMemo(() => {
    const term = (query.search ?? '').trim().toLowerCase();
    const list = brands ?? [];
    if (!term) return list;
    return list.filter(
      (b) => b.name.toLowerCase().includes(term) || b.slug.toLowerCase().includes(term),
    );
  }, [brands, query.search]);

  const paged = useMemo(() => {
    const start = (query.page - 1) * query.pageSize;
    return filtered.slice(start, start + query.pageSize);
  }, [filtered, query.page, query.pageSize]);

  const columns = useMemo<ColumnDef<BrandDTO>[]>(
    () => [
      {
        id: 'logo',
        header: '',
        enableSorting: false,
        size: 56,
        cell: ({ row }) =>
          row.original.logoUrl ? (
            <img
              src={row.original.logoUrl}
              alt=""
              style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 6 }}
            />
          ) : (
            <span
              className="d-inline-flex align-items-center justify-content-center text-muted-2"
              style={{ width: 36, height: 36, borderRadius: 6, background: 'var(--surface-2, #f1f1f1)' }}
            >
              <Icon name="tag" size={16} />
            </span>
          ),
      },
      { accessorKey: 'name', header: 'Brand', enableSorting: false },
      { accessorKey: 'slug', header: 'Slug', enableSorting: false },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        size: 96,
        cell: ({ row }) => (
          <RoleGate allow={WRITE_ROLES}>
            <div className="d-flex align-items-center gap-1">
              <button
                type="button"
                className="app-icon-btn"
                aria-label="Edit brand"
                onClick={() => openEdit(row.original)}
              >
                <Icon name="sliders" size={16} />
              </button>
              <button
                type="button"
                className="app-icon-btn text-danger"
                aria-label="Delete brand"
                onClick={() => setPendingDelete(row.original)}
              >
                <Icon name="close" size={16} />
              </button>
            </div>
          </RoleGate>
        ),
      },
    ],
    [],
  );

  return (
    <>
      <PageHeader
        title="Brands"
        subtitle="Manage product brands"
        actions={
          <RoleGate allow={WRITE_ROLES}>
            <button className="btn btn-primary" onClick={openCreate}>
              <Icon name="plus" size={16} /> New brand
            </button>
          </RoleGate>
        }
      />

      <DataTable
        columns={columns}
        data={paged}
        total={filtered.length}
        query={query}
        onQueryChange={setQuery}
        loading={isLoading}
        isFetching={isFetching}
        searchPlaceholder="Search brands…"
      />

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? 'Edit brand' : 'New brand'}
        footer={
          <div className="d-flex justify-content-end gap-2">
            <button type="button" className="btn btn-light" onClick={() => setDrawerOpen(false)}>
              Cancel
            </button>
            <RoleGate allow={WRITE_ROLES}>
              <button
                type="submit"
                form="brand-form"
                className="btn btn-primary"
                disabled={saveBrand.isPending}
              >
                {saveBrand.isPending ? <Spinner size="sm" /> : 'Save'}
              </button>
            </RoleGate>
          </div>
        }
      >
        <form id="brand-form" onSubmit={handleSubmit(onSubmit)}>
          <TextField id="brand-name" label="Name" required error={errors.name} {...register('name')} />
          <TextField
            id="brand-slug"
            label="Slug"
            required
            error={errors.slug}
            {...register('slug')}
            onInput={() => setSlugLocked(true)}
          />
          <TextField id="brand-logo" label="Logo URL" error={errors.logoUrl} {...register('logoUrl')} />
        </form>
      </Drawer>

      <ConfirmModal
        open={pendingDelete !== null}
        tone="danger"
        title="Delete brand"
        message={
          <>
            Delete <strong>{pendingDelete?.name}</strong>?
          </>
        }
        confirmLabel="Delete"
        loading={deleteBrand.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) return;
          deleteBrand.mutate(pendingDelete.id, { onSuccess: () => setPendingDelete(null) });
        }}
      />
    </>
  );
}
