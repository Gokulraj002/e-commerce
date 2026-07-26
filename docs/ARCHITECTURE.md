# Architecture — Elite NonVeg

A working reference for the system a new engineer inherits on day one. Everything
below matches the code as it exists in this repository — no aspirational
architecture, no boxes we haven't wired.

- **Deployment target:** a single Ubuntu VPS running native services (no Docker).
- **Money:** integer paise (`₹1 = 100`), never floats.
- **Weight / stock:** integer grams. Weights come in fixed packs (250 g / 500 g / 1 kg).
- **API envelope:** `{ success, data, message? }`; errors add `code` and `details`.
- **Auth:** JWT access token (15 min) + rotating refresh token (7 d), Argon2 hashing.
- **Bootstrap order (workspaces):** `shared` → `backend` → `frontend` / `admin`.

---

## 1. High-level topology

The production topology is one Ubuntu VPS. NGINX terminates TLS and serves both
React SPAs as static files; only `/api/*` requests reach the Node cluster.
PostgreSQL and Redis bind to loopback and are never exposed publicly.

```
                     Customers · Admin staff · Payment webhooks
                                         │
                                    DNS + TLS 443
                    store.example.com · admin.example.com · api.example.com
                                         │
                                         ▼
   ┌───────────────────────── Ubuntu VPS (single host) ─────────────────────────┐
   │                                                                            │
   │   ┌─────────────────────── NGINX (systemd) ────────────────────────────┐   │
   │   │  TLS · HTTP→HTTPS · gzip · rate-limit                              │   │
   │   │    store.example.com  →  /var/www/customer/  (React build)         │   │
   │   │    admin.example.com  →  /var/www/admin/     (React build)         │   │
   │   │    /api/*             →  127.0.0.1:4000  (PM2 cluster)             │   │
   │   └────────────────────────────┬───────────────────────────────────────┘   │
   │                                 │ loopback                                 │
   │            ┌────────────────────┴────────────────────┐                     │
   │            ▼                                         ▼                     │
   │   ┌────────────────────┐             ┌────────────────────────┐            │
   │   │ PM2: API cluster   │             │ PM2: BullMQ worker     │            │
   │   │ Node+Express+TS    │             │ notifications ·        │            │
   │   │ :4000, 1/core       │             │ delivery-assign ·      │            │
   │   └─────────┬──────────┘             │ invoice · reports      │            │
   │             │                        └──────────┬─────────────┘            │
   │             ▼                                   ▼                          │
   │   ┌────────────────────┐             ┌────────────────────────┐            │
   │   │ PostgreSQL :5432   │             │ Redis :6379            │            │
   │   │ ACID system-of-    │             │ cache + BullMQ broker  │            │
   │   │ record             │             │                        │            │
   │   └────────────────────┘             └────────────────────────┘            │
   │                                                                            │
   │      Off-box:  AWS S3 / Cloudinary (media)  ·  Nightly backup bucket       │
   └────────────────────────────────────────────────────────────────────────────┘

   Deploy path: GitHub Actions ── SSH ──▶ deployment/scripts/deploy.sh
                (git pull → npm ci → build → prisma migrate deploy → pm2 reload)
```

The deep operational runbook lives in [docs/blueprint/07-deployment-vps.md](blueprint/07-deployment-vps.md).

---

## 2. Runtime process boundaries

| Process              | Manager | Where it runs                          | Purpose                                    |
| -------------------- | ------- | -------------------------------------- | ------------------------------------------ |
| NGINX                | systemd | Port 80/443 (only public ports)        | TLS termination, static files, reverse proxy |
| PostgreSQL 15        | systemd | Loopback `127.0.0.1:5432`              | System of record                           |
| Redis 7              | systemd | Loopback `127.0.0.1:6379`              | Cache + BullMQ broker                      |
| API (Express)        | PM2     | Loopback `127.0.0.1:4000`, cluster mode | REST API, one worker per CPU core          |
| BullMQ worker        | PM2     | No open ports                          | Delivery auto-assign, notifications, invoices |

The API and the worker share the same source tree. The worker starts by
importing `startDeliveryAssignWorker` (and the notification worker) inside a
separate PM2 process, not inside the API.

---

## 3. Backend request lifecycle

Every request funnels through the middleware stack in `backend/src/app.ts`:

