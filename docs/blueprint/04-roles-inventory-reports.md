# 04 — Roles (RBAC), Inventory & Reports

> **Master Blueprint — Ojiva AI Technologies · Enterprise E-Commerce Web Application**
> Fresh non-veg (meat) cold-chain delivery platform · Single-store · Hyderabad region
> Reference analysed: elitenonveg.com · Currency: INR (₹) · Phase 1 = Web (Customer + Admin + APIs)
>
> This document covers three chapters of the blueprint:
> - **Chapter 6 — User Roles (complete RBAC)**
> - **Chapter 9 — Inventory (perishable, weight-based)**
> - **Chapter 10 — Reports**
>
> Consistent with `00-PROJECT-BRIEF.md`. Design only — no code. Tables + ASCII diagrams.
> Canonical modules referenced: Authentication, Dashboard, Products, Categories, Brands, Attributes, Variants, Inventory, Warehouse, Customers, Addresses, Cart, Wishlist, Coupons, Checkout, Orders, Payments, Delivery, Reports, Reviews, CMS, Settings, Roles, Permissions, Logs, Audit Logs, Notification Center.

---

# CHAPTER 6 — USER ROLES (Complete RBAC)

## 6.0 RBAC Design Philosophy

The platform uses a **Role-Based Access Control (RBAC)** model implemented through two canonical modules — **Roles** and **Permissions** — with an optional per-user override layer. This is deliberately *not* hard-coded per role; roles are data, permissions are data, and the binding between them is data. This lets the Super Admin create new roles (e.g., "Night Shift Packer") without a code deployment.

**Core concepts**

| Concept | Definition | Example |
|---|---|---|
| **Permission** | An atomic, verb-on-resource capability | `orders.refund.issue`, `products.create`, `inventory.adjust` |
| **Permission Group** | Logical bundle of permissions per module | "Orders", "Inventory", "Delivery" |
| **Role** | Named collection of permissions | Store Manager, Delivery Manager |
| **Role Assignment** | User ↔ Role link (a user may hold one or more roles) | user #42 → Inventory Manager |
| **User Override** | Explicit grant/deny on a single user, layered above the role | Deny `users.delete` for a specific Admin |
| **Scope** | Data boundary a permission applies within | Warehouse-scoped, Zone-scoped, Own-records-scoped |

**Permission naming convention:** `<module>.<sub-resource>.<action>` — e.g. `delivery.assignment.create`, `reports.tax.view`, `settings.payment.edit`. Every screen, API route, and action button is gated by exactly one permission string. Two special principals exist:

- **Super Admin** holds an implicit wildcard (`*.*.*`) and bypasses the matrix — it can never be locked out.
- **Customer** is a storefront principal, entirely separate from the admin permission space; customers authenticate against the storefront and can only touch their **own** records (self-scope).

**Resolution order (most specific wins):**

```
  Effective permission for (user, permission_string)
  =
    1. Super Admin?  → ALLOW (short-circuit, always)
    2. User Override DENY present?  → DENY
    3. User Override ALLOW present? → ALLOW
    4. Any assigned Role grants it? → ALLOW
    5. Otherwise                    → DENY  (deny-by-default)
```

**Enforcement is dual-layered** — never trust the UI alone:

```
  [ React Admin UI ]  ── hides/disables controls the role lacks (UX only)
          │
          ▼   every request carries JWT (role + permission claims / role id)
  [ Express middleware: requirePermission('orders.refund.issue') ]
          │            └─ 403 if effective permission = DENY
          ▼
  [ Controller → Service ]  ── re-checks data scope (warehouse/zone/own)
          │
          ▼
  [ Audit Logs ]  ── every allow/deny on sensitive actions is recorded
```

Scope is enforced in the service layer (row-level). Example: a Delivery Manager has `delivery.assignment.create`, but only for orders whose delivery **zone** is within their assigned zones — the middleware confirms the *capability*, the service confirms the *data boundary*.

---

## 6.1 Super Admin

> The platform owner / founder-level principal. One or a very small number of accounts. Root of trust.

**Permissions**
- Full unrestricted access to **every** module and action (implicit wildcard).
- Create, edit, delete **Roles** and edit the **Permissions** catalogue; assign roles to any user.
- Manage all **Settings**: payment gateway keys (Razorpay/PhonePe/Cashfree), COD toggle, tax/GST config, delivery zones & pincodes, slot cut-off times, weight-tolerance policy, free-shipping threshold (₹699), SMTP/SMS/WhatsApp credentials.
- Manage **Warehouses**, financial approvals, and view all **Audit Logs** including other admins' actions.
- Impersonate lower roles for support/debugging (impersonation is itself audit-logged).

**Allowed Pages** — every admin page: Dashboard, Products/Categories/Brands/Attributes/Variants, Inventory & Warehouse, Orders, Payments, Delivery, Customers, Coupons, Reviews, CMS, all Reports, Roles & Permissions, Users/Staff, Settings, Logs, Audit Logs, Notification Center.

**Restrictions**
- None functionally. **Governance guardrails only:** should not be used for day-to-day operations (principle of least privilege — use Admin/Manager roles instead). Cannot enter card/bank credentials into third-party fields on a customer's behalf (business-policy, not RBAC). Deletion of the last Super Admin account is blocked to prevent lockout.

**Workflow (day-to-day)**

```
  Login → Dashboard (business health KPIs)
    → Periodic review of Audit Logs (who changed prices, refunds, settings)
    → Approve exceptional refunds / large wastage write-offs
    → Manage staff onboarding: create user → assign role → set zone/warehouse scope
    → Adjust platform Settings (new zone launch, gateway rotation, tax changes)
    → Review high-level Reports (Revenue, Profitability, Wastage trends)
```

---

## 6.2 Admin

> Senior operations administrator. Runs the business day-to-day with near-full reach but without root-level control over roles/security and destructive settings.

