import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useFieldArray, useForm, useWatch, type Control } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ROLES, WEIGHT_PACKS_G, type ProductVariantDTO } from '@elite/shared';

import {
  ConfirmModal,
  Icon,
  PageHeader,
  SelectField,
  Spinner,
  StatusBadge,
  TextField,
  TextareaField,
} from '@/components/ui';
import { RoleGate } from '@/features/auth';
import { ROUTES } from '@/routes/paths';
import { formatPaise, formatWeight, paiseToRupees, rupeesToPaise } from '@/lib/money';
import {
  productFormSchema,
  slugify,
  useBrands,
  useCategories,
  useCreateProduct,
  useDeleteProduct,
  useProduct,
  useUpdateProduct,
  type ProductFormValues,
} from '@/features/catalog';

const WRITE_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STORE_MANAGER];
const DELETE_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN];

const EMPTY_DEFAULTS: ProductFormValues = {
  name: '',
  slug: '',
  categoryId: '',
  brandId: '',
  shortDesc: '',
  description: '',
  tags: '',
  isReadyToCook: false,
  isFeatured: false,
  images: [],
  variants: [{ weightG: 500, mrpRupees: 0, priceRupees: 0 }],
};

// ── Section (title/description on the left, fields on the right) ────

function Section({
  title,
  description,
  aside,
  children,
}: {
  title: string;
  description?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="card mb-3">
      <div className="card-body">
        <div className="row g-4">
          <div className="col-12 col-md-4">
            <h3
              className="mb-1"
              style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-strong)' }}
            >
              {title}
            </h3>
            {description && (
              <p
                className="mb-0"
                style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.45 }}
              >
                {description}
              </p>
            )}
            {aside && <div className="mt-2">{aside}</div>}
          </div>
          <div className="col-12 col-md-8">
            <div className="d-flex flex-column">{children}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Preview panel (mirrors the customer ProductCard) ────────────────

function pricePartsFromVariants(
  variants: Array<Pick<ProductFormValues['variants'][number], 'priceRupees' | 'mrpRupees'>>,
): { text: string; hasRange: boolean } {
  const active = variants.filter((v) => Number(v.priceRupees) > 0);
  if (!active.length) return { text: '—', hasRange: false };
  const prices = active.map((v) => rupeesToPaise(Number(v.priceRupees)));
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max
    ? { text: formatPaise(min), hasRange: false }
    : { text: `${formatPaise(min)} – ${formatPaise(max)}`, hasRange: true };
}

interface PreviewProps {
  control: Control<ProductFormValues>;
  categoryLabel: string | null;
  brandLabel: string | null;
}