```
express()
  helmet()                     ← security headers
  cors({ origin: env.corsOrigins, credentials: true })
  express.json({ verify })     ← stashes raw body on req.rawBody for webhook signature checks
  express.urlencoded()
  cookieParser()
  pinoHttp({ logger })         ← structured logs
  rateLimit(300/min)           ← global soft cap (per-route stricter limits live in modules)

  app.use(env.API_PREFIX, apiRouter)   ← mounts everything under /api/v1
  notFoundHandler
  errorHandler                 ← ApiError | ZodError | Prisma known errors → typed JSON
```

Every module obeys the 6-file layout enforced in
[backend/MODULE_GUIDE.md](../backend/MODULE_GUIDE.md):
`*.routes.ts` → `*.controller.ts` → `*.service.ts` → `*.repository.ts` (+
`*.schema.ts` for Zod, `*.types.ts` for local types). Controllers stay thin;
services throw `ApiError.*` which the central error middleware formats.

### Example — placing an order (`POST /api/v1/checkout/place`)

Reference: `backend/src/modules/checkout/checkout.service.ts` → `placeOrder`.

```
Client → apiClient (adds Bearer, unwraps envelope)
  → POST /api/v1/checkout/place  { addressId, slotId?, paymentMethod, note? }
  → requireAuth              (JWT verify → req.user)
  → validate(placeOrderSchema)   (Zod)
  → checkoutController.placeOrder
    → checkout.service.placeOrder (Prisma $transaction)
        a. load cart + items                     (assertCartNotEmpty)
        b. load + validate address (ownership) and optional slot (assertSlotBookable)
        c. re-check per-variant stock            (assertStockAvailable)
        d. recompute totals server-side          (buildPricing → subtotal, discount, shipping, total)
        e. create Order + snapshot OrderItems    (repo.createOrder)
        f. reserve stock                         (repo.reserveStock — reservedG bump)
        g. create Payment row (PENDING)          (repo.createPayment)
        h. write OrderStatusHistory, clear cart, bump slot booked counter
    (transaction commits)
    → enqueue notification job 'order.placed' on QUEUES.NOTIFICATIONS
    → return { order, paymentMethod, requiresPaymentInit: paymentMethod !== 'COD' }
  → controller responds with `created(res, result, 'Order placed')`  → 201 + envelope
Client then either:
  • paymentMethod === 'COD'      → done; poll orders list
  • otherwise                    → POST /payments/init → open gateway → POST /payments/verify
```

Stock is **reserved** at order-creation time (`reservedG` on `Inventory`); the
committed decrement of `stockG` happens on delivery confirmation, mirroring how
a physical cold-chain warehouse actually reduces inventory.

---

## 4. Auth flow

Reference: `backend/src/modules/auth/*`, `backend/src/middlewares/auth.ts`.

- `POST /auth/register` — body: `{ name, phone, email?, password }` (Zod `registerSchema` from `@elite/shared`); Argon2 hashes the password, creates a `RefreshToken` row keyed by SHA-256 hash of the token.
- `POST /auth/login` — accepts **phone OR email** plus password. Customers usually send `phone`; admin panel sends `email`. Returns `{ user, accessToken, refreshToken }`.
- `POST /auth/refresh` — body: `{ refreshToken }`. Refresh tokens **rotate**: the presented token is revoked and a new one is issued.
- `POST /auth/logout` — body: `{ refreshToken }`; revokes the row.
- `GET  /auth/me` — bearer required; returns the sanitized user (no `passwordHash`).

Middleware:

- `requireAuth` — parses `Authorization: Bearer <access>`, verifies with `JWT_ACCESS_SECRET`, sets `req.user = { id, role }`.
- `requireRole(...roles)` — chains after `requireAuth`, checks membership.
- `optionalAuth` — populates `req.user` if a valid bearer is present; never throws.

Access-token lifetime is `JWT_ACCESS_EXPIRES` (default `15m`); refresh is
`JWT_REFRESH_EXPIRES` (default `7d`).

---

## 5. Delivery auto-assignment pipeline

The delivery module ships a scored auto-assignment engine
(`backend/src/modules/delivery/delivery.autoAssign.ts`) that picks a partner for
each order. A BullMQ worker orchestrates the flow so a hot API path never runs
the algorithm inline.

