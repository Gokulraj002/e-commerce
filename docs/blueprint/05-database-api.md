# 05 — DATABASE & API PLANNING

**Project:** Ojiva AI Technologies — Enterprise E-Commerce Web Application (fresh-meat cold-chain delivery)
**Reference:** elitenonveg.com · **Stack:** PostgreSQL + Prisma · Node/Express/TypeScript REST · JWT · Redis · BullMQ
**Scope:** Phase 1 = Web (Customer Website + Admin Panel + Backend APIs), API-first for future mobile apps
**Author role:** Senior Database Architect + API Architect

> This chapter is **design only**. It contains **no SQL and no application code** — only table planning, relationships, indexes, normalization strategy, and REST endpoint catalogues. All tables are implemented via **Prisma schema** on **PostgreSQL**; naming here is logical (developers map to Prisma models/`@@map`).

---

## Design Principles (applies to both chapters)

1. **Weight-first commerce.** Meat is sold by weight. Every sellable unit is a **Variant** with a weight (grams) and a price. Stock is tracked in **grams**, not "units". A "500g Chicken Curry Cut" pack is a variant of the "Chicken Curry Cut" product.
2. **Snapshot at order time.** Prices, weights, product names, tax rates, and addresses are **captured (denormalized) into the order** so that later catalog edits never rewrite historical orders. This is deliberate, controlled denormalization.
3. **Hyperlocal, slot-based fulfilment.** No courier/AWB model. Orders are booked into **delivery slots** against a **serviceable pincode/zone**, fulfilled by **own-fleet delivery partners**.
4. **Money as integers.** All monetary values stored as **integer paise** (₹1 = 100 paise) to avoid floating-point drift. All weights stored as **integer grams**.
5. **Soft-delete + audit everywhere.** Business entities carry `created_at`, `updated_at`, `deleted_at` (soft delete). Every sensitive mutation writes an **audit log** row.
6. **UUID primary keys** for all business tables (safe to expose, merge-friendly, non-enumerable), with human-facing **sequential display codes** (e.g. `ORD-2026-000123`) where users need a readable reference.
7. **Multi-channel identity.** A customer can arrive via Website or WhatsApp; phone number (E.164) is the strong identity anchor for the Indian market.

---

# CHAPTER 11 — DATABASE PLANNING

## 11.1 Table List (grouped by domain)

Below is the full logical table inventory. `*` marks a **join/junction** table (resolves a many-to-many). `†` marks a **snapshot/denormalized** table by design.

### A. Users, Auth & RBAC (10)
| # | Table | Note |
|---|-------|------|
| 1 | `users` | All admin/staff/system principals (not customers) |
| 2 | `roles` | Canonical RBAC roles |
| 3 | `permissions` | Granular capability flags (e.g. `orders.refund`) |
| 4 | `role_permissions` * | Role ↔ Permission map |
| 5 | `user_roles` * | User ↔ Role map (a user may hold multiple roles) |
| 6 | `refresh_tokens` | Rotating JWT refresh token store / session registry |
| 7 | `password_resets` | Reset & OTP tokens (staff) |
| 8 | `login_attempts` | Brute-force throttling / lockout tracking |
| 9 | `otp_verifications` | Phone/email OTP (shared by staff + customers) |
| 10 | `api_keys` | Server-to-server / webhook consumer keys (future mobile, integrations) |

### B. Catalog — Products, Categories, Brands, Attributes, Variants (14)
| # | Table | Note |
|---|-------|------|
| 11 | `categories` | Self-referencing tree (Poultry → Chicken → Curry Cut) |
| 12 | `brands` | Brand / sub-label (e.g. Kadaknath line, private label) |
| 13 | `products` | Master sellable concept (weight-based parent) |
| 14 | `product_categories` * | Product ↔ Category (a product may sit in multiple) |
| 15 | `product_images` | Gallery per product |
| 16 | `attributes` | Attribute definitions (Cut Type, Bone, Piece Count, Marination) |
| 17 | `attribute_values` | Allowed values per attribute (Boneless, Curry Cut…) |
| 18 | `product_attributes` * | Product ↔ AttributeValue (descriptive facets) |
| 19 | `variants` | **Weight-based SKU**: 250g/500g/1kg pack + price + stock |
| 20 | `variant_attribute_values` * | Variant ↔ AttributeValue (variant-defining facets) |
| 21 | `product_tags` | Tags: "Ready-to-Cook", "Antibiotic-free", "Bestseller" |
| 22 | `product_tag_map` * | Product ↔ Tag |
| 23 | `related_products` * | Product ↔ Product (cross-sell / "goes well with") |
| 24 | `membership_plans` | Membership/loyalty tiers referenced by pricing & offers |

### C. Inventory, Warehouse, Suppliers, Stock (7)
| # | Table | Note |
|---|-------|------|
| 25 | `warehouses` | Cold-storage / processing units (Hyderabad hubs) |
| 26 | `suppliers` | Farms / vendors supplying raw meat |
| 27 | `inventory` | Per-variant-per-warehouse **stock in grams** (on-hand, reserved) |
| 28 | `stock_movements` | Immutable ledger of every gram in/out (purchase, sale, wastage, adjust) |
| 29 | `purchase_orders` | Inbound procurement from suppliers |
| 30 | `purchase_order_items` | Lines of a PO (variant, expected grams, cost) |
| 31 | `stock_batches` | Batch/lot with received date, expiry, cold-chain temp log ref |

### D. Customers & Addresses (4)
| # | Table | Note |
|---|-------|------|
| 32 | `customers` | Storefront accounts (separate from staff `users`) |
| 33 | `customer_addresses` | Multiple delivery addresses per customer |
| 34 | `customer_memberships` | Customer ↔ active membership plan + validity |
| 35 | `customer_devices` | Push tokens / device registry (future Firebase) |

### E. Cart & Wishlist (4)
| # | Table | Note |
|---|-------|------|
| 36 | `carts` | One active cart per customer (+ guest carts by token) |
| 37 | `cart_items` | Line items (variant + quantity of packs) |
| 38 | `wishlists` | Saved-for-later per customer |
| 39 | `wishlist_items` | Wishlist ↔ Product/Variant |

### F. Coupons & Promotions (3)
| # | Table | Note |
|---|-------|------|
| 40 | `coupons` | Discount codes, "Flat up to 20% off", free-ship-over-₹699 rule |
| 41 | `coupon_redemptions` | Usage ledger (per-customer / global caps) |
| 42 | `coupon_conditions` | Eligibility rules (min cart, category, first-order, membership) |

