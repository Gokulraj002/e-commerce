# Elite NonVeg — Admin Panel Guide

Foundation for the `@elite/admin` back office. This document is the contract for
the next wave of page agents. Follow it so every feature page looks and behaves
the same.

Stack: **React 18 + TypeScript + Vite + Bootstrap 5 (SCSS) + React Router v6 +
Axios + @tanstack/react-query + Chart.js + @tanstack/react-table + React Hook
Form + Zod**. Shared contracts come from **`@elite/shared`**.

- Money is **integer paise** (₹1 = 100). Never store rupees. Format with `formatPaise`.
- Stock / pack weight is **grams**. Format with `formatWeight`.
- Every API response is the envelope `{ success, data, message }`; the API client
  unwraps `.data` for you.

---

## Getting started

```bash
npm run dev --workspace admin      # http://localhost:5174 (proxies /api -> :4000)
npm run typecheck --workspace admin
npm run build --workspace admin
```

`@elite/shared` must be built first (`npm run build:shared`) — the admin imports
its compiled `dist`.

---

## Folder structure

```
admin/
├─ index.html                 # Inter font, #root
├─ vite.config.ts             # port 5174, /api proxy, '@' -> src alias
├─ tsconfig.json              # extends ../tsconfig.base.json, jsx react-jsx
└─ src/
   ├─ main.tsx                # Providers: QueryClient > Router > Toast > Auth > AppRouter
   ├─ styles/
   │  ├─ _tokens.scss         # design tokens (SCSS vars + :root CSS vars)
   │  ├─ _bootstrap-overrides.scss  # maps tokens onto Bootstrap, imports framework
   │  └─ main.scss            # app shell + component styles (.app-*, .ui-*)
   ├─ lib/
   │  ├─ apiClient.ts         # axios instance + `api` (typed, unwrapped) + getApiErrorMessage
   │  ├─ tokenStore.ts        # access/refresh token persistence
   │  ├─ queryClient.ts       # React Query defaults
   │  ├─ money.ts             # formatPaise / formatWeight / rupeesToPaise / formatCompact
   │  └─ chartSetup.ts        # Chart.js registration + CHART_PALETTE + cartesianDefaults
   ├─ features/
   │  └─ auth/                # AuthProvider, useAuth, ProtectedRoute, RoleGate, auth.api
   ├─ components/
   │  ├─ layout/              # AdminLayout, Sidebar, Topbar, Breadcrumbs, nav.config
   │  └─ ui/                  # DataTable, StatCard, ChartCard, PageHeader, ConfirmModal,
   │                         #   Drawer, Spinner, StatusBadge, FormField, Icon, toast
   ├─ routes/
   │  ├─ paths.ts             # ROUTES constants (single source of truth for URLs)
   │  └─ AppRouter.tsx        # route table
   └─ pages/
      └─ <Name>/<Name>.tsx    # one folder per page, default export
```

### Feature-folder rule

Cross-page primitives live in `components/ui`. Anything specific to one domain
(products, orders…) gets its own `features/<domain>/` folder holding its `*.api.ts`,
`*.schema.ts` (Zod), hooks, and local components. Pages stay thin — they compose
features + UI kit.

---

## Import conventions

- Use the `@/` alias for absolute imports: `import { DataTable } from '@/components/ui'`.
- Import the UI kit from the barrel `@/components/ui`, not deep paths.
- Import shared types/enums from `@elite/shared` — never redeclare them.

---

## The API client

```ts
import { api, getApiErrorMessage } from '@/lib/apiClient';

// `api.*` returns the UNWRAPPED payload (T), not an AxiosResponse.
const product = await api.get<ProductDTO>(`/catalog/products/${id}`);
await api.post<ProductDTO>('/catalog/products', body);
```

- Bearer token is attached automatically.
- A `401` triggers a **single** silent token refresh, then retries; if refresh
  fails, tokens are cleared and the app logs out.
- Turn errors into a message with `getApiErrorMessage(err)`.

Wrap reads in React Query and writes in mutations:

```ts
const { data, isLoading } = useQuery({
  queryKey: ['products', query],
  queryFn: () => api.get<Paginated<ProductDTO>>('/catalog/products', { params: query }),
});
```

---

## DataTable (list pages)

Server-driven. The table owns nothing about your data — it emits a
`DataTableQuery` (`{ page, pageSize, sort, order, search }`, page is 1-based) that
you feed straight into a query key and the API.

```tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import type { Paginated, ProductDTO } from '@elite/shared';

import { DataTable, DEFAULT_TABLE_QUERY, StatusBadge, type DataTableQuery } from '@/components/ui';
import { api } from '@/lib/apiClient';
import { formatPaise } from '@/lib/money';

const columns: ColumnDef<ProductDTO>[] = [
  { accessorKey: 'name', header: 'Product' },
  { accessorKey: 'rating', header: 'Rating', enableSorting: true },
  {
    id: 'price',
    header: 'From',
    enableSorting: false,
    cell: ({ row }) => formatPaise(row.original.variants[0]?.pricePaise ?? 0),
  },
];

export default function Products() {
  const [query, setQuery] = useState<DataTableQuery>(DEFAULT_TABLE_QUERY);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['products', query],
    queryFn: () => api.get<Paginated<ProductDTO>>('/catalog/products', { params: query }),
  });

  return (
    <DataTable
      columns={columns}
      data={data?.items ?? []}
      total={data?.total ?? 0}
      query={query}
      onQueryChange={setQuery}
      loading={isLoading}
      isFetching={isFetching}
      searchPlaceholder="Search products…"
      onRowClick={(row) => navigate(ROUTES.productEdit(row.id))}
    />
  );
}
```

