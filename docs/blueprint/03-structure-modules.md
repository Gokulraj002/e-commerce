# 03 — Folder Structure & Modules

> **Project:** Ojiva AI Technologies — Enterprise E-Commerce Web Application (fresh non-veg / cold-chain meat delivery, single-store, D2C)
> **Reference:** elitenonveg.com · **Region:** Hyderabad (hyperlocal, zone/pincode) · **Currency:** INR (₹)
> **Stack (fixed):** React + Bootstrap 5 (Customer & Admin) · Node.js + Express + **TypeScript** REST · PostgreSQL + **Prisma** · Redis · **BullMQ** · Native VPS deploy — Ubuntu + NGINX + PM2 (no Docker) · Razorpay/PhonePe/Cashfree/COD
> **Scope:** Phase 1 = Web only (Customer Website + Admin Panel + Backend APIs), **API-first** so future Android / iOS / Delivery-Boy apps reuse the same backend.

This chapter is the developer's starting map. **Chapter 4** defines the physical folder/file layout of the whole monorepo (with special depth on the backend, because that is where engineers begin). **Chapter 5** defines every business module, its logic, owners, dependencies, and roadmap — all tied to the meat / weight / cold-chain reality of the business.

---

# CHAPTER 4 — FOLDER STRUCTURE

## 4.1 Guiding Principles

Before the trees, these are the non-negotiable rules every folder decision obeys. They exist so a new developer can predict where any file lives without asking.

| # | Principle | What it means in practice |
|---|-----------|---------------------------|
| 1 | **Monorepo, multi-app** | One Git repository holds all deployable apps (`frontend`, `admin`, `backend`) plus cross-cutting packages (`shared`, `database`, `deployment`, `docs`). One clone, one source of truth, atomic cross-app commits. |
| 2 | **API-first** | The `backend` is the single brain. `frontend` and `admin` (and future mobile apps) are pure API clients. No business logic is duplicated in the UI. |
| 3 | **Feature/module-based backend** | The backend is organised by *business capability* (`orders`, `inventory`, `delivery`…), NOT by technical layer at the top level. Everything one feature needs sits in one folder. |
| 4 | **Contract sharing via `shared`** | TypeScript types, DTOs, enums, validation schemas, and constants that both server and clients must agree on live once in `shared/` and are imported everywhere. One source of truth for the "shape" of data. |
| 5 | **Config at the edges, never inline** | No secrets, URLs, or tunables hardcoded. Everything flows from `env` → a typed `config` object → the code. |
| 6 | **Convention over configuration** | Predictable, boring naming. If you know one module's layout you know all of them. |
| 7 | **Cold-chain awareness is structural** | Perishability is not an afterthought bolted on later — `inventory` (kg stock), `delivery` (slots/zones), and `jobs`/`queues` (cut-off automation, stock reservation expiry) are first-class top-level concerns. |

### Naming conventions (apply repo-wide)

| Artifact | Convention | Example |
|----------|-----------|---------|
| Folders | `kebab-case`, plural for collections | `product-variants/`, `middlewares/` |
| Backend module folder | `kebab-case`, singular business noun | `order/`, `delivery/`, `audit-log/` |
| React components | `PascalCase.tsx` | `ProductCard.tsx`, `SlotPicker.tsx` |
| React hooks | `useX.ts` camelCase | `useCart.ts`, `useServiceability.ts` |
| Backend files | `feature.role.ts` | `order.controller.ts`, `order.service.ts` |
| Prisma models | `PascalCase` singular | `Order`, `ProductVariant`, `DeliverySlot` |
| DB tables | `snake_case` plural (Prisma `@@map`) | `order_items`, `delivery_slots` |
| Constants / enums | `SCREAMING_SNAKE_CASE` values | `ORDER_STATUS.OUT_FOR_DELIVERY` |
| Env variables | `SCREAMING_SNAKE_CASE`, prefixed | `RAZORPAY_KEY_ID`, `REDIS_URL` |
| API routes | `kebab-case`, versioned, plural | `/api/v1/delivery-slots` |
| Shared DTO files | `*.dto.ts`, `*.schema.ts`, `*.types.ts` | `order.dto.ts`, `checkout.schema.ts` |

---

## 4.2 Top-Level Monorepo Layout

```
ojiva-meat-ecommerce/
├── frontend/               # Customer-facing React storefront (Bootstrap 5)
├── admin/                  # Internal Admin Panel React app (Bootstrap 5 + Chart.js)
├── backend/                # Node + Express + TypeScript REST API (the single brain)
├── database/               # Prisma schema, migrations, seeders (DB source of truth)
├── shared/                 # Cross-app TS types, DTOs, enums, validation, constants
├── deployment/             # Native VPS ops: NGINX site config, PM2 ecosystem, deploy/backup/setup scripts, env templates, systemd notes
├── docs/                   # This blueprint, API docs, ERD, runbooks
├── .github/                # GitHub Actions workflows (CI/CD pipelines)
├── .gitignore
├── .editorconfig           # Consistent whitespace/charset across all editors
├── .nvmrc                  # Pinned Node version for every developer & CI
├── package.json            # Root workspace manifest (npm/pnpm/yarn workspaces)
├── pnpm-workspace.yaml     # Declares workspace packages (frontend, admin, backend, shared)
├── tsconfig.base.json      # Base TS config extended by every app (paths, strict mode)
├── turbo.json              # (optional) Task pipeline/orchestration & build caching
└── README.md               # Repo overview + quick-start
```

| Folder | Purpose |
|--------|---------|
| `frontend/` | The customer storefront. Everything the shopper touches: catalog, product-by-weight, cart, serviceability check, checkout, slot booking, order tracking, account. |
| `admin/` | The back-office cockpit for staff. Dashboards, product/inventory management, order fulfilment, delivery/slot control, reports, RBAC, CMS, settings. |
| `backend/` | The authoritative REST API. Owns all business rules, DB access, payments, queues, notifications. Consumed by `frontend`, `admin`, and later mobile apps. |
| `database/` | The persistence contract: Prisma schema, versioned migrations, and seed data. Kept as its own package so DB evolution is reviewed independently. |
| `shared/` | The "contract" package. Types/DTOs/enums/validation used by **all** apps so the client and server never drift apart. |
| `deployment/` | Everything to ship & run in production on the native Ubuntu VPS: production NGINX site config, PM2 `ecosystem.config.js`, deploy/backup/server-setup shell scripts, `.env` templates, and systemd/`pm2 startup` notes. No container artefacts — PostgreSQL, Redis, Node and NGINX all run directly on the host. |
| `docs/` | Living documentation: this blueprint, API reference, ERD, and operational runbooks. |
| `.github/` | GitHub Actions definitions — lint, test, build, deploy pipelines. |
| Root config files | Workspace wiring, shared TS base config, Node pinning, formatting rules that every sub-app inherits. |

> **Why a monorepo?** The single most valuable property here is the **shared contract**. When the backend changes an `OrderStatus` enum or a checkout payload, the change lands in `shared/` and TypeScript instantly flags every place in `frontend` and `admin` that must update — in the same pull request. For a perishable business where an order-state or slot mistake means spoiled meat and refunds, that compile-time safety is worth more than the convenience of separate repos.

---

## 4.3 `frontend/` — Customer React App

