import { useMemo, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { ROLES, type ProductDTO, type ProductVariantDTO } from '@elite/shared';

import {
  ConfirmModal,
  DataTable,
  DEFAULT_TABLE_QUERY,
  Icon,
  PageHeader,
  StatusBadge,
  useToast,
  type DataTableBulkAction,
  type DataTableQuery,
} from '@/components/ui';
import { RoleGate } from '@/features/auth';
import { ROUTES } from '@/routes/paths';
import { getApiErrorMessage } from '@/lib/apiClient';
import { formatPaise, formatWeight } from '@/lib/money';
import {
  catalogKeys,
  deleteProduct as apiDeleteProduct,
  setProductActive as apiSetProductActive,
  useAdminProducts,
  useBrands,
  useCategories,
  useDeleteProduct,
} from '@/features/catalog';

const WRITE_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STORE_MANAGER];

type StockFilter = 'all' | 'in_stock' | 'out_of_stock';

// ── Helpers ────────────────────────────────────────────────────────

/** Rupee range like "₹250 – ₹520" (collapses to one value when equal). */
function formatPriceRange(variants: ProductVariantDTO[]): string {
  if (!variants.length) return '—';
  const prices = variants.map((v) => v.pricePaise);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? formatPaise(min) : `${formatPaise(min)} – ${formatPaise(max)}`;
}

/** Compact pack summary like "250 g – 1 kg" — sorted ascending. */
function formatPackRange(variants: ProductVariantDTO[]): string {
  if (!variants.length) return '—';
  const weights = variants.map((v) => v.weightG).sort((a, b) => a - b);
  const min = weights[0];
  const max = weights[weights.length - 1];
  return min === max ? formatWeight(min) : `${formatWeight(min)} – ${formatWeight(max)}`;
}

function anyInStock(product: ProductDTO): boolean {
  return product.variants.some((v) => v.inStock);
}

// ── CSV export (client-side, loaded/selected rows only) ────────────

