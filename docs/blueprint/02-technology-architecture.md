# 02 — Technology Architecture

> **Master Blueprint — Ojiva AI Technologies · Enterprise E-Commerce Web Application**
> Fresh non-veg (meat) cold-chain, hyperlocal D2C platform (reference: elitenonveg.com)
> Scope: Phase 1 = Web (Customer Website + Admin Panel + Backend APIs), API-first for future mobile apps.

This document covers two chapters:

- **Chapter 2 — Technology Recommendation** — why each element of the fixed stack is the correct choice *for a perishable, hyperlocal, weight-based meat business*, plus a defensible comparison of our custom stack against Magento, Laravel, WordPress/WooCommerce, Next.js and Shopify.
- **Chapter 3 — System Architecture** — the full layered runtime, every layer's responsibilities, its scaling story, and a complete request lifecycle for a customer placing an order.

The design intent throughout: **freshness and correctness win over convenience**. A wrong stock number, a missed delivery cut-off, or a double charge is not a cosmetic bug in this business — it is spoiled inventory, an angry hyperlocal customer, and a refund. Every technology below is justified against that reality.

---

# CHAPTER 2 — TECHNOLOGY RECOMMENDATION

## 2.1 Design Principles That Drive Every Choice

Before naming technologies, we fix the non-negotiable properties this platform must have. Each stack decision is later traced back to these.

| # | Principle | Why it matters for THIS business |
|---|-----------|----------------------------------|
| P1 | **API-first** | Phase 2/3 Android, iOS and Delivery Boy apps must reuse the exact same backend. No logic may hide inside the website. |
| P2 | **Strong data integrity** | Stock is real physical meat measured in grams. Overselling = a customer with no product; wrong price = revenue loss. Transactions must be ACID. |
| P3 | **Real-time, low-latency reads** | Serviceability checks, delivery-slot availability, cart, and catalog must feel instant on mobile networks in Hyderabad. |
| P4 | **Deferred / asynchronous work** | Invoices, WhatsApp/SMS confirmations, image processing and delivery auto-assignment must never block checkout. |
| P5 | **Financial correctness & idempotency** | COD + three payment gateways + weight-tolerance adjustments demand exactly-once handling of money events. |
| P6 | **Type safety end-to-end** | Weight math, price math, and stock decrements are error-prone. The compiler should catch mistakes before production. |
| P7 | **Operational portability & repeatability** | A single-store business needs cheap, reproducible deploys — dev == staging == prod — without a DevOps army. |
| P8 | **Total control of business rules** | Delivery slots, pincode zones, weight variance, COD limits, cut-off times: none of these exist in off-the-shelf e-commerce and cannot be forced into it cleanly. |

> **Headline conclusion:** No packaged platform (Shopify/Magento/Woo) models "sell 500g of chicken from a live kg-based stock pool, into a booked delivery slot, for a specific pincode zone, adjusting the final total for packing weight variance, payable by COD." That single sentence is why this is a **custom** build. Every tool below is chosen to make that sentence safe, fast and maintainable.

---

## 2.2 Why Each Technology — Tied to the Perishable / Hyperlocal Business

### 2.2.1 Why React.js (Customer Web + Admin Panel)

| Dimension | Justification for this project |
|-----------|-------------------------------|
| **Interactivity** | A meat-buying flow is stateful and reactive: pick weight variant (250g/500g/1kg) → price recomputes → check pincode serviceability → pick a delivery slot → cart badge updates → coupon revalidates. React's component + state model expresses this cleanly where server-rendered page reloads would feel slow and clumsy. |
| **Component reuse across two apps** | Customer Website and Admin Panel share primitives (product cards, weight/variant selectors, tables, forms, toasts). One React component library serves both, cutting build and maintenance cost for a single-store team. |
| **SPA feel on mobile** | The audience shops on phones over patchy mobile data in Hyderabad. A single-page app loads the shell once then exchanges small JSON payloads — snappy after first paint, which matters for conversion on perishables bought on impulse. |
| **Ecosystem fit with the fixed toolset** | React Router (navigation), Axios (API calls), React Hook Form (address/checkout forms with validation), **TanStack Query** (server-state caching, background refetch, retries) are all first-class in React. TanStack Query is especially valuable here: slot availability and stock are volatile, and it gives us cache-with-revalidate semantics for free. |
| **Talent & longevity** | Largest hiring pool of any frontend framework in India; the client can staff and maintain it long term. |
| **Admin analytics** | Chart.js + React Table (per brief) plug directly into React for the Admin dashboards (sales, inventory, delivery load). |

**Verdict:** React gives us a reactive, mobile-first, component-shared UI for both the storefront and the admin, using exactly the libraries the brief fixes.

### 2.2.2 Why Node.js + Express.js (Backend Runtime)

| Dimension | Justification for this project |
|-----------|-------------------------------|
| **One language across the stack** | Frontend is JavaScript/TypeScript; Node makes the backend TypeScript too. Shared types (Product, Order, Slot, Zone) flow from DB → API → UI with one mental model — fewer translation bugs in weight/price logic. |
| **I/O-bound workload = Node's sweet spot** | This backend is overwhelmingly I/O: DB queries, Redis reads, gateway webhooks, WhatsApp/SMS calls, S3 uploads. Node's non-blocking event loop serves thousands of concurrent lightweight requests (browse, cart, slot-check) with a small footprint — ideal for a hyperlocal burst at dinner-time ordering peaks. |
| **Express: minimal, explicit, controllable** | Express is an unopinionated micro-framework. For a business whose rules (zones, slots, tolerance, COD caps) are *unique*, we want to compose middleware and routing explicitly rather than fight a heavyweight framework's conventions. |
| **Mature middleware ecosystem** | JWT auth, rate limiting, validation, logging, CORS, Helmet security headers — all available and battle-tested, so we assemble a hardened API quickly. |
| **BullMQ affinity** | The queue system (BullMQ) is Node-native and Redis-backed; workers are just more Node processes sharing the same codebase and types as the API. |
| **API-first delivery** | Express serves clean REST JSON that the website today, and mobile/delivery apps tomorrow, consume identically (Principle P1). |

**Verdict:** Node + Express is the lean, I/O-optimized, single-language backbone that keeps the whole team in one type system and feeds naturally into the queue/worker model this perishable workflow needs.

### 2.2.3 Why TypeScript (Backend Language)