function PreviewPanel({ control, categoryLabel, brandLabel }: PreviewProps) {
  // useWatch scopes re-renders to the preview only, not the whole form.
  const values = useWatch({ control });
  const name = values.name || 'New product';
  const shortDesc = values.shortDesc || '';
  const firstImage = values.images?.[0]?.url ?? '';
  const variantRows = (values.variants ?? []) as ProductFormValues['variants'];
  const price = pricePartsFromVariants(variantRows);
  const tags = (values.tags ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  return (
    <div
      className="card"
      style={{ overflow: 'hidden', border: '1px solid var(--border)' }}
    >
      <div
        className="card-body"
        style={{ padding: '0.75rem 0.75rem 0.9rem' }}
      >
        <div
          className="mb-2 d-flex align-items-center justify-content-between"
          style={{
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            fontSize: '0.7rem',
            fontWeight: 700,
            color: 'var(--text-muted)',
          }}
        >
          <span>Preview</span>
          <span
            className="d-inline-flex align-items-center gap-1"
            style={{ letterSpacing: 0, textTransform: 'none' }}
          >
            <Icon name="image" size={12} /> Customer view
          </span>
        </div>

        <div
          style={{
            width: '100%',
            aspectRatio: '4 / 3',
            borderRadius: 10,
            overflow: 'hidden',
            background: 'var(--bg-muted)',
            border: '1px solid var(--border-hairline, var(--border))',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          {firstImage ? (
            <img
              src={firstImage}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
              }}
            />
          ) : (
            <span className="text-muted-2 d-inline-flex flex-column align-items-center gap-1 small">
              <Icon name="image" size={26} />
              <span>Add an image URL</span>
            </span>
          )}
        </div>

        <div className="mt-3">
          {categoryLabel && (
            <div
              className="small mb-1"
              style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.7rem' }}
            >
              {categoryLabel}
              {brandLabel ? ` · ${brandLabel}` : ''}
            </div>
          )}
          <div
            className="fw-bold"
            style={{ fontSize: '1.05rem', color: 'var(--text-strong)', lineHeight: 1.3 }}
          >
            {name}
          </div>
          {shortDesc && (
            <p className="small mb-0 mt-1" style={{ color: 'var(--text-muted)', lineHeight: 1.4 }}>
              {shortDesc}
            </p>
          )}

          <div
            className="mt-2 d-flex align-items-baseline gap-2"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            <span
              style={{
                fontWeight: 700,
                fontSize: '1.1rem',
                color: 'var(--text-strong)',
              }}
            >
              {price.text}
            </span>
            {price.hasRange && (
              <span className="small" style={{ color: 'var(--text-muted)' }}>
                per pack
              </span>
            )}
          </div>

          {(values.isFeatured || values.isReadyToCook || tags.length > 0) && (
            <div className="mt-2 d-flex flex-wrap gap-1">
              {values.isFeatured && <StatusBadge status="FEATURED" tone="warning" />}
              {values.isReadyToCook && <StatusBadge status="READY_TO_COOK" tone="info" />}
              {tags.slice(0, 3).map((t) => (
                <StatusBadge key={t} status={t.toUpperCase()} tone="neutral" />
              ))}
              {tags.length > 3 && <StatusBadge status={`+${tags.length - 3}`} tone="neutral" />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────

export default function ProductForm() {
  const navigate = useNavigate();
  // The edit route param carries the product SLUG (GET is by slug); the real id
  // comes from the fetched detail and is used for PATCH / variant / image calls.
  const { id: slug } = useParams();
  const isEdit = Boolean(slug);

  const { data: product, isLoading: loadingProduct } = useProduct(slug);
  const { data: categories } = useCategories();
  const { data: brands } = useBrands();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const [slugLocked, setSlugLocked] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: EMPTY_DEFAULTS,
  });

  const variants = useFieldArray({ control, name: 'variants', keyName: 'key' });
  const images = useFieldArray({ control, name: 'images', keyName: 'key' });

  // Hydrate the form once the product detail arrives (edit mode).
  useEffect(() => {
    if (!product) return;
    setSlugLocked(true);
    reset({
      name: product.name,
      slug: product.slug,
      categoryId: product.categoryId,
      brandId: product.brandId ?? '',
      shortDesc: product.shortDesc ?? '',
      description: product.description ?? '',
      tags: product.tags.join(', '),
      isReadyToCook: product.isReadyToCook,
      // The product-detail payload does not expose isFeatured; it defaults to
      // off here and is set explicitly by the toggle.
      isFeatured: false,
      images: product.images.map((url) => ({ url })),
      variants: product.variants.map((v: ProductVariantDTO) => ({
        id: v.id,
        weightG: v.weightG,
        mrpRupees: paiseToRupees(v.mrpPaise),
        priceRupees: paiseToRupees(v.pricePaise),
      })),
    });
  }, [product, reset]);

  // Auto-derive the slug from the name until the user edits the slug (create only).
  const nameValue = watch('name');
  useEffect(() => {
    if (isEdit || slugLocked) return;
    setValue('slug', slugify(nameValue ?? ''));
  }, [nameValue, isEdit, slugLocked, setValue]);

  // Watch categoryId / brandId so the preview eyebrow updates live.
  const categoryIdValue = watch('categoryId');
  const brandIdValue = watch('brandId');
  const categoryLabel =
    (categories ?? []).find((c) => c.id === categoryIdValue)?.name ?? null;
  const brandLabel = (brands ?? []).find((b) => b.id === brandIdValue)?.name ?? null;

  const onSubmit = (values: ProductFormValues) => {
    if (isEdit && product) {
      updateProduct.mutate(
        { values, existing: product },
        { onSuccess: () => navigate(ROUTES.products) },
      );
    } else {
      createProduct.mutate(values, { onSuccess: () => navigate(ROUTES.products) });
    }
  };

  const saving = createProduct.isPending || updateProduct.isPending;

  if (isEdit && loadingProduct) {
    return (
      <div className="d-flex justify-content-center py-5">
        <Spinner label="Loading product…" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <PageHeader
        title={isEdit ? 'Edit product' : 'New product'}
        subtitle={
          isEdit
            ? (product?.name ?? 'Update product details, media and variants')
            : 'Add a product to the catalog'
        }
        actions={
          <RoleGate allow={WRITE_ROLES}>
            <button
              type="button"
              className="btn btn-light"
              onClick={() => navigate(ROUTES.products)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <Spinner size="sm" /> : isEdit ? 'Save changes' : 'Save product'}
            </button>
          </RoleGate>
        }
      />

      <div className="row g-3">
        {/* Main column */}
        <div className="col-12 col-xl-8">
          <Section
            title="Basics"
            description="Name your product and pick the URL slug customers will see."
          >
            <TextField
              id="name"
              label="Name"
              placeholder="e.g. Farm-fresh chicken breast"
              required
              error={errors.name}
              maxChars={160}
              autoFocus={!isEdit}
              {...register('name')}
            />
            <TextField
              id="slug"
              label="Slug"
              required
              hint="Auto-derived from the name; click to override."
              leadingIcon={<span style={{ color: 'var(--text-muted)' }}>/</span>}
              error={errors.slug}
              {...register('slug')}
              onInput={() => setSlugLocked(true)}
            />
            <TextareaField
              id="shortDesc"
              label="Short description"
              hint="One line that appears under the product name on cards."
              rows={2}
              autoGrow
              maxRows={4}
              maxChars={280}
              error={errors.shortDesc}
              {...register('shortDesc')}
            />
          </Section>

          <Section
            title="Description"
            description="A longer story about the cut, sourcing, and how to cook it. Line breaks are preserved."
          >
            <TextareaField
              id="description"
              label="Full description"
              rows={6}
              autoGrow
              maxRows={16}
              maxChars={4000}
              placeholder="Tell customers about freshness, sourcing, prep tips…"
              error={errors.description}
              {...register('description')}
            />
          </Section>

          <Section
            title="Classification"
            description="Category and brand power discovery; flags surface as badges on the storefront."
          >
            <div className="row g-3">
              <div className="col-12 col-sm-6">
                <SelectField
                  id="categoryId"
                  label="Category"
                  required
                  error={errors.categoryId}
                  {...register('categoryId')}
                >
                  <option value="">Select a category…</option>
                  {(categories ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {`${'— '.repeat(c.depth)}${c.name}`}
                    </option>
                  ))}
                </SelectField>
              </div>
              <div className="col-12 col-sm-6">
                <SelectField
                  id="brandId"
                  label="Brand"
                  error={errors.brandId}
                  {...register('brandId')}
                >
                  <option value="">No brand</option>
                  {(brands ?? []).map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </SelectField>
              </div>
            </div>
            <TextField
              id="tags"
              label="Tags"
              hint="Comma-separated — e.g. chicken, boneless, fresh"
              error={errors.tags}
              {...register('tags')}
            />
            <div
              className="mt-1 p-3"
              style={{
                background: 'var(--bg-muted)',
                border: '1px solid var(--border-hairline, var(--border))',
                borderRadius: 10,
                display: 'flex',
                flexWrap: 'wrap',
                gap: '1.25rem',
              }}
            >
              <label className="form-check mb-0">
                <input
                  className="form-check-input"
                  type="checkbox"
                  {...register('isReadyToCook')}
                />
                <span className="form-check-label small fw-medium">Ready to cook</span>
                <div className="small" style={{ color: 'var(--text-muted)' }}>
                  Marinated / cleaned — ready for the pan.
                </div>
              </label>
              <label className="form-check mb-0">
                <input
                  className="form-check-input"
                  type="checkbox"
                  {...register('isFeatured')}
                />
                <span className="form-check-label small fw-medium">Featured</span>
                <div className="small" style={{ color: 'var(--text-muted)' }}>
                  Pin to home page hero rails.
                </div>
              </label>
            </div>
          </Section>

          <Section
            title="Media"
            description="Paste hosted image URLs — first image is used as the product thumbnail."
            aside={
              <button
                type="button"
                className="btn btn-sm btn-light"
                onClick={() => images.append({ url: '' })}
              >
                <Icon name="plus" size={14} /> Add image URL
              </button>
            }
          >
            {images.fields.length === 0 && (
              <div
                className="text-center small py-4"
                style={{
                  color: 'var(--text-muted)',
                  border: '1px dashed var(--border)',
                  borderRadius: 10,
                }}
              >
                No images yet. Add an image URL to see it here.
              </div>
            )}

            <div className="d-flex flex-column gap-2">
              {images.fields.map((field, i) => (
                <div key={field.key}>
                  <div className="d-flex align-items-center gap-2">
                    <span
                      className="text-muted-2 small text-center"
                      style={{ width: 24, flex: '0 0 auto' }}
                    >
                      {i + 1}
                    </span>
                    <input
                      type="url"
                      placeholder="https://…"
                      className={`form-control form-control-sm ${errors.images?.[i]?.url ? 'is-invalid' : ''}`}
                      {...register(`images.${i}.url`)}
                    />
                    <button
                      type="button"
                      className="app-icon-btn text-danger"
                      aria-label="Remove image"
                      onClick={() => images.remove(i)}
                    >
                      <Icon name="close" size={16} />
                    </button>
                  </div>
                  {errors.images?.[i]?.url && (
                    <div className="ui-field__error ps-4">
                      {errors.images[i]?.url?.message}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Section>

          <Section
            title="Variants"
            description="Every product is sold by pack weight. Add at least one variant with its MRP and selling price."
            aside={
              <button
                type="button"
                className="btn btn-sm btn-light"
                onClick={() =>
                  variants.append({ weightG: 500, mrpRupees: 0, priceRupees: 0 })
                }
              >
                <Icon name="plus" size={14} /> Add variant
              </button>
            }
          >
            {typeof errors.variants?.message === 'string' && (
              <div className="ui-field__error mb-2">{errors.variants.message}</div>
            )}

            <div className="d-flex flex-column gap-2">
              {variants.fields.map((field, i) => (
                <div
                  key={field.key}
                  className="d-flex align-items-start flex-wrap gap-2 p-2"
                  style={{
                    background: 'var(--bg-body)',
                    border: '1px solid var(--border-hairline, var(--border))',
                    borderRadius: 10,
                  }}
                >
                  <div style={{ width: 120, flex: '0 0 auto' }}>
                    <select
                      className={`form-select form-select-sm ${errors.variants?.[i]?.weightG ? 'is-invalid' : ''}`}
                      {...register(`variants.${i}.weightG`)}
                      aria-label="Pack weight"
                    >
                      {WEIGHT_PACKS_G.map((w) => (
                        <option key={w} value={w}>
                          {formatWeight(w)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-grow-1" style={{ minWidth: 140 }}>
                    <div className="input-group input-group-sm">
                      <span className="input-group-text">MRP&nbsp;₹</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className={`form-control ${errors.variants?.[i]?.mrpRupees ? 'is-invalid' : ''}`}
                        style={{ fontVariantNumeric: 'tabular-nums' }}
                        {...register(`variants.${i}.mrpRupees`)}
                      />
                    </div>
                  </div>
                  <div className="flex-grow-1" style={{ minWidth: 140 }}>
                    <div className="input-group input-group-sm">
                      <span className="input-group-text">Price&nbsp;₹</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className={`form-control ${errors.variants?.[i]?.priceRupees ? 'is-invalid' : ''}`}
                        style={{ fontVariantNumeric: 'tabular-nums' }}
                        {...register(`variants.${i}.priceRupees`)}
                      />
                    </div>
                    {errors.variants?.[i]?.priceRupees && (
                      <div className="ui-field__error">
                        {errors.variants[i]?.priceRupees?.message}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className="app-icon-btn text-danger"
                    aria-label="Remove variant"
                    disabled={variants.fields.length <= 1}
                    onClick={() => variants.remove(i)}
                  >
                    <Icon name="close" size={16} />
                  </button>
                </div>
              ))}
            </div>
          </Section>
        </div>

        {/* Preview sidebar (xl+) */}
        <aside className="d-none d-xl-block col-xl-4">
          <div
            style={{
              position: 'sticky',
              top: 'calc(var(--topbar-height, 60px) + 1rem)',
            }}
          >
            <PreviewPanel
              control={control}
              categoryLabel={categoryLabel}
              brandLabel={brandLabel}
            />
            {isDirty && (
              <div
                className="mt-2 small text-center"
                style={{ color: 'var(--text-muted)' }}
              >
                Unsaved changes
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Sticky footer */}
      <div
        className="mt-3"
        style={{
          position: 'sticky',
          bottom: '0.5rem',
          zIndex: 5,
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '0.6rem 0.9rem',
          boxShadow: 'var(--shadow-md, 0 6px 24px rgba(0,0,0,0.08))',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        {isEdit && (
          <RoleGate allow={DELETE_ROLES}>
            <button
              type="button"
              className="btn btn-sm btn-outline-danger"
              onClick={() => setPendingDelete(true)}
              disabled={saving || deleteProduct.isPending}
            >
              <Icon name="close" size={14} /> Delete product
            </button>
          </RoleGate>
        )}
        <div className="ms-auto d-flex align-items-center gap-2">
          {isDirty && !saving && (
            <span className="small" style={{ color: 'var(--text-muted)' }}>
              Unsaved changes
            </span>
          )}
          <button
            type="button"
            className="btn btn-sm btn-light"
            onClick={() => navigate(ROUTES.products)}
            disabled={saving}
          >
            Cancel
          </button>
          <RoleGate allow={WRITE_ROLES}>
            <button type="submit" className="btn btn-sm btn-primary" disabled={saving}>
              {saving ? <Spinner size="sm" /> : isEdit ? 'Save changes' : 'Save product'}
            </button>
          </RoleGate>
        </div>
      </div>

      <ConfirmModal
        open={pendingDelete}
        tone="danger"
        title="Delete product"
        message={
          <>
            Permanently delete <strong>{product?.name}</strong>? This removes it from the
            catalog and cannot be undone.
          </>
        }
        confirmLabel="Delete"
        loading={deleteProduct.isPending}
        onCancel={() => setPendingDelete(false)}
        onConfirm={() => {
          if (!product) return;
          deleteProduct.mutate(product.id, {
            onSuccess: () => {
              setPendingDelete(false);
              navigate(ROUTES.products);
            },
          });
        }}
      />
    </form>
  );
}
