# 06 — UI, DEVELOPMENT & FUTURE ROADMAP

> **Project:** Ojiva AI Technologies — Enterprise E-Commerce Web Application (single-store, fresh-meat cold-chain delivery)
> **Reference:** elitenonveg.com · **Currency:** INR (₹) · **Service area:** Hyderabad (hyperlocal, pincode/zone based)
> **Stack (fixed):** Customer Web = React + Bootstrap 5 + React Router + Axios + React Hook Form + TanStack Query · Admin = React + Bootstrap 5 + Chart.js + React Table · Backend = Node + Express + TypeScript + REST + JWT · PostgreSQL/Prisma · Redis · BullMQ · S3/Cloudinary · Native VPS: Ubuntu/NGINX/PM2 + SSH CI-CD (no Docker)
> **Scope:** Phase 1 = Web only (Customer Website + Admin Panel + Backend APIs), API-first so future mobile apps reuse the same backend.

This document covers three chapters:
- **Chapter 13 — UI Planning** (every page, modal, table, form, dashboard widget + full sitemaps)
- **Chapter 14 — Development Planning** (phases, timeline, milestones, deliverables, ASCII Gantt)
- **Chapter 15 — Future Roadmap** (Phase 2+ items, dependencies, effort)

---

# CHAPTER 13 — UI PLANNING

The UI is split into two independently deployed React applications that consume the **same REST backend**:

1. **Customer Website** — public storefront + authenticated customer account area. Optimised mobile-first (majority of Indian meat-delivery traffic is mobile), fast, conversion-focused, and hyperlocal-aware (pincode serviceability gates the entire buying flow).
2. **Admin Panel** — internal operations console for catalogue, inventory (by weight), orders, own-fleet delivery dispatch, customers, marketing, CMS, reports, and platform settings, gated by RBAC (Super Admin, Admin, Store Manager, Inventory Manager, Delivery Manager, Customer Support, Delivery Partner).

Two design principles drive every screen:
- **Perishable-goods reality first** — delivery slots (not courier shipping), pincode/zone serviceability, stock in kg/grams, per-slot cut-off times, weight tolerance at packing, and Cash-On-Delivery are treated as first-class UI concerns, not afterthoughts.
- **Weight-based commerce** — every product is sold by weight variant (250 g / 500 g / 1 kg), so the weight selector, per-unit pricing, and weight-aware cart totals appear consistently across catalogue, cart, checkout, and admin catalogue screens.

---

## 13.1 — CUSTOMER WEBSITE

### 13.1.1 Pages