| Dimension | Justification for this project |
|-----------|-------------------------------|
| **Money & weight are unforgiving** | Prices in ₹ and stock in grams must never silently coerce (`"500" + 250`). TypeScript's static types catch unit and shape errors at compile time, before they spoil an order. |
| **Domain modelling** | Order states (`PENDING → CONFIRMED → PACKED → OUT_FOR_DELIVERY → DELIVERED / CANCELLED`), payment states, and slot states are best modelled as explicit union types — the compiler then forces every code path to handle every state. |
| **Safer refactors** | A single-store platform evolves for years; typed contracts let us change a field and have the compiler list every impacted file. |
| **Prisma synergy** | Prisma generates fully typed DB clients, so a column rename or type change surfaces as compile errors across services — huge for data integrity (P2, P6). |

**Verdict:** TypeScript is the guardrail that makes weight-based, money-handling commerce code safe to write and safe to change.

### 2.2.4 Why PostgreSQL (Primary Database)

| Dimension | Justification for this project |
|-----------|-------------------------------|
| **ACID transactions** | Placing an order must, in one atomic transaction: decrement weight-based stock, create the order + line items, reserve the delivery slot capacity, and apply the coupon. PostgreSQL guarantees all-or-nothing — the single most important property against overselling perishables (P2). |
| **Relational integrity** | The domain is deeply relational: Customers↔Addresses↔Orders↔Items↔Variants↔Inventory↔Zones↔Slots↔Payments. Foreign keys, constraints and joins keep this consistent; a document store would push that integrity burden into application code. |
| **Row-level locking & concurrency** | Two customers grabbing the last 500g pack in the same slot is a classic race. Postgres `SELECT ... FOR UPDATE` / transactional locks let us serialize the decrement correctly. |
| **Rich types** | Numeric/decimal for exact ₹ money and gram weights (no float rounding), `JSONB` for flexible product attributes, arrays for serviceable pincodes, timestamps with time zone for slot cut-offs. |
| **Analytical strength** | Admin reports (sales by category, delivery load per zone, COD vs prepaid) are SQL aggregations Postgres handles natively — feeding Chart.js dashboards. |
| **Reliability & cost** | Open-source, no licensing, proven at scale; safe long-term bet for a single-store enterprise. |

**Verdict:** PostgreSQL is the correct system of record because this business is fundamentally about *consistent money and consistent physical stock*, which is exactly what a transactional relational database guarantees.

### 2.2.5 Why Prisma (ORM / Data Access Layer)

| Dimension | Justification for this project |
|-----------|-------------------------------|
| **Type-safe queries** | Prisma generates a typed client from the schema, so every query into Orders/Inventory/Slots is checked by the compiler — no stringly-typed SQL drift (P6). |
| **Single source of schema truth** | `schema.prisma` documents the entire data model in one readable file — invaluable onboarding artifact for a team implementing from this blueprint. |
| **Safe migrations** | Prisma Migrate produces versioned, reviewable, reproducible schema changes across dev/staging/prod (P7) — critical when the live DB holds real orders and money. |
| **Transaction API** | First-class interactive transactions express the atomic "decrement stock + create order + reserve slot" flow clearly and safely (P2). |
| **Repository-friendly** | Prisma sits naturally in the repository layer of our controller→service→repository pattern, isolating all DB access behind typed methods. |
| **Productivity** | Eliminates hand-written boilerplate DAO code, letting the team focus on meat-domain business rules, not plumbing. |

**Verdict:** Prisma gives us typed, migration-controlled, transaction-safe access to PostgreSQL — protecting the integrity that this perishable business lives or dies by, while keeping developers fast.

### 2.2.6 Why Redis (In-Memory Cache & Coordination Layer)

| Dimension | Justification for this project |
|-----------|-------------------------------|
| **Hot-path caching** | Catalog, category trees, active offers and serviceable-pincode maps are read on nearly every page but change rarely. Caching them in Redis serves them in sub-millisecond time and shields PostgreSQL during dinner-time traffic bursts (P3). |
| **Cart storage** | Carts are high-write, transient, session-scoped — a perfect fit for fast Redis structures rather than hammering the relational DB on every quantity tweak. |
| **Sessions / token denylist** | JWT refresh sessions and logout/blacklist state live in Redis for fast, centrally revocable auth. |
| **Rate limiting** | Redis counters back the API rate limiter (login brute-force protection, OTP throttling, checkout abuse). |
| **Slot-availability counters** | Fast atomic counters for "packs left in the 6–8pm slot for Zone 4" reduce contention on the DB while still being reconciled transactionally at commit. |
| **BullMQ broker** | BullMQ requires Redis as its backing store — so Redis simultaneously powers our async queue (see 2.2.x). One dependency, many jobs. |

**Verdict:** Redis is the speed-and-coordination layer: it keeps hot reads instant, absorbs volatile cart/slot writes, enforces rate limits, and doubles as the queue broker — directly serving Principles P3, P4 and P5.

### 2.2.7 Why Native VPS + PM2 + NGINX (No Docker)

The platform is deployed **directly on a single Ubuntu VPS** — NGINX, PM2-managed Node processes, PostgreSQL and Redis all run as native services on the host. No Docker, no containers, no orchestration layer.

| Dimension | Justification for this project |
|-----------|-------------------------------|
| **Simpler operations** | A single-store team runs one Ubuntu box with well-understood system services (`systemd`, `pm2`, `nginx`, `postgresql`, `redis-server`). No image builds, registries, container networking or Compose files to learn, debug or maintain. |
| **Single-VPS reality** | Phase 1 is one region (Hyderabad), one store, modest volume. The whole stack comfortably fits one strong VPS; containerisation would add moving parts without solving a problem the business actually has. |
| **Lower overhead** | Native processes avoid the container runtime's memory/CPU tax and image-storage footprint — every core and gigabyte goes to Postgres, Redis and the Node cluster instead of the daemon. |
| **Team familiarity** | The developers are fluent in Linux, NGINX and PM2. Deploying via `git pull` + `npm ci` + `prisma migrate deploy` + `pm2 reload` is transparent and debuggable with standard tooling they already know. |
| **Process management & zero-downtime** | PM2 runs the Node API and BullMQ worker in **cluster mode** (all CPU cores), auto-restarts on crash, and performs **zero-downtime `pm2 reload`** — the reproducibility and resilience benefits we need, without containers. |
| **CI/CD readiness** | The brief's CI/CD goal is met by GitHub Actions that SSH into the VPS and run the deploy script — versioned by Git commit, no image pipeline required (P7). |
| **Easy to add Docker later** | Nothing here forecloses containers. If volume grows and the team needs multi-host horizontal scaling, the same Node/Prisma codebase can be packaged into images and moved to Docker/orchestration with no application rewrite. |