```
frontend/
├── public/
│   ├── index.html
│   ├── favicon.ico
│   └── robots.txt
├── src/
│   ├── api/                    # Axios instance + typed API call wrappers (one file per domain)
│   │   ├── axiosClient.ts      # Base Axios: baseURL, interceptors, auth header, error normaliser
│   │   ├── auth.api.ts
│   │   ├── products.api.ts
│   │   ├── cart.api.ts
│   │   ├── checkout.api.ts
│   │   ├── orders.api.ts
│   │   ├── delivery.api.ts     # serviceability, slots
│   │   └── index.ts
│   ├── assets/                 # Static images, icons, fonts, brand illustrations
│   │   ├── images/
│   │   ├── icons/
│   │   └── styles/             # Global SCSS, Bootstrap 5 theme overrides, variables
│   ├── components/             # Reusable, presentational, business-agnostic UI
│   │   ├── common/             # Button, Modal, Spinner, Toast, Pagination, EmptyState
│   │   ├── layout/             # Navbar, Footer, MobileBottomNav, Container
│   │   ├── product/            # ProductCard, PriceTag, WeightBadge, FreshnessTag
│   │   ├── cart/               # CartLineItem, MiniCart, QtyStepper
│   │   └── forms/              # Input, Select, PincodeInput, controlled RHF fields
│   ├── features/               # Feature-scoped logic (state slices, feature components)
│   │   ├── auth/               # Login/OTP/register logic + local state
│   │   ├── catalog/            # Filtering, sorting, category browse logic
│   │   ├── cart/               # Cart calculations, weight totals
│   │   ├── serviceability/     # Pincode/zone check flow
│   │   ├── checkout/           # Multi-step checkout orchestration
│   │   └── orders/             # Order history, live tracking
│   ├── pages/                  # Route-level screens (one folder/file per URL)
│   │   ├── Home/
│   │   ├── CategoryListing/
│   │   ├── ProductDetail/
│   │   ├── Cart/
│   │   ├── Checkout/
│   │   ├── OrderConfirmation/
│   │   ├── OrderTracking/
│   │   ├── Account/            # Profile, addresses, wishlist, membership
│   │   └── Static/             # CMS-driven pages (About, FAQ, Policies)
│   ├── hooks/                  # Reusable React hooks
│   │   ├── useAuth.ts
│   │   ├── useCart.ts
│   │   ├── useServiceability.ts
│   │   ├── useDebounce.ts
│   │   └── useMediaQuery.ts
│   ├── context/                # React Context providers (global cross-cutting state)
│   │   ├── AuthContext.tsx
│   │   ├── CartContext.tsx
│   │   ├── ServiceabilityContext.tsx   # selected zone/pincode + slot held across app
│   │   └── ThemeContext.tsx
│   ├── routes/                 # Route table, guards, lazy imports
│   │   ├── AppRoutes.tsx
│   │   ├── ProtectedRoute.tsx  # requires login
│   │   └── routePaths.ts       # single source of URL strings
│   ├── layouts/                # Page shells that wrap route groups
│   │   ├── MainLayout.tsx      # Navbar + Footer for storefront
│   │   ├── AuthLayout.tsx      # Minimal shell for login/register
│   │   └── AccountLayout.tsx   # Sidebar shell for account section
│   ├── utils/                  # Pure helpers (no React)
│   │   ├── formatCurrency.ts   # ₹ INR formatting
│   │   ├── formatWeight.ts     # 250g / 500g / 1kg display
│   │   ├── validators.ts
│   │   └── date.ts             # slot/date helpers
│   ├── config/                 # Frontend runtime config from env (API URL, keys)
│   │   └── env.ts
│   ├── lib/                    # 3rd-party client setup (TanStack Query client, maps loader)
│   │   ├── queryClient.ts
│   │   └── googleMaps.ts
│   ├── types/                  # Frontend-only view types (re-exports from shared/)
│   ├── App.tsx
│   └── main.tsx                # App bootstrap / render root
├── .env.example
├── package.json
├── tsconfig.json
└── vite.config.ts
```

| Folder | Purpose |
|--------|---------|
| `public/` | Static files served as-is; HTML shell, favicon, robots. |
| `src/api/` | The **only** place HTTP happens. One typed wrapper file per backend domain, all built on a single configured Axios instance. TanStack Query hooks call these. |
| `src/assets/` | Images, icons, fonts, and global styles including the Bootstrap 5 brand override. |
| `src/components/` | Dumb, reusable UI blocks with no business knowledge. Grouped by area (`common`, `layout`, `product`, `cart`, `forms`). |
| `src/features/` | Feature-scoped logic and stateful components. A feature owns its slice; pages compose features. |
| `src/pages/` | One screen per route. Thin — they assemble features and components. |
| `src/hooks/` | Reusable behaviour (auth, cart, serviceability, debounce). |
| `src/context/` | App-wide state that must survive navigation: who is logged in, cart contents, chosen delivery zone/slot. |
| `src/routes/` | Central route table, lazy loading, and guards (`ProtectedRoute`). |
| `src/layouts/` | Shared shells (main, auth, account) so pages don't repeat chrome. |
| `src/utils/` | Pure functions — currency (₹), weight (g/kg), dates, validators. |
| `src/config/` | Reads Vite env into a typed object; no `import.meta.env` scattered in code. |
| `src/lib/` | Third-party client initialisation (TanStack Query client, Google Maps loader). |
| `src/types/` | View-model types; business types are imported from `shared/`. |

---

## 4.4 `admin/` — Admin React App

Mirrors `frontend`'s conventions so a developer moves between them effortlessly, plus the back-office extras: **charts**, **data tables**, and **RBAC-aware UI**.

```
admin/
├── public/
├── src/
│   ├── api/                    # Typed API wrappers for every admin domain
│   │   ├── axiosClient.ts
│   │   ├── dashboard.api.ts
│   │   ├── products.api.ts
│   │   ├── inventory.api.ts
│   │   ├── orders.api.ts
│   │   ├── delivery.api.ts
│   │   ├── customers.api.ts
│   │   ├── reports.api.ts
│   │   ├── rbac.api.ts
│   │   └── settings.api.ts
│   ├── assets/
│   ├── components/
│   │   ├── common/
│   │   ├── layout/             # AdminSidebar, Topbar, Breadcrumbs
│   │   ├── charts/             # Chart.js wrappers: LineChart, BarChart, DonutChart, KpiCard
│   │   ├── tables/             # React Table wrappers: DataTable, column defs, filters, CSV export
│   │   └── forms/
│   ├── features/
│   │   ├── dashboard/
│   │   ├── catalog/            # products, categories, brands, attributes, variants
│   │   ├── inventory/          # kg stock, batches, cut-off, low-stock alerts
│   │   ├── orders/             # fulfilment board, status transitions, weight adjustment
│   │   ├── delivery/           # zones, slots, capacity, partner assignment
│   │   ├── customers/
│   │   ├── marketing/          # coupons, CMS banners
│   │   ├── reports/
│   │   └── settings/
│   ├── pages/                  # Route screens per module
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── usePermission.ts    # gate UI by RBAC permission code
│   │   └── useTableQuery.ts    # server-side pagination/sort/filter binding
│   ├── context/
│   │   ├── AuthContext.tsx
│   │   └── PermissionContext.tsx   # current admin's role + permission set
│   ├── rbac/                   # Client-side authorization primitives
│   │   ├── permissions.ts      # permission code constants (mirror of shared/)
│   │   ├── Can.tsx             # <Can permission="orders.update">…</Can> guard component
│   │   └── roleMenu.ts         # which sidebar items each role sees
│   ├── routes/
│   │   ├── AppRoutes.tsx
│   │   ├── ProtectedRoute.tsx
│   │   └── PermissionRoute.tsx # route-level permission gate
│   ├── layouts/
│   │   ├── AdminLayout.tsx     # sidebar + topbar shell
│   │   └── AuthLayout.tsx
│   ├── utils/
│   ├── config/
│   ├── lib/
│   ├── types/
│   ├── App.tsx
│   └── main.tsx
├── .env.example
├── package.json
├── tsconfig.json
└── vite.config.ts
```

| Folder | Purpose |
|--------|---------|
| `src/components/charts/` | Reusable Chart.js wrappers (line/bar/donut/KPI) used across dashboard and reports. |
| `src/components/tables/` | React Table wrappers: the shared `DataTable` with server-side pagination, sorting, filtering, and CSV export — the workhorse of every admin list screen. |
| `src/features/` | Back-office feature logic grouped by module (catalog, inventory, orders, delivery, reports, settings). |
| `src/rbac/` | Client-side authorization: permission-code constants, a `<Can>` guard component, and `roleMenu` so each role sees only its allowed navigation. **UI gating only — the backend is the real enforcer.** |
| `src/hooks/usePermission.ts` | Convenience hook to check the logged-in admin's permission set. |
| `src/routes/PermissionRoute.tsx` | Blocks a whole route unless the admin holds the required permission. |
| `src/layouts/AdminLayout.tsx` | The persistent sidebar + topbar cockpit shell. |
| Everything else | Same intent and conventions as `frontend/` (see §4.3). |

---

## 4.5 `backend/` — Node + Express + TypeScript (the deep one)

This is where developers start, so it gets the fullest tree. The backend is **feature/module-based**: each business capability is a self-contained folder holding its routes, controller, service, validation, types, and tests. Cross-cutting technical concerns (config, middlewares, jobs, queues, shared services, prisma access, utils) live in sibling folders that every module can draw on.

### 4.5.1 Full backend tree