| # | Page | Route (indicative) | Auth | Purpose & Key UI Elements | Primary Modules Consumed |
|---|------|--------------------|------|---------------------------|--------------------------|
| C-01 | Home / Landing | `/` | Public | Hero + offer banners ("Flat up to 20% off", "Free shipping over ₹699"), pincode-serviceability prompt on first visit, category tiles, featured/best-seller carousels, ready-to-cook strip, trust badges (no antibiotics/hormones/chemicals, cold-chain), WhatsApp CTA, delivery-slot teaser | CMS, Products, Categories, Cart |
| C-02 | Category / Product Listing | `/c/:categorySlug` | Public | Product grid with weight-variant chips, price-per-pack, "Add to Cart", filters (category, price, availability, freshwater/seawater, boneless/curry-cut), sort, pagination/infinite scroll, breadcrumb | Products, Categories, Attributes, Inventory |
| C-03 | Search Results | `/search?q=` | Public | Debounced query results, suggestions, empty-state, same card as listing | Products |
| C-04 | Product Detail (PDP) | `/p/:productSlug` | Public | Image gallery, **weight selector (250g/500g/1kg)** with dynamic price & per-100g price, stock/availability by weight, cut type, quantity stepper, add-to-cart/wishlist/compare, delivery-ETA for saved pincode, freshness & storage info, nutrition, related products, reviews | Products, Variants, Inventory, Reviews, Wishlist, Cart |
| C-05 | Product Compare | `/compare` | Public | Side-by-side attribute matrix of up to 3–4 products, remove/add, add-to-cart per column | Products, Attributes |
| C-06 | Cart | `/cart` | Public (guest cart) | Line items with weight variant + qty steppers, price recompute, coupon field, order summary (subtotal, shipping rule vs ₹699, est. total), free-shipping progress bar, "proceed to checkout", cross-sell | Cart, Coupons, Products |
| C-07 | Checkout | `/checkout` | Auth (or guest→auth) | Multi-step: (1) **Pincode + address**, (2) **delivery-slot booking** with cut-off times, (3) payment method (Razorpay/PhonePe/Cashfree/**COD**), (4) review & place order. Weight-tolerance disclaimer shown before pay | Checkout, Addresses, Delivery, Payments, Coupons, Orders |
| C-08 | Order Confirmation / Thank-You | `/order/:id/success` | Auth | Order ID, chosen slot, payment status, items, "track order", invoice download, WhatsApp updates opt-in | Orders, Payments, Notification Center |
| C-09 | Account Dashboard | `/account` | Auth | Overview: recent orders, saved addresses, wishlist count, membership status, quick links | Customers, Orders, Addresses, Wishlist |
| C-10 | Orders List | `/account/orders` | Auth | Paginated order history, status chips, reorder, filter by status/date | Orders |
| C-11 | Order Detail | `/account/orders/:id` | Auth | Full order: items, slot, delivery-partner status, payment, invoice, cancel/refund request, reorder, timeline | Orders, Payments, Delivery |
| C-12 | Order Tracking | `/account/orders/:id/track` | Auth | Live status stepper (Placed → Confirmed → Packed → Out-for-Delivery → Delivered), assigned delivery boy name/phone, map/ETA, slot window | Orders, Delivery |
| C-13 | Wishlist | `/account/wishlist` | Auth | Saved products with weight variant, move-to-cart, remove | Wishlist, Products, Cart |
| C-14 | Addresses | `/account/addresses` | Auth | Address book, add/edit/delete, set default, pincode-serviceability indicator per address | Addresses, Delivery |
| C-15 | Profile & Settings | `/account/profile` | Auth | Name, phone (OTP-verify), email, password change, notification preferences (Email/SMS/WhatsApp) | Customers, Authentication, Notification Center |
| C-16 | Membership Plans | `/membership` | Public/Auth | Plan tiers, benefits (free delivery, priority slots, discounts), subscribe/upgrade, current-plan state | Customers, Payments, Coupons |
| C-17 | Wallet / Refunds | `/account/wallet` | Auth | Wallet balance, refund credits, transaction ledger | Payments, Orders |
| C-18 | Bulk / Wholesale Enquiry (B2B) | `/bulk-orders` | Public | Enquiry form (product, quantity in kg, event date), WhatsApp CTA, callback request | CMS, Orders (lead) |
| C-19 | Login / Register | `/login`, `/register` | Public | Phone/email + password + **OTP**, social/optional, forgot-password | Authentication |
| C-20 | Forgot / Reset Password | `/forgot`, `/reset/:token` | Public | Request link/OTP, set new password | Authentication |
| C-21 | CMS — About / Freshness / Sourcing | `/about`, `/freshness` | Public | Brand story, cold-chain, hygiene positioning | CMS |
| C-22 | CMS — Contact | `/contact` | Public | Contact form, WhatsApp (+91 7989020944), store info, map | CMS |
| C-23 | CMS — FAQ | `/faq` | Public | Accordion, delivery/slot/COD/returns questions | CMS |
| C-24 | CMS — Policies | `/terms`, `/privacy`, `/refund-policy`, `/shipping-policy` | Public | Legal pages | CMS |
| C-25 | Blog / Recipes (optional) | `/blog`, `/blog/:slug` | Public | Recipe & cooking content, SEO | CMS |
| C-26 | Offers / Deals | `/offers` | Public | Active coupons & campaigns | Coupons, Products |
| C-27 | Serviceability / Coming-Soon | `/service-area` | Public | Pincode check, "we deliver here / not yet", notify-me | Delivery |
| C-28 | 404 / Error / Maintenance | `*` | Public | Friendly error states | — |

### 13.1.2 Popups / Modals (Customer)

| # | Modal | Trigger | Purpose | Key Fields / Actions |
|---|-------|---------|---------|----------------------|
| CM-01 | Pincode-Serviceability | First visit, header pincode click, PDP/checkout | Confirm hyperlocal delivery + set slot availability | Pincode input, detect-location, result (serviceable / not), notify-me |
| CM-02 | Add-to-Cart Confirmation | "Add to cart" | Confirm add + upsell | Item, weight, qty, "view cart" / "checkout" / "continue" |
| CM-03 | Quick View | Product card | PDP preview without navigation | Gallery, weight selector, add-to-cart |
| CM-04 | Login / Register | Auth-required action | Inline auth | Phone/email, password, switch tabs |
| CM-05 | OTP Verification | Register, phone change, COD verify | Verify phone via OTP | 6-digit OTP, resend timer |
| CM-06 | Address Add / Edit | Checkout, address book | Capture address + geo | Name, phone, house/street, area, pincode, landmark, map pin, tag (Home/Work) |
| CM-07 | Delivery-Slot Picker | Checkout | Pick date + time slot | Date chips, slot list with cut-off + capacity, select |
| CM-08 | Coupon / Offers | Cart, checkout | Apply/browse coupons | Code input, list of eligible coupons, apply/remove |
| CM-09 | Cancel-Order | Order detail | Request cancellation | Reason dropdown, note, confirm |
| CM-10 | Refund Request | Order detail (delivered/issue) | Raise refund/return | Item(s), reason, photo upload, refund mode |
| CM-11 | Reorder Confirm | Orders list/detail | Re-add previous items | Availability check, adjust, add-to-cart |
| CM-12 | Weight-Tolerance Notice | Checkout before pay | Explain packed-weight variance & final-billing | Acknowledge checkbox |
| CM-13 | Confirm-Delete | Remove address/wishlist item | Prevent accidental delete | Confirm / cancel |
| CM-14 | Membership Subscribe | Membership page/CTA | Confirm plan & pay | Plan summary, payment, confirm |
| CM-15 | Notification Opt-in | Post-order / profile | WhatsApp/SMS/Email preferences | Channel toggles |
| CM-16 | Session-Expiry / Re-auth | Token expiry | Re-authenticate | Password/OTP |

### 13.1.3 Forms (Customer)

| Form | Location | Validation Highlights |
|------|----------|-----------------------|
| Register | C-19 / CM-04 | Phone format (+91), unique email, password strength, OTP required |
| Login | C-19 / CM-04 | Credential + rate-limit/lockout messaging |
| Forgot/Reset Password | C-20 | Token/OTP validity, matching passwords |
| Address | CM-06 / C-14 | Mandatory pincode, serviceability check, phone, geo-pin |
| Checkout | C-07 | Address selected, slot selected + not past cut-off, payment method, coupon validity |
| Coupon Apply | C-06/C-07 | Code exists, eligibility (min-cart, membership, first-order), expiry |
| Profile Update | C-15 | Phone re-verify on change, email format |
| Bulk/Wholesale Enquiry | C-18 | Product, quantity in kg, contact, date |
| Contact | C-22 | Name, email/phone, message, spam guard |
| Review & Rating | C-04/C-11 | Verified-purchase check, rating 1–5, optional photo |
| Notify-Me (non-serviceable) | CM-01/C-27 | Pincode + phone/email |

### 13.1.4 Customer Sitemap (ASCII)

```
CUSTOMER WEBSITE (React + Bootstrap 5)
│
├── / .......................... Home / Landing
│     ├── (modal) Pincode-Serviceability
│     └── (modal) Notification Opt-in
│
├── Catalogue
│     ├── /c/:categorySlug ...... Category / Listing
│     ├── /search .............. Search Results
│     ├── /p/:productSlug ...... Product Detail (weight selector)
│     │      ├── (modal) Quick View
│     │      └── (modal) Add-to-Cart
│     ├── /compare ............. Product Compare
│     └── /offers .............. Offers / Deals
│
├── Buying Flow
│     ├── /cart ................ Cart
│     │      └── (modal) Coupon / Offers
│     ├── /checkout ........... Checkout (pincode + slot + pay + COD)
│     │      ├── (modal) Address Add / Edit
│     │      ├── (modal) Delivery-Slot Picker
│     │      └── (modal) Weight-Tolerance Notice
│     └── /order/:id/success .. Order Confirmation
│
├── Account (auth)
│     ├── /account ............ Dashboard
│     ├── /account/orders ..... Orders List
│     │      └── /:id ......... Order Detail
│     │             ├── /track  Order Tracking
│     │             ├── (modal) Cancel-Order
│     │             ├── (modal) Refund Request
│     │             └── (modal) Reorder Confirm
│     ├── /account/wishlist ... Wishlist
│     ├── /account/addresses .. Addresses
│     ├── /account/wallet ..... Wallet / Refunds
│     └── /account/profile .... Profile & Settings
│
├── Membership
│     └── /membership ......... Plans  → (modal) Membership Subscribe
│
├── B2B
│     └── /bulk-orders ........ Bulk / Wholesale Enquiry
│
├── Auth
│     ├── /login  /register ... Login / Register → (modal) OTP
│     └── /forgot  /reset/:token
│
├── CMS
│     ├── /about  /freshness .. Brand / Sourcing
│     ├── /contact ............ Contact
│     ├── /faq ................ FAQ
│     ├── /blog  /blog/:slug .. Blog / Recipes
│     ├── /service-area ....... Serviceability
│     └── /terms /privacy /refund-policy /shipping-policy
│
└── * ........................ 404 / Error / Maintenance
```

---

## 13.2 — ADMIN PANEL

The Admin Panel is an authenticated, RBAC-gated SPA. A persistent left sidebar exposes module groups; a top bar carries global search, notifications, store selector (future multi-store), and the current-user menu. Every list screen is a **React Table** (server-side pagination, sort, filter, column visibility, bulk actions, CSV export); every editor is a **React Hook Form** form; every analytical surface uses **Chart.js**.

### 13.2.1 Pages

| # | Page | Route (indicative) | Roles (primary) | Purpose & Key UI Elements |
|---|------|--------------------|------------------|---------------------------|
| A-01 | Admin Login | `/admin/login` | All admin roles | Credentials + OTP/2FA, role-aware redirect |
| A-02 | Dashboard (Overview) | `/admin` | Super Admin, Admin, Store Manager | KPI widgets, charts, alerts (low stock, unassigned orders), quick actions |
| A-03 | Products — List | `/admin/products` | Store/Inventory Mgr | Product table, status, stock-by-weight, bulk actions |
| A-04 | Product — Create/Edit | `/admin/products/new`, `/:id` | Store/Inventory Mgr | Full product form incl. weight variants, pricing, images, category, attributes, SEO |
| A-05 | Categories | `/admin/categories` | Store Mgr | Tree list, drag-order, create/edit, image, SEO |
| A-06 | Brands | `/admin/brands` | Store Mgr | Brand list + form |
| A-07 | Attributes / Variants | `/admin/attributes` | Store Mgr | Attribute sets (cut type, bone-in/out, source), variant weight matrix |
| A-08 | Inventory | `/admin/inventory` | Inventory Mgr | Stock by weight/kg per product+variant, adjust, low-stock threshold, batch/expiry |
| A-09 | Inventory Adjustment / Batch | `/admin/inventory/adjust` | Inventory Mgr | Purchase/receipt, wastage, stock-take, reason codes |
| A-10 | Warehouse / Zones | `/admin/warehouse` | Inventory/Delivery Mgr | Warehouse(s), serviceable pincodes/zones, slot capacity config |
| A-11 | Orders — List | `/admin/orders` | Store Mgr, Support | Orders table, status, payment, slot, filters, bulk print/assign |
| A-12 | Order — Detail | `/admin/orders/:id` | Store Mgr, Support | Items (ordered vs packed weight), customer, address, slot, payment, timeline, actions (confirm/pack/assign/cancel/refund), invoice |
| A-13 | Delivery Board (Dispatch) | `/admin/delivery` | Delivery Mgr | Kanban/board by slot & status, assign delivery partner, live status, route/zone grouping |
| A-14 | Delivery Partners | `/admin/delivery/partners` | Delivery Mgr | Fleet roster, availability, active load, performance |
| A-15 | Customers — List | `/admin/customers` | Support, Store Mgr | Customer table, LTV, orders, membership, block/unblock |
| A-16 | Customer — Detail | `/admin/customers/:id` | Support | Profile, addresses, orders, wallet, notes, communications |
| A-17 | Coupons / Promotions | `/admin/coupons` | Store Mgr, Marketing | Coupon table + create/edit, rules, usage |
| A-18 | Membership Plans (admin) | `/admin/membership` | Admin | Plan CRUD, pricing, benefits, subscribers |
| A-19 | Reviews Moderation | `/admin/reviews` | Support, Store Mgr | Approve/reject, reply, flag |
| A-20 | Reports & Analytics | `/admin/reports` | Admin, Store Mgr | Sales, products, customers, delivery, payments, tax; date filters; export |
| A-21 | Payments / Transactions | `/admin/payments` | Admin | Gateway transactions, COD reconciliation, refunds, settlements |
| A-22 | CMS — Pages | `/admin/cms/pages` | Admin | Static-page editor (About, FAQ, policies) |
| A-23 | CMS — Banners / Home | `/admin/cms/banners` | Marketing | Hero/offer banners, home layout, scheduling |
| A-24 | CMS — Blog | `/admin/cms/blog` | Marketing | Blog/recipe posts CRUD |
| A-25 | Notifications Center | `/admin/notifications` | Admin | Templates (Email/SMS/WhatsApp/Push), send/broadcast, logs |
| A-26 | Settings — General | `/admin/settings` | Super Admin | Store info, currency (₹), free-ship threshold (₹699), tax/GST, timezone |
| A-27 | Settings — Delivery & Slots | `/admin/settings/delivery` | Admin, Delivery Mgr | Slot definitions, cut-off times, per-zone capacity, delivery fees, weight-tolerance % |
| A-28 | Settings — Payments | `/admin/settings/payments` | Super Admin | Razorpay/PhonePe/Cashfree/COD config, keys |
| A-29 | Settings — Integrations | `/admin/settings/integrations` | Super Admin | Google Maps, SMTP, SMS gateway, WhatsApp API, S3/Cloudinary |
| A-30 | Roles & Permissions | `/admin/roles` | Super Admin | Role matrix, permission toggles per module |
| A-31 | Staff / Users | `/admin/users` | Super Admin, Admin | Admin-user CRUD, role assignment, status |
| A-32 | Audit Logs | `/admin/audit-logs` | Super Admin | Immutable actor→action→entity trail |
| A-33 | System Logs | `/admin/logs` | Super Admin | Errors, jobs (BullMQ), webhooks, health |
| A-34 | Profile / My Account (admin) | `/admin/profile` | All | Password/2FA, preferences |
| A-35 | Delivery Partner — My Runs (limited) | `/admin/my-deliveries` | Delivery Partner | Assigned orders, mark packed/picked/delivered, COD collected (interim web view until Delivery App ships) |

### 13.2.2 Popups / Modals (Admin)

| # | Modal | Trigger | Purpose | Key Fields / Actions |
|---|-------|---------|---------|----------------------|
| AM-01 | Confirm-Delete | Delete any entity | Prevent accidental removal | Entity name, confirm |
| AM-02 | Quick Stock Adjust | Inventory row | Fast +/- stock in kg/g | Qty, reason, save |
| AM-03 | Assign Delivery Partner | Order/Delivery board | Dispatch order to fleet | Partner select (availability/zone), slot, confirm |
| AM-04 | Order Status Change | Order detail | Advance/rollback status | New status, note, notify-customer toggle |
| AM-05 | Cancel Order (admin) | Order detail | Cancel + restock | Reason, restock toggle, refund toggle |
| AM-06 | Refund / Return | Order/Payments | Initiate refund | Amount/items, mode (gateway/wallet), reason |
| AM-07 | Packed-Weight Adjust | Order detail (packing) | Record actual packed weight | Per-item weight, recompute total within tolerance |
| AM-08 | Coupon Create/Edit | Coupons | Fast coupon CRUD | Code, type, value, rules, dates |
| AM-09 | Category Create/Edit | Categories | Inline category form | Name, parent, image, SEO |
| AM-10 | Image Upload / Media Picker | Product/CMS forms | S3/Cloudinary upload | Drag-drop, crop, alt |
| AM-11 | Add Staff / Assign Role | Users/Roles | Create admin user | Name, email, role, status, invite |
| AM-12 | Send Notification / Broadcast | Notifications | Compose & send | Channel, template, audience, schedule |
| AM-13 | Slot / Cut-off Editor | Delivery settings | Define slot windows | Day, window, cut-off, capacity |
| AM-14 | Serviceable-Pincode Add | Warehouse/Zones | Add/remove pincode to zone | Pincode, zone, fee |
| AM-15 | COD Reconciliation | Payments | Mark COD collected/deposited | Amount, partner, date |
| AM-16 | Bulk Action Confirm | List bulk select | Apply action to N rows | Action, count, confirm |
| AM-17 | 2FA / Re-auth | Sensitive settings | Step-up auth | OTP/password |
| AM-18 | Export Config | Any table export | Choose columns/format | CSV/XLSX, filters, range |

### 13.2.3 Tables (Admin — React Table)

| # | Table | Screen | Key Columns | Bulk / Row Actions |
|---|-------|--------|-------------|--------------------|
| T-01 | Products | A-03 | Image, name, category, weight variants, price/pack, stock (kg), status | Publish/unpublish, edit, delete, export |
| T-02 | Categories | A-05 | Name, parent, product count, order, status | Reorder, edit, delete |
| T-03 | Inventory | A-08 | Product, variant, on-hand (kg/g), threshold, expiry/batch, status | Adjust, restock, export |
| T-04 | Inventory Transactions | A-09 | Date, type (purchase/wastage/sale/adjust), qty, actor, reason | View, export |
| T-05 | Orders | A-11 | Order #, customer, items, total, payment, slot, status, date | Assign, print, status-change, export |
| T-06 | Order Items (in detail) | A-12 | Product, ordered wt, packed wt, price, subtotal | Adjust weight |
| T-07 | Delivery Assignments | A-13/A-14 | Order #, partner, zone, slot, status, COD amount | Reassign, mark stage |
| T-08 | Customers | A-15 | Name, phone, orders, LTV, membership, status | Block, view, export |
| T-09 | Coupons | A-17 | Code, type, value, min-cart, used/limit, dates, status | Edit, disable, export |
| T-10 | Transactions / Payments | A-21 | Txn ID, order, gateway, amount, status, COD flag, date | Refund, reconcile, export |
| T-11 | Reviews | A-19 | Product, customer, rating, text, status | Approve, reject, reply |
| T-12 | Staff / Users | A-31 | Name, email, role, last login, status | Edit, disable |
| T-13 | Audit Logs | A-32 | Timestamp, actor, action, entity, before/after | View, export |
| T-14 | System / Job Logs | A-33 | Time, level, source, message, job status | View, retry job |
| T-15 | Membership Subscribers | A-18 | Customer, plan, start/renewal, status | View, cancel |
| T-16 | Notification Logs | A-25 | Time, channel, template, recipient, status | Resend, view |
| T-17 | Delivery Partners | A-14 | Name, phone, zone, availability, active load, rating | Toggle availability, view |

### 13.2.4 Forms (Admin)

| Form | Screen | Notable Sections / Validation |
|------|--------|-------------------------------|
| Product | A-04 | Basic info; **weight-variant matrix (250g/500g/1kg) with price + SKU + stock**; images; category/brand/attributes; freshness/storage; SEO; status. Validates unique slug/SKU, at least one variant, price > 0 |
| Category | A-05/AM-09 | Name, parent, image, order, SEO |
| Attribute / Variant | A-07 | Attribute set, values, weight units |
| Inventory Adjust / Purchase | A-09 | Product+variant, qty (kg/g), type, supplier, batch, expiry, reason |
| Supplier / Purchase Order | A-09 (procurement) | Supplier, items, quantities (kg), cost, expected date |
| Order Edit / Packing | A-12 | Packed weight per item, status, notes, refund/adjust |
| Coupon | A-17/AM-08 | Code, type (%/₹/free-ship), value, min-cart, usage limits, eligibility, validity |
| Membership Plan | A-18 | Name, price, cycle, benefits, discount rules |
| Delivery / Slot Settings | A-27/AM-13 | Slot windows, cut-off, capacity per zone, fees, weight-tolerance % |
| Serviceable Zone / Pincode | A-10/AM-14 | Pincode(s), zone, delivery fee, free-ship rule |
| Payment Settings | A-28 | Gateway keys, COD toggle, limits |
| Integration Settings | A-29 | Maps, SMTP, SMS, WhatsApp, storage credentials |
| General Settings | A-26 | Store info, ₹ currency, free-ship ₹699, GST/tax, timezone |
| Staff / Role | A-31/A-30 | User details, role, permission matrix |
| CMS Page / Banner / Blog | A-22/A-23/A-24 | Rich text, media, schedule, SEO |
| Login / 2FA | A-01 | Credentials, OTP |

### 13.2.5 Dashboard Widgets

**Main Admin Dashboard (A-02):**

| Widget | Type | Data | Notes |
|--------|------|------|-------|
| Sales Today | KPI tile | Today's revenue vs yesterday | ₹, delta % |
| Orders Today | KPI tile | Order count by status | New / confirmed / delivered |
| Orders by Status | Doughnut (Chart.js) | Distribution across lifecycle | Click → filtered orders |
| Revenue Trend | Line (Chart.js) | Daily/weekly/monthly revenue | Range selector |
| Low-Stock Alerts | List/table | Items below threshold (kg) | Quick restock link |
| Active Deliveries | Live counter/list | Out-for-delivery now, by zone | Link → delivery board |
| Top Products | Bar (Chart.js) | Best-sellers by qty/revenue | Period toggle |
| New Customers | KPI + sparkline | New signups today/period | |
| Pending Payments / COD Due | KPI tile | Uncollected COD, failed payments | Link → payments |
| Slot Utilisation | Progress bars | Booked vs capacity per slot | Cut-off awareness |
| Unassigned Orders | Alert badge | Orders needing a delivery partner | Link → dispatch |
| Refund/Cancellation Rate | KPI | % of orders | Trend arrow |

**Delivery Dashboard (A-13) widgets:**

| Widget | Type | Data |
|--------|------|------|
| Slots Today | Column board | Orders grouped by slot window |
| Fleet Availability | Counter | Partners available / busy / off |
| In-Progress by Stage | Funnel/steps | Packed → Picked → Out → Delivered |
| COD to Collect | KPI | Total COD amount pending on-route |
| Zone Load | Heat list | Orders per pincode/zone |
| SLA / Late Risk | Alert | Orders nearing slot-end |

**Delivery Partner "My Runs" (A-35) widgets:** assigned-count tile, next-slot list, COD-collected tally, mark-delivered actions.

### 13.2.6 Admin Sitemap (ASCII)

```
ADMIN PANEL (React + Bootstrap 5 + Chart.js + React Table)
│
├── /admin/login .................. Login (+2FA)
│
├── /admin ........................ Dashboard (KPIs, charts, alerts)
│
├── Catalogue
│     ├── /admin/products ......... Products (T-01)
│     │      └── /new /:id ........ Product Form (weight variants)
│     ├── /admin/categories ...... Categories (T-02)
│     ├── /admin/brands .......... Brands
│     └── /admin/attributes ...... Attributes / Variants
│
├── Inventory
│     ├── /admin/inventory ....... Inventory by weight (T-03)
│     ├── /admin/inventory/adjust  Adjustments / Batches (T-04)
│     └── /admin/warehouse ....... Warehouse / Zones / Slots
│
├── Sales
│     ├── /admin/orders .......... Orders (T-05)
│     │      └── /:id ............ Order Detail (packed-weight, actions)
│     ├── /admin/delivery ....... Delivery Board / Dispatch (T-07)
│     │      └── /partners ...... Delivery Partners (T-17)
│     └── /admin/payments ....... Payments / Transactions (T-10)
│
├── Customers
│     ├── /admin/customers ...... Customers (T-08)
│     │      └── /:id ........... Customer Detail
│     ├── /admin/membership ..... Membership Plans (T-15)
│     └── /admin/reviews ........ Reviews Moderation (T-11)
│
├── Marketing
│     ├── /admin/coupons ........ Coupons / Promotions (T-09)
│     ├── /admin/cms/banners .... Banners / Home layout
│     ├── /admin/cms/blog ....... Blog / Recipes
│     └── /admin/notifications .. Notification Center (T-16)
│
├── Reports
│     └── /admin/reports ........ Sales / Products / Customers / Delivery
│
├── CMS
│     └── /admin/cms/pages ...... Static Pages / Policies / FAQ
│
├── Administration
│     ├── /admin/settings ....... General (₹, ₹699, GST, timezone)
│     │      ├── /delivery ...... Slots / Cut-off / Zones / Tolerance
│     │      ├── /payments ...... Razorpay/PhonePe/Cashfree/COD
│     │      └── /integrations .. Maps/SMTP/SMS/WhatsApp/Storage
│     ├── /admin/roles .......... Roles & Permissions (matrix)
│     ├── /admin/users .......... Staff / Users (T-12)
│     ├── /admin/audit-logs ..... Audit Logs (T-13)
│     └── /admin/logs ........... System / Job Logs (T-14)
│
├── /admin/my-deliveries ........ Delivery Partner "My Runs" (interim)
└── /admin/profile .............. Admin Profile / 2FA
```

---

# CHAPTER 14 — DEVELOPMENT PLANNING

## 14.1 Delivery Approach

The build follows an **API-first, incremental** delivery model for a **small team** (indicative: 1 Tech Lead/Architect, 2 Backend engineers, 2 Frontend engineers — 1 admin-leaning, 1 storefront-leaning, 1 QA, part-time UI/UX + DevOps). Backend contracts are defined and stubbed early so admin and storefront front-ends develop in parallel against a stable REST API. Phases overlap deliberately — the plan below shows nominal sequencing, but Phases 3 and 4 run concurrently once the backend core is stable.

## 14.2 Phase Plan

| Phase | Scope | Key Deliverables | Milestone | Est. Duration |
|-------|-------|------------------|-----------|---------------|
| **P1 — Architecture & Setup** | Monorepo/repos, tooling, SSH-based CI/CD skeleton, DB schema (Prisma), VPS + PM2/NGINX base infra, design system (Bootstrap 5 theme), REST API contract & OpenAPI, auth scaffold | Repo + environments (dev/stage), ERD, API spec, component library shell, seed data | **M1: Foundation ready** — schemas + API contract frozen, envs live | 3–4 weeks |
| **P2 — Backend (Core APIs)** | Auth/JWT/RBAC, Products/Categories/Attributes/Variants, Inventory (by weight), Cart, Coupons, Checkout, Orders, Payments (Razorpay/PhonePe/Cashfree/COD), Delivery/slots/zones, Customers/Addresses, Reviews, CMS, Notifications (BullMQ+Redis), Reports aggregation, Settings, Audit/Logs | Documented REST endpoints, integration-tested services, payment & serviceability logic, job queues, S3/Cloudinary media | **M2: Backend API complete** — all Phase-1 endpoints pass integration tests | 6–8 weeks |
| **P3 — Admin Panel** | All admin pages/tables/forms/dashboards (Ch.13.2), Chart.js analytics, React Table lists, RBAC-gated UI, delivery dispatch board, inventory-by-weight, order packing/weight-tolerance flow | Fully functional Admin SPA wired to APIs | **M3: Admin operational** — store can be run end-to-end internally | 6–8 weeks (overlaps P2 tail) |
| **P4 — Customer Website** | All storefront pages/modals/forms (Ch.13.1), pincode serviceability, weight selector, slot booking, checkout+COD, account/orders/tracking, membership, wishlist/compare, CMS, SEO/perf, mobile-first polish | Fully functional Customer SPA wired to APIs | **M4: Storefront feature-complete** — full buy→track journey works | 7–9 weeks (overlaps P3) |
| **P5 — Testing (Unit / Integration / UAT)** | Unit tests (services/components), integration/API tests, E2E happy-paths, load/perf on catalogue+checkout, security review, UAT with client on real Hyderabad pincodes/slots, bug-fix hardening | Test suites in CI, UAT sign-off, defect burndown, perf/security report | **M5: UAT sign-off** — go-live candidate approved | 3–4 weeks |
| **P6 — Deployment (Native VPS / NGINX / PM2 / CI-CD)** | Provision Ubuntu VPS (users, SSH hardening, ufw); install Node/PM2/PostgreSQL/Redis/NGINX natively; NGINX reverse-proxy + SSL via Certbot/Let's Encrypt; PM2 cluster + `pm2 startup`; DB backups (pg_dump cron); GitHub Actions SSH-deploy pipeline (pull → install → `prisma migrate deploy` → build → `pm2 reload`); monitoring/logging, DNS, payment go-live, runbooks | Live production, automated zero-downtime deploy pipeline, monitoring dashboards, ops runbook & handover | **M6: Go-Live** — production launch | 2–3 weeks |

## 14.3 Overall Timeline

With deliberate overlap of P2→P3→P4, a realistic **calendar timeline for a small team is ~4.5 to 6 months** (≈ 18–26 weeks) from kickoff to production go-live, plus a short **hypercare / stabilisation** window post-launch. Sequential (non-overlapping) effort would be ~27–36 weeks; overlap compresses it.

- **Aggressive (experienced team, tight scope):** ~18 weeks (~4.5 months)
- **Realistic (recommended planning baseline):** ~22 weeks (~5.5 months)
- **Conservative (buffer for integrations/UAT churn):** ~26 weeks (~6.5 months)

## 14.4 Milestones (summary)

| Milestone | Meaning | Gate |
|-----------|---------|------|
| **M1 — Foundation ready** | Envs, schema, API contract, CI/CD skeleton | Contracts frozen |
| **M2 — Backend API complete** | All Phase-1 endpoints live & tested | Integration tests green |
| **M3 — Admin operational** | Internal team can run the store | Admin UAT internal |
| **M4 — Storefront feature-complete** | Full customer journey works | Storefront demo |
| **M5 — UAT sign-off** | Client-accepted go-live candidate | Defects ≤ agreed threshold |
| **M6 — Go-Live** | Production launch on Hyderabad zones | Payment + serviceability verified live |

## 14.5 Deliverables Per Phase (detail)

- **P1:** Architecture doc, Prisma schema/ERD, OpenAPI spec, Bootstrap 5 theme + shared components, PM2 `ecosystem.config.js` + NGINX site config templates, SSH-deploy CI pipeline skeleton, environment configs, seed catalogue.
- **P2:** Versioned REST API, service/unit tests, Postman/OpenAPI collection, payment sandbox integration, serviceability/slot engine, BullMQ workers (notifications/invoices), media pipeline.
- **P3:** Admin SPA (all Ch.13.2 screens), Chart.js dashboards, React Table lists with export, dispatch board, packing/weight-tolerance workflow, RBAC UI.
- **P4:** Customer SPA (all Ch.13.1 screens), pincode/slot/COD flows, weight selector, account & tracking, SEO meta + performance budget met, accessibility pass.
- **P5:** Test reports (unit/integration/E2E/load), security checklist, UAT script & sign-off, defect log closed.
- **P6:** Production deployment, CI/CD auto-deploy, monitoring/alerting, backup/restore verified, DNS + TLS, go-live checklist, ops runbook + client handover/training.

## 14.6 ASCII Gantt (indicative, weeks)

```
Week →        1   3   5   7   9  11  13  15  17  19  21  23  25
              |---|---|---|---|---|---|---|---|---|---|---|---|---|
P1 Setup      ####
P2 Backend       ###########████
P3 Admin                 ###########████
P4 Customer                  #############████
P5 Testing                              ##########
P6 Deploy                                         ######
Hypercare                                              ###
              |---|---|---|---|---|---|---|---|---|---|---|---|---|
Milestones    M1    M2       M3     M4        M5     M6
```

Legend: `#### ` = active development · overlap of P2/P3/P4 is intentional (front-ends build against frozen contracts while backend hardens). Milestones fall at the end of their gating phase.

---

# CHAPTER 15 — FUTURE ROADMAP (Phase 2+)

All future items are **additive** and **reuse the same REST backend** built in Phase 1. Because the platform is API-first from day one, mobile and third-party clients consume existing endpoints (with incremental new endpoints where noted) rather than requiring a re-architecture. Items are grouped by theme; the table gives value, dependencies, and relative effort.

## 15.1 Item Descriptions

- **Android App (Customer):** Native/React-Native customer app mirroring the storefront (catalogue, weight selector, pincode+slot, COD, tracking, push). Needs: mobile UI build, Firebase Push, app-store pipeline, mobile-optimised auth/session; consumes existing Products/Cart/Checkout/Orders/Delivery APIs.
- **iOS App (Customer):** Same as Android for iOS (App Store). Needs: iOS build, APNs/Firebase Push, Apple review compliance; same API surface.
- **Delivery App (Delivery Partner):** Dedicated fleet app replacing the interim web "My Runs" (A-35): assigned runs, route/map, mark packed/picked/out/delivered, COD collection, proof-of-delivery (photo/OTP), live location. Needs: delivery-status & location endpoints (mostly exist), background location, offline resilience, Google Maps.
- **Warehouse Management (WMS):** Deeper cold-chain ops — receiving, batch/expiry, cold-storage zones, pick/pack stations, wastage, cycle counts, supplier POs. Extends Inventory/Warehouse modules. Needs: procurement/PO endpoints, barcode/label support, batch-traceability.
- **AI Recommendation Engine:** Personalised product recommendations (frequently-bought, reorder reminders, slot suggestions, basket upsell). Needs: order/behaviour event data, model/service, recommendation endpoints; feeds PDP, home, cart.
- **AI Chatbot / Assistant:** Conversational support & guided ordering (order status, reorder, FAQ, slot help) on web + WhatsApp. Needs: NLU/LLM service, knowledge base from CMS/orders, WhatsApp API (already integrated), handoff to Customer Support.
- **Multi-Store:** Operate multiple physical stores/dark-stores with per-store catalogue, inventory, pricing, and zones under one platform. Needs: store dimension across catalogue/inventory/orders, store-scoped RBAC, store selector in admin (already stubbed), routing by pincode→store.
- **Multi-Vendor (Marketplace):** Onboard third-party meat/seafood vendors with vendor portal, commissions, payouts, vendor-level catalogue/inventory. Larger shift from single-store; needs vendor entity, vendor RBAC, settlement/payout engine, moderation.
- **ERP Integration:** Sync master data, procurement, and finance with an ERP (e.g. SAP/Odoo/Zoho). Needs: integration/middleware, data mapping, scheduled sync/webhooks.
- **Accounting Integration:** Push invoices, payments, COD, GST to accounting (Tally/Zoho Books/QuickBooks). Needs: export/webhook connectors, GST-compliant invoice mapping, reconciliation.
- **CRM Integration:** Sync customers, segments, campaigns, and support tickets with a CRM. Needs: customer/event sync, marketing-automation hooks, consent management.

## 15.2 Future Roadmap Table

| Item | Value (Business) | Depends On | Effort |
|------|------------------|------------|--------|
| Android App (Customer) | Large — captures majority mobile market, retention via push | Phase-1 REST APIs, Firebase Push, app pipeline | High |
| iOS App (Customer) | Large — premium segment, app-store reach | Phase-1 REST APIs, APNs/Firebase | High |
| Delivery App (Partner) | High — faster dispatch, live tracking, POD, COD control | Delivery/location endpoints, Maps, offline sync | Medium–High |
| Warehouse Management (WMS) | High — reduces wastage, cold-chain accuracy, traceability | Inventory/Warehouse modules, PO/batch endpoints, labels | Medium–High |
| AI Recommendation | Medium–High — higher AOV, reorder frequency | Order/behaviour data, ML service, rec endpoints | Medium |
| AI Chatbot | Medium — deflects support, guided reorder on web+WhatsApp | WhatsApp API, KB from CMS/orders, LLM/NLU service | Medium |
| Multi-Store | High — geographic expansion, dark-stores | Store dimension across modules, store-scoped RBAC | High |
| Multi-Vendor | High (new model) — marketplace scale | Vendor entity, vendor RBAC, payouts/settlement | Very High |
| ERP Integration | Medium — operational/finance efficiency at scale | Integration middleware, data mapping | Medium |
| Accounting Integration | Medium — automated GST/finance, less manual work | Invoice/payment connectors, GST mapping | Low–Medium |
| CRM Integration | Medium — retention, segmented marketing | Customer/event sync, consent | Low–Medium |

## 15.3 Sequencing Guidance (Phase 2+)

```
Phase 2 (near-term):   Delivery App  →  Android App  →  iOS App
                       (operational leverage first, then customer reach)

Phase 3 (scale):       Warehouse Mgmt  +  AI Recommendation  +  AI Chatbot
                       (efficiency + conversion once volume justifies)

Phase 4 (expansion):   Multi-Store  →  Multi-Vendor
                       (geographic then marketplace expansion)

Cross-cutting (any):   ERP / Accounting / CRM integrations
                       (adopted when back-office volume demands automation)
```

All the above continue to consume the **single API-first backend**; new capabilities are delivered as additive endpoints and services, preserving the customer web + admin panel already in production.

---

*End of Chapter 13–15 — UI, Development & Future Roadmap. Consistent with 00-PROJECT-BRIEF.md (Ojiva AI Technologies, INR, Hyderabad hyperlocal cold-chain, fixed React/Bootstrap/Node/TS/PostgreSQL stack, Phase-1 web-only, API-first).*