**Verdict:** For a lean single-store team on one VPS, native NGINX + PM2 + PostgreSQL + Redis is the simplest, lowest-overhead, most debuggable path to a resilient, zero-downtime deployment — with a clean upgrade path to Docker if scale ever demands it.

### 2.2.8 Why REST APIs (Interface Style)

| Dimension | Justification for this project |
|-----------|-------------------------------|
| **Simplicity & universality** | REST over HTTP/JSON is understood by every client the roadmap names: React web now; Android, iOS, Delivery Boy apps later. No specialized client runtime needed (P1). |
| **Cacheability** | RESTful GETs for catalog/zones/slots map cleanly onto NGINX and Redis caching — matching our read-heavy, low-latency need (P3). |
| **Clear resource model** | The domain is naturally resource-oriented (`/products`, `/cart`, `/orders`, `/slots`, `/serviceability`, `/payments/webhook`) — REST expresses it intuitively for developers reading this blueprint. |
| **Webhook compatibility** | Razorpay/PhonePe/Cashfree deliver payment events as HTTP POST webhooks — a REST backend receives them without extra machinery (P5). |
| **Tooling & debuggability** | Postman, curl, browser devtools all speak REST; support and QA can inspect any call. |

**Verdict:** REST is the pragmatic, universally consumable, cache-friendly contract that keeps the platform truly API-first for web and every future app.

### 2.2.9 Why Bootstrap 5 (UI Framework)

| Dimension | Justification for this project |
|-----------|-------------------------------|
| **Speed to market** | A single-store business needs a clean, trustworthy, responsive storefront fast. Bootstrap's grid and components deliver a polished, mobile-first UI without building a design system from scratch. |
| **Mobile-first responsiveness** | The majority of meat orders come from phones; Bootstrap's responsive grid guarantees the catalog, variant selectors and checkout reflow correctly across devices. |
| **Consistency across two apps** | The same Bootstrap system styles both Customer Website and Admin Panel, giving a coherent look with minimal custom CSS (per brief). |
| **Accessibility & cross-browser** | Bootstrap ships accessible, cross-browser-tested components — fewer surprises for a broad Hyderabad consumer base on varied devices. |
| **Low learning curve** | Widely known; any React developer can be productive immediately, protecting delivery timelines. |

**Verdict:** Bootstrap 5 is the fastest route to a trustworthy, responsive, consistent UI for both apps — appropriate for a lean single-store team focused on business logic, not pixel plumbing.

### 2.2.10 Why JWT (Authentication)

| Dimension | Justification for this project |
|-----------|-------------------------------|
| **Stateless, API-first auth** | JWTs let the same token authenticate the React site today and mobile/delivery apps tomorrow, without server-side session affinity — perfectly matching Principle P1. |
| **Horizontal scale** | Because verification is stateless, any Node process behind NGINX can validate a request — no sticky sessions needed as PM2 cluster workers (or later, additional VPS nodes) scale out. |
| **RBAC carrier** | The token carries the user's role (Customer, Delivery Partner, Store Manager, …) and claims, which our RBAC middleware reads to authorize each endpoint against the canonical role list. |
| **Refresh + revocation** | Short-lived access tokens plus refresh tokens (with a Redis-backed denylist for logout/compromise) balance convenience and security (P5). |
| **Cross-client fit** | Works uniformly for browser (HTTP-only cookie/local storage strategy) and native app clients that hold tokens directly. |

**Verdict:** JWT is the stateless, role-carrying, multi-client credential that keeps auth consistent and scalable across the website and every future app.

---

## 2.3 Custom Stack vs Off-the-Shelf Platforms

The brief mandates a **fully custom** build and explicitly rules out WordPress/Shopify/Magento as the *product*. This section proves *why* custom wins for a perishable, hyperlocal, weight-based meat business — using each alternative's own strengths honestly, then showing where it breaks against our Section 2.1 principles.

### 2.3.1 The four requirements that break packaged platforms

Every comparison below is judged against these business-specific needs that no meat-delivery use case can skip:

1. **Weight-based inventory & pricing** — stock in kg/grams, decremented by weight, variants of 250g/500g/1kg, price per weight.
2. **Delivery-slot booking + per-slot cut-off times** — not courier shipping; capacity-limited time windows.
3. **Pincode/zone serviceability** — checked *before* checkout; hyperlocal own-fleet delivery.
4. **Weight-tolerance final-total adjustment + COD** — order total may adjust at packing; COD is first-class.

### 2.3.2 Custom Stack (Ours) vs Magento (Adobe Commerce)

| Aspect | Magento | Our Custom Stack |
|--------|---------|------------------|
| **Pros** | Enterprise-grade catalog; native multi-store; rich B2B; mature admin. | Purpose-built for meat: weight stock, slots, zones native. Lightweight and fast. |
| **Cons** | Extremely heavy (PHP monolith); high hosting cost; steep learning curve; perishable slot/zone logic requires heavy custom modules anyway; slow admin. | Must be built (upfront effort) — but that effort goes straight into *our* rules. |
| **Weight/slot/zone/COD fit** | All four require significant custom modules bolted onto assumptions built for boxed-goods shipping. | All four are first-class domain concepts. |
| **Verdict** | Over-engineered for a single store; we'd pay a huge complexity tax and *still* custom-build the perishable core. | **Wins** — same custom logic, none of the monolith weight or licensing/hosting cost. |

### 2.3.3 Custom Stack (Ours) vs Laravel (PHP framework)

Laravel is the closest philosophical competitor — it is also a "build it yourself" framework, so the contest is real.

| Aspect | Laravel | Our Custom Stack |
|--------|---------|------------------|
| **Pros** | Excellent DX; batteries-included (queues, auth, ORM Eloquent); rapid development; strong community. | Single language (TypeScript) across web + API + workers; Node's event loop ideal for I/O-heavy hyperlocal bursts; typed contracts DB→UI. |
| **Cons** | Different language from the React frontend → two ecosystems, two type systems, no shared models; PHP concurrency model less suited to many concurrent lightweight I/O calls. | Slightly more assembly than Laravel's conventions (we choose middleware explicitly). |
| **Weight/slot/zone/COD fit** | Fully achievable — Laravel *can* build this well. | Fully achievable with end-to-end type safety on the money/weight math. |
| **Verdict** | A credible alternative, but forces a language split and loses shared types. | **Wins** — one language, one type system end-to-end, better concurrency profile for our workload, and it is the brief's fixed stack. |

### 2.3.4 Custom Stack (Ours) vs WordPress / WooCommerce