### G. Orders (6)
| # | Table | Note |
|---|-------|------|
| 43 | `orders` † | Order header + captured totals/tax/discount/ship |
| 44 | `order_items` † | Captured product/variant **snapshot** + priced weight |
| 45 | `order_status_history` | Every status transition with actor + timestamp |
| 46 | `order_addresses` † | Frozen delivery + billing address snapshot |
| 47 | `order_adjustments` † | Weight-tolerance / packing adjustments to line totals |
| 48 | `order_notes` | Internal + customer-visible notes |

### H. Payments, Transactions, Refunds (5)
| # | Table | Note |
|---|-------|------|
| 49 | `payments` | Payment intent per order (gateway, method, status) |
| 50 | `payment_transactions` | Gateway attempt/callback records (auth, capture, fail) |
| 51 | `refunds` | Full/partial refunds (incl. weight-shortfall refunds) |
| 52 | `payment_webhooks` | Raw inbound webhook log (idempotency + audit) |
| 53 | `cod_settlements` | COD cash reconciliation per delivery partner |

### I. Delivery — Zones, Slots, Assignments (6)
| # | Table | Note |
|---|-------|------|
| 54 | `delivery_zones` | Serviceable zones (polygon / hub coverage) |
| 55 | `delivery_pincodes` | Pincode ↔ Zone serviceability + COD flag |
| 56 | `delivery_slots` | Time-slot templates + cut-off times + capacity |
| 57 | `delivery_slot_bookings` | Order ↔ Slot on a given date (capacity decrement) |
| 58 | `delivery_partners` | Own-fleet "delivery boys" (linked to a `users` principal) |
| 59 | `delivery_assignments` | Order ↔ Partner + route status + proof-of-delivery |

### J. Reviews (2)
| # | Table | Note |
|---|-------|------|
| 60 | `reviews` | Product ratings & reviews (verified-purchase aware) |
| 61 | `review_media` | Photos attached to reviews |

### K. CMS (5)
| # | Table | Note |
|---|-------|------|
| 62 | `cms_pages` | Static pages (About, T&C, Privacy, FAQ) |
| 63 | `banners` | Homepage / category hero banners & offers |
| 64 | `blogs` | Recipe / freshness content (SEO) |
| 65 | `faqs` | Q&A entries |
| 66 | `menus` | Header/footer navigation structures |

### L. Settings, Notifications, Logs (7)
| # | Table | Note |
|---|-------|------|
| 67 | `settings` | Key/value store settings (store, tax, shipping thresholds) |
| 68 | `tax_rates` | GST/tax config (referenced & snapshotted at order) |
| 69 | `notification_templates` | Email/SMS/WhatsApp/Push template bodies |
| 70 | `notifications` | Per-recipient outbound notification queue/log |
| 71 | `activity_logs` | General app event log (info/warn) |
| 72 | `audit_logs` | Security-relevant who-did-what-to-what ledger |
| 73 | `email_sms_log` | Delivery status from SMTP/SMS/WhatsApp providers |

**Total logical tables: 73** (see §11.7 for the breakdown that sums to this).

---

## 11.2 Key Table Specifications

Only the load-bearing tables are expanded here. Fields listed are the *important* ones; every business table also carries the standard audit trio (`created_at`, `updated_at`, `deleted_at`) unless noted.

### Users / Auth / RBAC

| Table | Purpose | Primary Key | Important Fields | Foreign Keys |
|-------|---------|-------------|------------------|--------------|
| `users` | Staff/admin principals | `id (uuid)` | `full_name`, `email (uniq)`, `phone`, `password_hash`, `status`, `last_login_at`, `is_super_admin` | — |
| `roles` | RBAC roles | `id (uuid)` | `name (uniq)`, `slug`, `description`, `is_system` | — |
| `permissions` | Capability atoms | `id (uuid)` | `code (uniq, e.g. orders.refund)`, `module`, `description` | — |
| `role_permissions` | Role↔Permission | `(role_id, permission_id)` | — | `role_id→roles`, `permission_id→permissions` |
| `user_roles` | User↔Role | `(user_id, role_id)` | `assigned_by` | `user_id→users`, `role_id→roles` |
| `refresh_tokens` | Session registry | `id (uuid)` | `user_id`, `token_hash`, `expires_at`, `revoked_at`, `user_agent`, `ip` | `user_id→users` |

### Catalog

| Table | Purpose | Primary Key | Important Fields | Foreign Keys |
|-------|---------|-------------|------------------|--------------|
| `categories` | Category tree | `id (uuid)` | `name`, `slug (uniq)`, `parent_id`, `image_url`, `position`, `is_active` | `parent_id→categories` |
| `brands` | Brand/label | `id (uuid)` | `name`, `slug (uniq)`, `logo_url`, `is_active` | — |
| `products` | Sellable master | `id (uuid)` | `name`, `slug (uniq)`, `sku_code`, `brand_id`, `short_desc`, `description`, `is_veg (false)`, `is_ready_to_cook`, `is_bulk_b2b`, `status`, `rating_avg†`, `rating_count†` | `brand_id→brands` |
| `variants` | **Weight SKU** | `id (uuid)` | `product_id`, `variant_name (e.g. 500g Curry Cut)`, `sku (uniq)`, `weight_grams`, `pack_type`, `price_paise`, `compare_at_price_paise`, `price_per_kg_paise†`, `mrp_paise`, `tax_rate_id`, `is_default`, `is_active` | `product_id→products`, `tax_rate_id→tax_rates` |
| `attributes` | Facet defs | `id (uuid)` | `name`, `slug`, `type (select/text)`, `is_variant_defining` | — |
| `attribute_values` | Facet values | `id (uuid)` | `attribute_id`, `value`, `slug`, `position` | `attribute_id→attributes` |
| `product_categories` | M:N | `(product_id, category_id)` | `is_primary` | `product_id→products`, `category_id→categories` |
| `variant_attribute_values` | M:N | `(variant_id, attribute_value_id)` | — | `variant_id→variants`, `attribute_value_id→attribute_values` |

> **Weight-based selling detail.** `variants.weight_grams` (integer) is the pack weight; `variants.price_paise` is the pack price; `variants.price_per_kg_paise` is a **derived, denormalized** convenience field (`price_paise / weight_grams * 1000`) shown on PDP as "₹/kg" and recomputed on write. Stock is **not** on the variant — it lives in `inventory` in grams so it can be split per warehouse.

### Inventory

