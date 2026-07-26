# Elite NonVeg — Frontend Guide

The premium customer web app for **Elite NonVeg**, a high-end fresh-meat delivery
store in Hyderabad. This document is the contract for every agent extending the
app: follow it so pages stay consistent.

**Stack:** React 18 · TypeScript (strict, no `any`) · Vite · Bootstrap 5 (customized
via SCSS) · React Router v6 · Axios · React Hook Form + Zod · TanStack Query ·
Framer Motion. Shared DTOs/enums come from `@elite/shared`.

> Money is integer **paise** (₹1 = 100). Products are sold by **weight in grams**.
> Never do money math in the client — the server returns computed totals.

---

## 1. Getting started

```bash
# From the repo root — the shared package must be built first.
npm install                 # installs all workspaces (run once, at the root)
npm run build:shared        # emits @elite/shared dist used by the frontend
npm run dev:frontend        # Vite dev server on http://localhost:5173
```

The dev server proxies `/api` → `http://localhost:4000` (backend at `/api/v1`).
Scripts: `dev`, `build`, `preview`, `typecheck`.

---

## 2. Folder structure

```
frontend/
├─ index.html                 # Google Fonts (Playfair Display + Inter), #root
├─ vite.config.ts             # port 5173, /api proxy, @ alias → src
├─ tsconfig.json              # app config (src). tsconfig.node.json = vite config
└─ src/
   ├─ main.tsx                # providers: Query → Auth → Cart → Router
   ├─ styles/                 # design system (see §3)
   │  ├─ _tokens.scss         #   brand palette, fonts, radii, shadows, :root vars
   │  ├─ _bootstrap-overrides.scss  # Bootstrap SCSS var overrides
   │  ├─ _components.scss      #   app component/utility layer (.en-*)
   │  └─ main.scss            #   entrypoint (order matters)
   ├─ lib/
   │  ├─ apiClient.ts         # axios instance: Bearer, unwrap envelope, 401 refresh
   │  ├─ queryClient.ts       # TanStack Query defaults
   │  └─ money.ts             # formatPaise, formatWeight, discountPercent…
   ├─ features/               # feature-folder pattern (see §5)
   │  ├─ auth/                # authStore, AuthContext, useAuth, auth.api
   │  └─ cart/                # CartContext, useCart, cart.api
   ├─ components/
   │  ├─ ui/                  # presentational primitives (see §4)
   │  ├─ layout/              # RootLayout, Header, Footer, navData
   │  └─ common/              # PageStub (placeholder shell)
   ├─ pages/                  # one folder per route: <Name>/<Name>.tsx (default export)
   └─ routes/
      ├─ routes.ts            # ROUTES constants + typed `paths` builders
      ├─ AppRouter.tsx        # createBrowserRouter tree
      └─ RouteError.tsx       # errorElement fallback
```

---

## 3. Design system

Dark, premium, appetizing. **Never hardcode a hex value in a component** — use a
token (SCSS `$en-*` variable or the CSS custom property `--en-*`).

### Palette (in `_tokens.scss`)

| Token                    | Value     | Use                                   |
| ------------------------ | --------- | ------------------------------------- |
| `--en-bg`                | `#0E0F12` | App background (deep charcoal)        |
| `--en-surface`           | `#1D2027` | Cards / raised surfaces               |
| `--en-crimson`           | `#C1121F` | Primary (butcher crimson)             |
| `--en-accent`            | `#E63946` | Brighter accent red / hover           |
| `--en-gold`              | `#D4A017` | Premium accent, links, CTAs           |
| `--en-green`             | `#2E7D32` | In-stock / fresh badges               |
| `--en-text`              | `#FAF5EC` | Primary text (warm cream)             |
| `--en-text-dim`          | `#CFC8BA` | Secondary text                        |
| `--en-muted`             | `#8B8578` | Meta / muted text                     |

### Typography

- **Playfair Display** — display headings (`.en-display`, `<h1>`–`<h6>`, `.display-*`).
- **Inter** — body & UI. Loaded via `<link>` in `index.html`.

### Reusable classes worth knowing

`.en-container` (max-width shell), `.en-card` / `.en-card--hover`, `.en-badge--fresh|gold|crimson|neutral`,
`.en-eyebrow` (uppercase gold kicker), `.en-text-gradient`, `.en-divider`,
`.btn-gold` / `.btn-outline-cream` / `.btn-ghost` (extra button variants on top of Bootstrap).

Radii are generous and pill-shaped on buttons; shadows are soft. Add subtle
hover motion (translateY, gold border) — see `.en-card--hover`.

### Bootstrap

Bootstrap is customized through `_bootstrap-overrides.scss` (which maps our tokens
onto `$primary`, `$body-bg`, `$card-bg`, radii, shadows, fonts) and forced into
dark mode. Use Bootstrap's grid/utilities freely; reach for `.en-*` classes for
brand-specific surfaces.

---

## 4. UI kit (`components/ui`)

Import from the barrel: `import { Button, Card, Price, Badge } from '@/components/ui';`