**Permissions**
- Full CRUD on **Products, Categories, Brands, Attributes, Variants** (including price and weight-variant setup).
- Manage **Orders** end-to-end: view, edit, cancel, trigger refunds (within a configurable ceiling; above it routes to Super Admin approval).
- Manage **Coupons**, **CMS** (banners, pages, blog), **Reviews** (approve/reject), **Customers**.
- View **all Reports**; configure **Notification Center** templates.
- Manage **Inventory** and **Delivery** at supervisory level (can override manager decisions).
- Create staff users and assign the **operational** roles (Store/Inventory/Delivery Manager, Support) — but not create/edit Super Admin.

**Allowed Pages** — all pages **except** Super-Admin-only security surfaces (create/delete Roles themselves, edit raw Permissions catalogue, rotate payment-gateway secret keys, delete other admins). Can *view* Roles & Audit Logs; edits to the Roles catalogue are restricted.

**Restrictions**
- Cannot create/delete **Super Admin** accounts or grant the Super Admin role.
- Cannot edit sensitive **Settings**: payment secret keys, GST registration number, server/infra config.
- Refunds above the configured ceiling require Super Admin approval.
- Cannot permanently purge audit logs or customer PII (compliance).

**Workflow**

```
  Login → Dashboard → Orders queue (new/processing/exceptions)
    → Handle escalations from Support & Managers
    → Product & pricing updates, coupon campaigns, homepage banners (CMS)
    → Approve/monitor refunds within ceiling
    → Review daily Sales, Orders, Delivery, Wastage reports
    → Staff management for operational roles
```

---

## 6.3 Store Manager

> Owns the storefront catalogue, merchandising, pricing and order fulfilment for the store. Operational, not security.

**Permissions**
- CRUD on **Products, Categories, Variants, Attributes**; set prices, weight packs (250g/500g/1kg), offers ("Flat up to 20% off"), publish/unpublish.
- Manage **Orders**: view all, update status (Confirmed → Packing → Ready → Out-for-Delivery), edit items before packing, cancel with reason.
- View **Inventory** levels (read) and raise low-stock/reorder flags to Inventory Manager.
- Manage **Reviews** (approve/reject), **Coupons** (create within policy), **CMS** merchandising blocks.
- Consume **Sales, Orders, Products-Performance, Inventory** reports.

**Allowed Pages** — Dashboard, Products, Categories, Brands, Attributes, Variants, Orders, Coupons, Reviews, CMS (merchandising), Inventory (read/flag), Customers (read), relevant Reports.

