# Chapter 17 — Code Quality, Structure & Component Standards

> **Status:** Mandatory rulebook. Every developer, on every commit, follows this chapter.
> **Owner:** Tech Lead / Senior Staff Engineer.
> **Scope:** Monorepo — `frontend/` (Customer Web), `admin/` (Admin Panel), `backend/` (Node + Express + TypeScript), `shared/` (cross-cutting code).
> **Client mandate:** A CLEAN, well-maintained codebase is the #1 engineering priority. No dead code, no copy-paste, small single-responsibility components, consistent naming, DRY. This is a first-class deliverable, enforced by tooling and PR review — not an afterthought.

This chapter is the source of truth for *how code is written and organized*. Where any other chapter conflicts with this one on structure or naming, this chapter wins.

---

## 17.1 Core Principles

The codebase is optimized for **readability and change**, not for cleverness. Code is read far more often than it is written. Every rule below serves one goal: a new developer can open any file and understand it in under a minute.

### 17.1.1 The Seven Principles

| # | Principle | What it means in practice |
|---|-----------|---------------------------|
| 1 | **Single Responsibility** | One file, one component, one function = one reason to change. A `ProductCard` renders a product card. It does not also fetch data, format currency, and open a modal. |
| 2 | **DRY (Don't Repeat Yourself)** | If the same logic appears in 2+ places, extract it (hook, util, service, shared type). Copy-paste is a review blocker. |
| 3 | **No dead code** | No commented-out blocks, no unreachable branches, no unused exports/imports/vars, no "temporary" scaffolding left behind. Git history is our archive — delete freely. |
| 4 | **No noise in production** | No `console.log` / `console.debug` in shipped code. Use the logger. Debug logs are removed before PR, not after. |
| 5 | **Small files** | Files stay small enough to hold in your head (see size table in 17.1.3). Big file = split it. |
| 6 | **Meaningful names** | Names describe intent, not type or mechanism. `serviceablePincodes`, not `arr2`. `isSlotAvailable`, not `flag`. |
| 7 | **Self-documenting code** | The code explains *what*; comments explain only *why*. If you need a comment to explain what a line does, rename or refactor instead. |

### 17.1.2 "Definition of Clean" Checklist

A file/module/PR is **clean** only when ALL of these are true:

- [ ] Every function does one thing; its name says what that thing is.
- [ ] No commented-out code anywhere.
- [ ] No `console.*` in application code (logger only).
- [ ] No unused imports, variables, props, params, or exports.
- [ ] No `TODO` / `FIXME` / `HACK` left without a linked ticket ID.
- [ ] No magic numbers or magic strings — named constants only.
- [ ] No duplicated logic that should be shared.
- [ ] No `any` in TypeScript (see 17.5).
- [ ] Names are meaningful and consistent with the naming table (17.2).
- [ ] File is within the size guideline; large files are split by responsibility.
- [ ] Formatting is Prettier-clean and ESLint passes with zero warnings.
- [ ] Business logic is out of the UI/controller layer (in services/hooks).
- [ ] Loading, error, and empty states are handled (frontend) / errors are typed and centralised (backend).

### 17.1.3 Size Guidelines (soft limits — refactor when exceeded)

| Unit | Target | Hard smell (refactor) |
|------|--------|-----------------------|
| React component file | ≤ 150 lines | > 200 lines |
| Function / method | ≤ 30 lines | > 50 lines |
| Function parameters | ≤ 3 (use an options object beyond that) | > 4 |
| Nesting depth | ≤ 3 levels | > 3 (use early returns / guard clauses) |
| Controller method | ≤ 15 lines | > 25 lines |
| Service method | ≤ 40 lines | > 60 lines |
| JSX return per component | one clear tree | multiple unrelated trees = split |

> These are **guidelines, not linter-hard failures** for most, but reviewers cite them by number. A component at 250 lines is not "wrong syntax" — it is a review comment: "split by responsibility."

### 17.1.4 DO / DON'T

**DO**
- Delete code you replace. Trust git.
- Extract a well-named function instead of writing an explanatory comment.
- Prefer early returns (guard clauses) over nested `if/else`.
- Keep the "happy path" left-aligned; handle errors first.

**DON'T**
- Don't comment out code "in case we need it." Delete it.
- Don't leave `console.log("here")` — it will reach production.
- Don't write `// this loops the products` above a `products.map(...)`.
- Don't ship a 400-line "God" component that does fetching, state, and rendering.

---

## 17.2 Naming Conventions

Naming is enforced by ESLint where possible and by review everywhere else. **One convention per category — no exceptions.**

| Category | Convention | Example | Notes |
|----------|-----------|---------|-------|
| Folders | `kebab-case` | `order-history/`, `delivery-slot/` | Feature folders are singular-domain, plural resource (`products/`). |
| React component file | `PascalCase.tsx` | `ProductCard.tsx`, `SlotPicker.tsx` | One component per file; filename = component name. |
| React component | `PascalCase` | `ProductCard`, `CheckoutSummary` | Nouns / noun phrases. |
| Non-component TS/JS file | `kebab-case.ts` | `price-format.ts`, `cart.service.ts` | Utilities, services, config. |
| Custom hook file + fn | `useXxx` (camelCase) | `useCart.ts` → `useCart()` | Always prefixed `use`. |
| Variables & functions | `camelCase` | `serviceablePincodes`, `calculateCartTotal()` | Functions are verbs; booleans read as questions (`isSlotAvailable`, `hasStock`). |
| Constants (module-level, fixed) | `UPPER_SNAKE_CASE` | `FREE_SHIPPING_THRESHOLD`, `MAX_WEIGHT_TOLERANCE_PCT` | Real constants only; not every `const`. |
| Enums (TS) | `PascalCase` name, `UPPER_SNAKE` members | `OrderStatus.OUT_FOR_DELIVERY` | Prefer string enums / const objects. |
| TS type / interface | `PascalCase`, **no `I` prefix** | `Product`, `CreateOrderDto`, `CartLine` | Suffix DTOs with `Dto`. Suffix API payloads with `Request` / `Response`. |
| TS generics | Single cap letter or `PascalCase` | `T`, `TData`, `TError` | |
| Prisma model | `PascalCase` singular | `Product`, `OrderItem`, `DeliverySlot` | |
| DB table (via `@@map`) | `snake_case` plural | `products`, `order_items`, `delivery_slots` | Map every model with `@@map`; columns `@map` to `snake_case`. |
| API route path | `kebab-case`, plural nouns | `/api/v1/delivery-slots`, `/api/v1/orders/:orderId/items` | No verbs in paths — HTTP method is the verb. Resource IDs are named params (`:orderId`). |
| Query/body fields (JSON) | `camelCase` | `pincode`, `slotId`, `paymentMethod` | Consistent with TS; Prisma maps to snake_case at the DB edge. |
| CSS / custom class | `kebab-case`, BEM-ish | `product-card`, `product-card__price--offer` | Prefer Bootstrap utilities first; custom classes only when Bootstrap can't express it. |
| Bootstrap usage | Bootstrap tokens as-is | `d-flex`, `mb-3`, `btn btn-primary` | Don't wrap Bootstrap classes in redundant custom ones. |
| Env vars | `UPPER_SNAKE_CASE`, prefixed | `DATABASE_URL`, `REDIS_URL`, `RAZORPAY_KEY_ID`, `VITE_API_BASE_URL` | Frontend-exposed vars use the build tool's public prefix (e.g. `VITE_`). Never expose secrets to the client. |
| Git branch | `type/short-desc` (kebab) | `feat/delivery-slot-booking`, `fix/cod-order-total` | Types: `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `hotfix`. Optional ticket: `feat/ELN-142-slot-booking`. |
| Commit message | Conventional Commits | `feat(checkout): add pincode serviceability check` | See 17.8.2. |

### 17.2.1 Naming DO / DON'T

**DO**
- Name booleans as yes/no questions: `isServiceable`, `canCheckout`, `hasStock`.
- Name collections as plurals: `orders`, `cartLines`, `slots`.
- Name a value by its meaning: `weightTolerancePct`, not `wtp` or `x`.

**DON'T**
- Don't prefix interfaces with `I` (`IProduct` ❌ → `Product` ✅).
- Don't abbreviate domain words: `qty` is acceptable and common; `srvcblPncds` is not.
- Don't put verbs in REST paths (`/getOrders` ❌ → `GET /orders` ✅).
- Don't mix casing for the same concept (`slotId` here, `slot_id` there in the same JSON layer).

---

## 17.3 Frontend (React) Structure & Component Standards

Applies to both `frontend/` (Customer Web) and `admin/` (Admin Panel). Both are React + Bootstrap 5. Admin adds Chart.js + React Table but follows the same structure.

### 17.3.1 Organisation model: feature-first, atomic-shared

We combine two ideas:

1. **Feature folders** own everything for one domain (products, cart, checkout, orders…). This is where 90% of code lives.
2. **A shared UI kit** (`src/components/ui/`) holds *presentational, domain-agnostic* building blocks reused across features (Button, Modal, Input, Badge, Spinner, EmptyState).

```
frontend/src/
├── app/                      # app shell: router, providers, layout
│   ├── router.tsx
│   ├── providers.tsx         # QueryClientProvider, AuthProvider, etc.
│   └── layouts/              # AppLayout, AuthLayout
├── components/
│   └── ui/                   # reusable, DUMB, domain-agnostic components
│       ├── Button/
│       ├── Modal/
│       ├── Input/
│       ├── Spinner/
│       └── EmptyState/
├── features/                 # one folder per business domain
│   └── products/
│       ├── components/       # presentational, product-specific
│       │   ├── ProductCard.tsx
│       │   ├── ProductGrid.tsx
│       │   └── WeightVariantSelector.tsx
│       ├── pages/            # route-level containers
│       │   ├── ProductListPage.tsx
│       │   └── ProductDetailPage.tsx
│       ├── hooks/            # data + logic hooks for this feature
│       │   ├── useProducts.ts
│       │   └── useProductDetail.ts
│       ├── api/              # Axios service calls for this feature
│       │   └── products.api.ts
│       ├── types/            # feature-local types (shared ones live in shared/)
│       │   └── product.types.ts
│       └── index.ts          # public surface of the feature (barrel)
├── hooks/                    # cross-feature hooks (useDebounce, useMediaQuery)
├── lib/                      # axios instance, query client, formatters
│   ├── axios.ts
│   ├── queryClient.ts
│   └── format.ts             # formatCurrency (₹), formatWeight (g/kg)
├── constants/                # app-wide constants
└── styles/                   # global scss/css, Bootstrap overrides
```

> **Rule:** if code is used by **one** feature, it lives in that feature folder. If used by **2+** features/panels, it moves up — to `src/hooks`, `src/lib`, `src/components/ui`, or the monorepo `shared/` package (see 17.6).

### 17.3.2 Container vs Presentational

| Type | Also called | Responsibility | Knows about |
|------|-------------|----------------|-------------|
| **Container** | Page / smart | Fetches data (via hooks), owns state, wires callbacks, handles loading/error/empty | TanStack Query, hooks, routing |
| **Presentational** | Dumb / UI | Receives props, renders markup, emits events via callbacks | Only its props |

- **Pages** (`features/*/pages/`) are containers.
- **Components** (`features/*/components/` and `components/ui/`) are presentational and must stay dumb.
- A dumb component **never** calls `useQuery`, Axios, or `useNavigate`. It takes data + handlers as props.

### 17.3.3 When to split a component

Split when **any** of these is true:

- File exceeds ~150 lines.
- The component renders 2+ visually/semantically distinct sections that could be named.
- A block of JSX is repeated.
- A `return` has 3+ levels of conditional rendering.
- You're tempted to name an inner chunk with a comment (`{/* --- price section --- */}`) — that chunk is a component.
- A piece of logic could be reused → extract a **hook**, not a bigger component.

### 17.3.4 Reusable UI library (`components/ui/`)

- Wrap Bootstrap, don't fight it. `Button` renders a Bootstrap `btn` with typed `variant` / `size` props.
- Every `ui` component is: dumb, fully typed props, no domain knowledge, no data fetching.
- Folder-per-component with colocated styles/tests:

```
components/ui/Button/
├── Button.tsx
├── Button.module.css   # only if Bootstrap utilities are insufficient
├── Button.test.tsx
└── index.ts
```

### 17.3.5 Custom hooks for logic reuse

- All non-trivial logic and **all** data access live in hooks, not components.
- Data hooks wrap TanStack Query: `useProducts()`, `useCart()`, `useDeliverySlots(pincode)`.
- Pure UI/util logic lives in generic hooks: `useDebounce`, `useDisclosure`, `useMediaQuery`.
- A component body should read like a summary: call hooks, then return JSX.

### 17.3.6 Props typing & keeping components dumb

- Every component has an explicit `Props` type/interface. No implicit `any`, no untyped `props`.
- Prefer discrete props over passing large objects when only a few fields are used — but pass a domain object (`product: Product`) when the component is *about* that object.
- No default exports for components in feature code where a barrel `index.ts` re-exports named — **named exports** keep refactors and search clean. (Pages may default-export for lazy routes.)

### 17.3.7 Avoiding prop drilling

Order of preference:

1. **Server state → TanStack Query.** Never store fetched server data in Context or Redux; read it where needed via the query hook (it's cached and deduped).
2. **Cross-cutting client state → Context** (auth/session, active pincode/zone, cart drawer open). Keep contexts small and single-purpose.
3. **Local state stays local** (`useState`) — don't lift it "just in case."

> If you're passing a prop through 3+ layers that don't use it, that's prop drilling → move it to a query hook or a focused context.

### 17.3.8 Forms — React Hook Form (mandatory)

- All forms use **React Hook Form**. No hand-rolled `onChange` state soup.
- Validation schema is shared with the backend where possible (Zod schema in `shared/` — see 17.6), consumed via a resolver.
- One field wrapper component (`FormField`) standardises label + control + error text.
- On submit, call a **mutation hook** (TanStack Query `useMutation`) that calls the Axios service — the component never talks to Axios directly.

### 17.3.9 API layer — Axios services (no scattered `fetch`)

- **Zero** `fetch()` or inline `axios.get()` inside components. Ever.
- One shared Axios instance in `lib/axios.ts` (base URL from env, interceptors for auth token + error normalisation).
- Each feature has `api/<feature>.api.ts` exporting typed functions: `getProducts()`, `getProductById(id)`, `createOrder(dto)`.
- Query/mutation hooks call these services; components call the hooks.

Layering (strict, one direction):

```
Component  →  Hook (useQuery/useMutation)  →  Axios service (api/*.api.ts)  →  HTTP
   (dumb)        (feature logic)                 (typed request/response)
```

### 17.3.10 TanStack Query key conventions

- Query keys are arrays, structured **coarse → fine**, and centralised per feature (no stringly-typed keys sprinkled around).

| Data | Query key |
|------|-----------|
| Product list (filtered) | `['products', 'list', filters]` |
| Single product | `['products', 'detail', productId]` |
| Cart | `['cart']` |
| Delivery slots for a pincode | `['delivery-slots', pincode]` |
| Orders list | `['orders', 'list', params]` |

- Define a `productKeys` factory object per feature so keys are reused and invalidation is exact (`queryClient.invalidateQueries({ queryKey: productKeys.lists() })`).
- Set sane `staleTime` per data type in one place; don't tune it ad hoc in components.

### 17.3.11 Loading / Error / Empty states (all three, every time)

Every data-driven view handles **all three** states explicitly — never render assuming data exists.

| State | Standard UI |
|-------|-------------|
| Loading | Skeleton or `<Spinner />` from `ui/` |
| Error | `<ErrorState onRetry={…} />` — never a blank screen or raw error |
| Empty (200 but no data) | `<EmptyState />` with message + optional CTA |
| Success | The actual content |

> Reviewers reject any list/detail view that shows a blank screen while loading or on error.

### 17.3.12 Ideal feature-folder tree (reference)

```
features/checkout/
├── pages/
│   └── CheckoutPage.tsx           # container: orchestrates steps
├── components/
│   ├── AddressStep.tsx
│   ├── DeliverySlotStep.tsx
│   ├── PaymentStep.tsx            # Razorpay / PhonePe / Cashfree / COD selector
│   └── OrderSummary.tsx
├── hooks/
│   ├── useCheckout.ts             # step/state machine
│   ├── usePlaceOrder.ts           # useMutation → orders.api
│   └── useServiceability.ts       # pincode/zone check
├── api/
│   └── checkout.api.ts
├── types/
│   └── checkout.types.ts
└── index.ts
```

### 17.3.13 Frontend DO / DON'T

**DO**
- Keep components under 150 lines and dumb.
- Put every API call behind an Axios service + a query/mutation hook.
- Handle loading, error, and empty states.
- Format money and weight through `lib/format.ts` (`₹`, g/kg) — one source of truth.

**DON'T**
- Don't `fetch()` inside a component.
- Don't store server data in Context/Redux.
- Don't inline business rules (e.g. free-shipping threshold) in JSX — read a shared constant.
- Don't create `utils.js` dumping grounds; name files by purpose.

---

## 17.4 Backend (Node / Express / TypeScript) Structure Standards

The backend is organised as **feature modules** under `backend/src/modules/`. Each module is self-contained and follows the same anatomy. Deployment is native VPS (NGINX + PM2) — module structure is independent of deployment.

### 17.4.1 Feature module anatomy

```
backend/src/
├── modules/
│   └── orders/
│       ├── orders.routes.ts        # path + method → controller; attaches middleware
│       ├── orders.controller.ts    # HTTP in/out ONLY (thin)
│       ├── orders.service.ts       # business logic (fat)
│       ├── orders.repository.ts    # the ONLY place Prisma is touched for orders
│       ├── orders.validation.ts    # Zod schemas (DTO validation at the edge)
│       ├── orders.types.ts         # module-local types / DTO types
│       └── orders.constants.ts     # module constants (no magic values)
├── middlewares/                    # reusable: auth, rbac, validate, errorHandler, rateLimit
├── lib/                            # prisma client, redis client, bullmq queues, logger
├── config/                         # env loading + typed config object
├── common/                         # shared helpers: asyncHandler, ApiError, ApiResponse
└── app.ts / server.ts              # wiring, not logic
```

### 17.4.2 Layer responsibilities (strict, one direction)

```
Route  →  Middleware (auth, rbac, validate)  →  Controller  →  Service  →  Repository  →  Prisma/DB
                                                   (thin)       (logic)     (data only)
```

| Layer | Does | Must NOT |
|-------|------|----------|
| **Routes** | Map method+path to controller; attach middleware | Contain any logic |
| **Controller** | Read validated input, call one service method, shape the HTTP response | Contain business rules, touch Prisma, build queries |
| **Service** | All business logic, orchestration, transactions, calls repositories, enqueues jobs | Read `req`/`res`, know about HTTP |
| **Repository** | All Prisma access for its domain; returns typed data | Contain business rules |
| **Validation** | Zod schema per route; parse & type the input at the edge | — |

### 17.4.3 Thin controllers, fat services

- **Controllers are ≤ 15 lines.** Pattern: take validated DTO → call service → return typed response. No `if` business branches.
- **No business logic in routes or controllers.** Weight-tolerance recalculation, coupon rules, serviceability, stock decrement, COD rules → all in services.
- Services are the testable core of the app.

### 17.4.4 DTO + validation at the edge (Zod)

- Every request body/params/query is validated by a **Zod** schema via a reusable `validate(schema)` middleware **before** the controller runs.
- The inferred type (`z.infer`) *is* the DTO type — no separate hand-written duplicate.
- Invalid input never reaches a service. Services can trust their inputs.

### 17.4.5 Prisma access only in repositories

- `prisma.*` appears **only** in `*.repository.ts`. No Prisma calls in controllers, services, or routes.
- This keeps data access swappable, testable, and centralises query performance concerns.
- Services depend on repository functions, not on the Prisma client.

### 17.4.6 Centralised error handling + async wrapper

- Wrap every async controller in a single `asyncHandler` so rejected promises reach the error middleware — **no `try/catch` in every controller**.
- One typed `ApiError` class (`statusCode`, `message`, `code`, optional `details`). Services `throw new ApiError(...)`.
- One global `errorHandler` middleware (registered last) converts any error to a consistent JSON shape and logs it. Controllers never format error responses themselves.

### 17.4.7 Typed, consistent responses

- One response shape across the whole API, e.g. `{ success, data, error, meta }`, produced via a small `ApiResponse` helper.
- Success payload types are shared (`shared/` types) so frontend and backend agree.

### 17.4.8 Config & constants (no magic values)

- **All** environment access goes through one typed `config` object (`config/index.ts`) that validates env at boot (fail fast if a required var is missing). No `process.env.X` scattered in modules.
- No magic numbers/strings in logic. `FREE_SHIPPING_THRESHOLD_INR`, `MAX_WEIGHT_TOLERANCE_PCT`, `SLOT_CUTOFF_MINUTES`, `OrderStatus.CONFIRMED` — named in module or shared constants.

### 17.4.9 Reusable middlewares

- Cross-cutting concerns are middleware, written once: `authenticate`, `authorize(...roles)` (RBAC), `validate(schema)`, `rateLimit`, `errorHandler`, `requestLogger`.
- No copy-pasted auth checks inside controllers.

### 17.4.10 Background work (BullMQ) & cache (Redis)

- Long/async work (notifications: SMTP/SMS/WhatsApp, report generation, stock reconciliation) is **enqueued** from services onto BullMQ queues; processors live in a `jobs/` or per-module `*.processor.ts`. Controllers never do slow work inline.
- Redis access is wrapped in `lib/redis.ts` helpers; cache keys are namespaced constants, not inline strings.

### 17.4.11 Backend DO / DON'T

**DO**
- Keep controllers thin; put logic in services.
- Touch Prisma only in repositories.
- Validate every input with Zod at the edge.
- Throw `ApiError`; let the central handler format it.

**DON'T**
- Don't write `prisma.order.findMany` in a controller.
- Don't `try/catch` in every controller — use `asyncHandler`.
- Don't read `process.env` outside `config/`.
- Don't hardcode `699`, `20`, `"CONFIRMED"` in logic — name them.

---

## 17.5 TypeScript Rules

TypeScript is mandatory on the backend and on both React apps. `strict` is on everywhere.

| Rule | Requirement |
|------|-------------|
| **Strict mode** | `"strict": true` in every `tsconfig`. Also `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch`. |
| **No `any`** | `any` is banned (`@typescript-eslint/no-explicit-any` = error). For truly unknown data use `unknown` + narrow it. |
| **Narrow, don't cast** | Prefer type guards / Zod parsing over `as`. `as` is a review flag and needs justification. |
| **No `@ts-ignore`** | Use `@ts-expect-error` with a comment only when unavoidable; treat as tech debt with a ticket. |
| **Shared types live in `shared/`** | Domain types used by 2+ packages live once in `shared/` (see 17.6). No re-declaring `Product` in three places. |
| **No duplicate types** | One canonical definition per concept. Derive with utility types (`Pick`, `Omit`, `Partial`) instead of copying. |
| **Return-type discipline** | Exported/public functions declare explicit return types. Service and repository functions are explicitly typed. |
| **Prefer `type`/`interface` consistently** | `interface` for object shapes that may extend; `type` for unions/utilities. Be consistent within a file. |
| **Enums** | Prefer string literal unions or `as const` objects over numeric enums for serialisable values (order status, payment method). |

**DO:** model server responses as shared types; parse external/unknown input with Zod then flow the inferred type.
**DON'T:** reach for `any` to "make the error go away," or duplicate a DTO in frontend and backend.

---

## 17.6 Shared Code & DRY Strategy (`shared/`)

The monorepo `shared/` package is the anti-duplication backbone consumed by `frontend/`, `admin/`, and `backend/`.

### 17.6.1 What belongs in `shared/`

| Goes in `shared/` | Example |
|-------------------|---------|
| Domain **types / interfaces** | `Product`, `Order`, `CartLine`, `DeliverySlot` |
| **DTOs** & API request/response types | `CreateOrderRequest`, `OrderResponse` |
| **Validation schemas** (Zod) | `createOrderSchema` — one schema, used by RHF (frontend) and `validate` (backend) |
| **Constants / enums** | `OrderStatus`, `PaymentMethod`, `FREE_SHIPPING_THRESHOLD_INR` |
| **Pure utils** | `formatCurrencyInr`, `formatWeight`, `calculateCartTotal` (framework-agnostic, no DOM, no Node-only APIs) |

### 17.6.2 What does NOT belong in `shared/`

- React components/hooks (frontend-only) → stay in the app.
- Prisma client, repositories, Express middleware (backend-only) → stay in `backend/`.
- Anything importing `react`, `express`, or `@prisma/client` (keep `shared/` dependency-light and universal).

### 17.6.3 The extraction rule

> **If a type, constant, schema, or pure function is used in 2+ packages — or you're about to copy-paste it — it moves to `shared/`.** First use: local. Second use: extract.

**DO:** define the order-status enum and free-shipping threshold once in `shared/` and import everywhere.
**DON'T:** hardcode `₹699` in the cart badge, the checkout total, and the backend shipping calc separately.

---

## 17.7 Linting & Formatting

Zero-warning policy: **CI fails on any ESLint warning or Prettier diff.** Clean isn't optional.

### 17.7.1 Toolchain intent

- **ESLint** — correctness + consistency. Base: `eslint:recommended` + `@typescript-eslint` (type-aware) + `eslint-plugin-react` + `eslint-plugin-react-hooks` + `eslint-plugin-import`. Backend adds Node rules.
- **Prettier** — formatting only (single source of truth for style; ESLint doesn't fight it — `eslint-config-prettier` disables stylistic rules).
- **import ordering** — enforced groups + alphabetical, no unresolved imports.
- **Config lives at the repo root**, extended per package; identical rules across `frontend/`, `admin/`, `backend/`, `shared/`.

### 17.7.2 Key enforced rules

| Rule | Setting | Why |
|------|---------|-----|
| `@typescript-eslint/no-explicit-any` | error | No `any` |
| `@typescript-eslint/no-unused-vars` | error (args after last-used ignored) | No dead vars/imports |
| `no-console` | error (allow `warn`/`error` only via logger config) | No stray logs in prod |
| `no-debugger` | error | No debugger left in |
| `react-hooks/rules-of-hooks` | error | Hook correctness |
| `react-hooks/exhaustive-deps` | warn → treated as error in CI | Correct effect deps |
| `import/order` | error | Consistent, readable imports |
| `import/no-duplicates` | error | One import line per module |
| `no-magic-numbers` | warn (with sensible ignores: 0,1,-1) | Push toward named constants |
| `eqeqeq` | error | `===` only |
| `complexity` / `max-depth` | warn | Flags over-nested logic |

### 17.7.3 Pre-commit & CI gate

- **husky** runs a pre-commit hook; **lint-staged** runs ESLint `--fix` + Prettier + `tsc --noEmit` on staged files only (fast).
- **commitlint** validates the commit message against Conventional Commits on `commit-msg`.
- **CI lint gate:** every PR runs `lint`, `format:check`, and `type-check` across all packages. Red = not mergeable. No overrides without Tech Lead sign-off.

---

## 17.8 Git Workflow & PR Standards

### 17.8.1 Branching

- Trunk-based-ish: short-lived branches off `main` (or `develop` if used), merged via PR.
- Branch names: `type/short-desc` (see 17.2). One branch = one focused change.
- No direct commits to `main`. `main` is always deployable (native VPS deploy: GitHub Actions → SSH → pull → build → `pm2 reload`).

### 17.8.2 Conventional Commits

Format: `type(scope): summary` — imperative, lower-case, no trailing period.

| Type | Use |
|------|-----|
| `feat` | New user-facing capability |
| `fix` | Bug fix |
| `refactor` | Code change, no behaviour change |
| `chore` | Tooling, deps, config |
| `docs` | Documentation only |
| `test` | Tests only |
| `perf` | Performance |
| `hotfix` | Urgent production fix |

Examples: `feat(delivery): add pincode serviceability check`, `fix(orders): correct COD weight-tolerance total`, `refactor(cart): extract useCartTotal hook`.

### 17.8.3 Small PRs

- Target **< 400 lines changed**. Large PRs are split. One PR = one concern.
- PR description states: what, why, how to test, screenshots (UI), and linked ticket.
- No mixing refactor + feature in one PR unless trivially related.

### 17.8.4 PR review checklist (clean-code focused)

Reviewers explicitly verify — a PR is **blocked** if any fails:

- [ ] **No dead code** — no commented-out blocks, no unused imports/vars/exports.
- [ ] **No `console.*`** / `debugger`.
- [ ] **No duplication** — repeated logic extracted (hook/util/service/shared).
- [ ] **Naming** matches the convention table (17.2).
- [ ] **Component/function size** within guidelines; God components split.
- [ ] **No leftover `TODO`/`FIXME`** without a linked ticket.
- [ ] **No `any`**; inputs validated (Zod) on the backend.
- [ ] **Layering respected** — no Prisma in controllers, no `fetch` in components, no business logic in JSX/routes.
- [ ] **States handled** — loading/error/empty (frontend); typed errors (backend).
- [ ] **Constants** used instead of magic numbers/strings.
- [ ] Tests updated/added for logic; CI green (lint + type-check + tests).

> Reviewers approve clean code, not just working code. "It works" is necessary, not sufficient.

---

## 17.9 Testing & Documentation Expectations (brief)

- **Where tests live:** colocated with the unit (`Button.test.tsx` next to `Button.tsx`; `orders.service.test.ts` next to the service). Integration/e2e in a top-level `tests/` per package.
- **What must be tested:** services (business logic) on the backend; hooks and non-trivial components on the frontend. Pure utils in `shared/` are easy wins — test them.
- **README per package:** `frontend/`, `admin/`, `backend/`, `shared/` each has a README covering purpose, setup, scripts, and folder conventions (pointing back to this chapter).
- **JSDoc/TSDoc** for non-obvious exported functions — explain the *why* and edge cases (e.g. weight-tolerance rounding), not the obvious *what*. Self-documenting code needs no narration comments.

---

## 17.10 Anti-Patterns to Reject in Review

These are automatic review blockers. If you see one, request changes.

| Anti-pattern | Why it's rejected | Do instead |
|--------------|-------------------|------------|
| **God component / God service** | Impossible to read, test, or reuse | Split by responsibility |
| **Copy-paste code** | Breaks DRY; bugs multiply | Extract hook/util/service/shared |
| **Business logic in JSX** | Untestable, unreadable | Move to a hook/service |
| **`fetch`/Axios inside components** | Bypasses the API/query layer | Axios service + query hook |
| **Prisma calls in controllers/services** | Breaks layering, unswappable | Repository only |
| **Business logic in controllers/routes** | Untestable, bloated controllers | Service layer |
| **Unused imports / variables** | Dead code, noise | Delete |
| **Commented-out code** | Rot; git already stores history | Delete |
| **`console.log` in app code** | Leaks to prod, noise | Logger |
| **Deeply nested conditionals** | Cognitive overload | Guard clauses / early returns |
| **Huge files (200+ line components)** | Unmaintainable | Split |
| **Magic numbers / strings** | Unclear intent, drift | Named constants (shared where reused) |
| **`any` everywhere** | Defeats TypeScript | `unknown` + narrowing, real types |
| **Inconsistent naming** | Slows everyone down | Follow the naming table |
| **Prop drilling 3+ levels** | Fragile plumbing | Query hook / focused context |
| **`utils.js` dumping ground** | Nothing findable | Purpose-named files |
| **`TODO` with no ticket** | Forgotten forever | Link a ticket or do it |

---

## 17.11 Developer Golden Rules & Code Review Checklist

### 17.11.1 Developer Golden Rules (pin this)

1. **Leave it cleaner than you found it.** Boy-scout rule applies to every file you open.
2. **One thing per file, function, and component.** If you use "and" to describe it, split it.
3. **Delete, don't comment out.** Git is the archive.
4. **No `any`, no magic values, no `console.log`.** Ever, in shipped code.
5. **If it's used twice, extract it.** Hook, util, service, or `shared/`.
6. **Components stay dumb; logic lives in hooks and services.**
7. **Data flows one way:** component → hook → service → HTTP (FE); route → controller → service → repository (BE).
8. **Validate at the edge, trust inside.** Zod on every backend input.
9. **Name for the reader, not the writer.** Meaningful, consistent, convention-matching.
10. **Handle loading, error, and empty.** No blank screens, no unhandled throws.
11. **Small PRs, Conventional Commits, green CI.**
12. **Prisma only in repositories; env only in config.**

### 17.11.2 Code Review Checklist (used on EVERY PR)

| # | Check | Pass? |
|---|-------|:-----:|
| 1 | No dead/commented-out code | ☐ |
| 2 | No `console.*` / `debugger` | ☐ |
| 3 | No unused imports / vars / exports / props | ☐ |
| 4 | No duplication — shared logic extracted | ☐ |
| 5 | Naming follows convention table (17.2) | ☐ |
| 6 | Files/functions/components within size guidelines | ☐ |
| 7 | No `any`; explicit return types on public fns | ☐ |
| 8 | Backend inputs validated with Zod at the edge | ☐ |
| 9 | Prisma only in repositories | ☐ |
| 10 | No business logic in controllers/routes/JSX | ☐ |
| 11 | No `fetch`/Axios directly in components | ☐ |
| 12 | Constants used — no magic numbers/strings | ☐ |
| 13 | Loading / error / empty states handled | ☐ |
| 14 | Shared types/constants/schemas in `shared/`, not duplicated | ☐ |
| 15 | No `TODO`/`FIXME` without a linked ticket | ☐ |
| 16 | Tests added/updated for logic | ☐ |
| 17 | Conventional commit(s) + small, focused PR | ☐ |
| 18 | CI green: lint + format + type-check + tests | ☐ |

> **Merge rule:** all 18 boxes checked and CI green. Clean code is the deliverable — reviewers enforce it here, not later.