```
backend/
├── src/
│   ├── config/                     # Typed configuration loaded from env — no inline secrets
│   │   ├── env.ts                  # Validates & exposes all env vars (fails fast if missing)
│   │   ├── database.ts             # Prisma client singleton export
│   │   ├── redis.ts                # Redis connection (cache + BullMQ backing store)
│   │   ├── logger.ts               # Pino/Winston logger config
│   │   ├── cors.ts                 # Allowed origins per environment
│   │   ├── rateLimit.ts            # Rate-limit policy config
│   │   ├── payment.ts              # Razorpay / PhonePe / Cashfree keys & endpoints
│   │   ├── storage.ts              # AWS S3 / Cloudinary config
│   │   ├── mail.ts                 # SMTP config
│   │   └── constants.ts            # Server-only constants (defaults, tolerances)
│   │
│   ├── modules/                    # ★ FEATURE-BASED — the heart of the backend
│   │   ├── auth/
│   │   │   ├── auth.routes.ts       # Express router: endpoint → middleware → controller
│   │   │   ├── auth.controller.ts   # HTTP layer: parse req, call service, shape res
│   │   │   ├── auth.service.ts      # Business logic: OTP, JWT issue/refresh, sessions
│   │   │   ├── auth.validation.ts   # Zod schemas for login/register/refresh payloads
│   │   │   ├── auth.types.ts        # Module-local interfaces
│   │   │   └── auth.test.ts
│   │   ├── users/                   # Admin/staff user accounts (distinct from customers)
│   │   ├── customers/               # Customer profiles, membership plans
│   │   ├── addresses/               # Customer addresses + geo/pincode linkage
│   │   ├── products/
│   │   │   ├── products.routes.ts
│   │   │   ├── products.controller.ts
│   │   │   ├── products.service.ts
│   │   │   ├── products.validation.ts
│   │   │   ├── products.types.ts
│   │   │   └── products.test.ts
│   │   ├── categories/              # Poultry / Mutton / Seafood / Eggs / Ready-to-Cook
│   │   ├── brands/
│   │   ├── attributes/              # Cut type, bone-in/boneless, cleaned, marination
│   │   ├── variants/                # ★ Weight packs: 250g / 500g / 1kg, price-per-pack
│   │   ├── inventory/               # ★ kg/gram stock, batches, reservations, cut-off
│   │   ├── warehouse/               # Store/hub definitions, zone→warehouse mapping
│   │   ├── cart/                    # Server-authoritative cart (weight-aware totals)
│   │   ├── wishlist/
│   │   ├── coupons/                 # Discounts, free-shipping-over-₹699 rule
│   │   ├── checkout/                # Orchestrates serviceability + slot + payment init
│   │   ├── orders/                  # ★ Order lifecycle, items, weight-variance adjustment
│   │   ├── payments/                # ★ Gateway integration + COD + webhooks + refunds
│   │   ├── delivery/                # ★ Zones, pincode serviceability, slots, capacity, fleet
│   │   ├── reviews/                 # Product ratings & reviews (verified purchase)
│   │   ├── reports/                 # Sales/inventory/delivery analytics aggregation
│   │   ├── cms/                     # Banners, static pages, offers, menus
│   │   ├── settings/                # Global store settings (tax, thresholds, toggles)
│   │   ├── notifications/           # Notification Center: email/SMS/WhatsApp dispatch
│   │   ├── roles/                   # RBAC roles
│   │   ├── permissions/             # RBAC permission catalogue + role→permission map
│   │   ├── logs/                    # System/application logs API
│   │   └── audit-logs/              # Who-did-what immutable trail
│   │
│   ├── middlewares/                # Express middleware (cross-cutting request concerns)
│   │   ├── authenticate.ts          # Verify JWT, attach user to req
│   │   ├── authorize.ts             # RBAC: require permission code(s)
│   │   ├── validate.ts              # Runs a Zod schema against req (body/params/query)
│   │   ├── errorHandler.ts          # Central error → normalised JSON response
│   │   ├── notFound.ts              # 404 fallthrough
│   │   ├── rateLimiter.ts           # Redis-backed rate limiting
│   │   ├── requestLogger.ts         # Structured request logging + request-id
│   │   ├── auditContext.ts          # Captures actor/ip for audit-logs
│   │   └── tenantGuard.ts           # (reserved) single-store guard / future multi-store
│   │
│   ├── jobs/                       # ★ BullMQ WORKERS — background processors
│   │   ├── workers/
│   │   │   ├── notification.worker.ts    # Send email/SMS/WhatsApp from queue
│   │   │   ├── order.worker.ts           # Post-order side effects (invoice, stock commit)
│   │   │   ├── inventory.worker.ts       # Release expired stock reservations
│   │   │   ├── slotCutoff.worker.ts      # Lock slots at cut-off time, roll capacity
│   │   │   ├── payment.worker.ts         # Reconcile pending payments, retry captures
│   │   │   ├── report.worker.ts          # Heavy report generation / exports
│   │   │   └── cleanup.worker.ts         # Purge stale carts, temp files, old logs
│   │   ├── schedulers/                    # Repeatable/cron job definitions
│   │   │   ├── slotCutoff.scheduler.ts    # Enqueue cut-off checks every N minutes
│   │   │   ├── lowStock.scheduler.ts      # Daily low-stock (kg) alert scan
│   │   │   └── reconciliation.scheduler.ts
│   │   └── index.ts                       # Boots all workers (separate PM2 process)
│   │
│   ├── queues/                     # BullMQ QUEUE definitions (producers side)
│   │   ├── queueNames.ts            # Central enum of queue names
│   │   ├── notification.queue.ts
│   │   ├── order.queue.ts
│   │   ├── inventory.queue.ts
│   │   ├── payment.queue.ts
│   │   ├── report.queue.ts
│   │   └── index.ts                # Queue registry + connection wiring
│   │
│   ├── services/                  # Cross-module / infrastructure services (not one feature)
│   │   ├── payment/                # Gateway adapters behind one interface
│   │   │   ├── PaymentGateway.ts        # Common interface (init, verify, refund, webhook)
│   │   │   ├── razorpay.provider.ts
│   │   │   ├── phonepe.provider.ts
│   │   │   ├── cashfree.provider.ts
│   │   │   └── cod.provider.ts
│   │   ├── notification/           # Channel adapters behind one interface
│   │   │   ├── email.service.ts         # SMTP
│   │   │   ├── sms.service.ts           # SMS gateway
│   │   │   ├── whatsapp.service.ts      # WhatsApp API
│   │   │   └── push.service.ts          # Firebase (future)
│   │   ├── storage/                # S3 / Cloudinary upload abstraction
│   │   │   └── storage.service.ts
│   │   ├── maps/                   # Google Maps: geocode, distance, zone resolve
│   │   │   └── maps.service.ts
│   │   ├── cache/                  # Redis get/set/invalidate helpers
│   │   │   └── cache.service.ts
│   │   └── pdf/                    # Invoice / label generation
│   │       └── invoice.service.ts
│   │
│   ├── prisma/                    # Prisma access layer (schema lives in /database)
│   │   ├── client.ts               # Instantiates & exports PrismaClient (singleton)
│   │   ├── extensions.ts           # Prisma client extensions (soft-delete, audit hooks)
│   │   └── seed-helpers.ts         # Reusable seed utilities called by /database seeders
│   │
│   ├── routes/                    # Root route composition
│   │   ├── index.ts                # Mounts every module router under /api/v1
│   │   └── v1.ts                   # Version 1 aggregation (future: v2.ts)
│   │
│   ├── types/                     # Backend-wide shared types
│   │   ├── express.d.ts            # Augments Express Request (req.user, req.auditContext)
│   │   ├── api.types.ts            # Standard ApiResponse / paginated envelope
│   │   └── enums.ts                # Re-exports from shared/ for server use
│   │
│   ├── utils/                     # Pure server helpers
│   │   ├── apiResponse.ts          # success()/error() response builders
│   │   ├── AppError.ts             # Typed error class hierarchy
│   │   ├── asyncHandler.ts         # Wrap async controllers, forward errors
│   │   ├── pagination.ts           # Parse & build pagination
│   │   ├── weight.ts               # kg⇄g math, weight-tolerance calc
│   │   ├── price.ts                # ₹ money math (integer paise), rounding
│   │   ├── otp.ts                  # OTP generation/verification helpers
│   │   ├── slug.ts
│   │   └── datetime.ts             # Slot/cut-off time math (IST-aware)
│   │
│   ├── app.ts                     # Express app: middleware chain + route mounting
│   └── server.ts                  # HTTP bootstrap: start listening, graceful shutdown
│
├── tests/                         # Cross-cutting / integration / e2e tests
│   ├── integration/
│   ├── e2e/
│   ├── fixtures/
│   └── setup.ts
├── .env.example
├── package.json
├── tsconfig.json
└── jest.config.ts
```

### 4.5.2 Anatomy of one module (the pattern to copy)

Every folder under `src/modules/` follows the **same 6-file shape**. Learn it once; it repeats everywhere.

| File | Layer | Responsibility |
|------|-------|----------------|
| `*.routes.ts` | Transport | Declares endpoints and wires each to `authenticate` → `authorize` → `validate` → controller. No logic. |
| `*.controller.ts` | HTTP | Reads the request, calls the service, returns a normalised response. Knows about HTTP; knows **nothing** about SQL. |
| `*.service.ts` | Business logic | The brain of the module. Enforces rules, calls Prisma, coordinates queues/other services. Framework-agnostic and unit-testable. |
| `*.validation.ts` | Contract | Zod schemas validating body/params/query — imported from or aligned with `shared/`. |
| `*.types.ts` | Types | Module-local interfaces not shared beyond the module. |
| `*.test.ts` | Tests | Unit tests for the service's business rules. |

