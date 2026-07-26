import { useMemo, useState } from 'react';
import { ROLES } from '@elite/shared';

import {
  ConfirmModal,
  Drawer,
  EmptyState,
  ErrorState,
  FilterChip,
  Icon,
  PageHeader,
  Spinner,
  StatusBadge,
  TextField,
  TextareaField,
} from '@/components/ui';
import { RoleGate } from '@/features/auth';
import {
  useCmsPages,
  useDeleteCmsPage,
  useSaveCmsPage,
  type CmsPageDTO,
} from '@/features/ops';
import { getApiErrorMessage } from '@/lib/apiClient';

const ADMIN_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STORE_MANAGER];

interface FormState {
  slug: string;
  title: string;
  content: string;
  isPublished: boolean;
}
const EMPTY: FormState = { slug: '', title: '', content: '', isPublished: true };

type StatusFilter = 'all' | 'published' | 'draft';

function relativeSince(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const diffMs = Date.now() - d.getTime();
  const day = 24 * 60 * 60 * 1000;
  const diffDays = Math.floor(diffMs / day);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

export default function CmsPages() {
  const { data, isLoading, isError, error, refetch } = useCmsPages();
  const save = useSaveCmsPage();
  const remove = useDeleteCmsPage();

  const [editing, setEditing] = useState<CmsPageDTO | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [toDelete, setToDelete] = useState<CmsPageDTO | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setDrawerOpen(true);
  }
  function openEdit(p: CmsPageDTO) {
    setEditing(p);
    setForm({ slug: p.slug, title: p.title, content: p.content, isPublished: p.isPublished });
    setDrawerOpen(true);
  }
  async function onSave() {
    await save.mutateAsync({ id: editing?.id, body: form });
    setDrawerOpen(false);
  }

  const pages = data ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pages.filter((p) => {
      if (statusFilter === 'published' && !p.isPublished) return false;
      if (statusFilter === 'draft' && p.isPublished) return false;
      if (!q) return true;
      return p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q);
    });
  }, [pages, statusFilter, search]);

  const publishedCount = pages.filter((p) => p.isPublished).length;
  const draftCount = pages.length - publishedCount;

  return (
    <>
      <PageHeader
        title="CMS pages"
        subtitle="About, terms, privacy, FAQ — content served publicly at /pages/:slug."
        actions={
          <RoleGate allow={ADMIN_ROLES}>
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              + New page
            </button>
          </RoleGate>
        }
      />

      {isError && (
        <ErrorState
          title="Couldn't load CMS pages"
          message={getApiErrorMessage(error)}
          onRetry={() => refetch()}
        />
      )}

      {isLoading ? (
        <div className="d-flex justify-content-center py-5">
          <Spinner label="Loading pages…" />
        </div>
      ) : pages.length === 0 ? (
        <EmptyState
          icon="file"
          title="No CMS pages yet"
          message="Publish About, FAQ, Terms or Privacy content served from /pages/:slug."
          action={
            <RoleGate allow={ADMIN_ROLES}>
              <button type="button" className="btn btn-primary" onClick={openCreate}>
                + New page
              </button>
            </RoleGate>
          }
        />
      ) : (
        <>
          <div className="ui-filter-strip">
            <div className="ui-filter-strip__search">
              <span className="ui-filter-strip__search-icon" aria-hidden="true">
                <Icon name="search" size={16} />
              </span>
              <input
                type="search"
                className="form-control form-control-sm"
                placeholder="Search by title or slug…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search CMS pages"
              />
            </div>
            <div className="ui-filter-strip__sep" aria-hidden="true" />
            <div className="ui-filter-strip__chips" role="group" aria-label="Status filter">
              <FilterChip
                label={`All (${pages.length})`}
                active={statusFilter === 'all'}
                onClick={() => setStatusFilter('all')}
              />
              <FilterChip
                label={`Published (${publishedCount})`}
                active={statusFilter === 'published'}
                onClick={() => setStatusFilter('published')}
              />
              <FilterChip
                label={`Draft (${draftCount})`}
                active={statusFilter === 'draft'}
                onClick={() => setStatusFilter('draft')}
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon="file"
              title="No pages match those filters"
              message="Try a different search or switch the status chip."
              compact
            />
          ) : (
            <div className="ui-entity-grid">
              {filtered.map((p) => (
                <div className="ui-entity-card" key={p.id}>
                  <div className="ui-entity-card__head">
                    <div className="min-w-0">
                      <h3 className="ui-entity-card__title">{p.title}</h3>
                      <code
                        className="text-muted-2 small text-truncate d-inline-block mt-1"
                        style={{ maxWidth: '100%' }}
                      >
                        /{p.slug}
                      </code>
                    </div>
                    <StatusBadge
                      status={p.isPublished ? 'PUBLISHED' : 'DRAFT'}
                      tone={p.isPublished ? 'success' : 'neutral'}
                    />
                  </div>
                  <div className="ui-entity-card__meta">
                    <div className="ui-entity-card__row">
                      <span className="ui-entity-card__row-icon">
                        <Icon name="clock" size={14} />
                      </span>
                      <span className="ui-entity-card__row-text tabular">
                        Updated {relativeSince(p.updatedAt)}
                      </span>
                    </div>
                  </div>
                  <div className="ui-entity-card__footer">
                    <span className="text-muted-2 small tabular">
                      {new Date(p.updatedAt).toLocaleDateString('en-IN')}
                    </span>
                    <RoleGate allow={ADMIN_ROLES}>
                      <div className="ui-entity-card__actions">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => openEdit(p)}
                          aria-label={`Edit ${p.title}`}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => setToDelete(p)}
                          aria-label={`Delete ${p.title}`}
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
        title={editing ? `Edit ${editing.slug}` : 'New page'}
      >
        <div className="d-flex flex-column gap-3">
          <TextField label="Slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
          <TextField label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <TextareaField
            label="Content"
            rows={12}
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
          />
          <div className="form-check">
            <input
              className="form-check-input"
              type="checkbox"
              id="cms-pub"
              checked={form.isPublished}
              onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
            />
            <label className="form-check-label" htmlFor="cms-pub">
              Published
            </label>
          </div>
          <div className="d-flex justify-content-end gap-2 mt-2">
            <button className="btn btn-outline-secondary" onClick={() => setDrawerOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={onSave} disabled={save.isPending}>
              Save
            </button>
          </div>
        </div>
      </Drawer>

      <ConfirmModal
        open={Boolean(toDelete)}
        title="Delete this page?"
        message={toDelete ? `"${toDelete.title}" will be permanently removed.` : ''}
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