| Aspect | WordPress + WooCommerce | Our Custom Stack |
|--------|-------------------------|------------------|
| **Pros** | Fastest to a basic shop; cheap; vast plugin market; non-technical admin. | Built for our exact fulfilment model; scalable, secure, API-first. |
| **Cons** | Plugin-sprawl fragility; performance and security concerns at scale; not API-first; weight-stock/slot/zone/tolerance need multiple third-party plugins that fight each other; hard to guarantee ACID stock correctness. | Requires engineering investment. |
| **Weight/slot/zone/COD fit** | Cobbled together from mismatched plugins; brittle, hard to keep consistent; overselling risk. | Native, transactional, consistent. |
| **Verdict** | Fine for a blog-with-a-shop; wrong for a cold-chain operation where stock correctness is existential. | **Wins** — reliability and correctness a plugin stack cannot guarantee. |

### 2.3.5 Custom Stack (Ours) vs Next.js

Next.js is a React *meta-framework*, not a commerce platform — so this compares architecture style, not features.

| Aspect | Next.js | Our Custom Stack (React SPA + separate Node API) |
|--------|---------|--------------------------------------------------|
| **Pros** | SSR/SSG great for SEO; unified full-stack React; edge rendering. | Clean separation of concerns: one backend serves web + all future mobile/delivery apps identically (true API-first); simpler mental model; independent scaling of API vs UI. |
| **Cons** | Blurs frontend/backend; its API routes are not the natural home for a heavy, queue-driven, transactional commerce backend consumed by *non-web* clients; coupling web framework to core business API risks Phase-2 mobile reuse. | SPA needs deliberate SEO handling (SSR/prerender for public catalog pages) — a manageable, known task. |
| **Weight/slot/zone/COD fit** | Logic would still live in a Node backend regardless. | Logic lives in one shared, independently deployable API. |
| **Verdict** | Strong for SEO-first content sites; its full-stack coupling works against our "one backend, many apps" mandate. | **Wins for the API-first mandate** — mobile and delivery apps in Phase 2/3 must reuse the *same* backend, so the backend must stand alone. (SEO for public pages is addressed with targeted SSR/prerendering.) |

### 2.3.6 Custom Stack (Ours) vs Shopify

| Aspect | Shopify | Our Custom Stack |
|--------|---------|------------------|
| **Pros** | Fastest launch; fully managed; reliable checkout; huge app store; PCI handled. | Total control of weight stock, slots, zones, tolerance, COD, own-fleet delivery; no per-transaction fees; own the data and roadmap. |
| **Cons** | Rigid checkout/data model; recurring fees + transaction cut; weight-decrement stock, capacity-limited delivery slots, pincode-zone gating and packing-weight tolerance are all *outside* its model — you fight the platform and rent apps that still don't fit; own-fleet hyperlocal delivery unsupported natively. | Must build and self-manage (mitigated by the native VPS + PM2 + NGINX deployment, SSH-based CI/CD and this blueprint). |
| **Weight/slot/zone/COD fit** | Poor: forces boxed-product, courier-shipping assumptions; heavy app hacks; limited COD/tolerance handling. | Native and precise. |
| **Verdict** | Great for standard retail; structurally unable to model cold-chain, weight-based, slot-booked, hyperlocal meat delivery without constant friction and rented workarounds. | **Wins** — the fulfilment model *is* the product, and only custom can express it. |

### 2.3.7 Summary Scorecard

Scale: ✅ strong fit · ⚠️ possible with effort · ❌ poor fit.

| Requirement / Property | **Custom (Ours)** | Magento | Laravel | WP/Woo | Next.js | Shopify |
|------------------------|:---:|:---:|:---:|:---:|:---:|:---:|
| Weight-based stock & pricing | ✅ | ⚠️ | ✅ | ❌ | ✅ | ❌ |
| Delivery-slot booking + cut-offs | ✅ | ⚠️ | ✅ | ⚠️ | ✅ | ❌ |
| Pincode/zone serviceability | ✅ | ⚠️ | ✅ | ⚠️ | ✅ | ⚠️ |
| Weight-tolerance total + COD | ✅ | ⚠️ | ✅ | ⚠️ | ✅ | ❌ |
| True API-first (web + mobile + fleet) | ✅ | ⚠️ | ✅ | ❌ | ⚠️ | ❌ |
| End-to-end type safety (money/weight) | ✅ | ❌ | ⚠️ | ❌ | ✅ | n/a |
| Low hosting / no recurring platform fees | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ |
| Data & roadmap ownership | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Time-to-launch (raw) | ⚠️ | ❌ | ⚠️ | ✅ | ⚠️ | ✅ |

**Overall verdict:** Packaged platforms optimize for *standard boxed retail*. This business is *cold-chain, weight-based, slot-booked, pincode-gated, own-fleet, COD-heavy* — a set of requirements that live at the core of the product, not at its edges. Only a custom Node/TypeScript/PostgreSQL/Prisma/Redis stack lets us model those requirements as first-class citizens with transactional correctness, end-to-end type safety, and a single backend reusable by every future app. Custom wins.

---

# CHAPTER 3 — SYSTEM ARCHITECTURE

## 3.1 The Full Layered Architecture (ASCII)