```
Order reaches status READY
        │
        │  every 30s the scheduler enqueues a "scan" job
        ▼
BullMQ queue: delivery-assign
  ┌──────────────────────────────────────────────────────────┐
  │ scan  → prisma.order.findMany({status: READY, no active   │
  │         DeliveryAssignment}) → enqueue "assign" per order │
  │ assign→ delivery.service.autoAssign(orderId, express?)    │
  │         1. Load partner candidates (pincode-eligible)     │
  │         2. Score by availability + workload + distance    │
  │            (weights bias harder toward proximity for      │
  │            express orders; see AUTO_ASSIGN_WEIGHTS)       │
  │         3. Persist DeliveryAssignment + status history,   │
  │            bump partner load                              │
  │         4. Emit 'delivery.assigned' (partner) + enqueue   │
  │            'order.assigned' (customer) on NOTIFICATIONS   │
  └──────────────────────────────────────────────────────────┘

If no partner is eligible → soft skip 'NO_PARTNER' (409 in the service),
logged as a warning; the next scan tick will retry.
```

Delivery partners drive their own assignments via the `/delivery/my/assignments/*`
routes (accept → pickup → out-for-delivery → verify-otp → delivered / fail).
Every mutation transitions the parent order's status via the
`order.stateMachine.ts` transitions list.

---

## 6. Notification pipeline

Reference: `backend/src/modules/notification/*`, `backend/src/lib/queue.ts`.