Notes:
- Sorting: set `enableSorting: true` on a column; the table maps clicks to
  `sort`/`order` and resets to page 1. Keep sort keys aligned with API field names.
- Search is debounced (350 ms) internally.
- Columns are typed `ColumnDef<T>[]` — no `any`. Use `cell: ({ row }) => …` for
  formatting and `id` for non-accessor columns.

---

## ChartCard (dashboards / reports)

Wraps Chart.js. `type` is `'line' | 'bar' | 'doughnut'`. Chart.js registration
and shared defaults live in `lib/chartSetup.ts`; use `CHART_PALETTE` for colors.

```tsx
import type { ChartData } from 'chart.js';
import { ChartCard } from '@/components/ui';
import { CHART_PALETTE } from '@/lib/chartSetup';

const data: ChartData<'line'> = {
  labels: ['Mon', 'Tue', 'Wed'],
  datasets: [{ label: 'Revenue', data: [1, 2, 3], borderColor: CHART_PALETTE[0] }],
};

<ChartCard title="Revenue" subtitle="Last 7 days" type="line" data={data} loading={isLoading} />;
```

Cartesian charts inherit `cartesianDefaults` (responsive, bottom legend, no
aspect lock); pass `options` to override per-chart.

---

## StatCard / PageHeader / StatusBadge

```tsx
<PageHeader title="Products" subtitle="Manage the catalog" actions={<button className="btn btn-primary">New</button>} />

<StatCard label="Revenue (7d)" value={formatPaise(1781000)} icon="chart" delta={12.4} caption="vs last week" />

// Auto color mapping by domain — pass `kind`:
<StatusBadge kind="order" status={order.status} />
<StatusBadge kind="payment" status={order.paymentStatus} />
<StatusBadge kind="delivery" status={assignment.status} />
// Generic:
<StatusBadge status="ACTIVE" tone="success" />
```

Icons: `<Icon name="box" />`. Add new icons in `components/ui/Icon.tsx`.

---

## Forms (React Hook Form + Zod)

Put the schema in the feature folder and reuse shared Zod schemas where they exist.

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { TextField, SelectField, useToast } from '@/components/ui';

const schema = z.object({ name: z.string().min(2), categoryId: z.string().min(1) });
type Input = z.infer<typeof schema>;

const { register, handleSubmit, formState: { errors } } = useForm<Input>({ resolver: zodResolver(schema) });

<form onSubmit={handleSubmit(onSubmit)}>
  <TextField id="name" label="Name" required error={errors.name} {...register('name')} />
  <SelectField id="cat" label="Category" error={errors.categoryId} {...register('categoryId')}>
    <option value="">Select…</option>
  </SelectField>
</form>;
```

`TextField` / `TextareaField` / `SelectField` render the label, `is-invalid`
state, and error/hint text. Convert rupee inputs with `rupeesToPaise` before POST.

Feedback: `const toast = useToast(); toast.success({ title: 'Saved' })`.
Destructive actions use `<ConfirmModal tone="danger" … />`.

---

## RoleGate & route guards

Roles come from `@elite/shared` (`ROLES`, `STAFF_ROLES`). Only `STAFF_ROLES` can
enter the admin — `CUSTOMER` and `DELIVERY_PARTNER` are blocked at login and bootstrap.

Hide UI by role:

```tsx
import { RoleGate } from '@/features/auth';
import { ROLES } from '@elite/shared';

<RoleGate allow={[ROLES.SUPER_ADMIN, ROLES.ADMIN]}>
  <button className="btn btn-danger">Delete</button>
</RoleGate>;
```

Guard a whole route subtree in `AppRouter.tsx`:

```tsx
<Route element={<ProtectedRoute roles={[ROLES.SUPER_ADMIN, ROLES.ADMIN]} />}>
  <Route path={ROUTES.settings} element={<Settings />} />
</Route>
```

Check imperatively: `const { hasRole, user } = useAuth();`.
Also gate the sidebar item by adding `roles` to its entry in `nav.config.ts`.

---

## Adding a new CRUD page (checklist)

1. **Route** — add a constant to `routes/paths.ts` (`ROUTES.x`), then a `<Route>`
   in `AppRouter.tsx`. Wrap admin-only pages in a role-scoped `ProtectedRoute`.
2. **Nav** — add an item to the right group in `components/layout/nav.config.ts`
   (with `roles` if restricted, `matchPrefix` for detail routes).
3. **Feature folder** — `features/<domain>/`:
   - `<domain>.api.ts` — `api.get/post/...` calls returning shared DTOs.
   - `<domain>.schema.ts` — Zod schema + inferred `Input` type for forms.
   - `<domain>.queries.ts` (optional) — React Query hooks.
4. **Page** — replace the stub in `pages/<Name>/<Name>.tsx` (keep the default
   export). Compose `PageHeader` + `DataTable` (list) or the form primitives
   (create/edit). Use a `Drawer` for quick inline create/edit.
5. **Typecheck** — `npm run typecheck --workspace admin` must stay green.

---

## Naming conventions

- **Components / pages**: `PascalCase` files and default-exported page components
  (`Products.tsx` → `export default function Products()`).
- **Hooks**: `useX` camelCase. **Utilities / api modules**: camelCase functions.
- **Feature files**: `feature.api.ts`, `feature.schema.ts`, `feature.queries.ts`.
- **Route constants**: `ROUTES.camelCase`; parameterised routes are functions
  (`ROUTES.orderDetail(id)`).
- **CSS classes**: app shell `app-*`, reusable UI `ui-*`. Prefer Bootstrap
  utilities; add bespoke classes to `styles/main.scss` only when needed.
- **Money** ends in `Paise`, **weight** ends in `G` (grams) — mirror the DTOs.
- No `any`. No default exports except page components. Keep components small and
  composable.
```