**Request flow through the layers:**

```
HTTP Request
    │
    ▼
[ routes ]  → picks endpoint, applies middleware chain
    │
    ▼
[ authenticate ] → [ authorize (RBAC) ] → [ validate (Zod) ]
    │
    ▼
[ controller ]  → parses input, shapes output   (no business rules)
    │
    ▼
[ service ]     → BUSINESS LOGIC, the decisions live here
    │            ├──► [ prisma ]      (read/write PostgreSQL)
    │            ├──► [ services/ ]   (payment, maps, cache, storage)
    │            └──► [ queues ]      (enqueue background work → jobs/workers)
    ▼
[ apiResponse ] → normalised JSON envelope
    │
    ▼
HTTP Response
```

### 4.5.3 Where do new features go?

A crisp rule so nobody has to ask:

| You are adding… | Put it here |
|-----------------|-------------|
| A whole new business capability (e.g. "Subscriptions", "Gift Cards") | New folder in `src/modules/<feature>/` with the standard 6 files. |
| A new endpoint on an existing capability | Add to that module's `routes` + `controller` + `service`. |
| A background/async job | A worker in `jobs/workers/`, a queue in `queues/`, enqueued from the relevant service. |
| A new payment gateway / notification channel | A new provider under `services/payment/` or `services/notification/` implementing the existing interface. Nothing else changes. |
| A shared data shape used by clients too | Add the DTO/type/enum in `shared/`, then import it in the module. |
| A DB structural change | Edit the schema in `database/prisma/schema.prisma`, create a migration, update the service. |
| A cross-cutting request rule | New middleware in `src/middlewares/`. |

> **The golden rule:** business decisions live in **services**; controllers stay thin; the shape of anything crossing the wire lives in **shared**. If you are writing an `if` that decides *what the business does*, it belongs in a service.

### 4.5.4 Process topology (how the tree maps to running processes)

The one codebase runs as **two PM2 process types** off the same build:

```
                       ┌──────────────────────────┐
  HTTP (NGINX) ───────▶│  API process (server.ts) │──┐
                       │  app.ts + modules + routes│  │      ┌────────────┐
                       └──────────────────────────┘  ├─────▶│ PostgreSQL │
                                    │ enqueue          │      └────────────┘
                                    ▼                  │      ┌────────────┐
                       ┌──────────────────────────┐   ├─────▶│   Redis    │◀─┐
                       │  Redis (BullMQ backing)   │   │      └────────────┘  │
                       └──────────────────────────┘   │                       │
                                    │ consume          │                       │
                                    ▼                  │                       │
                       ┌──────────────────────────┐   │   BullMQ jobs         │
                       │ Worker process (jobs/     │◀──┘   (backed by Redis) ──┘
                       │ index.ts + workers)       │
                       └──────────────────────────┘
```

The **API process** answers HTTP and *produces* jobs; the **Worker process** *consumes* them (notifications, slot cut-offs, reservation expiry, reconciliation). Splitting them means a slow report or a WhatsApp send never blocks a customer's checkout.

---

## 4.6 `database/` — Prisma Schema, Migrations, Seeders

```
database/
├── prisma/
│   ├── schema.prisma           # ★ Single source of truth for all models & relations
│   ├── migrations/             # Auto-generated, versioned, committed SQL migrations
│   │   ├── 20260101000000_init/
│   │   └── .../
│   └── models/                 # (optional) split schema files if using prismaSchemaFolder
│       ├── product.prisma
│       ├── order.prisma
│       ├── inventory.prisma
│       └── delivery.prisma
├── seeders/                    # Deterministic seed scripts
│   ├── seed.ts                 # Entry point orchestrating all seeders
│   ├── 01-roles-permissions.seed.ts
│   ├── 02-categories.seed.ts   # Poultry / Mutton / Seafood / Eggs / Ready-to-Cook
│   ├── 03-products-variants.seed.ts   # Sample SKUs with 250g/500g/1kg packs
│   ├── 04-zones-slots.seed.ts  # Hyderabad zones/pincodes + delivery slots
│   ├── 05-settings.seed.ts     # Free-ship threshold ₹699, tax, tolerances
│   └── data/                   # Static CSV/JSON reference data (pincodes, zones)
├── .env.example                # DATABASE_URL template
└── README.md                   # Migration & seeding runbook
```

| Folder | Purpose |
|--------|---------|
| `prisma/schema.prisma` | The authoritative data model — every table, column, relation, index. Prisma generates the typed client from this. |
| `prisma/migrations/` | Version-controlled, forward-only migrations. Reviewed in PRs like code; applied identically in every environment. |
| `prisma/models/` | Optional split of the schema by domain for readability on large models. |
| `seeders/` | Idempotent scripts that populate reference and demo data — roles/permissions, categories, sample weight-variant products, Hyderabad zones & slots, store settings. |
| `seeders/data/` | Raw reference datasets (serviceable pincodes, zone polygons) kept as data, not code. |

> **Why `database/` is its own package (not inside `backend/`):** the schema is a *contract* the whole business depends on. Isolating it makes DB changes a deliberate, independently-reviewable event, and lets future services (mobile BFF, analytics) point at the same schema without importing the API app.

---

## 4.7 `deployment/` — Native VPS Ops (NGINX, PM2, Scripts, Env)

This is the **only** deployment package — there is no `docker/` folder and no container artefacts. Everything here provisions and runs the stack directly on the Ubuntu VPS. Full step-by-step build is in Chapter 16 (`07-deployment-vps.md`).

```
deployment/
├── nginx/
│   ├── customer.conf           # Server block: serves /var/www/customer React build + SPA fallback
│   ├── admin.conf              # Server block: serves /var/www/admin React build (admin subdomain)
│   ├── api.conf                # Reverse-proxy /api → 127.0.0.1:4000 (PM2 cluster)
│   ├── gzip.conf               # Shared gzip/compression + static cache headers
│   └── rate-limit.conf         # Edge rate-limit zones (login, OTP, checkout, webhook)
├── pm2/
│   └── ecosystem.config.js     # PM2 apps: api (cluster mode) + worker (BullMQ) + env per stage
├── scripts/
│   ├── setup-server.sh         # One-time provisioning: users, ufw, Node, PM2, PostgreSQL, Redis, NGINX, Certbot
│   ├── deploy.sh               # git pull → npm ci → prisma migrate deploy → build → pm2 reload
│   ├── backup.sh               # pg_dump → gzip → upload to S3 (cron-driven)
│   ├── restore-db.sh           # Restore from a chosen pg_dump artefact
│   └── health-check.sh         # Curl API /health + pm2 status probe
├── systemd/
│   └── NOTES.md                # pm2 startup (systemd unit) + optional worker/cron unit notes
├── env/
│   ├── .env.backend.example
│   ├── .env.frontend.example
│   ├── .env.admin.example
│   └── .env.worker.example
└── README.md                   # Deployment runbook (provisioning + deploy + rollback)
```

| Folder / File | Purpose |
|---------------|---------|
| `nginx/` | Native NGINX site config: two server blocks serving the customer and admin React builds from `/var/www`, one reverse-proxy block for `/api → 127.0.0.1:4000`, plus shared gzip/caching and rate-limit tuning. Copied into `/etc/nginx/sites-available` on the VPS. |
| `pm2/ecosystem.config.js` | Declares the runtime processes — **API in cluster mode** (one instance per CPU core) and the **BullMQ worker** as a separate process — plus per-environment env injection. |
| `scripts/` | Idempotent shell ops: `setup-server.sh` (first-time provisioning), `deploy.sh` (zero-downtime deploy via `pm2 reload`), `backup.sh` / `restore-db.sh`, and `health-check.sh`. |
| `systemd/NOTES.md` | How PM2 is persisted across reboots via `pm2 startup` (generated systemd unit) and where cron units for backups live. |
| `env/` | Templates (never real secrets) documenting every variable each service needs; real `.env` files live on the server only, never in git. |
| CI/CD | GitHub Actions live in `/.github/workflows`; the deploy workflow **SSHes into the VPS and runs `scripts/deploy.sh`** — no image build/registry step. |

---

## 4.8 `shared/` — The Cross-App Contract

The most strategically important package after the backend. It is the **single definition** of the shapes both server and clients must agree on. Change it once; TypeScript enforces agreement everywhere.

