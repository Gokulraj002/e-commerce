# Elite NonVeg — Ojiva AI Technologies

Enterprise fresh-meat e-commerce platform: single-store, hyperlocal cold-chain
delivery, custom-built (no Shopify / WordPress). Reference site
[elitenonveg.com](https://elitenonveg.com/) · Region: **Hyderabad** · Currency: **INR (₹)**.

The monorepo ships three deployable apps (customer web, admin panel, REST API),
a shared type/enum/Zod package, and a native-VPS deployment recipe.

- Money is stored as integer **paise** (`₹1 = 100`). Never use floats.
- Products are sold by weight — stock and pack size are stored in **grams**.
- All API responses use the envelope `{ success, data, message }` (errors add `code` and `details`).

---

## Stack

| Layer     | Choice                                                                          |
| --------- | ------------------------------------------------------------------------------- |
| Frontend  | React 18 + TypeScript · Vite · Bootstrap 5 (customized SCSS) · React Router v6 · TanStack Query · React Hook Form + Zod · Framer Motion |
| Admin     | React 18 + TypeScript · Vite · Bootstrap 5 · TanStack Table · Chart.js          |
| Backend   | Node 20 · Express 4 · TypeScript (strict, ESM) · Prisma 5 · Zod · Pino          |
| Data      | PostgreSQL 15 · Redis 7 (cache + BullMQ broker)                                 |
| Auth      | JWT access (15 min) + rotating refresh (7 d), Argon2 password hashing           |
| Payments  | Razorpay · PhonePe · Cashfree · Cash on Delivery (COD)                          |
| Storage   | AWS S3 or Cloudinary (driver switch via `STORAGE_DRIVER`)                       |
| Queues    | BullMQ over Redis — `notifications`, `delivery-assign`, `invoice`, `reports`    |
| Deploy    | **Native Ubuntu VPS** — NGINX + PM2 + PostgreSQL + Redis on one host. No Docker. |
| CI/CD     | GitHub Actions — lint / typecheck / build on PR; SSH deploy on push to `main`.  |

---

## Monorepo layout

```
E-commerce-meals/
├─ backend/          # Node + Express + TS REST API (Prisma, BullMQ workers)
├─ frontend/         # Customer web app (React + Vite, port 5173)
├─ admin/            # Admin panel (React + Vite, port 5174)
├─ shared/           # @elite/shared — enums, DTOs, Zod schemas
├─ deployment/       # NGINX configs, PM2 ecosystem, provisioning scripts
│  ├─ nginx/         #   nginx.conf, sites-available, snippets
│  ├─ pm2/           #   ecosystem.config.cjs
│  └─ scripts/       #   setup-server.sh, deploy.sh, rollback.sh, backup.sh, restore.sh
├─ docs/
│  ├─ ARCHITECTURE.md
│  ├─ DEPLOY.md
│  ├─ CONTRIBUTING.md
│  ├─ api/           # Postman collection + README
│  └─ blueprint/     # 8-chapter design spec (source of truth for what to build)
├─ .github/workflows # ci.yml, deploy.yml
└─ package.json      # npm workspaces (root)
```

npm workspaces: `shared`, `backend`, `frontend`, `admin`. The shared package is
compiled first — all three apps import types/enums/Zod schemas from
`@elite/shared`.

---

## Prerequisites

| Tool             | Minimum | Notes                                                       |
| ---------------- | ------- | ----------------------------------------------------------- |
| Node.js          | 20 LTS  | Enforced by `"engines"` in root `package.json`.             |
| npm              | 10      | Ships with Node 20. Uses `npm` workspaces (no Yarn/pnpm).   |
| PostgreSQL       | 15      | Local install or a managed database — the URL is env-driven. |
| Redis            | 7       | Used for caching and BullMQ; must be reachable from the API. |
| Git              | 2.40+   | For hooks and CI parity.                                    |

Optional: `psql` and `redis-cli` help when debugging.

---

## 60-second local quickstart

```bash
# 1. Clone and install every workspace from the repo root.
git clone <this-repo> && cd E-commerce-meals
npm install

# 2. Configure the backend. Copy the template and edit DATABASE_URL/REDIS_URL/JWT secrets.
cp .env.example backend/.env

# 3. Build the shared package once — the other three apps import its dist.
npm run build:shared

# 4. Create the database schema and load seed data (idempotent).
npm --workspace backend run prisma:migrate     # runs `prisma migrate dev`
npm --workspace backend run seed                # tsx prisma/seed.ts

# 5. Start the three dev servers in three terminals.
npm run dev:backend    # API      → http://localhost:4000/api/v1
npm run dev:frontend   # Customer → http://localhost:5173
npm run dev:admin      # Admin    → http://localhost:5174
```

Both Vite dev servers proxy `/api` to the backend on `:4000`.

### Verifying the API

```bash
curl http://localhost:4000/api/v1/health
# → { "success": true, "data": { "status": "ok", "db": "up", "cache": "up", ... } }
```

---

## Seeded logins

`npm run seed` (in `backend/`) is idempotent and populates staff, delivery
partners, and two demo customers. Password rules: staff share `Admin@123`;
customers share `Customer@123`.

| Role                | Phone            | Email                            | Password       |
| ------------------- | ---------------- | -------------------------------- | -------------- |
| Super Admin         | `+919000000001`  | `admin@elitenonveg.in`           | `Admin@123`    |
| Store Manager       | `+919000000002`  | `store@elitenonveg.in`           | `Admin@123`    |
| Inventory Manager   | `+919000000003`  | `inventory@elitenonveg.in`       | `Admin@123`    |
| Delivery Manager    | `+919000000004`  | `delivery@elitenonveg.in`        | `Admin@123`    |
| Delivery Partner    | `+919000000005`  | `ravi.rider@elitenonveg.in`      | `Admin@123`    |
| Delivery Partner    | `+919000000006`  | `imran.rider@elitenonveg.in`     | `Admin@123`    |
| Customer            | `+919000000010`  | `anjali@example.com`             | `Customer@123` |
| Customer            | `+919000000011`  | `karthik@example.com`            | `Customer@123` |

The `/auth/login` endpoint accepts **phone** (customer app) or **email** (admin
panel). Both hit the same route; see `docs/api/README.md`.

---

## Scripts reference

Run from the repo root unless noted.

| Script                                     | What it does                                                                 |
| ------------------------------------------ | ---------------------------------------------------------------------------- |
| `npm run dev:backend`                      | `tsx watch backend/src/server.ts` — API with hot reload.                     |
| `npm run dev:frontend`                     | Vite dev server for the customer app on `:5173`.                             |
| `npm run dev:admin`                        | Vite dev server for the admin panel on `:5174`.                              |
| `npm run build`                            | Build shared → backend → frontend → admin, in order.                         |
| `npm run build:shared`                     | Build only `@elite/shared` (required before typechecking the other apps).    |
| `npm run lint`                             | ESLint across `.ts` / `.tsx`.                                                |
| `npm run format`                           | Prettier write across `.ts / .tsx / .scss / .css / .json / .md`.             |
| `npm run typecheck`                        | `tsc --noEmit` per workspace (`--if-present`).                               |
| `npm --workspace backend run prisma:migrate` | `prisma migrate dev` — creates/updates local schema and generates client. |
| `npm --workspace backend run prisma:deploy`  | `prisma migrate deploy` — production migration runner (no shadow DB).     |
| `npm --workspace backend run prisma:studio`  | `prisma studio` GUI for the local DB.                                     |
| `npm --workspace backend run seed`         | Idempotent seed — creates staff, catalog, coupons, zones, slots.             |
| `npm --workspace backend run build`        | `prisma generate && tsc` — outputs to `backend/dist`.                        |
| `npm --workspace backend run start`        | `node backend/dist/server.js` — production entry point (used by PM2).        |

There is no `test` script yet — the CI workflow calls `npm test --if-present`
so it is a no-op until Vitest/Jest is wired up.

---

## Deep documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — system diagram, request lifecycle, module map.
- [docs/DEPLOY.md](docs/DEPLOY.md) — production deploy quickstart + env-var reference.
- [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) — branching, commits, PR checklist, how to add modules/pages.
- [docs/api/README.md](docs/api/README.md) — REST API index + Postman collection.
- [docs/blueprint/README.md](docs/blueprint/README.md) — 8-chapter design blueprint (business + engineering source of truth).
- [backend/MODULE_GUIDE.md](backend/MODULE_GUIDE.md) — how a backend module is structured.
- [frontend/FRONTEND_GUIDE.md](frontend/FRONTEND_GUIDE.md) — customer-app conventions.
- [admin/ADMIN_GUIDE.md](admin/ADMIN_GUIDE.md) — admin-panel conventions.

---

## Notes on payment providers

Razorpay, PhonePe and Cashfree providers are wired into a factory
(`backend/src/modules/payment/payment.providers/`). Live gateway calls only
happen when the matching credentials are set in `backend/.env`
(`RAZORPAY_KEY_ID`, `PHONEPE_MERCHANT_ID`, `CASHFREE_APP_ID`, plus their
secrets). Without credentials, the provider factory refuses the call — there
is no mock success path. For local testing without live keys, use
`paymentMethod: "COD"` at checkout; the Payment row is still created but no
gateway is contacted.

Webhook signature verification runs against the exact raw bytes captured by
the global JSON parser (see `backend/src/app.ts`). If you ever change the
body-parsing setup, mount a raw parser on the webhook routes first.
