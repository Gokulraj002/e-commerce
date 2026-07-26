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
  SelectField,
  Spinner,
  TextField,
  type DataTableQuery,
} from '@/components/ui';
import { RoleGate } from '@/features/auth';
import {
  categoryFormSchema,
  slugify,
  useCategories,
  useDeleteCategory,
  useSaveCategory,
  type CategoryFormValues,
  type FlatCategory,
} from '@/features/catalog';

const WRITE_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STORE_MANAGER];

const EMPTY: CategoryFormValues = { name: '', slug: '', parentId: '', imageUrl: '', sortOrder: 0 };

export default function Categories() {
  const [query, setQuery] = useState<DataTableQuery>(DEFAULT_TABLE_QUERY);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<FlatCategory | null>(null);
  const [pendingDelete, setPendingDelete] = useState<FlatCategory | null>(null);
  const [slugLocked, setSlugLocked] = useState(false);

  const { data: categories, isLoading, isFetching } = useCategories();
  const saveCategory = useSaveCategory();
  const deleteCategory = useDeleteCategory();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CategoryFormValues>({ resolver: zodResolver(categoryFormSchema), defaultValues: EMPTY });

  // Auto-slug from name until the user edits the slug.
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

  const openEdit = (cat: FlatCategory) => {
    setEditing(cat);
    setSlugLocked(true);
    reset({
      name: cat.name,
      slug: cat.slug,
      parentId: cat.parentId ?? '',
      imageUrl: cat.imageUrl ?? '',
      sortOrder: cat.sortOrder,
    });
    setDrawerOpen(true);
  };

  const onSubmit = (values: CategoryFormValues) => {
    saveCategory.mutate(
      { id: editing?.id, values },
      { onSuccess: () => setDrawerOpen(false) },
    );
  };

  // Client-side search + pagination over the (small) category list.
  const filtered = useMemo(() => {
    const term = (query.search ?? '').trim().toLowerCase();
    const list = categories ?? [];
    if (!term) return list;
    return list.filter(
      (c) => c.name.toLowerCase().includes(term) || c.slug.toLowerCase().includes(term),
    );
  }, [categories, query.search]);

  const paged = useMemo(() => {
    const start = (query.page - 1) * query.pageSize;
    return filtered.slice(start, start + query.pageSize);
  }, [filtered, query.page, query.pageSize]);

  const columns = useMemo<ColumnDef<FlatCategory>[]>(
    () => [
      {
        id: 'name',
        header: 'Category',
        enableSorting: false,
        cell: ({ row }) => (
          <span style={{ paddingLeft: row.original.depth * 16 }}>
            {row.original.depth > 0 && <span className="text-muted-2">↳ </span>}
            {row.original.name}
          </span>
        ),
      },
      { accessorKey: 'slug', header: 'Slug', enableSorting: false },
      { accessorKey: 'sortOrder', header: 'Sort', enableSorting: false },
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
                aria-label="Edit category"
                onClick={() => openEdit(row.original)}
              >
                <Icon name="sliders" size={16} />
              </button>
              <button
                type="button"
                className="app-icon-btn text-danger"
                aria-label="Delete category"
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

  const parentOptions = (categories ?? []).filter((c) => c.id !== editing?.id);

  return (
    <>
      <PageHeader
        title="Categories"
        subtitle="Organize products into categories"
        actions={
          <RoleGate allow={WRITE_ROLES}>
            <button className="btn btn-primary" onClick={openCreate}>
              <Icon name="plus" size={16} /> New category
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
        searchPlaceholder="Search categories…"
      />

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? 'Edit category' : 'New category'}
        footer={
          <div className="d-flex justify-content-end gap-2">
            <button type="button" className="btn btn-light" onClick={() => setDrawerOpen(false)}>
              Cancel
            </button>
            <RoleGate allow={WRITE_ROLES}>
              <button
                type="submit"
                form="category-form"
                className="btn btn-primary"
                disabled={saveCategory.isPending}
              >
                {saveCategory.isPending ? <Spinner size="sm" /> : 'Save'}
              </button>
            </RoleGate>
          </div>
        }
      >
        <form id="category-form" onSubmit={handleSubmit(onSubmit)}>
          <TextField id="cat-name" label="Name" required error={errors.name} {...register('name')} />
          <TextField
            id="cat-slug"
            label="Slug"
            required
            error={errors.slug}
            {...register('slug')}
            onInput={() => setSlugLocked(true)}
          />
          <SelectField id="cat-parent" label="Parent" error={errors.parentId} {...register('parentId')}>
            <option value="">None (top level)</option>
            {parentOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {`${'— '.repeat(c.depth)}${c.name}`}
              </option>
            ))}
          </SelectField>
          <TextField id="cat-image" label="Image URL" error={errors.imageUrl} {...register('imageUrl')} />
          <TextField
            id="cat-sort"
            label="Sort order"
            type="number"
            min="0"
            error={errors.sortOrder}
            {...register('sortOrder')}
          />
        </form>
      </Drawer>

      <ConfirmModal
        open={pendingDelete !== null}
        tone="danger"
        title="Delete category"
        message={
          <>
            Delete <strong>{pendingDelete?.name}</strong>? Categories with sub-categories cannot be
            removed.
          </>
        }
        confirmLabel="Delete"
        loading={deleteCategory.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) return;
          deleteCategory.mutate(pendingDelete.id, { onSuccess: () => setPendingDelete(null) });
        }}
      />
    </>
  );
}
