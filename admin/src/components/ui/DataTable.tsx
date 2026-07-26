import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';

import { Icon } from './Icon';
import { Spinner } from './Spinner';

/**
 * Server-driven query state a DataTable emits. Parents feed this straight into
 * a React Query key and their fetcher. Page is 1-based to match the API.
 */
export interface DataTableQuery {
  page: number;
  pageSize: number;
  sort?: string;
  order?: 'asc' | 'desc';
  search?: string;
}

export const DEFAULT_TABLE_QUERY: DataTableQuery = {
  page: 1,
  pageSize: 20,
  sort: undefined,
  order: undefined,
  search: '',
};

export type DataTableDensity = 'comfortable' | 'compact';

/** Metadata describing a selection-scoped bulk action button. */
export interface DataTableBulkAction<T> {
  /** Unique key (React key). */
  key: string;
  /** Button label shown in the selection strip. */
  label: string;
  icon?: 'plus' | 'sliders' | 'refresh' | 'close' | 'file' | 'settings' | 'alert';
  /** 'primary' renders as filled brand; 'default' as light. */
  tone?: 'primary' | 'default' | 'danger';
  /** Called with the currently-selected rows. */
  onRun: (rows: T[]) => void;
  /** Optional disabled predicate; defaults to false. */
  disabled?: (rows: T[]) => boolean;
}

interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  /** Total row count across all pages (from the API), for pagination math. */
  total: number;
  query: DataTableQuery;
  onQueryChange: (next: DataTableQuery) => void;
  /** First load (no data yet). */
  loading?: boolean;
  /** Background refetch (data present but updating). */
  isFetching?: boolean;
  /** Rendered when the list is empty. Accepts a string or a rich node (e.g. <EmptyState/>). */
  emptyMessage?: ReactNode;
  searchPlaceholder?: string;
  /** Extra toolbar controls rendered on the right (filters, export…). */
  toolbar?: ReactNode;
  onRowClick?: (row: T) => void;
  pageSizeOptions?: number[];

  // ── Premium / opt-in props (all default to the old look) ─────────
  /** Alternating row background for easier scan on wide tables. */
  zebra?: boolean;
  /** Sticky <thead> inside a fixed-height scroll container. */
  stickyHeader?: boolean;
  /** Row padding scale. `'comfortable'` is the default; `'compact'` shrinks it. */
  density?: DataTableDensity;
  /** Show the row-density toggle in the toolbar. */
  densityToggle?: boolean;
  /** Show the column-visibility menu in the toolbar. */
  columnMenu?: boolean;
  /** Stable id used to persist density + column visibility in localStorage. */
  tableId?: string;
  /** Show a leading checkbox column and expose `selection`/`bulkActions`. */
  selectable?: boolean;
  /** Actions rendered in the selection banner. */
  bulkActions?: DataTableBulkAction<T>[];
  /** Extract a stable row id (used for selection). Falls back to index-based ids. */
  getRowId?: (row: T, index: number) => string;
  /** Optional hide-search — some pages surface search in a filter strip above. */
  hideSearch?: boolean;
  /** Extra classes appended to the outer card. */
  className?: string;
}

const DEBOUNCE_MS = 350;
const LS_PREFIX = 'ui-datatable';