```
shared/
├── src/
│   ├── types/                  # Domain entity interfaces (Product, Order, Slot…)
│   │   ├── product.types.ts
│   │   ├── variant.types.ts    # weight-pack shape
│   │   ├── order.types.ts
│   │   ├── delivery.types.ts   # zone, slot, serviceability
│   │   ├── payment.types.ts
│   │   ├── user.types.ts
│   │   └── index.ts
│   ├── dto/                    # Request/response payload shapes per endpoint
│   │   ├── auth.dto.ts
│   │   ├── checkout.dto.ts
│   │   ├── order.dto.ts
│   │   └── index.ts
│   ├── enums/                  # Canonical enums used by ALL apps
│   │   ├── orderStatus.enum.ts       # PLACED, CONFIRMED, PACKED, OUT_FOR_DELIVERY, DELIVERED, CANCELLED
│   │   ├── paymentStatus.enum.ts
│   │   ├── paymentMethod.enum.ts     # RAZORPAY, PHONEPE, CASHFREE, COD
│   │   ├── deliverySlotStatus.enum.ts
│   │   ├── roles.enum.ts             # Super Admin … Customer
│   │   ├── permissions.enum.ts       # e.g. orders.update, inventory.adjust
│   │   └── index.ts
│   ├── validation/             # Zod schemas shared by frontend forms & backend validate
│   │   ├── auth.schema.ts
│   │   ├── address.schema.ts
│   │   ├── checkout.schema.ts
│   │   └── index.ts
│   ├── constants/              # Business constants used everywhere
│   │   ├── business.ts         # FREE_SHIP_THRESHOLD=699, WEIGHT_TOLERANCE_PCT, currency=INR
│   │   ├── weights.ts          # PACK_SIZES = [250, 500, 1000] (grams)
│   │   └── index.ts
│   └── index.ts                # Barrel export for the whole package
├── package.json
└── tsconfig.json
```

| Folder | Purpose |
|--------|---------|
| `types/` | Canonical entity interfaces (Product, Variant, Order, Slot, Payment). The client and server describe the same object the same way. |
| `dto/` | The exact shape of each API request and response body. |
| `enums/` | Status/method/role/permission enums — the vocabulary the whole system speaks. An order status can never be spelled two ways. |
| `validation/` | Zod schemas reused by frontend forms (client validation) **and** backend `validate` middleware (server validation) — one rule set, no drift. |
| `constants/` | Business numbers that must match across apps: free-ship threshold ₹699, pack sizes, weight tolerance, currency. |

**Cross-reference map (who imports `shared`):**

```
                         ┌───────────────┐
                         │    shared/    │  types · dto · enums · validation · constants
                         └──────┬────────┘
              ┌─────────────────┼──────────────────┐
              ▼                 ▼                  ▼
        ┌──────────┐      ┌──────────┐       ┌──────────┐
        │ frontend │      │  admin   │       │ backend  │
        └──────────┘      └──────────┘       └────┬─────┘
                                                  ▼
                                            (validates against
                                             the same schemas)
        (future) android · ios · delivery-boy apps → also import shared/
```

---

## 4.9 `docs/` — Documentation

```
docs/
├── blueprint/                  # This master blueprint (chapter files)
│   ├── 00-PROJECT-BRIEF.md
│   ├── 03-structure-modules.md   # ← this document
│   └── ...
├── api/
│   ├── openapi.yaml            # OpenAPI/Swagger spec (generated + curated)
│   └── postman_collection.json
├── erd/
│   ├── erd.png                 # Entity-relationship diagram export
│   └── erd.dbml                # Source DBML for the ERD
├── runbooks/                   # Operational how-tos
│   ├── deploy.md
│   ├── incident-response.md
│   ├── db-backup-restore.md
│   └── slot-capacity-tuning.md
└── README.md
```

| Folder | Purpose |
|--------|---------|
| `blueprint/` | The design bible (this file among them) — the shared context every author and developer starts from. |
| `api/` | The living API contract: OpenAPI spec + Postman collection for client and QA teams. |
| `erd/` | The visual data model and its source, kept in sync with `database/`. |
| `runbooks/` | Operational procedures for the on-call engineer — deploys, incidents, backups, slot tuning. |

---

## 4.10 Chapter 4 — Summary

- **Monorepo** with three deployable apps (`frontend`, `admin`, `backend`) and four support packages (`database`, `shared`, `deployment`, `docs`).
- The **backend is feature/module-based**: each capability is a self-contained 6-file folder; cross-cutting concerns (`config`, `middlewares`, `jobs`, `queues`, `services`, `prisma`, `utils`) are siblings every module reuses.
- **`shared/` is the contract** binding all apps to one vocabulary — and the reason the monorepo pays off.
- **Cold-chain reality is structural**, not incidental: `inventory` (kg stock), `delivery` (zones/slots), and `jobs`/`queues` (cut-off, reservation expiry) are top-level, first-class citizens.
- The layout is **API-first**: adding future mobile apps means adding clients, not rebuilding logic.

---
---

# CHAPTER 5 — MODULES

Each module below follows the same table: **Purpose · Business Logic · Who Uses It · Dependencies · Future Enhancements**. Details are tied to the meat / weight / cold-chain business. Roles referenced are the canonical RBAC set: Super Admin, Admin, Store Manager, Inventory Manager, Delivery Manager, Customer Support, Delivery Partner, Customer.

**Module dependency at a glance (high-level flow):**

```
Auth ─┬─► Customers ─┬─► Addresses ─► Delivery(serviceability)
      │              ├─► Cart ─► Checkout ─► Orders ─► Payments
      │              └─► Wishlist                 │
      │                                           ├─► Inventory (decrement kg)
Products ─► Categories/Brands/Attributes/Variants ├─► Delivery (slot booking)
      └─► Inventory ◄── Warehouse                 └─► Notifications
Coupons ─► Checkout                    Orders ─► Reports · Reviews · Invoices
Roles ─► Permissions ─► (guards every admin module)   Everything ─► Logs · Audit Logs
CMS · Settings · Notification Center  (support all of the above)
```

---

## 5.1 Authentication

| Aspect | Detail |
|--------|--------|
| **Purpose** | Establish and verify identity for both customers and staff, and issue the JWT access/refresh tokens every protected API call relies on. |
| **Business Logic** | Customer sign-up/login via **mobile OTP** (primary in Indian D2C) and email/password fallback; staff login via email/password with mandatory role assignment. Issues short-lived access JWT + long-lived refresh token; supports token refresh, logout (refresh revocation), password reset, and OTP throttling/rate-limiting to prevent abuse. Separates the **customer** identity space from the **staff/admin** identity space. |
| **Who Uses It** | All Customers (to shop & track); all staff roles (to reach the Admin Panel). Every other module depends on it indirectly. |
| **Dependencies** | Customers & Users (identity records), Roles/Permissions (staff authorization), Notification Center (OTP delivery via SMS/WhatsApp/email), Settings (OTP length/expiry), Audit Logs (login events). |
| **Future Enhancements** | Social login (Google), WhatsApp-based OTP as default, biometric login for mobile apps, device/session management, 2FA for high-privilege staff, single-sign-on for the future Delivery-Boy app. |

## 5.2 Dashboard

| Aspect | Detail |
|--------|--------|
| **Purpose** | Give each staff role an at-a-glance operational cockpit of the store's health the moment they log in. |
| **Business Logic** | Aggregates real-time KPIs — today's orders, revenue (₹), pending fulfilment, out-for-delivery count, low-stock (kg) alerts, slot capacity utilisation, COD vs prepaid split, new customers. Widgets are **role-filtered**: Inventory Manager sees stock health, Delivery Manager sees slot/fleet load, Store Manager sees sales. Backed by cached aggregates so the dashboard is fast even at volume. |
| **Who Uses It** | Super Admin, Admin, Store Manager, Inventory Manager, Delivery Manager, Customer Support (scoped views). |
| **Dependencies** | Reports (metric aggregation), Orders, Inventory, Delivery, Payments, Customers, Permissions (widget gating). |
| **Future Enhancements** | Configurable/drag-drop widgets, per-zone drill-down, predictive demand forecasting for perishable stock, anomaly alerts (spike in cancellations), real-time WebSocket live tiles. |

## 5.3 Products

| Aspect | Detail |
|--------|--------|
| **Purpose** | The catalog core — every sellable meat/seafood/egg item with its descriptions, imagery, freshness claims, and pricing anchor. |
| **Business Logic** | A Product is the parent SKU (e.g. "Chicken Curry Cut") carrying name, category, brand, cut/attribute set, images, freshness & sourcing claims (no antibiotics/hormones), tax class, and status (active/draft/out-of-service). Actual purchasable units are its **Variants** (weight packs). Supports slug/SEO fields, cold-chain handling notes, and per-zone availability. Publishing rules ensure a product cannot go live without at least one priced, in-stock variant. |
| **Who Uses It** | Customers (browse/buy); Store Manager & Admin (create/edit); Inventory Manager (links stock); Marketing (feature/offer). |
| **Dependencies** | Categories, Brands, Attributes, Variants (child units), Inventory (stock/availability), Reviews, CMS (merchandising), Storage service (images). |
| **Future Enhancements** | Recipe/how-to-cook content per product, nutritional info, provenance/farm traceability, AI-generated descriptions, bundle products (combo packs), personalised recommendations. |