| Table | Purpose | Primary Key | Important Fields | Foreign Keys |
|-------|---------|-------------|------------------|--------------|
| `warehouses` | Cold hubs | `id (uuid)` | `name`, `code`, `address`, `pincode`, `is_active` | — |
| `suppliers` | Vendors/farms | `id (uuid)` | `name`, `contact_phone`, `gstin`, `is_active` | — |
| `inventory` | Stock in grams | `id (uuid)` | `variant_id`, `warehouse_id`, `on_hand_grams`, `reserved_grams`, `reorder_level_grams`, `low_stock_flag†` | `variant_id→variants`, `warehouse_id→warehouses` |
| `stock_movements` | Gram ledger | `id (uuid)` | `inventory_id`, `movement_type (purchase/sale/reserve/release/wastage/adjust/return)`, `grams_delta (±)`, `reference_type`, `reference_id`, `actor_id`, `note` | `inventory_id→inventory` |
| `stock_batches` | Lot/expiry | `id (uuid)` | `variant_id`, `warehouse_id`, `supplier_id`, `received_at`, `expiry_at`, `initial_grams`, `remaining_grams` | `variant_id`, `warehouse_id`, `supplier_id` |

> **Reservation model.** On checkout, grams move from `on_hand` to `reserved` (a `reserve` movement). On dispatch, `reserved` is consumed (`sale`). On cancel/expiry, `reserved` returns to `on_hand` (`release`). This prevents overselling perishable stock during slot booking.

### Customers & Addresses

| Table | Purpose | Primary Key | Important Fields | Foreign Keys |
|-------|---------|-------------|------------------|--------------|
| `customers` | Storefront users | `id (uuid)` | `full_name`, `phone (E.164, uniq)`, `email`, `password_hash`, `status`, `default_address_id`, `wallet_balance_paise`, `referral_code` | `default_address_id→customer_addresses` |
| `customer_addresses` | Delivery addrs | `id (uuid)` | `customer_id`, `label`, `line1`, `line2`, `landmark`, `pincode`, `city`, `state`, `lat`, `lng`, `contact_phone`, `is_default` | `customer_id→customers` |

### Cart & Wishlist

| Table | Purpose | Primary Key | Important Fields | Foreign Keys |
|-------|---------|-------------|------------------|--------------|
| `carts` | Active cart | `id (uuid)` | `customer_id (null for guest)`, `guest_token`, `coupon_id`, `status`, `expires_at` | `customer_id→customers`, `coupon_id→coupons` |
| `cart_items` | Cart lines | `id (uuid)` | `cart_id`, `variant_id`, `quantity (packs)`, `unit_price_paise†`, `added_at` | `cart_id→carts`, `variant_id→variants` |

### Coupons

| Table | Purpose | Primary Key | Important Fields | Foreign Keys |
|-------|---------|-------------|------------------|--------------|
| `coupons` | Discount codes | `id (uuid)` | `code (uniq)`, `type (percent/flat/free_ship)`, `value`, `max_discount_paise`, `min_cart_paise`, `starts_at`, `ends_at`, `usage_limit`, `per_customer_limit`, `is_active` | — |
| `coupon_redemptions` | Usage ledger | `id (uuid)` | `coupon_id`, `customer_id`, `order_id`, `discount_paise`, `redeemed_at` | `coupon_id`, `customer_id`, `order_id` |

### Orders (snapshot core)

| Table | Purpose | Primary Key | Important Fields | Foreign Keys |
|-------|---------|-------------|------------------|--------------|
| `orders` | Order header | `id (uuid)` | `order_code (ORD-YYYY-NNNNNN, uniq)`, `customer_id`, `status`, `payment_status`, `fulfilment_status`, `subtotal_paise`, `discount_paise`, `tax_paise`, `shipping_paise`, `adjustment_paise`, `grand_total_paise`, `coupon_code†`, `slot_booking_id`, `placed_at` | `customer_id→customers`, `slot_booking_id→delivery_slot_bookings` |
| `order_items` | Line snapshots | `id (uuid)` | `order_id`, `variant_id (nullable ref)`, `product_name†`, `variant_name†`, `sku†`, `weight_grams†`, `quantity`, `unit_price_paise†`, `tax_rate†`, `line_total_paise†` | `order_id→orders`, `variant_id→variants` |
| `order_status_history` | Transition log | `id (uuid)` | `order_id`, `from_status`, `to_status`, `actor_type`, `actor_id`, `reason`, `created_at` | `order_id→orders` |
| `order_addresses` | Frozen address | `id (uuid)` | `order_id`, `type (ship/bill)`, `full_name`, `phone`, `line1`, `pincode`, `lat`, `lng` | `order_id→orders` |
| `order_adjustments` | Weight tolerance | `id (uuid)` | `order_id`, `order_item_id`, `reason (weight_variance/short_supply)`, `grams_delta`, `amount_delta_paise`, `approved_by` | `order_id`, `order_item_id→order_items` |

> **Why snapshots.** `order_items` copies `product_name`, `variant_name`, `sku`, `weight_grams`, `unit_price_paise`, and `tax_rate` at placement. If catalog prices change tomorrow, the invoice remains historically correct. The `variant_id` FK is retained only for analytics/linking and is intentionally **nullable** (a variant may later be deleted without corrupting the order).

### Payments

| Table | Purpose | Primary Key | Important Fields | Foreign Keys |
|-------|---------|-------------|------------------|--------------|
| `payments` | Intent per order | `id (uuid)` | `order_id`, `gateway (razorpay/phonepe/cashfree/cod)`, `method`, `amount_paise`, `status`, `gateway_order_id`, `gateway_payment_id` | `order_id→orders` |
| `payment_transactions` | Gateway events | `id (uuid)` | `payment_id`, `event (created/authorized/captured/failed)`, `amount_paise`, `gateway_ref`, `raw_payload` | `payment_id→payments` |
| `refunds` | Refunds | `id (uuid)` | `order_id`, `payment_id`, `amount_paise`, `reason (weight_shortfall/cancel/quality)`, `status`, `gateway_refund_id` | `order_id`, `payment_id` |
| `payment_webhooks` | Idempotent inbox | `id (uuid)` | `gateway`, `event_id (uniq)`, `signature_valid`, `processed_at`, `raw_body` | — |

### Delivery