function readLocal<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(`${LS_PREFIX}:${key}`);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeLocal(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${LS_PREFIX}:${key}`, JSON.stringify(value));
  } catch {
    /* quota / private mode — silently ignore */
  }
}

export function DataTable<T>({
  columns,
  data,
  total,
  query,
  onQueryChange,
  loading = false,
  isFetching = false,
  emptyMessage = 'No records found.',
  searchPlaceholder = 'Search…',
  toolbar,
  onRowClick,
  pageSizeOptions = [10, 20, 50, 100],
  zebra = false,
  stickyHeader = false,
  density: densityProp,
  densityToggle = false,
  columnMenu = false,
  tableId,
  selectable = false,
  bulkActions,
  getRowId,
  hideSearch = false,
  className = '',
}: DataTableProps<T>) {
  // Local, debounced search box mirrored to the query.
  const [searchInput, setSearchInput] = useState(query.search ?? '');
  useEffect(() => setSearchInput(query.search ?? ''), [query.search]);
  useEffect(() => {
    const current = query.search ?? '';
    if (searchInput === current) return;
    const t = window.setTimeout(
      () => onQueryChange({ ...query, search: searchInput, page: 1 }),
      DEBOUNCE_MS,
    );
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  // Density: prop wins, else stored, else 'comfortable'.
  const [storedDensity, setStoredDensity] = useState<DataTableDensity>(
    () => (tableId ? readLocal<DataTableDensity>(`${tableId}:density`, 'comfortable') : 'comfortable'),
  );
  const density: DataTableDensity = densityProp ?? storedDensity;
  useEffect(() => {
    if (tableId) writeLocal(`${tableId}:density`, storedDensity);
  }, [tableId, storedDensity]);

  // Column visibility (persisted per tableId).
  const [visibility, setVisibility] = useState<VisibilityState>(
    () => (tableId ? readLocal<VisibilityState>(`${tableId}:visibility`, {}) : {}),
  );
  useEffect(() => {
    if (tableId) writeLocal(`${tableId}:visibility`, visibility);
  }, [tableId, visibility]);

  // Selection (row-id → true). Cleared whenever the underlying rows change page.
  const [selection, setSelection] = useState<Record<string, boolean>>({});
  useEffect(() => {
    // Drop stale selections that no longer belong to the visible page.
    setSelection((prev) => {
      if (!Object.keys(prev).length) return prev;
      const visibleIds = new Set(
        data.map((row, i) => (getRowId ? getRowId(row, i) : String(i))),
      );
      const next: Record<string, boolean> = {};
      for (const [id, v] of Object.entries(prev)) if (visibleIds.has(id) && v) next[id] = true;
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const sorting: SortingState = useMemo(
    () => (query.sort ? [{ id: query.sort, desc: query.order === 'desc' }] : []),
    [query.sort, query.order],
  );

  const pageCount = Math.max(1, Math.ceil(total / query.pageSize));

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      pagination: { pageIndex: query.page - 1, pageSize: query.pageSize },
      columnVisibility: visibility,
    },
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    pageCount,
    getCoreRowModel: getCoreRowModel(),
    onColumnVisibilityChange: setVisibility,
    getRowId: getRowId
      ? (row, index) => getRowId(row as T, index)
      : undefined,
    onSortingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater;
      const first = next[0];
      onQueryChange({
        ...query,
        sort: first?.id,
        order: first ? (first.desc ? 'desc' : 'asc') : undefined,
        page: 1,
      });
    },
  });

  const from = total === 0 ? 0 : (query.page - 1) * query.pageSize + 1;
  const to = Math.min(query.page * query.pageSize, total);
  const showEmpty = !loading && data.length === 0;

  // Selection helpers.
  const rowIds = useMemo(
    () => data.map((row, i) => (getRowId ? getRowId(row, i) : String(i))),
    [data, getRowId],
  );
  const selectedIds = useMemo(
    () => rowIds.filter((id) => selection[id]),
    [rowIds, selection],
  );
  const selectedRows = useMemo(
    () => data.filter((_row, i) => selection[rowIds[i]]),
    [data, rowIds, selection],
  );
  const allSelected = selectedIds.length > 0 && selectedIds.length === rowIds.length;
  const someSelected = selectedIds.length > 0 && !allSelected;

  function toggleAll(next: boolean) {
    if (!next) {
      setSelection({});
      return;
    }
    const all: Record<string, boolean> = {};
    for (const id of rowIds) all[id] = true;
    setSelection(all);
  }

  function toggleOne(id: string, next: boolean) {
    setSelection((prev) => {
      const clone = { ...prev };
      if (next) clone[id] = true;
      else delete clone[id];
      return clone;
    });
  }

  const [colMenuOpen, setColMenuOpen] = useState(false);
  useEffect(() => {
    if (!colMenuOpen) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest('[data-ui-colmenu]')) setColMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [colMenuOpen]);

  // Column header for the leading selection column.
  const selectionHeader = selectable ? (
    <input
      type="checkbox"
      className="form-check-input mt-0"
      aria-label="Select all on this page"
      checked={allSelected}
      ref={(el) => {
        if (el) el.indeterminate = someSelected;
      }}
      onChange={(e) => toggleAll(e.target.checked)}
    />
  ) : null;

  const tableClasses = [
    'ui-table',
    'table',
    zebra ? 'ui-table--zebra' : '',
    density === 'compact' ? 'ui-table--compact' : '',
    stickyHeader ? 'ui-table--sticky' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const visibleLeafColumns = table.getAllLeafColumns().filter((c) => c.getCanHide());
  const totalColSpan = columns.length + (selectable ? 1 : 0);

  return (
    <div className={`card ui-table-card ${className}`}>
      <div className="card-body">
        {(!hideSearch || toolbar || densityToggle || columnMenu) && (
          <div className="ui-table__toolbar">
            {!hideSearch ? (
              <div className="position-relative" style={{ maxWidth: 320, width: '100%' }}>
                <span
                  className="position-absolute top-50 translate-middle-y text-muted-2"
                  style={{ left: 10 }}
                >
                  <Icon name="search" size={16} />
                </span>
                <input
                  type="search"
                  className="form-control"
                  style={{ paddingLeft: 34 }}
                  placeholder={searchPlaceholder}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </div>
            ) : (
              <div />
            )}
            <div className="d-flex align-items-center gap-2">
              {isFetching && !loading && <Spinner size="sm" />}
              {toolbar}
              {densityToggle && (
                <div className="btn-group btn-group-sm ui-density-toggle" role="group" aria-label="Row density">
                  <button
                    type="button"
                    className={`btn ${density === 'comfortable' ? 'btn-dark' : 'btn-light'}`}
                    onClick={() => setStoredDensity('comfortable')}
                    title="Comfortable rows"
                    aria-pressed={density === 'comfortable'}
                  >
                    <Icon name="menu" size={14} />
                  </button>
                  <button
                    type="button"
                    className={`btn ${density === 'compact' ? 'btn-dark' : 'btn-light'}`}
                    onClick={() => setStoredDensity('compact')}
                    title="Compact rows"
                    aria-pressed={density === 'compact'}
                  >
                    <Icon name="sliders" size={14} />
                  </button>
                </div>
              )}
              {columnMenu && (
                <div className="position-relative" data-ui-colmenu>
                  <button
                    type="button"
                    className="btn btn-sm btn-light"
                    onClick={() => setColMenuOpen((v) => !v)}
                    aria-haspopup="menu"
                    aria-expanded={colMenuOpen}
                  >
                    <Icon name="sliders" size={14} /> Columns
                  </button>
                  {colMenuOpen && (
                    <div className="ui-colmenu" role="menu">
                      <div className="ui-colmenu__title">Show columns</div>
                      {visibleLeafColumns.length === 0 && (
                        <div className="text-muted-2 small px-2 py-1">
                          No columns to configure.
                        </div>
                      )}
                      {visibleLeafColumns.map((col) => {
                        const label =
                          typeof col.columnDef.header === 'string' && col.columnDef.header
                            ? col.columnDef.header
                            : col.id;
                        return (
                          <label key={col.id} className="ui-colmenu__row">
                            <input
                              type="checkbox"
                              className="form-check-input mt-0"
                              checked={col.getIsVisible()}
                              onChange={(e) => col.toggleVisibility(e.target.checked)}
                            />
                            <span>{label}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {selectable && selectedIds.length > 0 && (
          <div className="ui-selection-bar" role="region" aria-label="Selection actions">
            <div className="ui-selection-bar__count">
              <strong>{selectedIds.length}</strong> selected
              <button
                type="button"
                className="btn btn-sm btn-link p-0 ms-2"
                onClick={() => setSelection({})}
              >
                Clear
              </button>
            </div>
            {(bulkActions ?? []).length > 0 && (
              <div className="d-flex align-items-center gap-2">
                {(bulkActions ?? []).map((action) => {
                  const disabled = action.disabled ? action.disabled(selectedRows) : false;
                  const toneClass =
                    action.tone === 'primary'
                      ? 'btn-primary'
                      : action.tone === 'danger'
                        ? 'btn-outline-danger'
                        : 'btn-light';
                  return (
                    <button
                      key={action.key}
                      type="button"
                      className={`btn btn-sm ${toneClass}`}
                      disabled={disabled}
                      onClick={() => action.onRun(selectedRows)}
                    >
                      {action.icon && <Icon name={action.icon} size={14} />}
                      <span className={action.icon ? 'ms-1' : ''}>{action.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className={`ui-table-wrap ${stickyHeader ? 'ui-table-wrap--sticky' : ''}`}>
          <table className={tableClasses}>
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {selectable && (
                    <th className="ui-table__select-cell" style={{ width: 40 }}>
                      {selectionHeader}
                    </th>
                  )}
                  {hg.headers.map((header) => {
                    const canSort = header.column.getCanSort();
                    const dir = header.column.getIsSorted();
                    return (
                      <th
                        key={header.id}
                        className={canSort ? 'is-sortable' : ''}
                        onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                        style={{ width: header.getSize() ? header.getSize() : undefined }}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {canSort && (
                          <span className="ui-table__sort-icon">
                            {dir === 'asc' ? '▲' : dir === 'desc' ? '▼' : '↕'}
                          </span>
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={totalColSpan}>
                    <div className="ui-table__loading">
                      <Spinner label="Loading…" />
                    </div>
                  </td>
                </tr>
              )}
              {showEmpty && (
                <tr>
                  <td colSpan={totalColSpan}>
                    <div className="ui-table__empty">{emptyMessage}</div>
                  </td>
                </tr>
              )}
              {!loading &&
                table.getRowModel().rows.map((row, i) => {
                  const rowId = rowIds[i];
                  const isSelected = selectable ? Boolean(selection[rowId]) : false;
                  return (
                    <tr
                      key={row.id}
                      className={isSelected ? 'is-selected' : undefined}
                      onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                      style={onRowClick ? { cursor: 'pointer' } : undefined}
                    >
                      {selectable && (
                        <td
                          className="ui-table__select-cell"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            className="form-check-input mt-0"
                            aria-label="Select row"
                            checked={isSelected}
                            onChange={(e) => toggleOne(rowId, e.target.checked)}
                          />
                        </td>
                      )}
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        <div className="ui-table__footer">
          <div className="d-flex align-items-center gap-2">
            <span>
              {from}–{to} of {total}
            </span>
            <select
              className="form-select form-select-sm"
              style={{ width: 'auto' }}
              value={query.pageSize}
              onChange={(e) => onQueryChange({ ...query, pageSize: Number(e.target.value), page: 1 })}
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </select>
          </div>
          <div className="d-flex align-items-center gap-1">
            <button
              type="button"
              className="btn btn-sm btn-light"
              disabled={query.page <= 1}
              onClick={() => onQueryChange({ ...query, page: query.page - 1 })}
            >
              <Icon name="chevron-left" size={16} />
            </button>
            <span className="px-2">
              Page {query.page} / {pageCount}
            </span>
            <button
              type="button"
              className="btn btn-sm btn-light"
              disabled={query.page >= pageCount}
              onClick={() => onQueryChange({ ...query, page: query.page + 1 })}
            >
              <Icon name="chevron-right" size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