**Restrictions**
- Cannot issue **refunds** beyond initiating a request (routes to Admin) — no direct financial disbursement authority by default (partial).
- Cannot manage **Users/Roles/Permissions** or **Settings**.
- Cannot perform stock **adjustments/wastage** postings (that is Inventory Manager) — can only *flag*.
- Cannot assign **delivery** partners (Delivery Manager's domain).

**Workflow**

```
  Login → Dashboard (today's orders, stockouts, top sellers)
    → Morning: verify catalogue live, prices/offers correct, sold-out items hidden
    → Through day: progress orders Confirmed→Packing→Ready; edit/cancel exceptions
    → Flag low-stock SKUs to Inventory Manager
    → Approve customer Reviews; refresh homepage merchandising
    → EOD: review Products-Performance & Sales reports
```

---

## 6.4 Inventory Manager

> Owns physical stock accuracy for a perishable, weight-based business — the most operationally sensitive non-financial role.

**Permissions**
- Full **Inventory** module: manage **Warehouse(s)**, **Stock** (kg/g), **Purchases** (goods receipt from suppliers), **Suppliers**, **Stock Movements** (IN / OUT / ADJUST / WASTAGE), **Low-Stock alerts**, **Reorder points**, **Inventory Logs & Reports**.
- Post **wastage/spoilage** write-offs and **weight-variance** adjustments; confirm **return-to-store restock** from failed/rejected deliveries.
- Read **Products/Variants** (to map stock to SKUs) and **Orders** (to reconcile decrements).

**Allowed Pages** — Dashboard (inventory widgets), Warehouse, Stock, Purchases, Suppliers, Stock Movements, Low-Stock Alerts, Inventory Logs, Inventory Reports; read access to Products/Variants and Orders.

**Restrictions**
- Cannot change **product prices**, **customer-facing catalogue** content, or publish products.
- Cannot issue **refunds**, manage **Users/Roles**, or edit platform **Settings** (except inventory thresholds/reorder config if delegated).
- Cannot assign **delivery** or access financial reports beyond inventory valuation.
- Stock actions are **warehouse-scoped** to assigned warehouse(s).

**Workflow**

```
  Login → Inventory Dashboard (low-stock, near-expiry, today's wastage)
    → Morning goods-receipt: record supplier Purchase → stock IN by weight (kg)
    → Set/adjust reorder points; raise POs for items below reorder level
    → Through day: monitor auto-decrements vs physical; post ADJUST for variance
    → Record WASTAGE for spoiled/expired/trim loss with reason codes
    → Confirm return-to-store restock from delivery failures
    → EOD: reconcile Stock Movement ledger; export Inventory Report
```

---

## 6.5 Delivery Manager

> Owns hyperlocal own-fleet dispatch: slots, zones, delivery-partner assignment, and delivery exceptions.

**Permissions**
- Manage **Delivery** module: view all ready orders, **assign/reassign Delivery Partners**, manage **delivery slots** and **cut-off times**, manage **zones/pincode** serviceability (operational toggles).
- Update delivery status (Out-for-Delivery → Delivered / Failed / Returned); capture **COD collection** confirmation and proof-of-delivery.
- Trigger **return-to-store** flow (which prompts Inventory restock).
- Read **Orders**, **Customers** (delivery contact/address), and **Delivery reports**.

**Allowed Pages** — Dashboard (delivery widgets), Delivery board, Slot/Zone management, Delivery Partners roster, Orders (read + delivery-status update), Delivery Reports, Notification Center (dispatch messages).

**Restrictions**
- Cannot edit **product catalogue, prices, or inventory postings** (can only trigger return-to-store, which Inventory confirms).
- Cannot issue **refunds** (routes to Admin/Support) or manage **Users/Roles/Settings** (except delivery slot/zone operational params if delegated).
- Actions are **zone-scoped** to assigned zones/pincodes.

**Workflow**

```
  Login → Delivery board (orders "Ready", grouped by zone & slot)
    → Assign Delivery Partners per zone respecting slot cut-off times
    → Track live: Out-for-Delivery → Delivered / Failed
    → Handle exceptions: reattempt, reschedule slot, or Return-to-Store
    → Confirm COD collections reconcile with assigned partners
    → EOD: on-time %, failed-delivery, COD-collected reports
```

---

## 6.6 Customer Support

> Front-line customer care: order assistance, refunds within limits, complaints, and account help. No catalogue or infrastructure control.

**Permissions**
- Read **Customers**, **Orders**, **Payments** (status), **Delivery** status; add internal notes and communicate via **Notification Center** (email/SMS/WhatsApp templates).
- Initiate **cancellations** and **refunds up to a small configurable cap** (partial — above cap escalates to Admin).
- Manage **Reviews** moderation (flag/hide abusive), apply goodwill **coupons** within policy.
- Update limited customer profile fields (contact, address correction) on request.

**Allowed Pages** — Dashboard (support KPIs), Customers, Orders (read + limited actions), Payments (read), Delivery (read), Reviews, Notification Center, Refund page (capped).

**Restrictions**
- Cannot edit **Products, Inventory, Delivery assignments, Roles, Settings**.
- Refunds strictly **capped**; large/whole-order refunds escalate (partial).
- Cannot delete customers or access financial/tax reports.
- No stock, pricing, or dispatch authority.

**Workflow**

```
  Login → Support queue / open tickets & WhatsApp threads
    → Look up order → explain status / ETA / slot
    → Process small refunds & cancellations within cap; escalate the rest to Admin
    → Correct address/contact; issue goodwill coupon per policy
    → Moderate flagged reviews
    → Log every interaction as a note (audit trail)
```

---

## 6.7 Delivery Partner ("Delivery Boy")

> Field fulfilment staff. **Phase 1 = web only**, so they operate through a mobile-responsive delivery view / assigned-orders web screen; the native Delivery app arrives later reusing the same APIs (API-first).

**Permissions**
- View **only their own assigned deliveries** (self + assignment scope): customer name, address, phone, slot, items, order total, COD amount to collect.
- Update delivery status for assigned orders: Picked-up → Out-for-Delivery → Delivered / Failed; capture **proof-of-delivery** (OTP/signature/photo) and **COD collected** amount.
- View their own delivery history and earnings/COD-collected summary.

**Allowed Pages** — Delivery Partner view only: My Assigned Orders, Order Detail (delivery scope), Status Update, COD Confirmation, My History. **No access to the main admin panel.**

**Restrictions**
- Cannot see **other partners' orders**, full customer database, catalogue, inventory, pricing, refunds, reports, or settings.
- Cannot reassign orders to themselves or others (Delivery Manager assigns).
- Cannot issue refunds or edit order contents.
- Read/write strictly limited to **assigned** orders (row-level self-scope).

**Workflow**

```
  Login (delivery view) → My Assigned Orders for the slot
    → Pickup at store → mark Picked-up
    → Navigate (Google Maps) → mark Out-for-Delivery
    → At doorstep: verify OTP / capture POD → collect COD → mark Delivered
    → If unreachable/rejected → mark Failed (reason) → triggers Return-to-Store
    → EOD: reconcile COD collected vs assigned
```

---

## 6.8 Customer (Storefront principal)

> The end buyer on the React customer website. Entirely outside the admin permission catalogue — self-scoped storefront identity.

**Permissions**
- Register/login (JWT), manage **own profile, addresses, membership plan, wishlist, product compare**.
- Browse catalogue, check **pincode/zone serviceability**, add to **Cart**, apply **Coupons**, book a **delivery slot**, choose payment (Razorpay/PhonePe/Cashfree/**COD**), place **Orders**.
- Track own orders & delivery; request cancellation/refund/return; write **Reviews** on purchased products; raise support requests.

**Allowed Pages** — Storefront: Home, Category/Product listing & detail, Cart, Checkout (serviceability + slot + payment), Account (Profile, Addresses, Orders, Wishlist, Compare, Membership), Order Tracking, Support/Contact, CMS pages.

**Restrictions**
- **Zero admin access.** Can only view/modify **own** data (self-scope).
- Cannot see stock quantities, other customers, internal notes, or backend modules.
- Refund/cancellation are **requests** subject to policy & staff approval, not direct actions.

**Workflow**

```
  Browse → enter pincode (serviceable?) → add products (250g/500g/1kg) to cart
    → apply coupon → free shipping if ≥ ₹699 → pick delivery slot (respect cut-off)
    → pay (online / COD) → place order
    → track status → receive cold-chain delivery → review product / raise support
```

---

## 6.9 Consolidated RBAC Permission Matrix

**Legend:** ✔ = full permission · ✖ = no permission · ◐ = partial / conditional (capped, scoped, request-only, or approval-routed). Customer is a storefront principal — admin actions are ✖ by definition; the final column reflects self-scope on storefront actions only.

| Action (permission) | Super Admin | Admin | Store Mgr | Inventory Mgr | Delivery Mgr | Support | Delivery Partner | Customer |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| **Manage products / categories** (`products.*`) | ✔ | ✔ | ✔ | ✖(read) | ✖ | ✖ | ✖ | ✖ |
| **Set prices & offers** (`products.price.edit`) | ✔ | ✔ | ✔ | ✖ | ✖ | ✖ | ✖ | ✖ |
| **Manage variants/attributes** (`variants.*`) | ✔ | ✔ | ✔ | ✖(read) | ✖ | ✖ | ✖ | ✖ |
| **View orders** (`orders.view`) | ✔ | ✔ | ✔ | ◐(read-reconcile) | ✔(zone) | ✔ | ◐(own only) | ◐(own only) |
| **Edit / cancel order** (`orders.edit`) | ✔ | ✔ | ✔(pre-pack) | ✖ | ✖ | ◐(cap) | ✖ | ◐(request) |
| **Assign delivery partner** (`delivery.assignment.create`) | ✔ | ✔ | ✖ | ✖ | ✔(zone) | ✖ | ✖ | ✖ |
| **Update delivery status** (`delivery.status.update`) | ✔ | ✔ | ◐ | ✖ | ✔(zone) | ✖ | ◐(own) | ✖ |
| **Issue refund** (`orders.refund.issue`) | ✔ | ◐(ceiling) | ◐(initiate) | ✖ | ✖ | ◐(small cap) | ✖ | ◐(request) |
| **Manage inventory / stock** (`inventory.*`) | ✔ | ✔ | ✖(read/flag) | ✔(warehouse) | ✖ | ✖ | ✖ | ✖ |
| **Post wastage / adjustment** (`inventory.adjust`,`inventory.wastage`) | ✔ | ✔ | ✖ | ✔(warehouse) | ◐(trigger RTS) | ✖ | ✖ | ✖ |
| **Manage suppliers / purchases** (`inventory.purchase.*`) | ✔ | ✔ | ✖ | ✔ | ✖ | ✖ | ✖ | ✖ |
| **Manage coupons** (`coupons.*`) | ✔ | ✔ | ✔(policy) | ✖ | ✖ | ◐(goodwill) | ✖ | ✖(apply only) |
| **Moderate reviews** (`reviews.moderate`) | ✔ | ✔ | ✔ | ✖ | ✖ | ✔ | ✖ | ◐(write own) |
| **Manage CMS / banners** (`cms.*`) | ✔ | ✔ | ✔(merch) | ✖ | ✖ | ✖ | ✖ | ✖ |
| **Manage users / staff** (`users.*`) | ✔ | ◐(operational only) | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ |
| **Manage roles & permissions** (`roles.*`,`permissions.*`) | ✔ | ✖(view) | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ |
| **Edit platform settings** (`settings.*`) | ✔ | ◐(non-sensitive) | ✖ | ◐(inv. thresholds) | ◐(slots/zones) | ✖ | ✖ | ✖ |
| **Edit payment / GST secrets** (`settings.payment.edit`) | ✔ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ |
| **View financial / tax reports** (`reports.tax.view`,`reports.revenue.view`) | ✔ | ✔ | ◐(sales only) | ◐(inv. valuation) | ◐(delivery only) | ✖ | ✖ | ✖ |
| **View operational reports** (`reports.*.view`) | ✔ | ✔ | ✔(sales/products) | ✔(inventory) | ✔(delivery) | ◐(support) | ✖ | ✖ |
| **View audit logs** (`audit.view`) | ✔ | ◐(view) | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ |
| **Impersonate / manage warehouses** | ✔ | ◐ | ✖ | ◐(warehouse) | ✖ | ✖ | ✖ | ✖ |

---

## 6.10 How Permissions Map to the Roles / Permissions Modules

The matrix above is not code — it is **seed data** for the Roles and Permissions modules.

**Data model (conceptual):**

```
  PERMISSION (catalogue)          ROLE                         USER
  ┌───────────────────┐           ┌────────────────┐           ┌──────────────┐
  │ id                │           │ id             │           │ id           │
  │ key ("orders.     │◄──┐       │ name           │◄──┐       │ name / email │
  │      refund.issue")│   │       │ description    │   │       │ warehouse_id │
  │ module ("Orders") │   │       │ is_system      │   │       │ zone_ids[]   │
  │ description       │   │       └────────────────┘   │       └──────┬───────┘
  └───────────────────┘   │                            │              │
            ▲             │   ROLE_PERMISSION           │  USER_ROLE   │
            │             └───┤ role_id  (FK)           └──┤ user_id   │
            │                 │ permission_id (FK)         │ role_id   │
            │                 │ effect (allow)             └───────────┘
            │                 │ scope (all|warehouse|zone|own)
            │                 └──────────────
            │        USER_PERMISSION_OVERRIDE (optional top layer)
            └────────┤ user_id · permission_id · effect(allow/deny) · scope
```

- **Permissions** module = the master catalogue of every `key` (auto-derived from the module list; each module contributes its verbs). Read-heavy; only Super Admin edits it. This is what makes each API route and UI control gate-able.
- **Roles** module = named rows + their `RolePermission` bindings (the ✔/◐ cells). `is_system` flags the eight canonical roles so they cannot be accidentally deleted; Super Admin can still clone them into custom roles.
- **Scope** column on the binding encodes the ◐ conditions that a matrix cell alone cannot: `warehouse` (Inventory Mgr), `zone` (Delivery Mgr), `own` (Delivery Partner, Customer), plus numeric conditions like refund `ceiling`/`cap` stored as role-level policy config in **Settings**.
- **User Overrides** let Super Admin/Admin tune an individual without inventing a whole new role (e.g., temporarily deny `orders.refund.issue` to a Support agent under review).
- **Audit Logs** records every change to Roles, RolePermissions, and Overrides, plus every *denied* attempt on sensitive permissions — closing the governance loop.

**Cross-module dependency:** the JWT issued by **Authentication** carries the user's role id(s) and scope claims; **every** other module's middleware calls the shared `requirePermission(key)` guard, so RBAC is a horizontal dependency of Orders, Inventory, Delivery, Payments, Reports, CMS, Settings, and the Notification Center alike.

---

# CHAPTER 9 — INVENTORY

## 9.0 Why Inventory Is Special Here

This is a **perishable, weight-based, cold-chain** business. Three facts drive the entire design:

1. **Stock is a continuous quantity in grams/kilograms**, not discrete units. A "pack" (250g/500g/1kg) is a *variant view* onto a bulk weight pool. Selling one 500g Chicken Curry Cut pack decrements the Chicken Curry Cut stock pool by ~500g — not "1".
2. **Weight variance is real.** Meat cannot be cut to the exact gram. A "500g" pack may physically weigh 480–520g. The system must tolerate variance, adjust order totals within a policy band, and reconcile the stock ledger against what was actually packed.
3. **Spoilage is inevitable.** Fresh meat has a short shelf life; trim loss, unsold near-expiry stock, and cold-chain failures create **wastage** that must be tracked, costed, and reported — it directly hits margin.

## 9.1 Inventory Sub-Modules Overview

| Sub-module | Purpose | Key data |
|---|---|---|
| **Warehouse** | Physical stock locations (Phase 1: one central Hyderabad cold-store; model supports more) | code, name, address, zone coverage, temperature class |
| **Stock** | Current on-hand weight per Product-Variant per Warehouse | on_hand_g, reserved_g, available_g, avg_cost/kg, batch, expiry |
| **Purchase (Goods Receipt)** | Inbound stock received from suppliers | PO ref, supplier, item, received_weight_g, cost, batch, expiry |
| **Supplier** | Vendor master for procurement | name, GSTIN, contact, items supplied, lead time, rating |
| **Low-Stock Alerts** | Threshold monitoring & reorder triggering | reorder_point_g, safety_stock_g, current available_g |
| **Stock Movement** | The append-only ledger of every weight change | type (IN/OUT/ADJUST/WASTAGE), qty_g, reason, ref, actor |
| **Inventory Logs** | Immutable audit of who changed what & when | actor, action, before/after, timestamp, source module |
| **Inventory Reports** | Valuation, movement, wastage, near-expiry, reorder | see Chapter 10 |

## 9.2 Warehouse

Phase 1 launches with **one central cold-store** in the Hyderabad region, but the schema is multi-warehouse from day one (delivery zones map to a serving warehouse) so expansion needs no migration.

| Field | Description |
|---|---|
| Warehouse code / name | e.g., `HYD-CENTRAL` |
| Address & geo | For dispatch routing (Google Maps) |
| Temperature class | Chilled (0–4°C) / Frozen (−18°C) — perishability policy differs |
| Zone coverage | Pincodes/zones this warehouse fulfils |
| Operating & cut-off times | Feeds slot cut-off logic |
| Status | Active / Maintenance |

**Dependency:** Warehouse ↔ **Delivery** (zone→warehouse map decides which stock pool a customer's order draws from and whether the pincode is serviceable).

## 9.3 Stock (in kg / grams)

Stock is held **per Product-Variant per Warehouse** as a weight balance with three buckets:

| Quantity | Meaning |
|---|---|
| **On-hand (g)** | Physically present in the cold-store |
| **Reserved (g)** | Committed to placed-but-not-yet-packed orders (soft allocation at checkout) |
| **Available (g)** | `on_hand − reserved` — what the storefront may still sell |

Additional per-batch attributes for perishables: **batch/lot no., received date, expiry/best-before date, average cost per kg** (for valuation & wastage costing), **temperature class**. Stock is consumed **FEFO (First-Expiry-First-Out)** — the batch nearest expiry is decremented first to minimise spoilage.

**Dependency:** Stock ↔ **Products/Variants** — a variant (e.g., "Chicken Curry Cut — 500g") maps to a base stock pool and a *nominal weight* (500g). The storefront shows "In stock" when `available_g ≥ nominal_weight × safety_factor`.

## 9.4 Purchase (Goods Receipt from Suppliers)

Procurement inbound flow. A **Purchase Order (PO)** is raised (often auto-suggested by reorder logic), the supplier delivers, and goods are **received by weight** — creating a **Stock IN** movement.

| Purchase field | Notes |
|---|---|
| PO number / date | Links to supplier & expected items |
| Supplier | FK to Supplier master |
| Line items | Product-Variant / base product, **ordered_weight_g** |
| **Received weight (g)** | Actual weighed-in quantity (may differ from ordered) |
| Batch / lot & expiry | Critical for FEFO & near-expiry reporting |
| Unit cost (₹/kg) | Drives valuation & wastage cost |
| GST on purchase | Feeds input-tax records (Tax report) |
| Status | Draft → Ordered → Partially/Fully Received → Closed |

Receiving posts an **IN** movement for the *received* weight and updates the batch's cost — supporting weighted-average valuation.

**Dependency:** Purchase ↔ **Supplier**, **Stock/Movements**, **Tax** (input GST), **Warehouse**.

## 9.5 Supplier Management

Vendor master enabling procurement and quality tracking.

| Field | Purpose |
|---|---|
| Name, GSTIN, PAN | Compliance & tax |
| Contact & address | Ordering / pickup |
| Items supplied | Which products/categories (poultry, mutton, seafood, eggs) |
| Lead time (days) | Feeds reorder timing |
| MOQ & price list | Purchase planning |
| Quality rating / rejection rate | Sourcing decisions; high rejection ⇒ more wastage |
| Payment terms | Finance |
| Status | Active / Blacklisted |

## 9.6 Low-Stock Alerts & Reorder Points

Because meat sells fast and spoils fast, thresholds are tuned per SKU.

| Parameter | Definition |
|---|---|
| **Safety stock (g)** | Buffer against demand spikes / supply delay |
| **Reorder point (g)** | `available_g` level that triggers a reorder alert = (avg daily sales × supplier lead time) + safety stock |
| **Reorder quantity (g)** | Suggested purchase weight (balancing freshness vs. stockout — over-ordering perishables = wastage) |
| **Max shelf-stock (g)** | Ceiling to prevent over-stocking spoilables |

**Alert triggers** (surfaced on Inventory Dashboard + Notification Center to Inventory Manager):
- `available_g ≤ reorder_point_g` → **Low-Stock / Reorder** alert.
- `available_g = 0` → **Out-of-Stock** (variant auto-hidden or marked sold-out on storefront).
- Batch `expiry ≤ today + N days` → **Near-Expiry** alert (prompt markdown/clearance or wastage).

**Dependency:** Low-Stock ↔ **Purchase** (raises PO), **Notification Center** (alerts), **Products** (storefront availability).

## 9.7 Stock Movement (IN / OUT / ADJUST / WASTAGE)

The **single source of truth** is an append-only movement ledger. Stock balances are always derivable by summing movements — nothing edits a balance directly.

| Movement type | Trigger | Effect on on-hand | Typical reason codes |
|---|---|---|---|
| **IN** | Goods receipt / purchase; **return-to-store restock** | + weight | `PURCHASE`, `RETURN_RESTOCK`, `OPENING_BALANCE`, `TRANSFER_IN` |
| **OUT** | Order packed & dispatched; internal transfer | − weight | `ORDER_FULFILMENT`, `SAMPLE`, `TRANSFER_OUT` |
| **ADJUST** | Physical count vs system mismatch; **weight-variance** at packing | ± weight | `CYCLE_COUNT`, `PACK_VARIANCE`, `CORRECTION` |
| **WASTAGE** | Spoilage, expiry, trim loss, cold-chain failure | − weight | `SPOILAGE`, `EXPIRY`, `TRIM_LOSS`, `DAMAGE`, `QC_REJECT` |

Every movement records: variant, warehouse, batch, qty_g, type, reason, **reference** (PO/Order/Adjustment id), **actor** (user), timestamp. This ledger feeds Inventory Logs and all inventory reports.

## 9.8 How Stock Decrements by Weight on an Order (with cut-off, reservation, variance)

This is the heart of the perishable model. Two-phase: **soft reserve at order** → **hard decrement at pack**.

```
  ┌──────────────────────────────────────────────────────────────────────┐
  │ STOCK-MOVEMENT & ORDER-WEIGHT FLOW                                     │
  └──────────────────────────────────────────────────────────────────────┘

  CUSTOMER PLACES ORDER (variant "Curry Cut 500g", slot = today 6–8pm)
        │
        ▼
  [Serviceability + Cut-off check]
     pincode serviceable?  slot before cut-off time?  ── no ──► block / next slot
        │ yes
        ▼
  [SOFT RESERVE]  reserved_g += nominal_weight (500g)      (Stock: available_g ↓)
     available_g < 0 ?  ── yes ──►  out-of-stock, offer alternate slot/variant
        │ no
        ▼
  ORDER CONFIRMED  (payment authorised OR COD accepted)
        │
        ▼
  ── SLOT CUT-OFF PASSES ──►  order locked for picking (no more edits)
        │
        ▼
  [PICK & PACK — physical weighing, FEFO batch]
     actual packed weight measured, e.g. 515g  (nominal 500g)
        │
        ▼
  [WEIGHT-TOLERANCE CHECK]  |actual − nominal| within ± tolerance band?
        │                                   │
     within band                       outside band
        │                                   │
        ▼                                   ▼
  price adjusts pro-rata           exception: re-pack to band,
  within allowed band              OR notify customer/Support,
  (order total may change          OR partial refund/charge per policy
   slightly per policy)                     │
        └───────────────┬───────────────────┘
                        ▼
  [HARD DECREMENT]  post OUT movement for ACTUAL packed weight (e.g. 515g)
     on_hand_g -= 515 ; reserved_g -= 500 ; available recomputed
     ADJUST movement posts the +15g variance vs the 500g reservation
        │
        ▼
  ORDER → READY → OUT-FOR-DELIVERY  (Delivery module)
        │
        ├── DELIVERED ────────────────► stock settled; movement ledger final
        │
        └── FAILED / REJECTED / RETURNED
                 │
                 ▼
        [RETURN-TO-STORE]  Delivery Mgr triggers, Inventory Mgr confirms
                 │
          product still saleable? (cold-chain intact, within shelf life?)
                 │                        │
               yes                       no
                 │                        │
                 ▼                        ▼
        IN movement (RETURN_RESTOCK)   WASTAGE movement (QC_REJECT/SPOILAGE)
        on_hand_g += weight            on_hand_g -= weight (write-off, costed)
```

### 9.8.1 Cut-off Times

Each **delivery slot** has a **cut-off time**. Orders for a slot must be placed before cut-off so the store can pick/pack in the cold-chain window.

| Slot (example) | Cut-off | Behaviour after cut-off |
|---|---|---|
| Today 6–8 AM | Previous day 10 PM | Slot hidden; earliest becomes next open slot |
| Today 6–8 PM | Today 2 PM | Reservations for this slot rejected; roll to next |

Cut-off also governs when reservations convert to the pick list and when edits lock. **Dependency:** cut-off config lives in **Settings/Delivery**, consumed at **Checkout** and by Inventory pick-list generation.

### 9.8.2 Weight Tolerance / Variance Handling

| Parameter | Example policy |
|---|---|
| **Tolerance band** | ±5% of nominal (500g → 475–525g acceptable) |
| **Within band** | Pack accepted; **order total re-priced pro-rata** to actual weight (e.g., 515g billed); customer notified of minor adjustment |
| **Outside band (over)** | Re-cut to band, or split; if billed higher, requires consent per policy |
| **Outside band (under)** | Re-pack from another batch, or partial refund for shortfall |
| **Ledger** | Difference (actual − reserved) posted as an **ADJUST** movement so stock stays exact |

This reconciles the *nominal* reservation against *actual* consumption, keeping the weight ledger trustworthy. **Dependency:** Variance ↔ **Orders** (total adjust), **Payments** (top-up/partial refund), **Notification Center** (inform customer).

### 9.8.3 Spoilage & Wastage Tracking

Wastage is a first-class, costed event — never a silent stock disappearance.

| Wastage source | Reason code | Captured cost |
|---|---|---|
| Expired / near-expiry unsold | `EXPIRY` | weight × avg cost/kg |
| Cold-chain break / power failure | `SPOILAGE` | weight × avg cost/kg |
| Cutting/cleaning trim loss | `TRIM_LOSS` | weight × avg cost/kg |
| Damaged in handling | `DAMAGE` | weight × avg cost/kg |
| Failed-delivery return, unsaleable | `QC_REJECT` | weight × avg cost/kg |

Each posts a **WASTAGE** movement with reason, batch, actor, and computed rupee loss → aggregated into the **Wastage/Spoilage report** (Chapter 10) and factored into **profitability**. High wastage on a supplier's batches also feeds **Supplier** rejection rating.

### 9.8.4 Reorder Points (recap in flow)

When a fulfilment OUT or wastage drops `available_g ≤ reorder_point_g`, a Low-Stock alert fires and (optionally) auto-drafts a PO sized to `reorder_quantity_g` for the supplier with the shortest lead time — balancing freshness against stockout.

## 9.9 Inventory Logs

Immutable audit specific to inventory, complementing the platform-wide **Audit Logs**.

| Logged | Detail |
|---|---|
| Every movement | type, qty_g, batch, before/after balance, reason, reference |
| Threshold edits | reorder point / safety stock changes, old→new, actor |
| Purchase & supplier edits | who changed cost, expiry, supplier |
| Wastage postings | actor, reason, costed loss (high-sensitivity) |

Wastage and manual ADJUST postings are the highest-risk (shrinkage/fraud) events, so they are always logged with actor + reason and surfaced to Admin/Super Admin.

## 9.10 Inventory Dependencies (Cross-Module Summary)

| Depends on / feeds | Relationship |
|---|---|
| **Products / Variants** | Variant ↔ stock pool + nominal weight; availability gates storefront |
| **Warehouse** | Stock is per warehouse; zone→warehouse map (Delivery) picks the pool |
| **Orders** | Soft reserve at order, hard OUT decrement at pack, ADJUST for variance |
| **Checkout** | Serviceability + slot cut-off + availability check before order confirm |
| **Delivery** | Return-to-store failed deliveries → IN (restock) or WASTAGE |
| **Payments** | Weight-variance re-pricing → top-up charge or partial refund |
| **Purchase / Supplier** | Inbound IN movements; reorder auto-drafts POs; wastage rates supplier quality |
| **Notification Center** | Low-stock, near-expiry, out-of-stock alerts to Inventory Manager |
| **Reports / Tax** | Valuation, movement, wastage reports; purchase input-GST |
| **Audit / Inventory Logs** | Every adjust/wastage recorded with actor & reason |

---

# CHAPTER 10 — REPORTS

## 10.0 Reporting Approach

Reports are **read-only analytical views** built over Orders, Payments, Inventory, Delivery, Customers, and Tax data. Design principles:

- **Every report is permission-gated** (see Chapter 6): financial/tax reports are Admin/Super-Admin; operational reports reach the relevant manager.
- **Common filter spine** across all reports: **date range** (today / 7d / 30d / custom), **warehouse/zone**, **category**, **channel** (website / WhatsApp), **payment method**, and **status** — so numbers reconcile across reports.
- **Chart.js** powers the Admin Dashboard visualisations (the admin panel stack is React + Bootstrap 5 + **Chart.js** + React Table). Tabular detail uses React Table with server-side pagination, sorting, and **CSV/Excel export**.
- Heavy aggregations are precomputed via **BullMQ** scheduled jobs and cached in **Redis** so dashboards stay fast; detailed drill-downs query PostgreSQL directly.
- Reports never mutate data — but exports and views on customer PII / financials are themselves **audit-logged**.

## 10.1 Chart.js Visualisations on the Admin Dashboard

The Dashboard is the landing analytics surface. Suggested Chart.js widgets, gated by role:

| Widget | Chart type | Feeds from |
|---|---|---|
| Revenue trend (daily/weekly) | Line | Orders + Payments |
| Sales by category (poultry/mutton/seafood/eggs) | Doughnut / Pie | Orders + Products |
| Orders by status funnel | Bar (stacked) | Orders |
| Payment method split (online vs COD) | Pie | Payments |
| Top 10 products by revenue/weight | Horizontal bar | Order items |
| On-time delivery % & failed deliveries | Gauge / Bar | Delivery |
| Stock valuation & low-stock count | KPI cards + bar | Inventory |
| **Wastage cost trend** | Line/area | Stock movements (WASTAGE) |
| New vs returning customers | Stacked bar | Customers + Orders |
| GST collected (output) | Bar | Tax/Payments |

Each widget is filterable by the common date/zone/category spine and drills into the corresponding full report.

## 10.2 Consolidated Report Catalogue

| # | Report | Purpose | Key Metrics / Columns | Filters | Audience (consumers) | Source Modules |
|---|---|---|---|---|---|---|
| 1 | **Sales Report** | Track sales volume & value over time | Orders count, gross sales ₹, **kg sold**, avg order value (AOV), units by pack size, discount given, net sales, sales by category/product/channel | Date range, category, channel (web/WhatsApp), zone, coupon | Super Admin, Admin, Store Manager | Orders, Products, Coupons |
| 2 | **Revenue Report** | Financial performance & margin | Gross revenue, discounts, shipping revenue, **COGS (avg cost/kg × weight)**, **wastage cost**, gross margin %, net revenue, revenue by day/category | Date range, category, warehouse, payment method | Super Admin, Admin | Orders, Payments, Inventory (COGS/wastage) |
| 3 | **Orders Report** | Operational order health | Orders by status (Placed→Confirmed→Packing→Ready→OFD→Delivered/Cancelled/Returned), fulfilment time, cancellation rate & reasons, **weight-variance adjustments**, slot distribution | Date range, status, zone, slot, channel | Admin, Store Manager, Delivery Manager | Orders, Delivery, Inventory |
| 4 | **Inventory Report** | Stock accuracy, valuation, movement | On-hand/reserved/available (g/kg) per SKU, **stock valuation ₹**, movement summary (IN/OUT/ADJUST/WASTAGE), near-expiry batches, below-reorder SKUs, stock turnover, days-of-cover | Date range, warehouse, category, batch/expiry | Inventory Manager, Admin, Super Admin | Inventory, Warehouse, Products/Variants |
| 5 | **Customers Report** | Understand & segment the customer base | New vs returning, active/dormant, lifetime value (LTV), order frequency, AOV, top customers, membership-plan mix, city/pincode spread, wishlist→purchase conversion | Date range, zone/pincode, membership, segment | Admin, Store Manager, Super Admin | Customers, Orders, Membership |
| 6 | **Delivery Report** | Fulfilment & fleet performance | Deliveries by status, **on-time %**, avg delivery time, failed-delivery rate & reasons, **return-to-store count**, deliveries & load per partner, COD collected vs due, slot adherence | Date range, zone, slot, delivery partner | Delivery Manager, Admin, Super Admin | Delivery, Orders |
| 7 | **Payments Report** | Money-in reconciliation | Collections by method (Razorpay/PhonePe/Cashfree/**COD**), success/failure rate per gateway, pending/authorised/captured, **COD outstanding & reconciliation**, settlement vs gateway payouts, chargebacks | Date range, gateway/method, status, zone | Admin, Super Admin, Finance/Support(read) | Payments, Orders |
| 8 | **Tax (GST) Report** | Statutory GST compliance | Taxable value, **output GST (CGST/SGST/IGST)** by rate slab & category, HSN-wise summary, **input GST on purchases**, net GST payable, invoice-wise register | Date range (month/quarter), category, HSN, rate | Super Admin, Admin (Finance) | Payments, Orders, Purchase, Settings(tax) |
| 9 | **Refund Report** | Track reversals & their causes | Refunds count & ₹, by reason (quality/variance/cancellation/failed-delivery), by method, avg time-to-refund, **refund rate % of sales**, refunds by agent (who approved), pending refunds | Date range, reason, method, agent, status | Admin, Super Admin, Support | Payments, Orders |
| 10 | **Products Performance Report** | Merchandising & assortment decisions | Revenue & **kg sold** per SKU, best/worst sellers, **wastage per SKU**, margin per SKU, stockout incidents & lost-sale estimate, review rating, return rate, conversion (views→add-to-cart→buy) | Date range, category, brand, warehouse | Store Manager, Admin, Super Admin | Products, Orders, Inventory, Reviews |

## 10.3 Report-to-Consumer & Role Access Map

| Report | Super Admin | Admin | Store Mgr | Inventory Mgr | Delivery Mgr | Support |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| Sales | ✔ | ✔ | ✔ | ✖ | ✖ | ✖ |
| Revenue (margin) | ✔ | ✔ | ✖ | ✖ | ✖ | ✖ |
| Orders | ✔ | ✔ | ✔ | ◐(reconcile) | ✔(zone) | ◐(read) |
| Inventory | ✔ | ✔ | ◐(read) | ✔ | ✖ | ✖ |
| Customers | ✔ | ✔ | ✔ | ✖ | ✖ | ◐(lookup) |
| Delivery | ✔ | ✔ | ✖ | ✖ | ✔(zone) | ◐(read) |
| Payments | ✔ | ✔ | ✖ | ✖ | ◐(COD zone) | ◐(read) |
| Tax (GST) | ✔ | ✔(finance) | ✖ | ✖ | ✖ | ✖ |
| Refund | ✔ | ✔ | ✖ | ✖ | ✖ | ◐(own actions) |
| Products Performance | ✔ | ✔ | ✔ | ◐(wastage) | ✖ | ✖ |

*(✔ full · ◐ partial/scoped/read-only · ✖ none — consistent with Chapter 6.)*

## 10.4 Reporting Cross-Module Dependencies

```
   Orders ─┬─► Sales, Orders, Products-Perf, Revenue
           └─► Refund, Delivery, Tax
   Payments ─► Payments, Revenue, Refund, Tax
   Inventory ─► Inventory, Revenue(COGS/wastage), Products-Perf(wastage)
   Delivery ─► Delivery, Orders(fulfilment)
   Customers ─► Customers, Sales(segments)
   Purchase ─► Tax(input GST), Inventory(valuation)
   Settings(tax/zones) ─► Tax slabs, zone/warehouse filters everywhere
```

- **Revenue & Tax** reports cannot be correct without **Inventory** (COGS, wastage) and **Purchase** (input GST) — margin and net-GST are cross-module by nature.
- **Products Performance** deliberately fuses **Orders + Inventory + Reviews** so merchandising sees demand, wastage, and satisfaction in one place.
- All financial reports share the **Settings** tax/zone configuration to guarantee the same slab and geography definitions everywhere — preventing reconciliation drift.

---

*End of Chapter 04 — Roles (RBAC), Inventory & Reports. Consistent with `00-PROJECT-BRIEF.md`.*