| Component         | Purpose                                                        |
| ----------------- | -------------------------------------------------------------- |
| `Button`          | `variant` (primary/gold/outline/ghost/danger), `size`, `isLoading`, `leftIcon` |
| `Badge`           | Status pill — `tone` fresh/gold/crimson/neutral                |
| `Card`            | Rounded surface — `hoverable`, `glass`, `padding`              |
| `Price`           | Renders paise + optional MRP strike-through + `% OFF`          |
| `Rating`          | Read-only 5-star with partial fill + count                    |
| `Spinner`         | Gold loading spinner                                           |
| `Skeleton`        | Shimmer placeholder — `width`/`height`/`radius`/`count`        |
| `EmptyState`      | Empty list placeholder with icon/title/action                 |
| `QuantityStepper` | +/- counter (cart & product tiles)                            |
| `Modal`           | Portal dialog with fade/scale motion                          |
| `Drawer`          | Portal slide-in panel (mini-cart, filters)                    |

Keep primitives **small, typed and presentational** — no data fetching inside them.

---

## 5. Adding a page (feature-folder pattern)

1. **Create the page component** at `src/pages/<Name>/<Name>.tsx` with a
   **default export** returning `JSX.Element`. Replace the `PageStub` body.
2. **Register the route** — add a `path` to `ROUTES` in `routes/routes.ts` and a
   typed builder in `paths`, then add the `<Route>` in `routes/AppRouter.tsx`.
   Always link with `paths.foo(id)`, never a raw string.
3. **Put feature logic in a feature folder**, not the page. A feature owns its
   API calls, query hooks, types and context:

   ```
   src/features/<feature>/
     <feature>.api.ts     # thin apiClient wrappers returning DTOs
     use<Feature>.ts      # react-query hooks (queries/mutations)
     <Feature>Context.tsx # only if cross-page state is needed
     index.ts             # barrel
   ```

   The page composes UI-kit primitives + the feature's hooks. Cross-feature UI
   that isn't a primitive goes in `components/`.

---

## 6. Calling the API

Everything goes through `apiClient` (`src/lib/apiClient.ts`), which:

- prefixes `baseURL` `/api/v1`,
- attaches the Bearer access token from the auth store,
- **unwraps the `{ success, data, message }` envelope** so `response.data` is the
  DTO directly,
- on a `401`, refreshes the access token once and retries; on failure, logs out.

### Pattern: API function + react-query hook

```ts
// features/catalog/catalog.api.ts
import type { ProductDTO } from '@elite/shared';
import { apiClient } from '@/lib/apiClient';

export async function fetchProduct(slug: string): Promise<ProductDTO> {
  const { data } = await apiClient.get<ProductDTO>(`/catalog/products/${slug}`);
  return data; // already unwrapped
}
```

```ts
// features/catalog/useProduct.ts
import { useQuery } from '@tanstack/react-query';
import { fetchProduct } from './catalog.api';

export function useProduct(slug: string) {
  return useQuery({ queryKey: ['product', slug], queryFn: () => fetchProduct(slug) });
}
```

- **Query keys** are arrays, most-specific-last: `['product', slug]`, `['cart']`.
- **Mutations** call the API function and either `setQueryData` or
  `invalidateQueries` the affected key (see `CartContext` for the pattern).
- Use `getApiErrorMessage(error)` for user-facing error text.
- Reuse Zod schemas from `@elite/shared` (`loginSchema`, `registerSchema`,
  `addressSchema`) with React Hook Form via `@hookform/resolvers/zod`.

### Money & weight

Always format with `src/lib/money.ts`: `formatPaise(49900) → "₹499"`,
`formatWeight(1000) → "1 kg"`, `discountPercent(mrp, price)`. Or drop in the
`<Price>` primitive.

---

## 7. Auth & cart state

- **Auth** — `useAuth()` gives `{ user, isAuthenticated, login, register, logout }`.
  Tokens live in a framework-agnostic `authStore` (localStorage + pub/sub) so
  axios can refresh without React. Never read tokens directly in components.
- **Cart** — `useCart()` gives `{ cart, itemCount, addItem, updateItem, removeItem,
  applyCouponCode, clearCouponCode, clear, isLoading, isMutating }`. **The cart is
  server-owned and requires login.** `addItem` on a guest rejects with
  `RequireLoginError` — catch it and redirect to `paths.login()`, then resume.
  This keeps the server the single source of truth for pricing/stock/totals (no
  guest-cart merge logic). If a guest cart is later required, layer it here only.

---

## 8. Naming & conventions

- **Components / types:** `PascalCase`. **Hooks:** `useCamelCase`. **Files:** match
  the default export (`ProductDetail.tsx`); non-component modules `camelCase.ts`.
- **API modules:** `<feature>.api.ts`. **Context:** `<Feature>Context.tsx`.
- **CSS classes:** brand classes are prefixed `en-`. Prefer tokens over literals.
- **Imports:** use the `@/` alias for `src` (no deep `../../..`). Import order:
  external → `@elite/shared` → `@/…` → relative. Import shared DTOs/enums as
  `import type` where they are types.
- **TypeScript:** strict; **no `any`**, no unused locals/params (enforced). Type every
  prop; components return `JSX.Element`.
- Keep components small and presentational; push data/logic into feature hooks.
- Respect `prefers-reduced-motion` (already handled globally) when adding motion.
```