## 5.4 Categories

| Aspect | Detail |
|--------|--------|
| **Purpose** | Organise the catalog into the browsable taxonomy customers expect: Poultry, Mutton/Goat, Seafood, Eggs, Ready-to-Cook/Marinated, Bulk/Wholesale. |
| **Business Logic** | Hierarchical (parent → sub-category, e.g. Poultry → Chicken → Boneless/Curry Cut/Biryani Cut). Each category has slug, image/banner, sort order, and status; drives navigation menus, listing pages, and filtering. Supports category-level merchandising and SEO. |
| **Who Uses It** | Customers (navigation/filter); Store Manager & Admin (manage tree); CMS (menus). |
| **Dependencies** | Products (categorised items), CMS (menu placement), Settings (default sort). |
| **Future Enhancements** | Seasonal/festival categories (e.g. Bakrid specials), dynamic "smart" categories by attribute, per-zone category visibility, category landing pages with editorial content. |

## 5.5 Brands

| Aspect | Detail |
|--------|--------|
| **Purpose** | Attribute products to a source brand/label (e.g. own-label vs Kadaknath specialty), enabling brand-based browsing and trust signalling. |
| **Business Logic** | Simple entity — name, logo, description, status. Products optionally reference a brand; enables brand filters and brand landing pages. For a single-store operation the "brand" often signals a premium sub-line (heritage/free-range) that commands different pricing/positioning. |
| **Who Uses It** | Customers (filter/trust); Store Manager & Admin (manage); Marketing. |
| **Dependencies** | Products. |
| **Future Enhancements** | Brand storytelling pages, brand-level promotions, supplier/vendor linkage for B2B sourcing, brand performance in Reports. |

## 5.6 Attributes

| Aspect | Detail |
|--------|--------|
| **Purpose** | Define the descriptive/filterable characteristics specific to meat: cut type, bone-in/boneless, cleaning level, marination, skin-on/off, piece count. |
| **Business Logic** | Attribute = a named property with a set of values (e.g. Cut: Curry Cut / Biryani Cut / Boti). Attributes power faceted filtering and product specification display, and feed variant generation. Distinct from Variants: attributes describe *what it is*; variants describe *how much you buy*. |
| **Who Uses It** | Customers (filters); Store Manager & Admin (define); Products/Variants (composition). |
| **Dependencies** | Products, Variants, Categories (attribute relevance per category). |
| **Future Enhancements** | Attribute-driven guided selling ("choose your cut"), per-category required attributes, attribute-based search boosting, allergen/dietary attributes. |

## 5.7 Variants

| Aspect | Detail |
|--------|--------|
| **Purpose** | ★ The purchasable unit — **weight packs** (250g / 500g / 1kg) with their own price, SKU, and stock. This is the commercial heart of a sold-by-weight meat business. |
| **Business Logic** | Each Variant belongs to a Product and encodes pack weight (in grams), MRP & selling price (₹, stored in paise), per-pack SKU/barcode, and its own inventory link (kg-derived). Price is not strictly linear across pack sizes (bulk packs may be cheaper per kg). The cart, order totals, and inventory decrement all operate at the variant level. Cut-off availability and weight tolerance (packed weight may vary slightly) are anchored here. |
| **Who Uses It** | Customers (select pack size to add to cart); Store Manager (pricing); Inventory Manager (stock per pack); Orders/Cart/Checkout (line items). |
| **Dependencies** | Products (parent), Attributes, Inventory (kg stock ↔ pack availability), Cart, Orders, Coupons (variant-level offers), Settings (weight-tolerance %). |
| **Future Enhancements** | Custom-weight ordering (slider "order 750g"), dynamic per-kg pricing, subscription pack sizes, whole-animal / bulk-B2B variants, price-per-kg comparison display. |

## 5.8 Inventory