| Table | Purpose | Primary Key | Important Fields | Foreign Keys |
|-------|---------|-------------|------------------|--------------|
| `delivery_zones` | Coverage areas | `id (uuid)` | `name`, `hub_warehouse_id`, `is_active` | `hub_warehouse_id→warehouses` |
| `delivery_pincodes` | Serviceability | `id (uuid)` | `pincode (uniq)`, `zone_id`, `is_serviceable`, `cod_allowed`, `min_order_paise` | `zone_id→delivery_zones` |
| `delivery_slots` | Slot templates | `id (uuid)` | `zone_id`, `label (e.g. 7-9 AM)`, `start_time`, `end_time`, `cutoff_minutes_before`, `capacity`, `is_active` | `zone_id→delivery_zones` |
| `delivery_slot_bookings` | Booked capacity | `id (uuid)` | `slot_id`, `delivery_date`, `order_id`, `booked_count†`, `status` | `slot_id→delivery_slots`, `order_id→orders` |
| `delivery_partners` | Own fleet | `id (uuid)` | `user_id`, `name`, `phone`, `vehicle_no`, `zone_id`, `is_available` | `user_id→users`, `zone_id→delivery_zones` |
| `delivery_assignments` | Order↔Partner | `id (uuid)` | `order_id`, `partner_id`, `status (assigned/picked/out/delivered/failed)`, `otp`, `delivered_at`, `pod_image_url`, `collected_cash_paise` | `order_id→orders`, `partner_id→delivery_partners` |

---

## 11.3 Relationships

### One-to-Many (1—*)
- `categories` 1—* `categories` (self-referencing parent→children tree)
- `brands` 1—* `products`
- `products` 1—* `variants`  ← **core weight-variant relation**
- `products` 1—* `product_images`
- `variants` 1—* `inventory` (one row per warehouse)
- `inventory` 1—* `stock_movements`
- `variants` 1—* `stock_batches`
- `warehouses` 1—* `inventory`
- `suppliers` 1—* `purchase_orders`
- `purchase_orders` 1—* `purchase_order_items`
- `customers` 1—* `customer_addresses`
- `customers` 1—* `orders`
- `customers` 1—1 `carts` (active) / 1—* over time
- `carts` 1—* `cart_items`
- `orders` 1—* `order_items`  ← **core**
- `orders` 1—* `order_status_history`
- `orders` 1—* `order_addresses` (ship + bill snapshot)
- `orders` 1—* `order_adjustments`
- `orders` 1—* `refunds`
- `payments` 1—* `payment_transactions`
- `delivery_zones` 1—* `delivery_pincodes`
- `delivery_zones` 1—* `delivery_slots`
- `delivery_slots` 1—* `delivery_slot_bookings`
- `delivery_partners` 1—* `delivery_assignments`
- `products` 1—* `reviews`
- `reviews` 1—* `review_media`
- `notification_templates` 1—* `notifications`

### One-to-One (1—1)
- `orders` 1—1 `payments` (one active payment intent per order; historical attempts live in `payment_transactions`)
- `orders` 1—1 `delivery_slot_bookings` (an order books exactly one slot)
- `orders` 1—1 `delivery_assignments` (Phase 1: one partner per order)
- `delivery_partners` 1—1 `users` (a partner is also a login principal)

### Many-to-Many (*—*), always via a join table
- `products` *—* `categories`  → via `product_categories`
- `products` *—* `attribute_values` → via `product_attributes`
- `variants` *—* `attribute_values` → via `variant_attribute_values`
- `products` *—* `tags` → via `product_tag_map`
- `products` *—* `products` → via `related_products` (cross-sell)
- `users` *—* `roles` → via `user_roles`
- `roles` *—* `permissions` → via `role_permissions`
- `coupons` *—* `customers`/`orders` → via `coupon_redemptions`
- `customers` *—* `products` → via `wishlist_items`

---

## 11.4 Indexing Strategy

| Table.Column(s) | Index type | Why |
|-----------------|-----------|-----|
| `products.slug`, `categories.slug`, `brands.slug`, `variants.sku`, `blogs.slug`, `cms_pages.slug` | Unique | Slug/SKU lookups drive every PDP/PLP URL and admin search |
| all FK columns (`*_id`) | B-tree | Join performance; PostgreSQL does **not** auto-index FKs |
| `orders.status`, `orders.payment_status`, `orders.fulfilment_status` | B-tree / partial | Admin order dashboards filter constantly by status |
| `orders.order_code` | Unique | Human order lookup |
| `orders.customer_id, orders.placed_at` | Composite | "My orders" list, sorted newest-first |
| `customers.phone`, `customers.email` | Unique | Login & OTP identity; phone is primary anchor |
| `customer_addresses.pincode`, `delivery_pincodes.pincode` | B-tree/Unique | **Serviceability check on every checkout** — hot path |
| `inventory.(variant_id, warehouse_id)` | Unique composite | One stock row per variant/warehouse; upsert target |
| `stock_movements.(inventory_id, created_at)` | Composite | Ledger reconstruction & reports |
| `delivery_slot_bookings.(slot_id, delivery_date)` | Composite | Capacity check per slot per day — hot path |
| `coupons.code` | Unique | Coupon apply |
| `coupon_redemptions.(coupon_id, customer_id)` | Composite | Per-customer usage cap enforcement |
| `payment_webhooks.event_id` | Unique | Webhook **idempotency** (dedupe retries) |
| `refresh_tokens.token_hash` | Unique | Session lookup on refresh |
| `audit_logs.(entity_type, entity_id, created_at)` | Composite | "History of this order/product" |
| `*.created_at` on high-volume tables (orders, notifications, logs) | B-tree | Time-range reports & pagination |
| `products.name`, `products.description` | GIN / full-text (`tsvector`) | Storefront search ("prawns", "boneless") |
| `products.status, deleted_at` | Partial (`WHERE deleted_at IS NULL`) | Only active catalog is ever listed |

**Index discipline:** index read hot-paths (slugs, FKs, status, pincode, phone, created_at) but avoid over-indexing write-heavy ledgers (`stock_movements`, `payment_transactions`) beyond what reports need.

---

## 11.5 Normalization Strategy

**Target: Third Normal Form (3NF)** across the operational catalog, customer, and configuration tables.