```
                                   ┌───────────────────────────────────────────┐
                                   │                CUSTOMERS                    │
                                   │  Phone / Desktop browsers (Hyderabad)       │
                                   │  Admin & Store staff · (future) Mobile apps │
                                   └───────────────────┬─────────────────────────┘
                                                       │ HTTPS
                                                       ▼
                 ┌─────────────────────────────────────────────────────────────────────┐
                 │   LAYER 1 — CLIENT LAYER (React SPAs, Bootstrap 5)                    │
                 │   ┌───────────────────────────┐   ┌──────────────────────────────┐   │
                 │   │  Customer Website (React) │   │  Admin Panel (React)         │   │
                 │   │  Router·Axios·RHF·        │   │  Chart.js · React Table      │   │
                 │   │  TanStack Query           │   │  (dashboards, ops)           │   │
                 │   └───────────────────────────┘   └──────────────────────────────┘   │
                 └───────────────────────────────┬─────────────────────────────────────┘
                                                 │  REST / JSON  (JWT in header/cookie)
                                                 ▼
                 ┌─────────────────────────────────────────────────────────────────────┐
                 │   LAYER 2 — API GATEWAY / REVERSE PROXY  (NGINX)                      │
                 │   TLS termination · routing · rate limiting · load balancing ·        │
                 │   gzip/br compression · static asset & cache headers · WAF-lite        │
                 └───────────────────────────────┬─────────────────────────────────────┘
                                                 │ HTTP (localhost loopback, 127.0.0.1)
                                                 ▼
                 ┌─────────────────────────────────────────────────────────────────────┐
                 │   LAYER 3 — APPLICATION LAYER  (Node.js + Express + TypeScript)       │
                 │   Middleware: JWT auth → RBAC → validation → rate-limit → logging      │
                 │   Pattern:   Controller  →  Service (business rules)  →  Repository     │
                 │   Modules:   Auth, Products, Cart, Checkout, Orders, Payments,          │
                 │              Delivery, Inventory, Coupons, Reports, CMS, Settings…      │
                 │   [ Stateless · PM2 cluster mode · one worker per CPU core on the VPS ] │
                 └───┬───────────────────────┬───────────────────────┬──────────────────┘
                     │                       │                       │
        ┌────────────▼──────────┐  ┌─────────▼──────────┐  ┌─────────▼─────────────────┐
        │ LAYER 4 — CACHE       │  │ LAYER 6 — DATABASE │  │ LAYER 7 — OBJECT STORAGE  │
        │ Redis                 │  │ PostgreSQL (Prisma)│  │ AWS S3 / Cloudinary       │
        │ • sessions/JWT deny   │  │ • system of record │  │ • product images/media    │
        │ • cart                │  │ • ACID txns        │  │ • invoice PDFs            │
        │ • catalog/zone cache  │  │ • FKs/constraints  │  │ • CDN-delivered           │
        │ • rate-limit counters │  │ • read replica(s)  │  └───────────────────────────┘
        │ • slot counters       │  │ • PITR backups     │
        │ • BullMQ broker  ─────┼──┐└────────────────────┘
        └───────────────────────┘  │
                                    │ jobs
                     ┌──────────────▼───────────────────────────────────────────────────┐
                     │   LAYER 5 — QUEUE / WORKER LAYER  (BullMQ workers, Node/TS)        │
                     │   notifications · invoice-PDF · image-processing ·                 │
                     │   delivery auto-assign · report generation · webhook post-proc     │
                     └───┬───────────────────────────┬───────────────────────────────────┘
                         │                           │
          ┌──────────────▼─────────────┐  ┌──────────▼───────────────────────────────────┐
          │ LAYER 8 — NOTIFICATIONS    │  │ LAYER 9 — PAYMENT GATEWAYS                    │
          │ SMTP email · SMS gateway · │  │ Razorpay · PhonePe · Cashfree · COD           │
          │ WhatsApp Business API ·    │  │  ↑ webhooks (idempotent) back into Layer 3     │
          │ Firebase Push (future)     │  │ Google Maps (geocode/zone) also called here    │
          └────────────────────────────┘  └───────────────────────────────────────────────┘

     CROSS-CUTTING (spanning all layers): Logging · Monitoring/Alerting · Security ·
     Config/Secrets · SSH-based CI/CD · PM2 process management (cluster + startup) · Audit Logs
```

**Canonical request path (happy path):**
`Customer → React → NGINX → Node/Express → (Redis check) → PostgreSQL → commit → enqueue BullMQ → Workers → Notifications / Storage / Payment` — detailed end-to-end in Section 3.13.

---

## 3.2 Layer 1 — Client Layer (Customer Web + Admin Web)

Two independent React SPAs, both styled with Bootstrap 5, both talking only to the REST API. They hold **no business rules** — every rule (price, stock, tolerance, serviceability, RBAC) is enforced server-side; the client merely presents and validates for UX.

| Concern | Customer Website | Admin Panel |
|---------|------------------|-------------|
| **Primary users** | Consumers (Customer role) | Super Admin, Admin, Store/Inventory/Delivery Managers, Customer Support |
| **Key libraries** | React Router, Axios, React Hook Form, TanStack Query, Bootstrap 5 | React, Bootstrap 5, Chart.js, React Table |
| **Core screens** | Catalog, product+variant, serviceability check, cart, checkout, slot booking, order tracking, account, wishlist, compare | Dashboard, Products/Inventory, Orders, Delivery board, Customers, Coupons, Reports, CMS, Settings, Roles |
| **Server-state strategy** | TanStack Query caches catalog/zones/slots with background revalidation; volatile data (stock, slots) short TTL | React Query/Table for paginated, filterable operational grids |
| **Auth** | JWT (access + refresh); role = Customer | JWT; elevated roles gate the whole app + per-feature RBAC |
| **Responsibilities** | Render UI, client-side form validation, optimistic cart UX, call REST API, show real-time order status | Operate the store: manage catalog/stock/orders/delivery, view analytics |

**Responsibilities**

- Render responsive, mobile-first UI (Bootstrap grid) and manage local UI state.
- Validate forms (React Hook Form) for fast feedback — **never** as the source of truth.
- Communicate exclusively via REST/JSON (Axios), attaching the JWT.
- Cache and revalidate server state (TanStack Query) to keep catalog/slots feeling instant.
- Present real-time order/delivery status pushed from the backend.

**Scaling story:** SPAs are static bundles — built once and served as immutable assets via NGINX and a CDN. Scaling the frontend is essentially free (edge caching); traffic growth pressures the API, not the static client. Customer and Admin apps deploy and scale independently.

---

## 3.3 Layer 2 — API Gateway / Reverse Proxy (NGINX)

NGINX is the single public entry point. Nothing reaches Node directly.

