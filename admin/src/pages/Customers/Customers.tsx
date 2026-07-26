import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import type { UserDTO } from '@elite/shared';

import {
  DataTable,
  DEFAULT_TABLE_QUERY,
  EmptyState,
  ErrorState,
  FilterChip,
  Icon,
  PageHeader,
  StatTile,
  StatusBadge,
  type DataTableQuery,
} from '@/components/ui';
import { getApiErrorMessage } from '@/lib/apiClient';
import { useCustomers } from '@/features/sales';

/** Two-letter uppercase initials for the avatar chip. */
function initialsOf(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0] ?? '');
  return (parts.join('') || '?').toUpperCase();
}

/** Coarse "how long ago" for a joined date — good enough for a table cell. */
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

type MemberFilter = 'all' | 'members' | 'guests';

export default function Customers() {
  const [query, setQuery] = useState<DataTableQuery>(DEFAULT_TABLE_QUERY);
  const [memberFilter, setMemberFilter] = useState<MemberFilter>('all');
  const navigate = useNavigate();
  const { data, isLoading, isFetching, isError, error, refetch } = useCustomers({
    page: query.page,
    pageSize: query.pageSize,
    search: query.search?.trim() || undefined,
  });

  const items = data?.items ?? [];

  // Client-side chip filter over the current page — the API has no
  // members/guests filter, so we scope this to the visible slice and keep
  // the KPIs honest with an "on this page" caption where applicable.
  const filteredItems = useMemo(() => {
    if (memberFilter === 'members') return items.filter((u) => u.isMember);
    if (memberFilter === 'guests') return items.filter((u) => !u.isMember);
    return items;
  }, [items, memberFilter]);

  const memberCount = useMemo(() => items.filter((u) => u.isMember).length, [items]);
  const newThisWeek = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return items.filter((u) => new Date(u.createdAt).getTime() >= weekAgo).length;
  }, [items]);

  const columns: ColumnDef<UserDTO>[] = [
    {
      id: 'avatar',
      header: '',
      cell: (c) => (
        <div className="ui-thumb" aria-hidden="true">
          {initialsOf(c.row.original.name)}
        </div>
      ),
      size: 56,
    },
    {
      header: 'Name',
      accessorKey: 'name',
      cell: (c) => {
        const u = c.row.original;
        return (
          <div className="min-w-0">
            <div className="fw-semibold text-truncate" style={{ color: 'var(--text-strong)' }}>
              {u.name}
            </div>
            <div className="text-muted-2 small text-truncate">
              {u.email ?? <span className="text-muted-2">No email</span>}
            </div>
          </div>
        );
      },
    },
    {
      header: 'Phone',
      accessorKey: 'phone',
      cell: (c) => <span className="tabular">{c.row.original.phone}</span>,
    },
    {
      header: 'Member',
      cell: (c) => (
        <StatusBadge
          status={c.row.original.isMember ? 'MEMBER' : 'GUEST'}
          tone={c.row.original.isMember ? 'success' : 'neutral'}
        />
      ),
    },
    {
      header: 'Joined',
      cell: (c) => (
        <span className="text-muted-2 small tabular">{relativeSince(c.row.original.createdAt)}</span>
      ),
    },
    {
      header: 'Orders',
      cell: () => <span className="text-muted-2 tabular">—</span>,
    },
    {
      header: 'Last active',
      cell: () => <span className="text-muted-2 tabular">—</span>,
    },
  ];

  return (
    <>
      <PageHeader title="Customers" subtitle="Everyone who has ever signed up." />

      <div className="row g-3 mb-3">
        <div className="col-12 col-sm-6 col-lg-4">
          <StatTile
            label="Total customers"
            value={<span>{(data?.total ?? 0).toLocaleString('en-IN')}</span>}
            icon="users"
            tone="brand"
            loading={isLoading}
          />
        </div>
        <div className="col-12 col-sm-6 col-lg-4">
          <StatTile
            label="New this week"
            value={<span>{newThisWeek.toLocaleString('en-IN')}</span>}
            caption="on this page"
            icon="arrow-up"
            tone="success"
            loading={isLoading}
          />
        </div>
        <div className="col-12 col-sm-6 col-lg-4">
          <StatTile
            label="Members"
            value={<span>{memberCount.toLocaleString('en-IN')}</span>}
            caption="on this page"
            icon="star"
            tone="info"
            loading={isLoading}
          />
        </div>
      </div>

      <div className="ui-filter-strip">
        <div className="ui-filter-strip__search">
          <span className="ui-filter-strip__search-icon" aria-hidden="true">
            <Icon name="search" size={16} />
          </span>
          <input
            type="search"
            className="form-control form-control-sm"
            placeholder="Search by name or phone…"
            value={query.search ?? ''}
            onChange={(e) => setQuery({ ...query, search: e.target.value, page: 1 })}
            aria-label="Search customers"
          />
        </div>
        <div className="ui-filter-strip__sep" aria-hidden="true" />
        <div className="ui-filter-strip__chips" role="group" aria-label="Membership filter">
          <FilterChip label="All" active={memberFilter === 'all'} onClick={() => setMemberFilter('all')} />
          <FilterChip
            label="Members"
            icon="star"
            active={memberFilter === 'members'}
            onClick={() => setMemberFilter('members')}
          />
          <FilterChip
            label="Guests"
            active={memberFilter === 'guests'}
            onClick={() => setMemberFilter('guests')}
          />
        </div>
      </div>

      {isError && (
        <ErrorState
          title="Couldn't load customers"
          message={getApiErrorMessage(error)}
          onRetry={() => refetch()}
        />
      )}

      <DataTable
        columns={columns}
        data={filteredItems}
        total={data?.total ?? 0}
        query={query}
        onQueryChange={setQuery}
        loading={isLoading}
        isFetching={isFetching}
        hideSearch
        zebra
        stickyHeader
        densityToggle
        columnMenu
        tableId="admin-customers"
        emptyMessage={
          <EmptyState
            icon="users"
            title={query.search ? 'No customers match that search' : 'No customers yet'}
            message={
              query.search
                ? 'Try a different name or phone number.'
                : 'Customer accounts show up here once the storefront takes its first sign-up.'
            }
            compact
          />
        }
        onRowClick={(u) => navigate(`/customers/${u.id}`)}
      />
    </>
  );
}