- **1NF** — atomic columns; repeating groups (a product's images, a customer's addresses, a variant's attributes) are split into child tables, never comma-lists.
- **2NF** — no partial dependency on composite keys; join tables (`product_categories`, `role_permissions`) hold only the relationship (+ minimal qualifiers).
- **3NF** — no transitive dependency; e.g. a brand's name lives only in `brands`, referenced by `products.brand_id`, never re-copied into `products`.

### Controlled (deliberate) denormalization — and why
| Where | Denormalized data | Reason |
|-------|-------------------|--------|
| `order_items` | `product_name`, `variant_name`, `sku`, `weight_grams`, `unit_price_paise`, `tax_rate` | **Snapshot at order time.** Historical invoices must never mutate when the catalog is later edited or a variant is deleted. |
| `orders` | `subtotal/discount/tax/shipping/grand_total`, `coupon_code` | Financial truth captured once; avoids recomputing from live prices. |
| `order_addresses` | Full frozen address | Customer may edit/delete their address; the order must retain where it actually went. |
| `variants.price_per_kg_paise` | Derived ₹/kg | Read-heavy PDP display; recomputed on every price write. |
| `products.rating_avg`, `rating_count` | Aggregated review stats | Avoid a COUNT/AVG over `reviews` on every catalog listing; refreshed on review write. |
| `inventory.low_stock_flag` | Boolean derived from `on_hand < reorder_level` | Fast dashboard filtering without arithmetic per row. |

Every denormalized field is **owned by a single writer path** and refreshed transactionally, so it never drifts silently.

---

## 11.6 ASCII ERD — Core Sales Flow

```
                     ┌──────────────┐        ┌──────────────┐
                     │   brands     │        │  categories  │◄─┐ (self parent_id)
                     └──────┬───────┘        └──────┬───────┘  │
                            │ 1                      │ *        │
                            │                        │ product_categories (M:N)
                            ▼ *                       ▼
                     ┌──────────────┐  1        *  ┌──────────────┐
                     │   products   │─────────────►│  variants    │  (weight_grams, price_paise)
                     └──────┬───────┘              └──────┬───────┘
                            │ 1                            │ 1
                            │ *                            │ *
                     ┌──────▼───────┐              ┌──────▼───────────┐
                     │   reviews    │              │   inventory      │ (grams: on_hand/reserved)
                     └──────────────┘              └──────┬───────────┘
                                                          │ 1
                                                          │ *
                                                   ┌──────▼───────────┐
                                                   │ stock_movements  │ (± grams ledger)
                                                   └──────────────────┘

  ┌──────────────┐ 1     * ┌──────────────┐ 1    * ┌──────────────┐
  │  customers   │────────►│    carts     │───────►│  cart_items  │──► variants
  └──────┬───────┘         └──────────────┘        └──────────────┘
         │ 1
         │ *                         (checkout converts cart → order)
         ▼
  ┌──────────────┐ 1        * ┌──────────────┐        ┌────────────────────┐
  │    orders    │───────────►│  order_items │ (SNAPSHOT: name/price/grams)│
  │ order_code   │            └──────────────┘        └────────────────────┘
  │ totals_paise │
  └──┬───┬───┬───┘
   1 │   │1  │1
     ▼   │   └────────────► ┌──────────────────────┐   * ┌──────────────────┐
 ┌───────▼──────┐           │ order_status_history │     │ order_adjustments│ (weight variance)
 │   payments   │ 1         └──────────────────────┘     └──────────────────┘
 └──────┬───────┘
        │ *                    1 ┌───────────────────────┐ *  ┌────────────────┐
 ┌──────▼──────────────┐  order──►│ delivery_slot_booking │◄───│ delivery_slots │──► delivery_zones
 │ payment_transactions│         └───────────────────────┘    └────────────────┘        │
 └─────────────────────┘                                                                 │ *
        │                    1 ┌───────────────────────┐                          ┌──────▼──────────┐
        └─(refunds)─────order──►│ delivery_assignments  │──► delivery_partners     │delivery_pincodes│
                               └───────────────────────┘                          └─────────────────┘
```

---

## 11.7 Approximate Table Count

| Domain | Tables |
|--------|-------:|
| A. Users / Auth / RBAC | 10 |
| B. Catalog (products/categories/brands/attributes/variants) | 14 |
| C. Inventory / Warehouse / Suppliers / Stock | 7 |
| D. Customers & Addresses | 4 |
| E. Cart & Wishlist | 4 |
| F. Coupons & Promotions | 3 |
| G. Orders | 6 |
| H. Payments / Transactions / Refunds | 5 |
| I. Delivery (zones/slots/assignments) | 6 |
| J. Reviews | 2 |
| K. CMS | 5 |
| L. Settings / Notifications / Logs | 7 |
| **Total** | **73** |

**≈ 73 tables** for Phase 1. A lean MVP can ship on ~45 core tables (catalog + orders + payments + delivery + auth); the remainder (batches, memberships, devices, blogs, menus, cod_settlements) are additive and can land in later sprints without schema churn.

---

# CHAPTER 12 — API PLANNING

All endpoints are **REST over HTTPS**, JSON bodies, JWT bearer auth, versioned under **`/api/v1/`**. Conventions:

- **Nouns, plural, hierarchical** paths; verbs only for actions that aren't CRUD (`/checkout`, `/apply`, `/cancel`).
- **Collection vs item:** `GET /products` (list, paginated/filtered) · `GET /products/{id}` (item).
- **Pagination/filter/sort** via query params (`?page=&limit=&sort=&status=&q=`).
- **Auth column legend:** `Public` (no token) · `Customer` (customer JWT) · `Admin` (any staff with permission) · role names from the canonical RBAC list (Super Admin, Admin, Store Manager, Inventory Manager, Delivery Manager, Customer Support, Delivery Partner). Permission checks are enforced by RBAC middleware mapped to `permissions.code`.
- Two logical surfaces share the version prefix: **storefront** (`/api/v1/...`) and **admin** (`/api/v1/admin/...`).

---

## 12.1 Authentication

| Method | Path | Purpose | Auth/Role |
|--------|------|---------|-----------|
| POST | `/api/v1/auth/register` | Customer sign-up (name, phone, email, password) | Public |
| POST | `/api/v1/auth/login` | Customer login → access+refresh JWT | Public |
| POST | `/api/v1/auth/otp/request` | Request phone/email OTP | Public |
| POST | `/api/v1/auth/otp/verify` | Verify OTP (login or phone-verify) | Public |
| POST | `/api/v1/auth/refresh` | Rotate access token via refresh token | Public (valid refresh) |
| POST | `/api/v1/auth/logout` | Revoke current refresh token | Customer |
| POST | `/api/v1/auth/forgot-password` | Start reset flow | Public |
| POST | `/api/v1/auth/reset-password` | Complete reset with token | Public |
| GET | `/api/v1/auth/me` | Current customer profile | Customer |
| POST | `/api/v1/admin/auth/login` | Staff/admin login | Public (staff) |
| POST | `/api/v1/admin/auth/refresh` | Staff token refresh | Public (valid refresh) |
| POST | `/api/v1/admin/auth/logout` | Staff logout | Admin |
| GET | `/api/v1/admin/auth/me` | Current staff principal + roles/permissions | Admin |

## 12.2 Products

| Method | Path | Purpose | Auth/Role |
|--------|------|---------|-----------|
| GET | `/api/v1/products` | List/search/filter (category, brand, price, tag, in-stock) | Public |
| GET | `/api/v1/products/{slug}` | Product detail + variants + images + attributes | Public |
| GET | `/api/v1/products/{id}/variants` | Variants (weights/prices/stock) of a product | Public |
| GET | `/api/v1/products/{id}/related` | Cross-sell suggestions | Public |
| GET | `/api/v1/products/featured` | Homepage bestsellers/featured | Public |
| GET | `/api/v1/products/search` | Full-text search endpoint | Public |
| GET | `/api/v1/admin/products` | Admin catalog list (incl. inactive) | Store Manager |
| POST | `/api/v1/admin/products` | Create product | Store Manager |
| PUT | `/api/v1/admin/products/{id}` | Update product | Store Manager |
| PATCH | `/api/v1/admin/products/{id}/status` | Activate/deactivate | Store Manager |
| DELETE | `/api/v1/admin/products/{id}` | Soft-delete product | Admin |
| POST | `/api/v1/admin/products/{id}/images` | Upload/attach image | Store Manager |
| DELETE | `/api/v1/admin/products/{id}/images/{imageId}` | Remove image | Store Manager |

## 12.3 Category / Brand / Attribute / Variant

| Method | Path | Purpose | Auth/Role |
|--------|------|---------|-----------|
| GET | `/api/v1/categories` | Category tree (public nav) | Public |
| GET | `/api/v1/categories/{slug}/products` | Products in a category | Public |
| GET | `/api/v1/brands` | Brand list | Public |
| GET | `/api/v1/attributes` | Attributes + values (filters) | Public |
| GET | `/api/v1/admin/categories` | Manage categories | Store Manager |
| POST | `/api/v1/admin/categories` | Create category | Store Manager |
| PUT | `/api/v1/admin/categories/{id}` | Update / reparent / reorder | Store Manager |
| DELETE | `/api/v1/admin/categories/{id}` | Soft-delete category | Admin |
| GET/POST | `/api/v1/admin/brands` | List / create brand | Store Manager |
| PUT/DELETE | `/api/v1/admin/brands/{id}` | Update / delete brand | Store Manager |
| GET/POST | `/api/v1/admin/attributes` | List / create attribute | Store Manager |
| POST | `/api/v1/admin/attributes/{id}/values` | Add attribute value | Store Manager |
| POST | `/api/v1/admin/products/{id}/variants` | Create weight variant (grams/price) | Store Manager |
| PUT | `/api/v1/admin/variants/{id}` | Update variant (price/weight/status) | Store Manager |
| PATCH | `/api/v1/admin/variants/{id}/price` | Adjust price (audited) | Store Manager |
| DELETE | `/api/v1/admin/variants/{id}` | Soft-delete variant | Admin |

## 12.4 Inventory / Warehouse / Supplier

| Method | Path | Purpose | Auth/Role |
|--------|------|---------|-----------|
| GET | `/api/v1/admin/inventory` | Stock list (grams, low-stock filter) | Inventory Manager |
| GET | `/api/v1/admin/inventory/{variantId}` | Stock across warehouses for a variant | Inventory Manager |
| PATCH | `/api/v1/admin/inventory/{id}/adjust` | Manual grams adjustment (writes movement) | Inventory Manager |
| GET | `/api/v1/admin/inventory/movements` | Stock-movement ledger (filter by type/date) | Inventory Manager |
| GET | `/api/v1/admin/inventory/low-stock` | Reorder alerts | Inventory Manager |
| GET/POST | `/api/v1/admin/warehouses` | List / create warehouse | Admin |
| PUT/DELETE | `/api/v1/admin/warehouses/{id}` | Update / deactivate | Admin |
| GET/POST | `/api/v1/admin/suppliers` | List / create supplier | Inventory Manager |
| PUT/DELETE | `/api/v1/admin/suppliers/{id}` | Update / deactivate supplier | Inventory Manager |
| GET/POST | `/api/v1/admin/purchase-orders` | List / raise PO | Inventory Manager |
| PATCH | `/api/v1/admin/purchase-orders/{id}/receive` | Receive stock → batch + movement | Inventory Manager |
| GET | `/api/v1/admin/batches` | Batch/expiry list (FIFO/expiry mgmt) | Inventory Manager |

## 12.5 Cart / Wishlist

| Method | Path | Purpose | Auth/Role |
|--------|------|---------|-----------|
| GET | `/api/v1/cart` | Get active cart (customer or guest token) | Public/Customer |
| POST | `/api/v1/cart/items` | Add variant (pack) to cart | Public/Customer |
| PATCH | `/api/v1/cart/items/{itemId}` | Update quantity | Public/Customer |
| DELETE | `/api/v1/cart/items/{itemId}` | Remove line | Public/Customer |
| DELETE | `/api/v1/cart` | Empty cart | Public/Customer |
| POST | `/api/v1/cart/merge` | Merge guest cart into account on login | Customer |
| POST | `/api/v1/cart/coupon` | Apply coupon to cart | Customer |
| DELETE | `/api/v1/cart/coupon` | Remove coupon | Customer |
| GET | `/api/v1/wishlist` | List wishlist | Customer |
| POST | `/api/v1/wishlist/items` | Add product/variant | Customer |
| DELETE | `/api/v1/wishlist/items/{itemId}` | Remove item | Customer |

## 12.6 Coupons

| Method | Path | Purpose | Auth/Role |
|--------|------|---------|-----------|
| POST | `/api/v1/coupons/validate` | Validate code against cart (pre-checkout) | Customer |
| GET | `/api/v1/coupons/available` | Public/eligible offers for customer | Customer |
| GET | `/api/v1/admin/coupons` | List coupons | Store Manager |
| POST | `/api/v1/admin/coupons` | Create coupon + conditions | Store Manager |
| PUT | `/api/v1/admin/coupons/{id}` | Update coupon | Store Manager |
| PATCH | `/api/v1/admin/coupons/{id}/status` | Enable/disable | Store Manager |
| DELETE | `/api/v1/admin/coupons/{id}` | Delete coupon | Admin |
| GET | `/api/v1/admin/coupons/{id}/redemptions` | Usage report | Store Manager |

## 12.7 Checkout (serviceability + slots + order creation)

| Method | Path | Purpose | Auth/Role |
|--------|------|---------|-----------|
| POST | `/api/v1/checkout/serviceability` | Check pincode serviceable + COD allowed | Public/Customer |
| GET | `/api/v1/checkout/slots` | Available delivery slots for date/zone (capacity, cut-off) | Customer |
| POST | `/api/v1/checkout/summary` | Price the cart (subtotal, tax, ship, discount, total) | Customer |
| POST | `/api/v1/checkout/validate` | Final stock+slot+address validation before pay | Customer |
| POST | `/api/v1/checkout` | Create order + reserve stock + book slot + init payment | Customer |

## 12.8 Orders

| Method | Path | Purpose | Auth/Role |
|--------|------|---------|-----------|
| GET | `/api/v1/orders` | Customer's own orders (paginated) | Customer |
| GET | `/api/v1/orders/{code}` | Order detail (items, status, tracking) | Customer |
| POST | `/api/v1/orders/{code}/cancel` | Cancel (if allowed) → release stock/slot | Customer |
| POST | `/api/v1/orders/{code}/reorder` | Recreate cart from a past order | Customer |
| GET | `/api/v1/orders/{code}/invoice` | Download invoice (snapshot) | Customer |
| GET | `/api/v1/admin/orders` | All orders (filter status/date/zone/partner) | Store Manager / Customer Support |
| GET | `/api/v1/admin/orders/{id}` | Full order incl. history & payment | Store Manager |
| PATCH | `/api/v1/admin/orders/{id}/status` | Advance status (confirm/pack/dispatch) | Store Manager |
| POST | `/api/v1/admin/orders/{id}/adjustments` | Record weight-tolerance adjustment | Store Manager |
| POST | `/api/v1/admin/orders/{id}/notes` | Add internal/customer note | Customer Support |
| POST | `/api/v1/admin/orders/{id}/cancel` | Admin cancel + refund trigger | Store Manager |

## 12.9 Payments (incl. webhooks)

| Method | Path | Purpose | Auth/Role |
|--------|------|---------|-----------|
| POST | `/api/v1/payments/initiate` | Create gateway order (Razorpay/PhonePe/Cashfree) | Customer |
| POST | `/api/v1/payments/verify` | Verify signature after client callback | Customer |
| GET | `/api/v1/payments/{orderCode}/status` | Poll payment status | Customer |
| POST | `/api/v1/payments/cod/confirm` | Place COD order (no gateway) | Customer |
| POST | `/api/v1/webhooks/razorpay` | Razorpay server webhook (idempotent) | Public (signed) |
| POST | `/api/v1/webhooks/phonepe` | PhonePe webhook | Public (signed) |
| POST | `/api/v1/webhooks/cashfree` | Cashfree webhook | Public (signed) |
| GET | `/api/v1/admin/payments` | Payment/transaction list | Admin |
| POST | `/api/v1/admin/payments/{id}/refund` | Issue full/partial refund | Admin |
| GET | `/api/v1/admin/refunds` | Refund list & status | Admin |
| GET | `/api/v1/admin/cod/settlements` | COD cash reconciliation per partner | Delivery Manager |

> Webhooks verify HMAC signature, dedupe on `event_id` via `payment_webhooks`, then enqueue processing (BullMQ) — never trust the client callback alone.

## 12.10 Delivery

| Method | Path | Purpose | Auth/Role |
|--------|------|---------|-----------|
| GET | `/api/v1/delivery/pincode/{pincode}` | Public serviceability + COD lookup | Public |
| GET | `/api/v1/admin/delivery/zones` | Manage zones | Delivery Manager |
| POST/PUT | `/api/v1/admin/delivery/zones` | Create/update zone | Delivery Manager |
| GET/POST | `/api/v1/admin/delivery/pincodes` | Manage pincode serviceability | Delivery Manager |
| GET/POST | `/api/v1/admin/delivery/slots` | Manage slot templates & capacity | Delivery Manager |
| GET | `/api/v1/admin/delivery/bookings` | Slot bookings by date/zone | Delivery Manager |
| GET/POST | `/api/v1/admin/delivery/partners` | Manage delivery partners | Delivery Manager |
| POST | `/api/v1/admin/orders/{id}/assign` | Assign order to partner | Delivery Manager |
| GET | `/api/v1/delivery/my-assignments` | Partner's assigned deliveries (future app reuses) | Delivery Partner |
| PATCH | `/api/v1/delivery/assignments/{id}/status` | Update pickup/out/delivered | Delivery Partner |
| POST | `/api/v1/delivery/assignments/{id}/pod` | Submit proof-of-delivery + OTP + cash | Delivery Partner |

## 12.11 Customer / Address

| Method | Path | Purpose | Auth/Role |
|--------|------|---------|-----------|
| GET | `/api/v1/customers/profile` | Get profile | Customer |
| PUT | `/api/v1/customers/profile` | Update profile | Customer |
| POST | `/api/v1/customers/change-password` | Change password | Customer |
| GET | `/api/v1/customers/addresses` | List addresses | Customer |
| POST | `/api/v1/customers/addresses` | Add address (pincode validated) | Customer |
| PUT | `/api/v1/customers/addresses/{id}` | Update address | Customer |
| DELETE | `/api/v1/customers/addresses/{id}` | Delete address | Customer |
| PATCH | `/api/v1/customers/addresses/{id}/default` | Set default | Customer |
| GET | `/api/v1/customers/memberships` | Membership status/plans | Customer |
| GET | `/api/v1/admin/customers` | List/search customers | Customer Support |
| GET | `/api/v1/admin/customers/{id}` | Customer 360 (orders, addresses) | Customer Support |
| PATCH | `/api/v1/admin/customers/{id}/status` | Block/unblock | Admin |

## 12.12 Reviews

| Method | Path | Purpose | Auth/Role |
|--------|------|---------|-----------|
| GET | `/api/v1/products/{id}/reviews` | List product reviews | Public |
| POST | `/api/v1/products/{id}/reviews` | Submit review (verified-purchase check) | Customer |
| PUT | `/api/v1/reviews/{id}` | Edit own review | Customer |
| DELETE | `/api/v1/reviews/{id}` | Delete own review | Customer |
| GET | `/api/v1/admin/reviews` | Moderation queue | Customer Support |
| PATCH | `/api/v1/admin/reviews/{id}/moderate` | Approve/reject/hide | Customer Support |

## 12.13 CMS

| Method | Path | Purpose | Auth/Role |
|--------|------|---------|-----------|
| GET | `/api/v1/cms/pages/{slug}` | Static page content | Public |
| GET | `/api/v1/cms/banners` | Active homepage/category banners | Public |
| GET | `/api/v1/cms/blogs` | Blog/recipe list | Public |
| GET | `/api/v1/cms/blogs/{slug}` | Blog detail | Public |
| GET | `/api/v1/cms/faqs` | FAQ list | Public |
| GET | `/api/v1/cms/menus` | Nav menus | Public |
| GET/POST | `/api/v1/admin/cms/pages` | Manage pages | Admin |
| GET/POST | `/api/v1/admin/cms/banners` | Manage banners | Admin |
| GET/POST | `/api/v1/admin/cms/blogs` | Manage blogs | Admin |
| GET/POST | `/api/v1/admin/cms/faqs` | Manage FAQs | Admin |
| PUT/DELETE | `/api/v1/admin/cms/{resource}/{id}` | Update/delete CMS item | Admin |

## 12.14 Reports

| Method | Path | Purpose | Auth/Role |
|--------|------|---------|-----------|
| GET | `/api/v1/admin/reports/sales` | Sales by day/week/month | Admin / Store Manager |
| GET | `/api/v1/admin/reports/products` | Best/worst sellers, by-weight sold | Store Manager |
| GET | `/api/v1/admin/reports/inventory` | Stock valuation, wastage, low-stock | Inventory Manager |
| GET | `/api/v1/admin/reports/customers` | New/returning, LTV, top customers | Admin |
| GET | `/api/v1/admin/reports/coupons` | Coupon performance | Store Manager |
| GET | `/api/v1/admin/reports/delivery` | Slot fill-rate, on-time %, partner load | Delivery Manager |
| GET | `/api/v1/admin/reports/payments` | Method split, COD vs prepaid, refunds | Admin |
| GET | `/api/v1/admin/reports/dashboard` | KPI summary (today's orders/revenue) | Admin |
| GET | `/api/v1/admin/reports/export` | CSV/Excel export of a report | Admin |

## 12.15 Settings / Roles / Permissions

| Method | Path | Purpose | Auth/Role |
|--------|------|---------|-----------|
| GET | `/api/v1/admin/settings` | Read settings (store, tax, shipping thresholds) | Admin |
| PUT | `/api/v1/admin/settings` | Update settings | Super Admin |
| GET/POST | `/api/v1/admin/tax-rates` | Manage GST/tax rates | Admin |
| GET | `/api/v1/admin/roles` | List roles | Super Admin |
| POST | `/api/v1/admin/roles` | Create role | Super Admin |
| PUT | `/api/v1/admin/roles/{id}` | Update role + permission set | Super Admin |
| DELETE | `/api/v1/admin/roles/{id}` | Delete role | Super Admin |
| GET | `/api/v1/admin/permissions` | List all permissions | Super Admin |
| GET/POST | `/api/v1/admin/users` | List / create staff users | Super Admin |
| PUT | `/api/v1/admin/users/{id}` | Update staff (roles/status) | Super Admin |
| PATCH | `/api/v1/admin/users/{id}/roles` | Assign/revoke roles | Super Admin |
| DELETE | `/api/v1/admin/users/{id}` | Deactivate staff | Super Admin |

## 12.16 Notifications

| Method | Path | Purpose | Auth/Role |
|--------|------|---------|-----------|
| GET | `/api/v1/notifications` | Customer's in-app notifications | Customer |
| PATCH | `/api/v1/notifications/{id}/read` | Mark read | Customer |
| POST | `/api/v1/notifications/preferences` | Update channel preferences | Customer |
| GET | `/api/v1/admin/notifications/templates` | List templates (email/SMS/WhatsApp/push) | Admin |
| POST | `/api/v1/admin/notifications/templates` | Create template | Admin |
| PUT | `/api/v1/admin/notifications/templates/{id}` | Edit template | Admin |
| POST | `/api/v1/admin/notifications/broadcast` | Send campaign/broadcast | Admin |
| GET | `/api/v1/admin/notifications/logs` | Delivery logs (SMTP/SMS/WhatsApp status) | Admin |

## 12.17 Miscellaneous / System

| Method | Path | Purpose | Auth/Role |
|--------|------|---------|-----------|
| GET | `/api/v1/health` | Liveness/readiness probe | Public |
| GET | `/api/v1/config` | Public runtime config (min-order, free-ship threshold, gateways enabled) | Public |
| POST | `/api/v1/uploads/sign` | Signed S3/Cloudinary upload URL | Admin/Customer |
| GET | `/api/v1/admin/audit-logs` | Security audit trail | Super Admin |
| GET | `/api/v1/admin/activity-logs` | General activity log | Admin |

---

## 12.18 APIs per Module — Summary

| Module | Approx. endpoints |
|--------|------------------:|
| Authentication | 13 |
| Products | 13 |
| Category / Brand / Attribute / Variant | 16 |
| Inventory / Warehouse / Supplier | 12 |
| Cart / Wishlist | 11 |
| Coupons | 8 |
| Checkout | 5 |
| Orders | 11 |
| Payments (incl. webhooks) | 11 |
| Delivery | 11 |
| Customer / Address | 12 |
| Reviews | 6 |
| CMS | 11 |
| Reports | 9 |
| Settings / Roles / Permissions | 12 |
| Notifications | 8 |
| Miscellaneous / System | 5 |
| **Grand total** | **≈ 174 endpoints** |

> **Sizing note.** ~174 REST endpoints across 17 modules for Phase 1 web. Because the architecture is **API-first**, the same contract serves the future Customer mobile app, Delivery Partner app, and any B2B/bulk-order portal without a second backend — mobile clients simply consume the identical `/api/v1/` surface (with delivery-partner endpoints already stubbed in §12.10).

---

## Cross-Module Dependency Notes (for developers)

- **Checkout** is the busiest orchestration: it touches `serviceability (delivery)` → `slots (delivery)` → `pricing (catalog + coupons + tax)` → `stock reserve (inventory)` → `order create (orders)` → `payment initiate (payments)`. Wrap the order-create + stock-reserve + slot-book in a **single DB transaction**; kick payment + notifications to **BullMQ** after commit.
- **Weight tolerance** flows from `delivery_assignments`/packing back into `order_adjustments` → may trigger a partial `refund`. Design the order total as *authorized amount* vs *final captured amount*.
- **Stock truth** is always the `stock_movements` ledger; `inventory.on_hand_grams` is a materialized running total, reconciled by the ledger.
- **RBAC** middleware resolves `user_roles → role_permissions → permissions.code` and caches it in **Redis** per session to avoid a DB hit on every request.
- **Idempotency** is mandatory on `/checkout`, `/payments/*`, and all `/webhooks/*` (client-supplied idempotency key + `payment_webhooks.event_id` unique).

*End of Chapter 11 & 12.*