| Aspect | Detail |
|--------|--------|
| **Purpose** | ★ Track perishable stock in **kilograms/grams**, reserve it during checkout, decrement on order, and enforce daily cut-off — the module that prevents overselling fresh meat. |
| **Business Logic** | Stock is held in weight units per variant/warehouse, not simple unit counts. On add-to-cart/checkout a **soft reservation** holds stock for a short TTL (released by a BullMQ worker if the order isn't completed). On order confirmation, stock is committed (decremented); on cancellation it is returned. Enforces **per-slot cut-off times** (order by X to get slot Y), low-stock thresholds (kg) that trigger alerts, and batch/lot tracking with harvest/pack date for freshness (FEFO — first-expire-first-out). Handles weight-variance reconciliation when actual packed weight differs. |
| **Who Uses It** | Inventory Manager (primary), Store Manager, Admin; consumed by Checkout/Orders (availability & decrement), Dashboard (alerts). |
| **Dependencies** | Variants, Warehouse, Orders, Checkout, Jobs/Queues (reservation expiry, cut-off, low-stock scan), Settings (thresholds/cut-off), Audit Logs. |
| **Future Enhancements** | Demand forecasting to cut spoilage, auto-purchase/replenishment, wastage & shrinkage analytics, multi-warehouse allocation, real-time stock via IoT scale integration, expiry-driven flash discounts. |

## 5.9 Warehouse

| Aspect | Detail |
|--------|--------|
| **Purpose** | Define the physical fulfilment hub(s)/store from which stock is held and orders are dispatched, and map them to delivery zones. |
| **Business Logic** | Each Warehouse has address, geo-coordinates, operating hours, and a served zone/pincode set. In Phase 1 (single-store) there is typically one hub, but the model supports many so growth needs no rewrite. Inventory is tracked per warehouse; delivery zones resolve to the warehouse that serves them, enabling correct slot capacity and dispatch routing. |
| **Who Uses It** | Inventory Manager, Delivery Manager, Admin; consumed by Inventory (stock location), Delivery (zone→hub mapping). |
| **Dependencies** | Inventory, Delivery (zones), Settings, Maps service (geo). |
| **Future Enhancements** | Multi-hub inventory balancing, dark-store expansion, nearest-hub auto-routing, transfer orders between hubs, capacity/temperature monitoring. |

## 5.10 Customers

| Aspect | Detail |
|--------|--------|
| **Purpose** | Own the customer profile, contact details, membership status, and shopping history that personalise the storefront and power support. |
| **Business Logic** | Stores profile (name, mobile, email), membership plan tier, order history linkage, wishlist, preferences, and lifetime value. Distinct identity space from staff Users. Supports blocking/flagging (e.g. repeat COD rejecters), membership benefits (free shipping, early slots), and GDPR-style data controls. |
| **Who Uses It** | Customers (self-service profile); Customer Support (assist/lookup); Store Manager & Admin (segmentation); Marketing. |
| **Dependencies** | Authentication, Addresses, Orders, Wishlist, Coupons (segment targeting), Notification Center. |
| **Future Enhancements** | Loyalty points/wallet, referral program, RFM segmentation, subscription management, customer health scoring, WhatsApp two-way support. |

## 5.11 Addresses

| Aspect | Detail |
|--------|--------|
| **Purpose** | Manage a customer's saved delivery addresses with the geo/pincode data that drives serviceability and slot assignment. |
| **Business Logic** | Each address holds label (home/work), full address, pincode, and geo-coordinates (from Google Maps). On save/select, the address is checked against serviceable zones; a non-serviceable pincode blocks checkout with a clear message. The default address pre-selects the delivery zone and available slots. Weight/perishability makes accurate geo essential for own-fleet routing. |
| **Who Uses It** | Customers (manage/select); Checkout (serviceability + slot); Delivery (routing); Customer Support. |
| **Dependencies** | Customers, Delivery (zone/serviceability), Maps service (geocode/validate), Checkout. |
| **Future Enhancements** | Map-pin precise location capture, address auto-complete, delivery instructions/landmarks, geofenced serviceability, saved "favourite slot per address". |

## 5.12 Cart

| Aspect | Detail |
|--------|--------|
| **Purpose** | Hold the customer's selected weight-pack variants with live, server-authoritative pricing and weight totals before checkout. |
| **Business Logic** | **Server-side cart** (not just client state) so prices, stock, and offers are always trustworthy. Line items reference variants with quantity; the service computes subtotal (₹), applicable coupon preview, free-shipping progress toward ₹699, estimated total weight, and per-line stock validity. Guest carts merge into the account cart on login. Cart re-validates stock and price at view time (perishable prices/stock move). |
| **Who Uses It** | Customers; consumed by Checkout, Coupons (preview), Inventory (stock check). |
| **Dependencies** | Variants, Inventory (availability), Coupons (discount preview), Customers, Settings (free-ship threshold). |
| **Future Enhancements** | Saved carts / reorder, "frequently bought together", cart abandonment recovery (WhatsApp), scheduled recurring cart, minimum-order nudges per zone. |

## 5.13 Wishlist

| Aspect | Detail |
|--------|--------|
| **Purpose** | Let customers save products/variants for later and be notified when back in stock — valuable when perishable items sell out. |
| **Business Logic** | Per-customer list of products/variants; supports move-to-cart and back-in-stock notification opt-in. Purely convenience; no stock impact. Feeds re-marketing and demand signals. |
| **Who Uses It** | Customers; Marketing (demand insight). |
| **Dependencies** | Customers, Products/Variants, Inventory (back-in-stock trigger), Notification Center. |
| **Future Enhancements** | Price-drop alerts, shareable wishlists, "notify for next fresh batch", wishlist-driven restock prioritisation. |

## 5.14 Coupons

| Aspect | Detail |
|--------|--------|
| **Purpose** | Drive promotions — the "flat up to 20% off" and "free shipping over ₹699" mechanics plus targeted discounts. |
| **Business Logic** | Supports percentage/flat/free-shipping coupon types with rules: min cart value, category/product/variant scope, per-customer & global usage caps, validity window, first-order-only, membership-tier exclusivity, and stacking rules. Validated at cart preview and re-validated at checkout to prevent tampering. Discount computed on ₹ subtotal with clear breakdown. |
| **Who Uses It** | Customers (apply); Marketing/Store Manager & Admin (create/manage); Checkout (apply & validate). |
| **Dependencies** | Cart, Checkout, Customers (targeting), Products/Variants/Categories (scope), Orders (redemption record), Settings. |
| **Future Enhancements** | Auto-apply best coupon, referral codes, BOGO/bundle offers, dynamic personalised coupons, gamified/spin-wheel promos, zone-specific offers. |

## 5.15 Checkout

| Aspect | Detail |
|--------|--------|
| **Purpose** | Orchestrate the critical conversion moment — validate address serviceability, book a delivery slot, apply coupons, reserve stock, and initiate payment — atomically. |
| **Business Logic** | The coordinator, not a data owner. Steps: (1) confirm cart stock & price; (2) validate selected **address serviceability** (zone/pincode); (3) present & lock an available **delivery slot** honouring cut-off and capacity; (4) apply coupon & compute final ₹ total incl. tax, shipping (free over ₹699), and weight-tolerance note; (5) **soft-reserve inventory**; (6) choose payment method (Razorpay/PhonePe/Cashfree/COD); (7) create a pending Order and hand off to Payments. Any failure releases the reservation and slot. |
| **Who Uses It** | Customers; orchestrates Cart, Delivery, Inventory, Coupons, Payments, Orders. |
| **Dependencies** | Cart, Addresses, Delivery (serviceability + slot), Inventory (reservation), Coupons, Payments, Orders, Settings, Notification Center. |
| **Future Enhancements** | One-page/express checkout, saved-payment fast path, buy-now, partial-payment/wallet, tip-the-delivery-partner, slot-based dynamic pricing/surge for peak. |

## 5.16 Orders

| Aspect | Detail |
|--------|--------|
| **Purpose** | ★ The transactional backbone — record confirmed purchases and drive them through the fulfilment lifecycle from placed to delivered, including weight-variance adjustment. |
| **Business Logic** | An Order snapshots line items (variant, weight, ₹ price), address, slot, coupon, totals, and payment status. Status machine: `PLACED → CONFIRMED → PACKED → OUT_FOR_DELIVERY → DELIVERED`, with `CANCELLED`/`RETURNED` branches. On packing, actual weight may differ from ordered pack → **weight-variance adjustment** recalculates the ₹ total within the allowed tolerance (and adjusts the COD amount or prepaid refund/charge). Commits inventory on confirm, releases on cancel. Every transition is audited and notified. |
| **Who Uses It** | Customers (track/cancel); Store Manager (fulfil), Inventory Manager (pack/commit), Delivery Manager (dispatch), Delivery Partner (deliver), Customer Support (assist). |
| **Dependencies** | Checkout (creation), Payments, Inventory (commit/release), Delivery (slot/dispatch), Coupons (redemption), Customers, Notification Center, Reports, Audit Logs, Invoice/PDF service. |
| **Future Enhancements** | Partial delivery/refund, order editing pre-cutoff, subscription/recurring orders, returns & quality-complaint workflow, real-time order timeline via WebSocket, automated dispute handling. |

## 5.17 Payments

| Aspect | Detail |
|--------|--------|
| **Purpose** | ★ Handle money movement across Razorpay, PhonePe, Cashfree, and **Cash On Delivery**, including verification, webhooks, reconciliation, and refunds. |
| **Business Logic** | A **provider-abstraction** layer exposes one interface (init, verify, capture, refund, webhook) with interchangeable gateway adapters. Prepaid flow: create payment intent → redirect/collect → verify signature → mark Order paid. **COD** flow: mark order COD-pending, collect on delivery, reconcile the collected ₹ (adjusted for weight variance) by the Delivery Partner. Handles webhooks idempotently, retries pending captures via a worker, and processes refunds on cancellation/return. Amounts stored in paise to avoid float errors. |
| **Who Uses It** | Customers (pay); Delivery Partner (collect COD); Store Manager & Admin (reconcile/refund); Customer Support (refund lookup). |
| **Dependencies** | Checkout/Orders, Payment gateway services, Jobs/Queues (reconciliation, retries), Notification Center (receipts), Settings (enabled gateways), Audit Logs, Reports. |
| **Future Enhancements** | UPI-intent & autopay for subscriptions, wallet/store credit, EMI for bulk B2B, split settlements, automated reconciliation reports, gateway failover routing, saved cards/tokenisation. |

## 5.18 Delivery

| Aspect | Detail |
|--------|--------|
| **Purpose** | ★ The cold-chain fulfilment engine — zone/pincode **serviceability**, **delivery-slot** booking with capacity & cut-off, and **own-fleet** partner assignment/tracking. |
| **Business Logic** | Defines serviceable **zones** (pincode/polygon) mapped to a warehouse. Manages **delivery slots** (e.g. today evening, tomorrow morning) each with capacity limits and cut-off times; a slot closes when full or past cut-off (enforced by a BullMQ scheduler). At checkout it confirms serviceability and holds a slot. For fulfilment it assigns orders to **Delivery Partners** (hyperlocal own fleet — "delivery boy"), tracks out-for-delivery status, captures proof-of-delivery, and handles COD collection handoff. Perishability makes slots and cut-offs central, not optional. |
| **Who Uses It** | Delivery Manager (zones/slots/assignment), Delivery Partner (execute), Customers (choose slot/track), Store Manager, Checkout/Orders. |
| **Dependencies** | Warehouse, Addresses (serviceability), Orders (dispatch), Inventory (cut-off alignment), Maps service (routing/geo), Jobs/Queues (cut-off, capacity roll), Payments (COD), Notification Center, Settings. |
| **Future Enhancements** | Live GPS partner tracking, route optimisation, dynamic slot pricing/capacity, 3rd-party logistics fallback (Phase 2+), delivery-partner app & earnings, temperature-logged cold-chain proof, ETA prediction. |

## 5.19 Reports

| Aspect | Detail |
|--------|--------|
| **Purpose** | Turn operational data into decision-making analytics — sales, inventory/wastage, delivery performance, and customer insights. |
| **Business Logic** | Aggregates across modules into reports: revenue (₹) by day/category/zone, best/worst sellers by weight sold, COD vs prepaid, coupon ROI, slot utilisation & on-time delivery, low-stock/wastage, new vs returning customers. Heavy generation/exports run via a BullMQ worker to avoid blocking. Supports date-range filters and CSV export from the admin tables. |
| **Who Uses It** | Super Admin, Admin, Store Manager (sales), Inventory Manager (stock/wastage), Delivery Manager (fulfilment SLAs). |
| **Dependencies** | Orders, Payments, Inventory, Delivery, Customers, Coupons, Jobs/Queues (async generation), Cache (pre-aggregates). |
| **Future Enhancements** | Scheduled emailed reports, predictive analytics & demand forecasting, spoilage/margin dashboards, cohort/LTV analysis, exportable BI-warehouse feed, per-zone P&L. |

## 5.20 Reviews

| Aspect | Detail |
|--------|--------|
| **Purpose** | Capture product ratings and reviews (freshness, quality, packaging) to build trust and inform quality control. |
| **Business Logic** | Reviews are tied to **verified purchases** (order delivered) to prevent fake ratings; include star rating, text, optional photos, and moderation status. Aggregated rating shows on product pages. Negative/quality reviews can flag a batch for Inventory/QC follow-up. Staff can respond. |
| **Who Uses It** | Customers (write/read); Store Manager & Customer Support (moderate/respond); Inventory Manager (QC signal). |
| **Dependencies** | Orders (purchase verification), Products/Variants, Customers, Notification Center (review requests), Storage (photos), Audit Logs. |
| **Future Enhancements** | Post-delivery review prompts (WhatsApp), photo/video reviews, sentiment analysis, batch-quality correlation, incentivised reviews, Q&A on products. |

## 5.21 CMS

| Aspect | Detail |
|--------|--------|
| **Purpose** | Let non-technical staff control storefront content — banners, offers, homepage merchandising, static/policy pages, and navigation menus — without deploys. |
| **Business Logic** | Manages content blocks: hero/promo **banners** (with schedule and zone targeting), homepage sections, category/offer strips, and **static pages** (About, FAQ, Delivery Policy, Terms) rendered by the storefront's Static pages. Content is versioned and can be scheduled (e.g. festival banner). Drives the customer app's dynamic sections via API. |
| **Who Uses It** | Marketing, Store Manager & Admin (author); Customers (consume rendered content). |
| **Dependencies** | Products/Categories/Coupons (linked merchandising), Settings, Storage (media), Notification Center (announcements). |
| **Future Enhancements** | Drag-drop page builder, A/B tested banners, personalised/zone-targeted content, blog/recipe CMS, SEO metadata management, multi-language content. |

## 5.22 Settings

| Aspect | Detail |
|--------|--------|
| **Purpose** | Central store configuration — the business tunables that other modules read instead of hardcoding. |
| **Business Logic** | Holds global config: store identity/contact, currency (INR), tax rules, **free-shipping threshold (₹699)**, **weight-tolerance %**, default slot cut-off windows, enabled payment gateways, notification channel toggles, min order value per zone, and maintenance mode. Changes are audited and cached. Scoped so only high-privilege roles edit sensitive keys. |
| **Who Uses It** | Super Admin & Admin (edit); read by virtually every module (Checkout, Delivery, Payments, Cart, Inventory). |
| **Dependencies** | Roles/Permissions (edit rights), Audit Logs, Cache; consumed store-wide. |
| **Future Enhancements** | Per-zone setting overrides, feature flags, scheduled setting changes (festival mode), config change history/rollback, environment-aware settings UI. |

## 5.23 Roles

| Aspect | Detail |
|--------|--------|
| **Purpose** | Define the RBAC roles that bound what each staff member can do — the canonical set of eight. |
| **Business Logic** | Roles (Super Admin, Admin, Store Manager, Inventory Manager, Delivery Manager, Customer Support, Delivery Partner, Customer) are collections of **Permissions**. A user holds one (or more) roles; the effective permission set gates every admin action and menu. Roles are managed centrally; Super Admin can define/edit custom roles. Enforced server-side by the `authorize` middleware and mirrored client-side by the `<Can>` guard for UX. |
| **Who Uses It** | Super Admin (manage); every staff user is bound by one; consumed by every admin module. |
| **Dependencies** | Permissions (composition), Authentication (assignment), Users, Audit Logs. |
| **Future Enhancements** | Custom/departmental roles, temporary role elevation, role templates, per-warehouse scoped roles, delegation/approval workflows. |

## 5.24 Permissions

| Aspect | Detail |
|--------|--------|
| **Purpose** | The granular capability catalogue (e.g. `orders.update`, `inventory.adjust`, `coupons.create`) that Roles are built from and middleware enforces. |
| **Business Logic** | A canonical, code-based permission list grouped by module and action. Roles map to permission sets; the `authorize` middleware checks the required permission on every protected endpoint — **the server is the real enforcer**, the client guard is only UX. Permission codes live in `shared/enums/permissions` so backend, admin, and future apps agree. |
| **Who Uses It** | Super Admin (assign to roles); enforced against every staff request across all admin modules. |
| **Dependencies** | Roles, Authentication/authorize middleware, shared enums, Audit Logs. |
| **Future Enhancements** | Field-level & record-level permissions, permission bundles, self-service access requests, permission usage auditing, attribute-based access control (ABAC). |

## 5.25 Logs

| Aspect | Detail |
|--------|--------|
| **Purpose** | Capture technical/application logs — requests, errors, integration events — for debugging and observability. |
| **Business Logic** | Structured logging (with request-id) of API activity, errors, payment/webhook events, queue processing, and integration calls. Distinct from Audit Logs (business "who did what"): Logs are the engineer's diagnostic trail. Supports level filtering and searchable retention; log workers/cleanup purge stale entries. |
| **Who Uses It** | Super Admin, Admin, engineering/on-call. |
| **Dependencies** | Logger config, all modules (emit logs), Jobs/Queues (worker logs), cleanup worker. |
| **Future Enhancements** | Centralised log aggregation (ELK/CloudWatch), alerting on error spikes, distributed tracing, performance metrics dashboard, log-based anomaly detection. |

## 5.26 Audit Logs

| Aspect | Detail |
|--------|--------|
| **Purpose** | Maintain an immutable business trail of sensitive actions — who changed what, when — for accountability and dispute resolution. |
| **Business Logic** | Records actor (staff user), action, entity, before/after values, timestamp, and IP for high-impact events: price/stock changes, order status transitions, refunds, coupon creation, role/permission edits, settings changes. Populated via the `auditContext` middleware and service hooks; **append-only** (never edited/deleted). Critical for a cash-handling (COD) perishable business where weight/price adjustments and refunds must be traceable. |
| **Who Uses It** | Super Admin, Admin, Customer Support (dispute investigation), compliance. |
| **Dependencies** | Authentication (actor), Permissions, all sensitive modules (Orders, Payments, Inventory, Settings, Roles), immutable store. |
| **Future Enhancements** | Tamper-evident hashing, exportable compliance reports, per-entity audit timeline UI, anomaly/fraud detection on audit stream, retention policies. |

## 5.27 Notification Center

| Aspect | Detail |
|--------|--------|
| **Purpose** | The single dispatch hub for all customer & staff communications across Email (SMTP), SMS, WhatsApp, and (future) Firebase push. |
| **Business Logic** | A channel-abstracted service driven by **events** (order placed/confirmed/out-for-delivery/delivered, OTP, payment receipt, cancellation/refund, back-in-stock, cart abandonment, low-stock staff alerts). Notifications are **queued via BullMQ** and sent by a worker for reliability and retries; templates are managed and localisable. Channel selection and toggles come from Settings. WhatsApp is first-class given the business's WhatsApp ordering channel. |
| **Who Uses It** | Customers (receive), staff (operational alerts); triggered by Auth, Orders, Payments, Delivery, Inventory, Wishlist, Cart, Reviews. |
| **Dependencies** | Notification channel services (email/SMS/WhatsApp/push), Jobs/Queues (async send), Settings (channels/templates), Customers (contact), Audit/Logs. |
| **Future Enhancements** | In-app notification inbox, two-way WhatsApp support/ordering, delivery ETA push, notification preferences per customer, rich WhatsApp templates with buttons, campaign/broadcast marketing. |

---

## 5.28 Chapter 5 — Cross-Module Dependency Summary

| Module | Most depends on | Most depended-on by |
|--------|-----------------|---------------------|
| Authentication | Customers, Users, Roles/Permissions, Notifications | Everything (indirectly) |
| Variants | Products, Inventory | Cart, Checkout, Orders |
| Inventory | Variants, Warehouse, Jobs/Queues | Checkout, Orders, Dashboard, Reports |
| Checkout | Cart, Delivery, Inventory, Coupons, Payments | Orders |
| Orders | Checkout, Payments, Inventory, Delivery | Reports, Reviews, Notifications, Audit |
| Payments | Orders, gateway services, Jobs/Queues | Orders, Reports |
| Delivery | Warehouse, Addresses, Maps, Jobs/Queues | Checkout, Orders |
| Permissions | Roles | Every admin module (via authorize) |
| Notification Center | Channel services, Jobs/Queues, Settings | Auth, Orders, Payments, Delivery, Inventory |
| Settings | Roles/Permissions, Cache | Store-wide (read by all) |
| Audit Logs | Auth, sensitive modules | Compliance, Support |

**The three modules that make this a *cold-chain* platform** — and therefore deserve the most engineering care — are **Inventory** (kg stock, reservation, cut-off, FEFO), **Delivery** (serviceability, slots, capacity, own fleet), and **Orders** (weight-variance adjustment, COD reconciliation). Get these right and the rest of the catalog/commerce machinery is conventional e-commerce.