- `notify()` writes a `Notification` row (default channel `IN_APP`). The user-facing routes are `GET /notifications`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`.
- Producers (checkout, delivery, payment services) enqueue jobs on `QUEUES.NOTIFICATIONS`. Job types include `order.placed`, `order.assigned`, `delivery.assigned`, `payment.verified`.
- A worker consumes those jobs, calls `notify()` (in-app + optional out-of-band channels), and can fan-out to SMTP, SMS gateway, WhatsApp, and future FCM using credentials in `backend/.env` (`SMTP_*`, `SMS_*`, `WHATSAPP_*`).
- Channels with no credentials are skipped silently — the in-app record is always written.

Queue names are declared once in `backend/src/lib/queue.ts` (`QUEUES` object).
Never reference queue names as raw strings.

---

## 7. Money & weight units

| Field / concept       | Unit        | Where it enters the code                                     |
| --------------------- | ----------- | ------------------------------------------------------------ |
| Prices, MRPs, totals  | `Int paise` | `pricePaise`, `mrpPaise`, `subtotalPaise`, `totalPaise`, etc. |
| Discount / shipping   | `Int paise` | `discountPaise`, `shippingPaise`                             |
| Free-shipping cut-off | Rupees      | `FREE_SHIPPING_THRESHOLD` env (default `699`) → converted at read time |
| Weight / pack size    | `Int grams` | `weightG`                                                    |
| Stock                 | `Int grams` | `Inventory.stockG` / `reservedG` / `reorderLevelG`           |
| Coupon flat value     | `Int paise` | `Coupon.valuePaise`, `Coupon.maxDiscountPaise`               |
| Coupon percent        | Percent     | `Coupon.percent` (integer 1–100)                             |

Frontends **never** do money math — the server returns computed totals. Format
for display using `formatPaise` (both apps) or the `<Price>` primitive
(frontend). Money constants live at `@elite/shared` (`MONEY.UNIT_PER_RUPEE = 100`).

---

## 8. Key modules

Every backend module follows the same 6-file anatomy
(`routes → controller → service → repository → schema → types`). All are
mounted under `env.API_PREFIX` (default `/api/v1`) by
`backend/src/routes/index.ts`.

| Prefix              | Module        | Responsibility                                                                                | Notable files                                                       |
| ------------------- | ------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `/health`           | health        | Liveness — pings DB + Redis. Reference pattern for the 6-file layout.                          | `health.routes.ts`                                                  |
| `/auth`             | auth          | Register / login (phone or email) / refresh / logout / me. Argon2 + rotating refresh tokens.  | `auth.service.ts`, `auth.tokens.ts`                                 |
| `/catalog`          | catalog       | Public product / category / brand reads; staff CRUD for products, variants, images.           | `catalog.routes.ts`, `catalog.service.ts`                           |
| `/cart`             | cart          | Server-owned cart (requires auth). Add / update / remove items; apply / remove coupon.        | `cart.service.ts`, `cart.pricing.ts`                                |
| `/wishlist`         | wishlist      | Signed-in wishlist; supports "move to cart".                                                  | `wishlist.routes.ts`                                                |
| `/coupons`          | coupon        | Public `POST /validate`; staff CRUD. Supports `PERCENT`, `FLAT`, `FREE_SHIPPING` types.       | `coupon.schema.ts`, `coupon.service.ts`                             |
| `/checkout`         | checkout      | `GET /summary` (address + slot + pricing) and `POST /place` (transactional order creation).   | `checkout.service.ts` (see the request-lifecycle example above)     |
| `/orders`           | order         | Customer listing / detail / cancel; admin listing + status transitions via state machine.     | `order.stateMachine.ts`, `order.service.ts`                         |
| `/payments`         | payment       | `POST /init` + `POST /verify` + gateway webhooks + refunds. Provider factory abstracts SDKs.  | `payment.providers/`, `payment.service.ts`                          |
| `/delivery`         | delivery      | Public serviceability + slots; admin zones/slots/assignments; partner driver-app endpoints.   | `delivery.autoAssign.ts`, `delivery.service.ts`, `haversine.ts`     |
| `/inventory`        | inventory     | Staff-only: warehouses, suppliers, stock levels, purchases, movements ledger, wastage report. | `inventory.routes.ts`                                               |
| `/reviews`          | review        | Public reads; authenticated writes; staff moderation (`/pending`, `/:id/approve`).            | `review.service.ts`                                                 |
| `/users`            | user          | Signed-in profile + address book. Admin customer listing.                                     | `user.routes.ts`                                                    |
| `/cms`              | cms           | Public pages / banners; admin CRUD for pages and banners.                                     | `cms.routes.ts`                                                     |
| `/settings`         | settings      | Public safe subset (`GET /public`); admin key/value settings management.                      | `settings.service.ts`                                               |
| `/notifications`    | notification  | User's in-app notifications: list, mark-read, mark-all-read. Producer is `notify()`.          | `notification.service.ts`                                           |
| `/dashboard`        | dashboard     | Staff-only KPI numbers for admin charts (`GET /stats`).                                       | `dashboard.service.ts`                                              |
| (mount-ready)       | audit         | Read-only admin surface over `audit_logs`. Router exists; integrator mounts under `/audit`.    | `audit.routes.ts`                                                   |

Shared cross-cutting code lives in `backend/src/lib` (`prisma.ts`, `redis.ts`,
`logger.ts`, `queue.ts`) and `backend/src/middlewares` (`auth`, `validate`,
`error`, `audit`, `rateLimit`, `requestId`, `sanitize`).

---

## 9. Persistence — schema at a glance

Detailed reference: `backend/prisma/schema.prisma` (704 lines). Highlights:

- **Users, auth, RBAC** — `User`, `RefreshToken`, `DeliveryPartnerProfile`, `Address`.
- **Catalog** — `Category` (self-referential tree), `Brand`, `Attribute`, `Product`, `ProductVariant`, `ProductImage`.
- **Inventory** — `Warehouse`, `Supplier`, `Inventory` (per variant per warehouse), `StockMovement`, `PurchaseOrder`.
- **Commerce** — `Cart` / `CartItem`, `Wishlist` / `WishlistItem`, `Coupon`, `Order` / `OrderItem` / `OrderStatusHistory`, `Payment`, `Refund`.
- **Delivery** — `DeliveryZone`, `DeliverySlot`, `DeliveryAssignment` (unique on `orderId`).
- **Content & ops** — `CmsPage`, `Banner`, `Setting`, `Notification`, `Review`, `AuditLog`.

Enum values mirror `@elite/shared` (`Role`, `OrderStatus`, `PaymentMethod`,
`PaymentStatus`, `DeliveryStatus`, `StockMovementType`, `CouponType`) so the
backend, admin, and frontend all speak the same vocabulary.

---

## 10. Configuration & secrets

Backend env is validated at boot by `backend/src/config/env.ts`
(`z.object({ ... }).safeParse(process.env)` → `process.exit(1)` on failure).
Required or defaulted variables are documented in
[docs/DEPLOY.md](DEPLOY.md#environment-variables). Payment / SMS / WhatsApp /
S3 / Cloudinary keys are read on demand by their providers — absent credentials
mean that provider is disabled, not that the app crashes.

Secrets live only in `backend/.env` on each host (`chmod 600`) — never in
git. The template is `.env.example` at the repo root.
