import { useMemo, useState } from 'react';
import { ROLES } from '@elite/shared';

import {
  ConfirmModal,
  Drawer,
  EmptyState,
  ErrorState,
  Icon,
  PageHeader,
  SelectField,
  Spinner,
  StatusBadge,
  TextField,
} from '@/components/ui';
import { RoleGate } from '@/features/auth';
import {
  useBanners,
  useDeleteBanner,
  useSaveBanner,
  type BannerDTO,
} from '@/features/ops';
import { getApiErrorMessage } from '@/lib/apiClient';

const ADMIN_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STORE_MANAGER];

const POSITIONS = [
  { value: 'HOME_HERO', label: 'Home hero' },
  { value: 'HOME_STRIP', label: 'Home strip' },
  { value: 'CATEGORY_TOP', label: 'Category top' },
] as const;

function positionLabel(value: string): string {
  return POSITIONS.find((p) => p.value === value)?.label ?? value;
}

interface FormState {
  title: string;
  imageUrl: string;
  link: string;
  position: string;
  sortOrder: string;
  isActive: boolean;
}
const EMPTY: FormState = {
  title: '',
  imageUrl: '',
  link: '',
  position: 'HOME_HERO',
  sortOrder: '0',
  isActive: true,
};

export default function Banners() {
  const { data, isLoading, isError, error, refetch } = useBanners();
  const save = useSaveBanner();
  const remove = useDeleteBanner();

  const [editing, setEditing] = useState<BannerDTO | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [toDelete, setToDelete] = useState<BannerDTO | null>(null);
  const [positionFilter, setPositionFilter] = useState<string>('all');

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setDrawerOpen(true);
  }
  function openEdit(b: BannerDTO) {
    setEditing(b);
    setForm({
      title: b.title ?? '',
      imageUrl: b.imageUrl,
      link: b.link ?? '',
      position: b.position,
      sortOrder: String(b.sortOrder),
      isActive: b.isActive,
    });
    setDrawerOpen(true);
  }
  async function onSave() {
    await save.mutateAsync({
      id: editing?.id,
      body: {
        title: form.title.trim() || null,
        imageUrl: form.imageUrl.trim(),
        link: form.link.trim() || null,
        position: form.position,
        sortOrder: Number(form.sortOrder) || 0,
        isActive: form.isActive,
      },
    });
    setDrawerOpen(false);
  }

  const banners = data ?? [];
  // TODO: drag-to-reorder — bind onDragEnd → save.mutate with new sortOrder.
  const filtered = useMemo(() => {
    return positionFilter === 'all'
      ? banners
      : banners.filter((b) => b.position === positionFilter);
  }, [banners, positionFilter]);

  return (
    <>
      <PageHeader
        title="Banners"
        subtitle="Hero and promo banners rendered on the storefront."
        actions={
          <RoleGate allow={ADMIN_ROLES}>
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              + New banner
            </button>
          </RoleGate>
        }
      />

      {isError && (
        <ErrorState
          title="Couldn't load banners"
          message={getApiErrorMessage(error)}
          onRetry={() => refetch()}
        />
      )}

      {isLoading ? (
        <div className="d-flex justify-content-center py-5">
          <Spinner label="Loading banners…" />
        </div>
      ) : banners.length === 0 ? (
        <EmptyState
          icon="image"
          title="No banners yet"
          message="Publish hero, strip, or category banners for the storefront."
          action={
            <RoleGate allow={ADMIN_ROLES}>
              <button type="button" className="btn btn-primary" onClick={openCreate}>
                + New banner
              </button>
            </RoleGate>
          }
        />
      ) : (
        <>
          <div className="ui-filter-strip">
            <div className="d-flex align-items-center gap-2">
              <label
                htmlFor="banner-position-filter"
                className="text-muted-2 small mb-0"
              >
                Position
              </label>
              <select
                id="banner-position-filter"
                className="form-select form-select-sm"
                style={{ width: 'auto' }}
                value={positionFilter}
                onChange={(e) => setPositionFilter(e.target.value)}
              >
                <option value="all">All positions</option>
                {POSITIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="ui-filter-strip__spacer" />
            <span className="text-muted-2 small tabular">
              {filtered.length} of {banners.length}
            </span>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon="image"
              title="No banners in this position"
              message="Switch position or add a new banner for this slot."
              compact
            />
          ) : (
            <div className="ui-entity-grid">
              {filtered.map((b) => (
                <div className="ui-entity-card" key={b.id} style={{ padding: 0, minHeight: 0 }}>
                  {b.imageUrl ? (
                    <img
                      src={b.imageUrl}
                      alt={b.title ?? `${b.position} banner`}
                      style={{
                        width: '100%',
                        height: 180,
                        objectFit: 'cover',
                        borderTopLeftRadius: 'var(--radius)',
                        borderTopRightRadius: 'var(--radius)',
                      }}
                    />
                  ) : (
                    <div
                      className="d-flex align-items-center justify-content-center"
                      style={{
                        height: 180,
                        background: 'var(--bg-muted)',
                        color: 'var(--text-muted)',
                        borderTopLeftRadius: 'var(--radius)',
                        borderTopRightRadius: 'var(--radius)',
                      }}
                      aria-hidden="true"
                    >
                      <Icon name="image" size={28} />
                    </div>
                  )}
                  <div
                    style={{
                      padding: '1rem 1.15rem 1.05rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.7rem',
                    }}
                  >
                    <div className="ui-entity-card__head">
                      <div className="min-w-0">
                        <h3 className="ui-entity-card__title">{b.title ?? 'Untitled banner'}</h3>
                        <div className="text-muted-2 small mt-1">
                          {positionLabel(b.position)} · <span className="tabular">#{b.sortOrder}</span>
                        </div>
                      </div>
                      <StatusBadge
                        status={b.isActive ? 'ACTIVE' : 'INACTIVE'}
                        tone={b.isActive ? 'success' : 'neutral'}
                      />
                    </div>
                    {b.link && (
                      <div className="ui-entity-card__row">
                        <span className="ui-entity-card__row-icon">
                          <Icon name="chevron-right" size={13} />
                        </span>
                        <span className="ui-entity-card__row-text text-truncate">{b.link}</span>
                      </div>
                    )}
                    <RoleGate allow={ADMIN_ROLES}>
                      <div className="ui-entity-card__actions is-static">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => openEdit(b)}
                          aria-label={`Edit ${b.title ?? 'banner'}`}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => setToDelete(b)}
                          aria-label={`Delete ${b.title ?? 'banner'}`}
                        >
                          Delete
                        </button>
                      </div>
                    </RoleGate>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? 'Edit banner' : 'New banner'}
      >
        <div className="d-flex flex-column gap-3">
          <TextField label="Title (optional)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <TextField label="Image URL" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} />
          <TextField label="Link (optional)" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} />
          <SelectField label="Position" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })}>
            {POSITIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </SelectField>
          <TextField label="Sort order" type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} />
          <div className="form-check">
            <input
              className="form-check-input"
              type="checkbox"
              id="b-active"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            <label className="form-check-label" htmlFor="b-active">Active</label>
          </div>
          <div className="d-flex justify-content-end gap-2 mt-2">
            <button className="btn btn-outline-secondary" onClick={() => setDrawerOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={onSave} disabled={save.isPending}>Save</button>
          </div>
        </div>
      </Drawer>

      <ConfirmModal
        open={Boolean(toDelete)}
        title="Delete this banner?"
        message={toDelete ? `"${toDelete.title ?? 'Untitled'}" will be removed.` : ''}
        confirmLabel="Delete"
        tone="danger"
        loading={remove.isPending}
        onConfirm={async () => {
          if (toDelete) await remove.mutateAsync(toDelete.id);
          setToDelete(null);
        }}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}
