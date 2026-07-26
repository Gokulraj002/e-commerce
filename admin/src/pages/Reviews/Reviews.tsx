import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import type { ReviewDTO } from '@elite/shared';

import {
  ConfirmModal,
  DataTable,
  DEFAULT_TABLE_QUERY,
  EmptyState,
  ErrorState,
  FilterChip,
  PageHeader,
  type DataTableQuery,
} from '@/components/ui';
import { getApiErrorMessage } from '@/lib/apiClient';
import {
  formatDateTime,
  useApproveReview,
  useDeleteReview,
  usePendingReviews,
} from '@/features/sales';

function Stars({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <span
      className="tabular"
      style={{ color: '#D4A017', letterSpacing: '1px' }}
      aria-label={`${clamped} out of 5 stars`}
    >
      {'★'.repeat(clamped)}
      <span style={{ color: 'var(--border-strong)' }}>{'★'.repeat(5 - clamped)}</span>
    </span>
  );
}

/** Tiny placeholder for the product thumbnail cell — no image URL in ReviewDTO. */
function ProductThumb({ name }: { name: string }) {
  const letter = name.trim().charAt(0).toUpperCase() || '?';
  return (
    <div className="ui-thumb" aria-hidden="true">
      {letter}
    </div>
  );
}

type ReviewTab = 'pending' | 'approved' | 'all';

const TAB_META: Record<ReviewTab, { label: string; empty: { title: string; message: string } }> = {
  pending: {
    label: 'Pending',
    empty: {
      title: 'All caught up',
      message: 'No reviews are waiting for moderation.',
    },
  },
  approved: {
    label: 'Approved',
    empty: {
      title: 'Approved reviews live on product pages',
      message: 'A dedicated list will land alongside the approved-reviews API.',
    },
  },
  all: {
    label: 'All',
    empty: {
      title: 'Nothing to review',
      message: 'When customers submit reviews, they queue up here for moderation.',
    },
  },
};

export default function Reviews() {
  const [query, setQuery] = useState<DataTableQuery>(DEFAULT_TABLE_QUERY);
  const [tab, setTab] = useState<ReviewTab>('pending');
  const [toDelete, setToDelete] = useState<ReviewDTO | null>(null);
  const { data, isLoading, isFetching, isError, error, refetch } = usePendingReviews({
    page: query.page,
    pageSize: query.pageSize,
  });
  const approve = useApproveReview();
  const remove = useDeleteReview();

  const isRowBusy = (id: string) =>
    (approve.isPending && approve.variables === id) ||
    (remove.isPending && remove.variables === id);

  // Only the pending list is served by the backend today; the other tabs are
  // visual sugar so the page reads as a moderation queue rather than a single
  // list. When an approved endpoint ships, wire it up here.
  const items = tab === 'pending' ? data?.items ?? [] : [];
  const total = tab === 'pending' ? data?.total ?? 0 : 0;

  const columns: ColumnDef<ReviewDTO>[] = [
    {
      id: 'product',
      header: 'Product',
      cell: (c) => {
        const name = c.row.original.productName ?? c.row.original.productId;
        return (
          <div className="d-flex align-items-center gap-2 min-w-0">
            <ProductThumb name={name} />
            <div className="fw-semibold text-truncate" style={{ color: 'var(--text-strong)' }}>
              {name}
            </div>
          </div>
        );
      },
    },
    {
      header: 'Customer',
      cell: (c) => (
        <span className="text-truncate d-inline-block" style={{ maxWidth: 180 }}>
          {c.row.original.userName ?? c.row.original.userId}
        </span>
      ),
    },
    {
      header: 'Rating',
      cell: (c) => <Stars value={c.row.original.rating} />,
    },
    {
      header: 'Comment',
      cell: (c) => (
        <div style={{ maxWidth: 380 }}>
          {c.row.original.title && (
            <div className="fw-semibold small" style={{ color: 'var(--text-strong)' }}>
              {c.row.original.title}
            </div>
          )}
          <div
            className="text-muted-2 small"
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              wordBreak: 'break-word',
            }}
          >
            {c.row.original.body ?? ''}
          </div>
        </div>
      ),
    },
    {
      header: 'Submitted',
      cell: (c) => (
        <span className="text-muted-2 small tabular">
          {formatDateTime(c.row.original.createdAt)}
        </span>
      ),
    },
    {
      header: '',
      id: 'actions',
      cell: (c) => {
        const busy = isRowBusy(c.row.original.id);
        return (
          <div className="d-flex gap-2 justify-content-end">
            <button
              type="button"
              className="btn btn-sm btn-outline-success"
              onClick={() => approve.mutate(c.row.original.id)}
              disabled={busy}
              aria-label={`Approve review by ${c.row.original.userName ?? 'customer'}`}
            >
              Approve
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-danger"
              onClick={() => setToDelete(c.row.original)}
              disabled={busy}
              aria-label={`Reject review by ${c.row.original.userName ?? 'customer'}`}
            >
              Reject
            </button>
          </div>
        );
      },
    },
  ];

  const emptyMeta = TAB_META[tab].empty;

  return (
    <>
      <PageHeader
        title="Reviews"
        subtitle="Approve or reject customer reviews before they go live."
      />

      <div className="ui-filter-strip">
        <div className="ui-filter-strip__chips" role="tablist" aria-label="Review moderation queue">
          {(Object.keys(TAB_META) as ReviewTab[]).map((t) => (
            <FilterChip
              key={t}
              label={t === 'pending' ? `${TAB_META[t].label} (${data?.total ?? 0})` : TAB_META[t].label}
              active={tab === t}
              onClick={() => {
                setTab(t);
                setQuery({ ...query, page: 1 });
              }}
            />
          ))}
        </div>
        <div className="ui-filter-strip__spacer" />
      </div>

      {isError && (
        <ErrorState
          title="Couldn't load pending reviews"
          message={getApiErrorMessage(error)}
          onRetry={() => refetch()}
        />
      )}

      <DataTable
        columns={columns}
        data={items}
        total={total}
        query={query}
        onQueryChange={setQuery}
        loading={tab === 'pending' && isLoading}
        isFetching={tab === 'pending' && isFetching}
        hideSearch
        zebra
        stickyHeader
        densityToggle
        columnMenu
        tableId="admin-reviews"
        emptyMessage={<EmptyState icon="star" title={emptyMeta.title} message={emptyMeta.message} compact />}
      />

      <ConfirmModal
        open={Boolean(toDelete)}
        title="Reject and delete this review?"
        message="This will permanently delete the review."
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