function csvEscape(value: string | number | null | undefined): string {
  const s = value == null ? '' : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadProductsCsv(
  rows: ProductDTO[],
  categoryName: Map<string, string>,
  brandName: Map<string, string>,
): void {
  const header = [
    'id',
    'name',
    'slug',
    'category',
    'brand',
    'variants',
    'min_price_paise',
    'max_price_paise',
    'in_stock',
    'ready_to_cook',
  ];
  const lines: string[] = [header.join(',')];
  for (const p of rows) {
    const prices = p.variants.map((v) => v.pricePaise);
    const min = prices.length ? Math.min(...prices) : '';
    const max = prices.length ? Math.max(...prices) : '';
    lines.push(
      [
        p.id,
        p.name,
        p.slug,
        categoryName.get(p.categoryId) ?? '',
        p.brandId ? (brandName.get(p.brandId) ?? '') : '',
        p.variants.length,
        min,
        max,
        anyInStock(p) ? 'yes' : 'no',
        p.isReadyToCook ? 'yes' : 'no',
      ]
        .map(csvEscape)
        .join(','),
    );
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `products-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ── Thumbnail cell ─────────────────────────────────────────────────

function Thumb({ src, alt }: { src: string | undefined; alt: string }) {
  const box: CSSProperties = {
    width: 48,
    height: 48,
    borderRadius: 10,
    border: '1px solid var(--border-hairline, var(--border))',
    background: 'var(--bg-body)',
    objectFit: 'cover',
    display: 'inline-block',
  };
  if (src) return <img src={src} alt={alt} style={box} loading="lazy" />;
  return (
    <span
      className="d-inline-flex align-items-center justify-content-center text-muted-2"
      style={{ ...box, objectFit: undefined, background: 'var(--bg-muted)' }}
      aria-hidden
    >
      <Icon name="image" size={20} />
    </span>
  );
}

// ── Page ───────────────────────────────────────────────────────────

export default function Products() {
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();

  const [query, setQuery] = useState<DataTableQuery>(DEFAULT_TABLE_QUERY);
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [stock, setStock] = useState<StockFilter>('all');
  const [featuredOnly, setFeaturedOnly] = useState(false);

  const [pendingDelete, setPendingDelete] = useState<ProductDTO | null>(null);
  const [pendingBulkDeactivate, setPendingBulkDeactivate] = useState<ProductDTO[] | null>(null);
  const [pendingBulkDelete, setPendingBulkDelete] = useState<ProductDTO[] | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const { data: categories } = useCategories();
  const { data: brands } = useBrands();
  const deleteProduct = useDeleteProduct();

  const categoryName = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categories ?? []) map.set(c.id, c.name);
    return map;
  }, [categories]);

  const brandName = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of brands ?? []) map.set(b.id, b.name);
    return map;
  }, [brands]);

  const { data, isLoading, isFetching } = useAdminProducts({
    page: query.page,
    pageSize: query.pageSize,
    search: query.search,
    sort: query.sort,
    order: query.order,
    category: category || undefined,
    brand: brand || undefined,
    isFeatured: featuredOnly || undefined,
  });

  const rawItems = data?.items ?? [];
  // Stock is filtered client-side — backend list has no in-stock predicate.
  const items = useMemo(() => {
    if (stock === 'all') return rawItems;
    if (stock === 'in_stock') return rawItems.filter(anyInStock);
    return rawItems.filter((p) => !anyInStock(p));
  }, [rawItems, stock]);

  const totalProducts = data?.total ?? 0;
  const inStockCount = rawItems.filter(anyInStock).length;
  const subtitleParts: string[] = [
    `${totalProducts.toLocaleString('en-IN')} product${totalProducts === 1 ? '' : 's'}`,
    `${inStockCount} in stock on this page`,
  ];

  // ── Columns ─────────────────────────────────────────────────────
  const columns = useMemo<ColumnDef<ProductDTO>[]>(
    () => [
      {
        id: 'thumb',
        header: '',
        enableSorting: false,
        enableHiding: false,
        size: 68,
        cell: ({ row }) => <Thumb src={row.original.images[0]} alt={row.original.name} />,
      },
      {
        accessorKey: 'name',
        header: 'Product',
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
          <div className="d-flex flex-column" style={{ minWidth: 180, maxWidth: 320 }}>
            <span
              className="fw-semibold text-truncate"
              style={{ color: 'var(--text-strong)' }}
              title={row.original.name}
            >
              {row.original.name}
            </span>
            <span
              className="small text-truncate"
              style={{ color: 'var(--text-muted)' }}
              title={row.original.slug}
            >
              /{row.original.slug}
            </span>
          </div>
        ),
      },
      {
        id: 'category',
        header: 'Category',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="small">{categoryName.get(row.original.categoryId) ?? '—'}</span>
        ),
      },
      {
        id: 'brand',
        header: 'Brand',
        enableSorting: false,
        cell: ({ row }) => {
          const label = row.original.brandId ? brandName.get(row.original.brandId) : null;
          if (!label) {
            return (
              <span className="small" style={{ color: 'var(--text-muted)' }}>
                —
              </span>
            );
          }
          return <span className="small">{label}</span>;
        },
      },
      {
        id: 'price',
        header: 'Price',
        enableSorting: true,
        cell: ({ row }) => (
          <span
            className="fw-semibold"
            style={{
              fontVariantNumeric: 'tabular-nums',
              color: 'var(--text-strong)',
              whiteSpace: 'nowrap',
            }}
          >
            {formatPriceRange(row.original.variants)}
          </span>
        ),
      },
      {
        id: 'packs',
        header: 'Packs',
        enableSorting: false,
        cell: ({ row }) => {
          const count = row.original.variants.length;
          return (
            <div className="d-flex flex-column">
              <span className="small fw-semibold">
                {count} pack{count === 1 ? '' : 's'}
              </span>
              <span
                className="small"
                style={{
                  color: 'var(--text-muted)',
                  fontVariantNumeric: 'tabular-nums',
                  whiteSpace: 'nowrap',
                }}
              >
                {formatPackRange(row.original.variants)}
              </span>
            </div>
          );
        },
      },
      {
        id: 'status',
        header: 'Status',
        enableSorting: false,
        cell: ({ row }) => {
          const inStock = anyInStock(row.original);
          return (
            <StatusBadge
              status={inStock ? 'IN_STOCK' : 'OUT_OF_STOCK'}
              tone={inStock ? 'success' : 'danger'}
            />
          );
        },
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        enableHiding: false,
        size: 96,
        cell: ({ row }) => (
          <RoleGate allow={WRITE_ROLES}>
            <div
              className="d-flex align-items-center gap-1 justify-content-end"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="app-icon-btn"
                aria-label={`Edit ${row.original.name}`}
                title="Edit"
                onClick={() => navigate(ROUTES.productEdit(row.original.slug))}
              >
                <Icon name="sliders" size={16} />
              </button>
              <button
                type="button"
                className="app-icon-btn text-danger"
                aria-label={`Delete ${row.original.name}`}
                title="Delete"
                onClick={() => setPendingDelete(row.original)}
              >
                <Icon name="close" size={16} />
              </button>
            </div>
          </RoleGate>
        ),
      },
    ],
    [categoryName, brandName, navigate],
  );

  // ── Bulk actions ────────────────────────────────────────────────
  const bulkActions = useMemo<DataTableBulkAction<ProductDTO>[]>(
    () => [
      {
        key: 'deactivate',
        label: 'Deactivate',
        icon: 'refresh',
        tone: 'default',
        onRun: (rows) => setPendingBulkDeactivate(rows),
      },
      {
        key: 'delete',
        label: 'Delete',
        icon: 'close',
        tone: 'danger',
        onRun: (rows) => setPendingBulkDelete(rows),
      },
      {
        key: 'export',
        label: 'Export CSV',
        icon: 'file',
        tone: 'default',
        onRun: (rows) => downloadProductsCsv(rows, categoryName, brandName),
      },
    ],
    [categoryName, brandName],
  );

  // ── Bulk mutation runners ───────────────────────────────────────
  async function runBulkDeactivate(products: ProductDTO[]): Promise<void> {
    if (!products.length) return;
    setBulkBusy(true);
    try {
      await Promise.all(products.map((p) => apiSetProductActive(p.id, false)));
      await qc.invalidateQueries({ queryKey: catalogKeys.products });
      toast.success({
        title: `Deactivated ${products.length} product${products.length === 1 ? '' : 's'}`,
      });
      setPendingBulkDeactivate(null);
    } catch (err) {
      toast.error({
        title: 'Could not deactivate products',
        message: getApiErrorMessage(err),
      });
    } finally {
      setBulkBusy(false);
    }
  }

  async function runBulkDelete(products: ProductDTO[]): Promise<void> {
    if (!products.length) return;
    setBulkBusy(true);
    try {
      await Promise.all(products.map((p) => apiDeleteProduct(p.id)));
      await qc.invalidateQueries({ queryKey: catalogKeys.products });
      toast.success({
        title: `Deleted ${products.length} product${products.length === 1 ? '' : 's'}`,
      });
      setPendingBulkDelete(null);
    } catch (err) {
      toast.error({
        title: 'Could not delete products',
        message: getApiErrorMessage(err),
      });
    } finally {
      setBulkBusy(false);
    }
  }

  const resetPage = () => setQuery((q) => ({ ...q, page: 1 }));

  // ── Filter toolbar ──────────────────────────────────────────────
  const toolbar = (
    <div className="d-flex align-items-center flex-wrap gap-2">
      <select
        className="form-select form-select-sm"
        style={{ width: 'auto', minWidth: 150 }}
        value={category}
        onChange={(e) => {
          setCategory(e.target.value);
          resetPage();
        }}
        aria-label="Filter by category"
      >
        <option value="">All categories</option>
        {(categories ?? []).map((c) => (
          <option key={c.id} value={c.slug}>
            {`${' '.repeat(c.depth * 2)}${c.name}`}
          </option>
        ))}
      </select>

      <select
        className="form-select form-select-sm"
        style={{ width: 'auto', minWidth: 130 }}
        value={brand}
        onChange={(e) => {
          setBrand(e.target.value);
          resetPage();
        }}
        aria-label="Filter by brand"
      >
        <option value="">All brands</option>
        {(brands ?? []).map((b) => (
          <option key={b.id} value={b.slug}>
            {b.name}
          </option>
        ))}
      </select>

      <select
        className="form-select form-select-sm"
        style={{ width: 'auto', minWidth: 130 }}
        value={stock}
        onChange={(e) => {
          setStock(e.target.value as StockFilter);
          resetPage();
        }}
        aria-label="Filter by stock status"
        title="Filters the current page — server-side stock filter is not supported yet"
      >
        <option value="all">All stock</option>
        <option value="in_stock">In stock</option>
        <option value="out_of_stock">Out of stock</option>
      </select>

      <label
        className="d-inline-flex align-items-center gap-2 small fw-medium"
        style={{ userSelect: 'none' }}
      >
        <input
          type="checkbox"
          className="form-check-input mt-0"
          checked={featuredOnly}
          onChange={(e) => {
            setFeaturedOnly(e.target.checked);
            resetPage();
          }}
        />
        Featured only
      </label>
    </div>
  );

  return (
    <>
      <PageHeader
        title="Products"
        subtitle={subtitleParts.join(' · ')}
        actions={
          <RoleGate allow={WRITE_ROLES}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate(ROUTES.productNew)}
            >
              <Icon name="plus" size={16} /> New product
            </button>
          </RoleGate>
        }
      />

      <DataTable
        columns={columns}
        data={items}
        total={data?.total ?? 0}
        query={query}
        onQueryChange={setQuery}
        loading={isLoading}
        isFetching={isFetching}
        searchPlaceholder="Search products…"
        onRowClick={(row) => navigate(ROUTES.productEdit(row.slug))}
        toolbar={toolbar}
        stickyHeader
        zebra
        density="comfortable"
        selectable
        bulkActions={bulkActions}
        columnMenu
        tableId="admin-products"
        getRowId={(row) => row.id}
        emptyMessage="No products match these filters."
      />

      <ConfirmModal
        open={pendingDelete !== null}
        tone="danger"
        title="Delete product"
        message={
          <>
            Delete <strong>{pendingDelete?.name}</strong>? This removes it from the catalog.
          </>
        }
        confirmLabel="Delete"
        loading={deleteProduct.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) return;
          deleteProduct.mutate(pendingDelete.id, {
            onSuccess: () => setPendingDelete(null),
          });
        }}
      />

      <ConfirmModal
        open={pendingBulkDeactivate !== null}
        tone="primary"
        title="Deactivate selected products"
        message={
          <>
            Deactivate <strong>{pendingBulkDeactivate?.length ?? 0}</strong> product
            {(pendingBulkDeactivate?.length ?? 0) === 1 ? '' : 's'}? They will be hidden from
            customers but not deleted.
          </>
        }
        confirmLabel="Deactivate"
        loading={bulkBusy}
        onCancel={() => setPendingBulkDeactivate(null)}
        onConfirm={() => runBulkDeactivate(pendingBulkDeactivate ?? [])}
      />

      <ConfirmModal
        open={pendingBulkDelete !== null}
        tone="danger"
        title="Delete selected products"
        message={
          <>
            Permanently delete <strong>{pendingBulkDelete?.length ?? 0}</strong> product
            {(pendingBulkDelete?.length ?? 0) === 1 ? '' : 's'}? This cannot be undone.
          </>
        }
        confirmLabel="Delete"
        loading={bulkBusy}
        onCancel={() => setPendingBulkDelete(null)}
        onConfirm={() => runBulkDelete(pendingBulkDelete ?? [])}
      />
    </>
  );
}