| Function | What NGINX does here | Why it matters for this business |
|----------|----------------------|----------------------------------|
| **TLS termination** | Terminates HTTPS (Let's Encrypt/commercial cert), enforces HSTS, modern ciphers | Protects logins, addresses, payment redirects; trust signal for consumers |
| **Routing / reverse proxy** | Routes `/api/*` to Node cluster; serves static SPA bundles and media; proxies webhooks to the app | Clean separation of static vs API; one domain, many services |
| **Load balancing** | Distributes requests across the PM2 cluster workers on the loopback upstream (round-robin/least-conn) | Absorbs dinner-time ordering spikes by spreading load across all CPU cores |
| **Rate limiting** | Edge throttling per IP/route (login, OTP, checkout, webhook) | First line of defense against brute-force, OTP abuse, checkout spam |
| **Compression & caching** | gzip/brotli; cache headers for static + cacheable GETs | Faster loads on mobile networks; less origin load |
| **Security hardening** | Security headers, request size limits, basic WAF-style rules, hides upstream | Reduces attack surface before traffic hits app code |
| **Health checks** | Proxies to PM2 cluster workers; PM2 auto-restarts crashed workers and `pm2 reload` keeps a live worker serving during deploys | Zero-downtime deploys and resilience |

**Scaling story:** NGINX is extremely lightweight and can proxy tens of thousands of connections per node. It fronts the PM2 cluster on this VPS; if volume outgrows one box, additional VPS nodes are added to the NGINX upstream (or a managed load balancer is placed in front). TLS and rate limiting stay centralized regardless of how many Node processes or nodes exist.

---

## 3.4 Layer 3 — Application Layer (Express + TypeScript)

The brain of the platform: stateless Node/Express services in TypeScript, implementing every business rule for the canonical modules (Auth, Products, Categories, Brands, Attributes, Variants, Inventory, Warehouse, Customers, Addresses, Cart, Wishlist, Coupons, Checkout, Orders, Payments, Delivery, Reports, Reviews, CMS, Settings, Roles, Permissions, Logs, Audit Logs, Notification Center).

**Request pipeline (middleware order):**

```
Incoming request
   → CORS + security headers
   → Body parse + payload size guard
   → Request/correlation-ID + structured logging
   → JWT authentication (verify signature, expiry, denylist in Redis)
   → RBAC authorization (role + permission check against the route)
   → Input validation (schema validate body/params/query)
   → Per-route rate limiting (Redis counters)
   → CONTROLLER → SERVICE → REPOSITORY
   → Response (typed DTO) / centralized error handler
```

**Layered internal pattern:**

| Sub-layer | Responsibility | Example (place order) |
|-----------|----------------|-----------------------|
| **Controller** | HTTP concerns only: parse request, call service, shape response, map errors to status codes | `POST /orders` receives payload, returns 201 + order DTO |
| **Service** | Pure business rules; orchestrates transactions; no HTTP, no raw SQL | Validate serviceability + slot + stock + coupon, run atomic order transaction, enqueue jobs |
| **Repository** | All data access via Prisma; the only layer that touches the DB | Typed reads/writes for Inventory, Orders, Slots, Payments |

**Cross-cutting concerns handled here:** JWT auth, RBAC middleware (maps the eight canonical roles to permissions), input validation, idempotency handling for payment webhooks, audit logging of sensitive actions, and enqueuing async work to BullMQ.

**Scaling story:** Because every API process is **stateless** (session/cart/rate-limit state lives in Redis; data in Postgres), we scale simply by running more processes. PM2 runs the app in **cluster mode** to use all CPU cores on the VPS; when one box is no longer enough, additional VPS nodes join the NGINX upstream. No sticky sessions are needed thanks to JWT (Principle P1).

---

## 3.5 Layer 4 — Caching Layer (Redis)

Redis is the low-latency memory and coordination layer. It stores nothing that cannot be rebuilt from Postgres — it is an accelerator and coordinator, never the system of record.

| Use | Data | TTL / policy | Business reason |
|-----|------|--------------|-----------------|
| **Sessions / JWT denylist** | Refresh-session records, revoked token IDs | Session lifetime / until expiry | Fast auth + instant logout/compromise revocation |
| **Cart** | Per-user/guest cart items, quantities, chosen variants | Rolling expiry | High-write, transient — spares the DB on every quantity change |
| **Catalog cache** | Product/category/brand/offer read models | Minutes, invalidated on admin edit | Sub-ms reads on the hottest pages during peaks |
| **Serviceability / zone cache** | Pincode → zone → serviceable + slot template map | Long TTL, invalidated on settings change | Instant pre-checkout serviceability check |
| **Slot-availability counters** | Remaining capacity per (zone, slot, date) | Reconciled at commit | Fast "slots left" without hammering DB; race-safe with DB confirm |
| **Rate-limit counters** | Per-IP/user/route request counts | Sliding window | Brute-force / OTP / checkout abuse protection |
| **BullMQ broker** | Queues, job state, delayed jobs | Managed by BullMQ | Backbone of the async worker layer |

**Consistency rule:** For money and stock, Redis is a *fast pre-check*, and the authoritative decrement/reserve always happens inside the PostgreSQL transaction. Redis counters are reconciled/invalidated on commit — we never trust the cache to move money or oversell meat.

**Scaling story:** Start single-node Redis with persistence (AOF) and daily snapshots. Grow to Redis with replicas for read scaling and failover; partition by concern (cache vs queue) if load demands. Because cache data is reconstructable, a Redis restart degrades performance briefly but never loses the source of truth.

---

## 3.6 Layer 5 — Queue / Worker Layer (BullMQ)

Any work that is slow, external, or must be retried is pushed off the request path onto BullMQ queues (backed by Redis) and processed by a dedicated Node/TypeScript worker process managed by PM2 (separate from the API app). This keeps checkout fast and the system resilient (Principle P4).

| Queue / Job | Trigger | What the worker does | Why async |
|-------------|---------|----------------------|-----------|
| **Notifications** | Order placed/confirmed/packed/out-for-delivery/delivered; OTP; payment result | Send SMS + WhatsApp + email via Layer 8 | External APIs are slow/unreliable; must retry without blocking checkout |
| **Invoice PDF** | Order confirmed | Render invoice PDF, store in S3, attach to notification | CPU/render work; not needed synchronously |
| **Image processing** | Admin uploads product image | Resize, compress, generate thumbnails/webp, push to S3/Cloudinary | Heavy transform; keeps admin UI responsive |
| **Delivery auto-assign** | Order confirmed for a serviceable zone/slot | Assign to available Delivery Partner by zone/slot/load rules | Complex logic; retried; decoupled from checkout |
| **Report generation** | Scheduled or admin-requested | Aggregate large datasets, build report file/S3 | Long-running; must not block API |
| **Webhook post-processing** | Payment webhook received & acknowledged | Reconcile payment, update order, trigger downstream jobs | Fast-ack the gateway, do heavy work off-path |

**Reliability features:** automatic retries with backoff, dead-letter handling for poison jobs, delayed jobs (e.g., slot cut-off reminders), and idempotent job handlers so a retried notification never double-sends.

**Scaling story:** The worker runs as a **separate PM2 process** scaled independently of the API — if notifications spike, raise the worker's PM2 instance count without touching the web tier. Queue concurrency is tuned per job type. Because API and worker share the same TypeScript codebase and types, business rules stay consistent across both.

---

## 3.7 Layer 6 — Database Layer (PostgreSQL + Prisma)

The single system of record. Everything about money, stock, orders, and identity is authoritative here.

| Responsibility | Detail |
|----------------|--------|
| **Transactional integrity** | The order transaction (decrement weight stock + create order/items + reserve slot capacity + apply coupon + create payment intent) is one ACID transaction — the core defense against overselling perishables |
| **Relational model** | FKs and constraints across Customers, Addresses, Orders, Items, Variants, Inventory, Zones, Slots, Coupons, Payments, Delivery |
| **Exact numeric types** | `decimal`/`numeric` for ₹ money and gram weights — no floating-point drift in price or weight-tolerance math |
| **Concurrency control** | Row-level locking (`SELECT … FOR UPDATE`) to serialize last-pack contention |
| **Access via Prisma** | Typed client in the repository layer; Prisma Migrate for versioned schema changes |
| **Auditability** | Backing store for Audit Logs module (who changed price/stock/role) |

**Read considerations:** The workload is read-heavy (browsing) with critical, lower-volume writes (orders). We serve hot reads from Redis first; for heavier read/reporting load we introduce **read replicas** — analytics and report generation query a replica so admin dashboards never contend with live checkout writes. Writes always go to the primary; the order transaction always runs on the primary.

**Backups & recovery:** Automated daily base backups plus continuous WAL archiving for **point-in-time recovery (PITR)** — essential when the DB holds real orders and payments. Backups are stored off-box (S3), periodically restore-tested, and retention meets business/finance needs.

**Scaling story:** Vertical scale first (Postgres scales well on a single strong node); then read replicas for read/report offload; connection pooling (e.g., PgBouncer) to protect the primary from connection storms as PM2 cluster workers (and later VPS nodes) multiply. The single-store, single-region (Hyderabad) profile means a well-tuned primary + replica comfortably covers Phase 1 and well beyond.

---

## 3.8 Layer 7 — Storage Layer (AWS S3 / Cloudinary)

Object storage for all binary/media assets, kept out of the database and served via CDN.

| Stored asset | Notes |
|--------------|-------|
| **Product & category images** | Uploaded via Admin; processed by the image-processing worker into optimized/thumbnail/webp variants |
| **Invoice PDFs** | Generated by the invoice worker; linked from orders and notifications |
| **Report exports** | Generated report files for admin download |
| **CMS media** | Banners, offer creatives, static content assets |

**Responsibilities:** durable, cheap, scalable blob storage; CDN delivery for fast global/edge image loading; signed URLs for private assets (invoices). Cloudinary optionally adds on-the-fly transformation/optimization; S3 is the durable default. The DB stores only URLs/keys, never binaries.

**Scaling story:** Object storage + CDN is effectively infinitely scalable and offloads all heavy media traffic from NGINX and the app tier — the product-image-heavy storefront stays fast regardless of catalog size or traffic.

---

## 3.9 Layer 8 — Notification Services

All customer and ops communications, driven from the worker layer (never inline in the request path).

| Channel | Used for | Notes |
|---------|----------|-------|
| **SMTP email** | Order confirmations, invoices (PDF attached), account/password, admin reports | Transactional email provider via SMTP |
| **SMS gateway** | OTP login, order status, delivery updates, COD confirmations | Critical for the Indian market; high deliverability |
| **WhatsApp Business API** | Order updates, support, the WhatsApp ordering channel (+91 …) | A primary channel per the reference business |
| **Firebase Push (future)** | App push once mobile apps ship (Phase 2/3) | Architecture reserves a channel; not in Phase 1 web |

**Responsibilities:** deliver the right message on the right channel, with templates, retries, and idempotency (a retried job must not double-notify). The Notification Center module records what was sent for audit and support.

**Scaling story:** Because notifications run on independently scalable BullMQ workers with retry/backoff, transient provider outages or dinner-time surges are absorbed by the queue rather than felt at checkout.

---

## 3.10 Layer 9 — Payment Gateway Integration

Supports **Razorpay, PhonePe, Cashfree, and Cash On Delivery**, unified behind a single internal payments service so order code is gateway-agnostic.

| Concern | Design |
|---------|--------|
| **Multiple gateways** | A common internal Payments abstraction; each gateway is an adapter behind it. Adding/swapping a gateway doesn't change order logic |
| **COD as first-class** | COD is a native payment method (no external call) — the order confirms with a COD flag; collection is reconciled on delivery |
| **Webhooks** | Gateways confirm payment via signed HTTP webhooks POSTed to the API; NGINX routes them, the app verifies signature, fast-acks, then post-processes via a worker |
| **Idempotency** | Every webhook/payment event carries a unique id; handlers are idempotent (dedupe on event/payment id) so retried webhooks never double-credit or double-confirm — the core of financial correctness (P5) |
| **Reconciliation** | Payment state transitions (created → authorized → captured/failed) are recorded and reconciled against orders; mismatches flagged for support |
| **Google Maps** | Geocoding/zone resolution for address → serviceable zone also integrates at this outbound-integration tier |

**Scaling story:** Webhook receipt is a fast, idempotent, ack-then-defer operation; heavy reconciliation runs on workers. This keeps payment handling correct and non-blocking even under bursts, and lets us route customers across gateways for reliability/cost.

---

## 3.11 Cross-Cutting Concerns (All Layers)

| Concern | Approach |
|---------|----------|
| **Logging** | Structured JSON logs with a correlation/request ID threaded from NGINX → app → workers, so one order can be traced across every layer |
| **Monitoring & alerting** | Health checks, metrics (latency, error rate, queue depth, DB connections), and alerts on anomalies (failed payments, growing dead-letter queue, slot-oversell attempts) |
| **Security** | TLS everywhere; JWT + RBAC; input validation; rate limiting; Helmet-style headers; secrets in a secrets manager/env, never in code; least-privilege DB/storage; PII protection for addresses/contacts; signed URLs for private files; audit logging of sensitive admin actions |
| **Configuration & secrets** | Environment-based config per environment (dev/staging/prod); secrets injected at runtime, never committed |
| **Auditing** | Audit Logs + Logs modules capture who changed price, stock, roles, orders — accountability for a money/stock-sensitive business |

---

## 3.12 Deployment Topology (Native VPS + PM2 + NGINX — No Docker)

Every tier runs as a **native process/service on a single Ubuntu VPS**. NGINX, the PM2-managed Node processes, PostgreSQL and Redis all live on the host and talk over the localhost loopback (`127.0.0.1`); only NGINX's 80/443 ports are public. See Chapter 16 (`07-deployment-vps.md`) for the full step-by-step build.

```
        ┌──────────────────────── Ubuntu VPS (single host) ───────────────┐
        │                                                                  │
        │   ┌───────────────┐   loopback 127.0.0.1 (private to host)        │
        │   │  NGINX        │◀── 80 / 443 public (only exposed ports)       │
        │   │  systemd svc  │    serves static React builds + proxies /api  │
        │   └──────┬────────┘                                               │
        │          │ proxy → 127.0.0.1:4000                                 │
        │   ┌──────▼──────────┐   ┌──────────────────┐   ┌───────────────┐  │
        │   │ API (PM2)       │   │ Worker (PM2)     │   │  Redis        │  │
        │   │ Node+Express+TS │   │ BullMQ consumer  │   │  redis-server │  │
        │   │ cluster mode    │   │ fork/instances   │   │ (cache+broker)│  │
        │   │ 1 proc / CPU    │   │ separate process │   │ :6379 local   │  │
        │   └──────┬──────────┘   └────────┬─────────┘   └───────────────┘  │
        │          │                       │                                │
        │   ┌──────▼───────────────────────▼──────┐   ┌──────────────────┐  │
        │   │  PostgreSQL (local :5432)            │   │  (external) S3 / │  │
        │   │  + optional managed instance later   │   │  Cloudinary CDN  │  │
        │   └──────────────────────────────────────┘   └──────────────────┘  │
        │                                                                  │
        └──────────────────────────────────────────────────────────────────┘
     CI/CD (GitHub Actions): SSH into VPS → git pull → npm ci → prisma migrate
                              deploy → build → pm2 reload  (zero-downtime)
```

| Element | Role |
|---------|------|
| **NGINX (native)** | Public edge (TLS, routing, LB across PM2 workers, rate limit, gzip, static SPA serving) as in Layer 2; installed via apt, runs under systemd |
| **PM2** | Runs the Node **API in cluster mode** (one process per CPU core) and the **BullMQ worker as a separate process** — uses all cores, auto-restarts on crash, zero-downtime `pm2 reload`, survives reboot via `pm2 startup` |
| **PostgreSQL (native)** | Installed on the VPS, listening on local `:5432`; can be split to a managed instance later without app changes |
| **Redis (native)** | Installed on the VPS, listening on local `:6379`; serves both cache and BullMQ broker |
| **GitHub + CI/CD** | GitHub Actions SSH into the VPS and run the deploy script (`git pull` → install → `prisma migrate deploy` → build → `pm2 reload`); versioned by Git commit — the brief's "CI/CD-ready" goal |
| **Ubuntu VPS** | Start on one box; split DB/Redis to dedicated/managed instances and add VPS nodes behind NGINX as Hyderabad volume grows |

**Scaling path in one line:** single VPS → separate DB/Redis to managed instances → add PM2 cluster workers, then additional VPS nodes behind NGINX → add Postgres read replica + connection pooler → (Phase 2+) the same API serves mobile & delivery apps with no rewrite.

---

## 3.13 Request Lifecycle Example — Customer Places an Order

A concrete end-to-end trace of one order (e.g., 500g boneless chicken + 1kg prawns, delivery to a Hyderabad pincode, 6–8 pm slot, COD) flowing through **every** layer.

```
[1] Customer (React) — clicks "Place Order"
      Axios POST /api/orders  (JWT in header)  ──────────────┐
                                                              ▼
[2] NGINX — terminates TLS, applies checkout rate limit, load-balances
      to a PM2 cluster worker, forwards over the localhost loopback.
                                                              ▼
[3] Express middleware — JWT verified (+Redis denylist check) →
      RBAC confirms role=Customer may create own order →
      request body validated (items, address, slot, payment method).
                                                              ▼
[4] Checkout Service (business rules) — pre-checks against Redis:
      • Serviceability: pincode → zone (zone cache)      → serviceable? ✔
      • Slot 6–8pm capacity counter                       → slots left? ✔
      • Coupon validity                                   → valid? ✔
                                                              ▼
[5] PostgreSQL (via Prisma) — ONE ACID TRANSACTION on the primary:
      • Lock & decrement weight stock (500g chicken, 1kg prawns)  ← prevents oversell
      • Re-verify slot capacity, reserve one slot unit
      • Create Order + line items (prices, weights, tolerance rule)
      • Apply coupon, compute total (free shipping >₹699 logic)
      • Create Payment record: method=COD, state=PENDING_COD
      COMMIT  (all-or-nothing).  Redis slot/stock counters reconciled.
                                                              ▼
[6] Checkout Service — enqueues BullMQ jobs (non-blocking), then
      Controller returns 201 + order DTO  ──────────► [1] React shows
                                                        "Order confirmed",
                                                        order tracking view.
   ── Everything below now runs asynchronously off the request path ──
                                                              ▼
[7] BullMQ Workers pick up jobs:
      • Invoice-PDF worker  → render PDF → store in S3 → link to order
      • Notification worker → SMS + WhatsApp + email "Order confirmed"
      • Delivery auto-assign worker → pick Delivery Partner for zone+slot
                                                              ▼
[8] Notification Layer — SMS gateway + WhatsApp Business API + SMTP
      deliver confirmations (idempotent; retried on transient failure).
                                                              ▼
[9] Storage Layer — invoice PDF durable in S3, served via signed URL /CDN.

  (For a PREPAID order instead of COD, insert between [4] and [5]:
   Payment Service creates a gateway order (Razorpay/PhonePe/Cashfree),
   customer pays, gateway POSTs a signed WEBHOOK → NGINX → app verifies
   signature, fast-acks, and a worker idempotently captures payment and
   flips the order to CONFIRMED before delivery assignment.)

[10] Ongoing — as staff pack and dispatch, Admin Panel updates order
      state (PACKED → OUT_FOR_DELIVERY → DELIVERED); each transition
      re-enters Layer 3, persists to Postgres, and re-triggers
      notification jobs so the customer is kept informed in real time.
      Weight-tolerance: if packed weight differs within tolerance, the
      final total adjusts and the customer is notified before delivery.
```

**What this trace proves about the architecture:**

- **Checkout stays fast** because only the *critical, correctness-bearing* work (stock, slot, order, payment record) runs synchronously in one ACID transaction; everything slow or external (PDF, notifications, assignment) is deferred to workers.
- **No overselling** because the weight-stock decrement and slot reservation are locked inside a single Postgres transaction — Redis only pre-screens.
- **Financial correctness** because COD is native and prepaid webhooks are signature-verified and idempotent.
- **API-first** because the exact same `/api/orders` flow will serve the future mobile and delivery apps with zero backend changes.

---

## 3.14 Chapter Summary

The layered architecture maps one-to-one onto the perishable, hyperlocal reality of the business: a React client for a reactive weight/slot buying flow; NGINX as a hardened, load-balancing edge; a stateless Express/TypeScript application tier where all business rules live in a clean controller→service→repository shape; Redis for instant reads and coordination; PostgreSQL+Prisma as the ACID system of record that guarantees stock and money correctness; BullMQ workers for all slow/external work; S3/Cloudinary for media; and idempotent, multi-channel notification and payment integrations — all running as native processes under PM2 on a single Ubuntu VPS and deployed through an SSH-based GitHub Actions CI/CD pipeline. Every layer scales independently, and the single backend is ready to power the Phase 2/3 mobile and delivery apps without a rewrite.
