# MASTER BLUEPRINT
# Enterprise E-Commerce Web Application

**Company:** Ojiva AI Technologies
**Project:** Custom Single-Store Fresh-Meat / Cold-Chain E-Commerce Platform
**Reference Business Analyzed:** https://elitenonveg.com/
**Document Type:** Pre-Development Master Architecture & Planning Blueprint
**Status:** Design Phase (No Code) — Ready for Development Kickoff

---

## About This Document

This is the **single master blueprint** for the platform. It is detailed enough
that a development team can begin work immediately. It contains **no code** — it
is pure business analysis, architecture, and planning.

The platform is a **fully custom, API-first web application** (NOT WordPress,
Shopify, or Magento). Phase 1 delivers the **Customer Website + Admin Panel +
Backend APIs**. Android, iOS, and the Delivery Boy app are **future phases** that
will reuse the same REST backend.

### The business in one line
A hyperlocal (Hyderabad), cold-chain, **sold-by-weight** fresh meat / poultry /
seafood / eggs delivery store — COD-heavy, delivery-slot based, own-fleet
fulfilment with OTP verification.

---

## Technology Stack (Summary)

| Layer | Technology |
|-------|-----------|
| Customer Web | React.js · Bootstrap 5 · React Router · Axios · React Hook Form · TanStack Query |
| Admin Panel | React.js · Bootstrap 5 · Chart.js · React Table |
| Backend | Node.js · Express.js · TypeScript · REST APIs · JWT |
| Database / ORM | PostgreSQL · Prisma |
| Cache / Queue | Redis · BullMQ |
| Storage | AWS S3 or Cloudinary |
| Deployment | **Native Ubuntu VPS (NO Docker)** · NGINX · PM2 · GitHub Actions SSH deploy (`pm2 reload`) |
| Payments | Razorpay · PhonePe · Cashfree · Cash On Delivery |
| Maps / Notifications | Google Maps · SMTP · SMS · WhatsApp API · Firebase Push (future) |

---

## Table of Contents

| # | Chapter | Section |
|---|---------|---------|
| 1 | Business Analysis (model, flows, journeys, workflows) | Part A |
| 7 | Order Management (full lifecycle & edge flows) | Part A |
| 8 | Delivery Management (assignment, OTP, analytics) | Part A |
| 2 | Technology Recommendation (why each + comparisons) | Part B |
| 3 | System Architecture (9 layers, request lifecycle) | Part B |
| 4 | Folder / File Structure (monorepo, backend deep-dive) | Part C |
| 5 | Modules (all 27 modules, deps, roadmap) | Part C |
| 6 | User Roles (RBAC matrix) | Part D |
| 9 | Inventory (weight-based stock, wastage) | Part D |
| 10 | Reports (10 reports + dashboards) | Part D |
| 11 | Database Planning (73 tables, relationships, indexes) | Part E |
| 12 | API Planning (~174 endpoints) | Part E |
| 13 | UI Planning (pages, modals, forms, sitemap) | Part F |
| 14 | Development Planning (6 phases, timeline) | Part F |
| 15 | Future Roadmap (mobile apps, AI, multi-store) | Part F |
| 16 | **Deployment — Native VPS (No Docker)** | Part G |
| 17 | **Code Quality, Structure & Component Standards** | Part G |

> Chapters are grouped by author-team for coherence. Numbers follow the original
> project specification; the reading order below keeps related topics together.

---

# ═══════════════════════════════════════════════════════
# PART A — BUSINESS, ORDERS & DELIVERY
# ═══════════════════════════════════════════════════════

# 01 — BUSINESS ANALYSIS

> **Project:** Ojiva AI Technologies — Enterprise E-Commerce Web Application (single-store)
> **Domain:** Fresh non-veg (meat / seafood) cold-chain D2C delivery, Hyderabad
> **Reference analysed:** elitenonveg.com
> **Author role:** Senior Enterprise Solution Architect + Business Analyst
> **Scope of this document:** Chapter 1 (Business Analysis), Chapter 7 (Order Management), Chapter 8 (Delivery Management)
> **Companion source of truth:** `00-PROJECT-BRIEF.md` (business facts + tech stack — do not contradict)

---

## Table of Contents

- [CHAPTER 1 — BUSINESS ANALYSIS](#chapter-1--business-analysis)
  - [1.1 Business Model](#11-business-model)
  - [1.2 End-to-End Business Flow](#12-end-to-end-business-flow)
  - [1.3 Customer Journey](#13-customer-journey)
  - [1.4 Store Workflow](#14-store-workflow)
  - [1.5 Admin Workflow](#15-admin-workflow)
  - [1.6 Delivery Workflow (Own-Fleet, OTP)](#16-delivery-workflow-own-fleet-otp)
  - [1.7 Inventory Workflow](#17-inventory-workflow)
  - [1.8 Payment Workflow](#18-payment-workflow)
- [CHAPTER 7 — ORDER MANAGEMENT](#chapter-7--order-management-complete-lifecycle)
  - [7.1 Order State Machine](#71-order-state-machine-happy-path)
  - [7.2 Edge Flows](#72-edge-flows)
  - [7.3 Order-Status Reference Table](#73-order-status-reference-table)
  - [7.4 Cross-Module Dependencies](#74-cross-module-dependencies)
- [CHAPTER 8 — DELIVERY MANAGEMENT](#chapter-8--delivery-management-enterprise-module)
  - [8.1 Assignment Models](#81-assignment-models)
  - [8.2 Auto-Assignment Scoring Algorithm](#82-auto-assignment-scoring-algorithm)
  - [8.3 OTP Verification at Delivery](#83-otp-verification-at-delivery)
  - [8.4 Return To Store](#84-return-to-store-rts)
  - [8.5 Delivery Dashboard](#85-delivery-dashboard-widgets)
  - [8.6 Delivery Reports](#86-delivery-reports)
  - [8.7 Delivery Analytics (KPIs)](#87-delivery-analytics-kpis)

---

# CHAPTER 1 — BUSINESS ANALYSIS

## 1.1 Business Model

Ojiva's platform operates a **single-store, direct-to-consumer (D2C), perishable-goods cold-chain** business. This is fundamentally different from a general marketplace (Amazon), a dropship store, or a slot-shipped catalogue retailer. The perishability of fresh meat and seafood is the single largest force shaping every design decision in this blueprint.

### 1.1.1 Business Model Canvas (condensed)

| Building block | Decision for Ojiva | Why it matters to the system design |
|---|---|---|
| **Value proposition** | Fresh, hygienic, pre-cut, antibiotic/hormone-free meat delivered same-day hyperlocal in cold-chain packaging | Freshness SLA drives cut-off times, slot booking, and short inventory shelf-life logic |
| **Customer segments** | (a) Urban household retail buyers, (b) B2B bulk/wholesale buyers | Two pricing + fulfilment tracks; B2B needs bulk variants and possibly credit terms |
| **Channels** | Website (Phase 1), WhatsApp ordering (+91 7989020944), future mobile apps | API-first backend so all channels share one order pipeline |
| **Revenue streams** | Product sales by weight, delivery fee (waived > ₹699), membership plans | Weight-based pricing engine + free-shipping-threshold + membership entitlements |
| **Key resources** | Cold storage, own delivery fleet ("delivery boys"), packing staff, refrigerated packaging | Inventory in kg + delivery module + packing workflow are first-class modules |
| **Key activities** | Sourcing → cutting/cleaning → weighing/packing → cold delivery | Store workflow and inventory workflow are operationally central |
| **Cost structure** | Perishable procurement, spoilage/wastage, fleet, cold-chain, COD handling | Spoilage tracking + COD reconciliation are mandatory admin features |
| **Key partners** | Payment gateways (Razorpay/PhonePe/Cashfree), SMS/WhatsApp providers, Google Maps | External integrations behind abstraction layers |

### 1.1.2 The seven defining characteristics

1. **Sold by weight, not by unit.** A product is not "1 chicken"; it is *Chicken Curry Cut — 500g pack*. Weight variants (250g / 500g / 1kg) are the sellable SKUs. Price is derived from weight × rate/kg, so the pricing engine, cart, and inventory must all speak in grams.

2. **Perishable with a short shelf-life.** Stock cannot be "back-ordered" and held indefinitely. Inventory is decremented in kg, and unsold same-day stock becomes **spoilage/wastage** — a tracked cost, not a silent write-off.

3. **Hyperlocal, zone/pincode-bound.** The business serves the **Hyderabad region only**. Before a customer can even reach checkout, the system must confirm the delivery pincode is **serviceable**. Non-serviceable pincodes are captured as demand signals, never as orders.

4. **Delivery-slot based, not courier-shipped.** Customers book a **same-day or next-available time slot**, subject to a **per-slot cut-off time** and a **per-slot capacity**. This replaces the "shipped in 3–5 days" mental model entirely.

5. **COD-heavy.** In the Indian fresh-meat market, **Cash On Delivery** is a primary — often the majority — payment method. The order lifecycle, refund logic, and delivery module must treat COD as first-class, including cash reconciliation from the delivery fleet.

6. **Weight tolerance at packing.** Meat cannot be cut to the exact gram. An order for 500g may be packed at 480–520g. The system supports a **weight tolerance band**, and the **final billed amount can adjust slightly** after packing — a subtlety absent from standard e-commerce.

7. **Own-fleet last mile.** Phase 1 uses **in-house delivery staff (delivery boys)**, not third-party logistics (3PL). This means the platform owns assignment, routing hints, OTP proof-of-delivery, and cash handling internally.

### 1.1.3 Membership model

Membership plans are a recurring-value lever. The blueprint assumes membership entitlements such as: free delivery irrespective of the ₹699 threshold, priority slots, member-only pricing, and early access to limited stock (e.g., Kadaknath, Scampi). Membership status is an attribute of the **Customer** that the **Checkout**, **Delivery**, and **Coupons** modules read.

---

## 1.2 End-to-End Business Flow

The macro flow below shows how a single order threads through every operational function, from customer intent to cash settlement. Each swimlane maps to a module/role from the canonical lists in the brief.

```
 CUSTOMER            STOREFRONT/APP        BACKEND CORE          STORE OPS            DELIVERY FLEET        FINANCE/ADMIN
 ────────            ──────────────        ────────────          ─────────            ─────────────         ─────────────
    │                                                                                                          
    │  browse / search                                                                                         
    ├───────────────────►│                                                                                     
    │                     │  serviceability check (pincode → zone)                                             
    │◄────────────────────┤  [serviceable? Y/N]                                                                
    │                                                                                                          
    │  add-to-cart (by weight)                                                                                 
    ├───────────────────►│──────────────────►│ cart priced (weight×rate)                                       
    │                                          │ soft-reserve stock (optional)                                 
    │  checkout: address + slot + payment                                                                      
    ├───────────────────►│──────────────────►│ validate slot capacity + cut-off                               
    │                                          │ validate stock (kg) available                                 
    │                                          ├──► PAYMENT (Razorpay/PhonePe/Cashfree/COD)                    
    │                                          │◄── paid / COD-accepted                                        
    │                                          │ ORDER CREATED → CONFIRMED                                     
    │                                          │ hard-decrement inventory (kg)                                 
    │                                          ├───────────────────────────────►│ order appears in queue      
    │                                                                            │ PACK (weigh → tolerance)    
    │                                          │◄── final weight/amount adjust ──┤                             
    │                                          │ order READY                     │                             
    │                                          ├────────────────────────────────┼──────────►│ ASSIGNED        
    │                                                                                        │ PICKED UP       
    │  live tracking                                                                         │ OUT FOR DELIVERY
    │◄───────────────────────────────────────────────────────────────────────────────────  │                 
    │  receives goods + gives OTP / pays cash                                                │                 
    │──────────────────────────────────────────────────────────────────────────────────────► OTP verify      
    │                                          │◄── DELIVERED + COD cash collected ──────────┤                 
    │                                          │ order DELIVERED                                                
    │                                          ├──────────────────────────────────────────────────────►│ COD  
    │  review / reorder                                                                                   │recon
    ├───────────────────►│                                                                                │settle
```

**Reading the flow:** the critical serialization points are (1) serviceability before cart value is committed, (2) slot + stock validation before payment, (3) inventory hard-decrement at order confirmation, (4) weight/amount reconciliation at packing, and (5) OTP + cash settlement at delivery. Each is a guard that prevents a downstream failure that would waste perishable stock or fleet time.

---

## 1.3 Customer Journey

The customer journey is the retail buyer's path from discovery to reorder. Unlike durable-goods e-commerce, two gates — **serviceability** and **slot cut-off** — appear early and can terminate or reshape the journey.

```
 ┌──────────┐   ┌──────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────┐
 │DISCOVERY │──►│ BROWSE   │──►│ SERVICEABILITY│──►│ ADD TO CART  │──►│  LOGIN   │
 │(SEO/ads/ │   │ CATEGORY │   │ PINCODE CHECK │   │  (BY WEIGHT) │   │ REGISTER │
 │ WhatsApp)│   │ + PDP    │   │               │   │              │   │          │
 └──────────┘   └──────────┘   └──────┬───────┘   └──────────────┘   └────┬─────┘
                                      │ not serviceable                    │
                                      ▼                                     ▼
                              ┌───────────────┐                    ┌──────────────┐
                              │ CAPTURE LEAD  │                    │ ADDRESS +    │
                              │ "notify me"   │                    │ SLOT SELECT  │
                              │ (demand data) │                    └──────┬───────┘
                              └───────────────┘                           │
                                                                          ▼
 ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────────┐
 │ REVIEW / │◄──│ DELIVERY │◄──│  TRACK   │◄──│ PAYMENT  │◄──│ CART REVIEW  │
 │ REORDER  │   │ (OTP)    │   │  ORDER   │   │ (RZP/COD)│   │ + COUPON     │
 └──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────────┘
```

### 1.3.1 Stage-by-stage detail

| # | Stage | What the customer does | What the system does | Key dependencies |
|---|---|---|---|---|
| 1 | **Discovery** | Arrives via SEO, ads, referral, or WhatsApp link | Serves landing/category pages; records acquisition source | CMS, Products |
| 2 | **Browse category** | Explores Poultry / Mutton / Seafood / Eggs / RTC; opens product detail (PDP); may use wishlist / compare | Renders category + PDP with weight variants, price/kg, freshness/positioning copy, stock badge | Categories, Products, Variants, Attributes, Wishlist |
| 3 | **Serviceability / pincode check** | Enters delivery pincode (prompted early, ideally in header) | Maps pincode → delivery **zone**; confirms serviceable + shows available slots; if not serviceable, offers "notify me" | Delivery (zones), Settings |
| 4 | **Add to cart by weight** | Chooses variant (250g/500g/1kg) + quantity | Prices line = weight × rate/kg; runs live stock (kg) + free-shipping-threshold checks; optional soft-reserve | Cart, Inventory, Coupons |
| 5 | **Login / register** | Signs in (or registers) — can be deferred until checkout | Issues JWT session; merges guest cart with account cart | Authentication, Customers, Cart |
| 6 | **Address + slot** | Selects saved address or adds new; picks delivery slot | Re-validates pincode↔zone for chosen address; validates slot capacity + cut-off; blocks past-cut-off slots | Addresses, Delivery, Google Maps |
| 7 | **Payment** | Chooses Razorpay / PhonePe / Cashfree / COD | Prepaid: initiates gateway; COD: applies COD rules (eligibility, cap); creates order on success | Payments, Checkout, Orders |
| 8 | **Track order** | Watches status + delivery progress | Streams status updates + notifications (SMS/WhatsApp/email) | Orders, Delivery, Notification Center |
| 9 | **Delivery (OTP)** | Receives goods; reads out OTP; pays cash if COD | Delivery partner verifies OTP → marks Delivered; records COD cash | Delivery, Orders, Payments |
| 10 | **Review / reorder** | Rates product/delivery; one-tap reorder | Stores review (moderated); rebuilds cart from past order (re-checking serviceability/stock/slot) | Reviews, Orders, Cart |

### 1.3.2 Journey design principles

- **Fail fast, fail early.** Serviceability is checked before the customer invests effort in a cart. A non-serviceable pincode becomes a captured lead ("notify me when we deliver to 500081"), turning a dead-end into demand intelligence.
- **Weight literacy.** Every price display shows both the **pack price** and the **rate/kg** so buyers can compare fairly.
- **Slot honesty.** Slots already past cut-off are shown disabled with the reason, never silently hidden, to build trust.
- **COD parity.** COD is presented as a peer of prepaid, not buried, because it is the dominant method in this market.

---

## 1.4 Store Workflow

The store (fulfilment centre) is where a confirmed order becomes a packed, weighed, cold parcel. This workflow is executed by the **Store Manager**, **Inventory Manager**, and packing staff.

```
        NEW CONFIRMED ORDER ENTERS STORE QUEUE
                     │
                     ▼
        ┌────────────────────────┐
        │ 1. PICK LIST GENERATED │  (grouped by slot + category)
        └───────────┬────────────┘
                    ▼
        ┌────────────────────────┐      short on stock?
        │ 2. PICK ITEMS (kg)     ├──────────────────► SUBSTITUTE / PARTIAL / CANCEL LINE
        └───────────┬────────────┘                    (notify customer + refund logic)
                    ▼
        ┌────────────────────────┐
        │ 3. CUT / CLEAN / PREP  │
        └───────────┬────────────┘
                    ▼
        ┌────────────────────────┐   actual weight vs ordered weight
        │ 4. WEIGH ON SCALE      ├───────────────► WITHIN TOLERANCE? 
        └───────────┬────────────┘                   │Y            │N (out of band)
                    │                                 ▼             ▼
                    │                        adjust final amount   flag for manager
                    ▼                        (auto)                approval
        ┌────────────────────────┐
        │ 5. COLD PACK + LABEL   │  (order ID, slot, address, QR/barcode)
        └───────────┬────────────┘
                    ▼
        ┌────────────────────────┐
        │ 6. QUALITY CHECK       │
        └───────────┬────────────┘
                    ▼
        ORDER MARKED "READY" → HANDOFF TO DELIVERY MODULE
```

### 1.4.1 Store workflow notes

| Step | Trigger / Actor | System effect | Notes |
|---|---|---|---|
| Pick list | Auto on `CONFIRMED` | Aggregates orders by slot; reserves stock | Batching by slot reduces cold-room exposure |
| Pick items | Packing staff | Marks line picked | If insufficient kg → substitution/partial/cancel branch |
| Cut/clean/prep | Packing staff | — | Manual step; time feeds slot-capacity planning |
| Weigh | Packing staff | Records **actual grams**; recomputes line amount | Core weight-tolerance mechanism (see 1.7.3) |
| Cold pack + label | Packing staff | Generates label with QR/barcode + slot | Barcode later scanned at fleet pickup |
| Quality check | Store Manager | Approves | Gate before `READY` |
| Ready | System | State `PACKING → READY` | Hands off to Delivery assignment |

**Cross-module dependency:** the store workflow reads from **Inventory** (stock in kg), writes back **actual consumed weight** and **spoilage**, feeds **Orders** the final amount (weight tolerance), and signals **Delivery** that the parcel is `READY` for assignment.

---

## 1.5 Admin Workflow

The Admin Panel is the operational cockpit. Access is governed by **RBAC** across the canonical roles: Super Admin, Admin, Store Manager, Inventory Manager, Delivery Manager, Customer Support, Delivery Partner, Customer.

```
                         ┌───────────────────────────────┐
                         │        ADMIN PANEL LOGIN       │
                         │      (JWT + RBAC gating)       │
                         └───────────────┬───────────────┘
                                         ▼
        ┌───────────────┬────────────────┼────────────────┬────────────────┐
        ▼               ▼                ▼                ▼                ▼
 ┌────────────┐  ┌────────────┐   ┌────────────┐   ┌────────────┐   ┌────────────┐
 │ CATALOGUE  │  │ INVENTORY  │   │  ORDERS    │   │ DELIVERY   │   │ REPORTS &  │
 │ Products   │  │ Stock kg   │   │ Lifecycle  │   │ Assignment │   │ SETTINGS   │
 │ Categories │  │ Cut-offs   │   │ Refunds    │   │ Fleet      │   │ Coupons    │
 │ Variants   │  │ Spoilage   │   │ COD recon  │   │ Zones/slots│   │ CMS/Users  │
 └────────────┘  └────────────┘   └────────────┘   └────────────┘   └────────────┘
        │               │                │                │                │
        └───────────────┴────────────────┴────────────────┴────────────────┘
                                         ▼
                         ┌───────────────────────────────┐
                         │  AUDIT LOGS + NOTIFICATION CTR │
                         │ (every privileged action logged)│
                         └───────────────────────────────┘
```

### 1.5.1 Role-to-function matrix (RBAC)

| Function / Module | Super Admin | Admin | Store Mgr | Inventory Mgr | Delivery Mgr | Cust. Support |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| Products/Categories/Variants | ✔ | ✔ | view | view | — | view |
| Inventory (stock kg, cut-offs, spoilage) | ✔ | ✔ | ✔ | ✔ | — | view |
| Orders (view) | ✔ | ✔ | ✔ | view | ✔ | ✔ |
| Orders (cancel/refund/exchange) | ✔ | ✔ | partial | — | — | request |
| Delivery assignment / fleet | ✔ | ✔ | — | — | ✔ | view |
| Coupons / Memberships | ✔ | ✔ | — | — | — | — |
| Payments / COD reconciliation | ✔ | ✔ | — | — | view | view |
| Reports & Analytics | ✔ | ✔ | scoped | scoped | scoped | scoped |
| Settings / Roles / Permissions | ✔ | partial | — | — | — | — |
| CMS | ✔ | ✔ | — | — | — | — |
| Audit Logs | ✔ | view | — | — | — | — |

*(✔ = full, "partial/scoped/view/request" = limited; empty = no access.)*

**Design rule:** every privileged/state-changing action (price change, stock adjustment, order cancellation, refund, manual delivery assignment) writes to **Audit Logs** with actor, before/after, and timestamp. This is non-negotiable for a cash-heavy, perishable business where disputes and shrinkage must be traceable.

---

## 1.6 Delivery Workflow (Own-Fleet, OTP)

Phase 1 last-mile is executed by in-house **Delivery Partners** ("delivery boys"). Since there is no separate Delivery Boy app in Phase 1, the delivery partner is managed through the admin/web interfaces and status updates are recorded by the Delivery Manager or via a lightweight partner web view consuming the same APIs.

```
   READY ORDER  ──►  ASSIGNMENT (manual / auto / hybrid)  ──►  PARTNER ACCEPTS
                                                                    │
                                                                    ▼
                                                        SCAN/PICK UP AT STORE
                                                        (barcode → PICKED UP,
                                                         cash float noted if COD)
                                                                    │
                                                                    ▼
                                                        OUT FOR DELIVERY
                                                        (customer notified + tracking)
                                                                    │
                                        ┌───────────────────────────┼───────────────────────────┐
                                        ▼                                                         ▼
                              CUSTOMER AVAILABLE                                     CUSTOMER UNAVAILABLE /
                                        │                                            REFUSES / WRONG ADDRESS
                                        ▼                                                         │
                              COLLECT OTP FROM CUSTOMER                                           ▼
                                        │                                              MARK "FAILED DELIVERY"
                              ┌─────────┴─────────┐                                    (reason code) → reattempt
                              ▼                   ▼                                     or RETURN TO STORE (RTS)
                        OTP VALID            OTP INVALID (retry x3)                              │
                              │                   │                                             ▼
                              ▼                   └──► escalate / fallback verify        STOCK/REFUND HANDLING
                     COLLECT COD CASH (if COD)                                           (perishable → likely
                              │                                                           spoilage write-off)
                              ▼
                     MARK "DELIVERED" + capture proof
                              │
                              ▼
                     COD CASH → RECONCILIATION QUEUE (Finance)
```

### 1.6.1 Delivery workflow rules

| Aspect | Rule | Rationale |
|---|---|---|
| **Proof of delivery** | Mandatory **OTP** read out by customer; system verifies against order OTP | Prevents "not delivered" disputes; essential for COD trust |
| **OTP retries** | Up to 3 attempts; then fallback (support-verified / alternate confirm) | Balances security with real-world friction |
| **COD cash** | Partner collects exact amount (per **final** weight-adjusted total); logged per order | Feeds daily cash reconciliation |
| **Failed delivery** | Reason-coded (not home / refused / wrong address / unreachable) | Drives reattempt vs RTS decision + analytics |
| **Perishable RTS** | Returned meat generally **cannot be resold** → spoilage write-off | Protects food safety + accurate wastage costing |
| **Reattempt window** | Same-slot or next-slot only (freshness) | No multi-day reattempts like parcel logistics |

**Cross-module dependency:** Delivery consumes `READY` orders from **Orders**, reads slot/zone from **Delivery** config, updates **Orders** status, triggers **Notification Center** messages, and hands COD amounts to **Payments** for reconciliation. Full assignment logic is designed in Chapter 8.

---

## 1.7 Inventory Workflow

Inventory is measured and moved in **kilograms/grams**, not units. This is the operational heart of a perishable business and the module most different from generic e-commerce.

```
   PROCUREMENT (kg in)                     SALES DEMAND (kg out)
        │                                        ▲
        ▼                                        │
 ┌──────────────┐   opening stock (kg)   ┌───────┴────────┐
 │ STOCK INTAKE │──────────────────────► │  AVAILABLE     │
 │ per SKU/kg   │                        │  STOCK (kg)    │
 └──────────────┘                        └───────┬────────┘
                                                 │
                  ┌──────────────────────────────┼──────────────────────────────┐
                  ▼                               ▼                              ▼
        ┌──────────────────┐          ┌──────────────────┐          ┌──────────────────┐
        │ SOFT RESERVE     │          │ HARD DECREMENT   │          │ PACK ADJUSTMENT  │
        │ (in cart, TTL)   │          │ (order confirmed)│          │ (actual weighed  │
        │ optional         │          │                  │          │  grams)          │
        └──────────────────┘          └──────────────────┘          └──────────────────┘
                                                 │
                                                 ▼
                                        ┌──────────────────┐
                                        │ CUT-OFF REACHED  │  slot closes for new orders
                                        │ PER SLOT         │
                                        └────────┬─────────┘
                                                 ▼
                                        ┌──────────────────┐
                                        │ END-OF-DAY       │  unsold kg → SPOILAGE / WASTAGE
                                        │ RECONCILE (kg)   │  (write-off + cost recorded)
                                        └──────────────────┘
```

### 1.7.1 Stock states

| State | Meaning | Trigger |
|---|---|---|
| **Available** | Sellable kg on hand | Intake / adjustment |
| **Soft-reserved** | Held for in-progress cart (short TTL) | Add-to-cart (optional) |
| **Committed** | Deducted for confirmed order | Order `CONFIRMED` |
| **Consumed** | Actually weighed & packed | Store weigh step |
| **Spoiled / Wastage** | Unsellable (unsold, RTS, expired) | EoD reconcile / RTS |

### 1.7.2 Cut-off time logic

Each **delivery slot** has a **cut-off time** after which it stops accepting new orders (so the store can pick/pack/deliver in time). The system:
- Computes remaining capacity per slot in real time.
- Disables slots past cut-off (with visible reason).
- Prevents checkout against a closed slot, re-validating at the payment step (a slow checkout can cross the cut-off).

### 1.7.3 Weight tolerance mechanism

- Customer orders a **nominal weight** (e.g., 500g).
- Packing yields an **actual weight** within a configured **tolerance band** (e.g., ±5%).
- If **within band** → final line amount is auto-recomputed at actual weight × rate/kg; customer notified of the (small) adjustment. For prepaid, a micro-refund or micro-charge policy applies (often absorbed/settled at COD; for prepaid, difference credited/charged per Settings).
- If **outside band** → flagged for **manager approval** before the order proceeds (protects against errors and disputes).

### 1.7.4 Spoilage / wastage

- Perishability means **unsold same-day stock and RTS returns are written off** as spoilage.
- Spoilage is **recorded with quantity (kg), reason, and cost** — it is a KPI (wastage %), not a hidden loss.
- Procurement planning uses historical demand + spoilage to right-size intake.

**Cross-module dependency:** Inventory is read by **Cart/Checkout** (availability), decremented by **Orders** (confirmation), adjusted by **Store** (weighing), and drives **Reports** (wastage %, stockouts). It also governs slot availability jointly with **Delivery**.

---

## 1.8 Payment Workflow

The platform supports **Razorpay, PhonePe, Cashfree** (prepaid gateways) and **Cash On Delivery**. A **provider abstraction layer** lets any prepaid gateway be swapped or load-balanced without touching order logic.

```
                         CHECKOUT: SELECT PAYMENT METHOD
                                     │
             ┌───────────────────────┼───────────────────────┐
             ▼                                                ▼
        PREPAID (RZP / PhonePe / Cashfree)               COD SELECTED
             │                                                │
             ▼                                                ▼
   CREATE PAYMENT INTENT/ORDER                       COD ELIGIBILITY CHECK
   (amount, currency INR, order ref)                 (pincode allowed? cap?
             │                                        blacklist? min/max?)
             ▼                                                │
   REDIRECT / SDK → CUSTOMER PAYS                     ┌───────┴────────┐
             │                                        ▼                ▼
   ┌─────────┴─────────┐                          ELIGIBLE        NOT ELIGIBLE
   ▼                   ▼                              │            → force prepaid
 SUCCESS            FAILURE/TIMEOUT                   ▼
   │                   │                       ORDER CREATED (COD)
   ▼                   ▼                       payment_status = PENDING
 GATEWAY WEBHOOK    RETRY / CHANGE                    │
 (verify signature) METHOD / ABANDON                  ▼
   │                                          CASH COLLECTED AT DELIVERY
   ▼                                          (final weight-adjusted amount)
 PAYMENT CAPTURED                                     │
 payment_status=PAID                                  ▼
   │                                          payment_status = PAID
   ▼                                          + COD RECONCILIATION
 ORDER CREATED → CONFIRMED                            │
                                                      ▼
                          ┌───────────────────────────────────────────┐
                          │ REFUND PATH (cancel/return/failed delivery) │
                          │ prepaid → gateway refund (async webhook)    │
                          │ COD     → no charge / cash not collected /  │
                          │           store credit if pre-collected     │
                          └───────────────────────────────────────────┘
```

### 1.8.1 Payment method comparison

| Method | Type | When captured | Refund mechanism | Special handling |
|---|---|---|---|---|
| **Razorpay** | Prepaid gateway | At checkout (webhook-verified) | Gateway refund API (async) | Signature verification; idempotent webhook |
| **PhonePe** | Prepaid gateway | At checkout | Gateway refund | UPI-heavy; status polling + webhook |
| **Cashfree** | Prepaid gateway | At checkout | Gateway refund | Alt/backup gateway; same abstraction |
| **COD** | Cash on delivery | At delivery (final weight-adj. amount) | No charge / not collected / store credit | Eligibility rules, cash reconciliation, higher failed-delivery risk |

### 1.8.2 Key payment rules

- **Webhook is the source of truth** for prepaid capture — never trust the client redirect alone. Verify signatures; make webhook handling idempotent.
- **COD eligibility** is configurable by zone/pincode, order value cap, and customer risk (repeat failed-delivery customers may be forced prepaid).
- **Weight tolerance and payment interact:** the **final** amount (post-packing) is what COD collects; for prepaid, the small difference is refunded/charged per Settings.
- **Reconciliation:** COD cash from each delivery partner is reconciled daily; discrepancies flagged to Finance/Admin.

**Cross-module dependency:** Payments is invoked by **Checkout**, updates **Orders** (`payment_status`), triggers **Notification Center** (receipts, refund confirmations), and feeds **Reports** (revenue, COD %, refund %, reconciliation).

---
---

# CHAPTER 7 — ORDER MANAGEMENT (complete lifecycle)

Order Management is the spine of the platform. Every other module either feeds the order or reacts to it. This chapter defines the **happy-path state machine**, the **edge flows** (with who triggers them, the stock effect, and refund logic), a **status reference table**, and the **cross-module dependencies**.

## 7.1 Order State Machine (happy path)

```
  ┌──────┐   ┌──────────┐   ┌─────────┐   ┌───────────────┐   ┌───────────┐
  │ CART │──►│ CHECKOUT │──►│ PAYMENT │──►│ ORDER CREATED │──►│ CONFIRMED │
  └──────┘   └──────────┘   └─────────┘   └───────────────┘   └─────┬─────┘
   (draft,    (address+      (prepaid       (persisted, ID           │
   client)    slot chosen,   captured OR    issued, OTP gen)         │ stock hard-
              validated)     COD accepted)                           │ decremented
                                                                     ▼
                                                              ┌───────────┐
                                                              │  PACKING  │  (store weighs;
                                                              └─────┬─────┘   weight tolerance
                                                                    │         may adjust total)
                                                                    ▼
                                                              ┌───────────┐
                                                              │   READY   │  (packed + QC passed)
                                                              └─────┬─────┘
                                                                    ▼
                                                              ┌───────────┐
                                                              │ ASSIGNED  │  (delivery partner set:
                                                              └─────┬─────┘   manual/auto/hybrid)
                                                                    ▼
                                                              ┌───────────┐
                                                              │ PICKED UP │  (partner scans barcode
                                                              └─────┬─────┘   at store; COD float noted)
                                                                    ▼
                                                          ┌───────────────────┐
                                                          │ OUT FOR DELIVERY  │  (customer notified,
                                                          └─────────┬─────────┘   live tracking on)
                                                                    ▼
                                                              ┌───────────┐
                                                              │ DELIVERED │  (OTP verified +
                                                              └───────────┘   COD cash collected)
```

**Guard conditions between states**

| Transition | Guard (must be true) | Owner |
|---|---|---|
| Cart → Checkout | Cart non-empty; pincode serviceable | System/Customer |
| Checkout → Payment | Address valid; slot open (before cut-off) + capacity; stock available (kg) | System |
| Payment → Order Created | Prepaid captured (webhook) OR COD eligible & accepted | Payments |
| Order Created → Confirmed | Fraud/eligibility passed; inventory hard-decrement succeeds | System |
| Confirmed → Packing | Order in store queue; picking begins | Store |
| Packing → Ready | Weighed (within tolerance or approved); QC passed | Store Manager |
| Ready → Assigned | Delivery partner selected & accepts | Delivery Mgr / Auto |
| Assigned → Picked Up | Barcode scanned at store | Delivery Partner |
| Picked Up → Out For Delivery | Partner departs | Delivery Partner |
| Out For Delivery → Delivered | **OTP verified** (+ COD cash collected) | Delivery Partner |

## 7.2 Edge Flows

The happy path is only part of the lifecycle. The following edge flows are where perishability, COD, and own-fleet delivery make Ojiva materially different from generic e-commerce. Each is detailed with **trigger/owner**, **stock effect**, and **refund logic**.

### 7.2.1 Cancelled

```
 CONFIRMED / PACKING ──cancel──► CANCELLED
   │  (before dispatch)              │
   ▼                                 ▼
 restock kg IF still sellable    refund per payment method
 (pre-cut poultry may restock;   (see refund logic)
  already-cut/packed → spoilage)
```

| Aspect | Detail |
|---|---|
| **Who triggers** | Customer (self-service, only before a cut-off / before `PICKED UP`), Customer Support, Admin, or system (e.g., stock shortfall discovered at picking) |
| **Allowed window** | Up to `READY`/`PICKED UP`; after dispatch, becomes **Failed Delivery / Return**, not cancellation |
| **Stock effect** | If not yet cut → **restock kg** to Available. If already cut/packed → **cannot restock** → **spoilage write-off** |
| **Refund logic** | Prepaid → **full refund** via gateway (async). COD → no money moved (order simply voided) |
| **Notification** | Cancellation + refund-initiated message |

### 7.2.2 Returned

```
 DELIVERED ──return request──► RETURN REQUESTED ──approve──► RETURNED
    │  (quality complaint)          │                          │
    ▼                               ▼                          ▼
 evidence (photo)             support review              perishable → NOT
 within short window          decision                   restocked → spoilage;
                                                          refund/replace issued
```

| Aspect | Detail |
|---|---|
| **Who triggers** | Customer (quality/spoilage complaint) → reviewed by Customer Support/Admin |
| **Window** | Very short (same day / on-delivery inspection) because goods are perishable |
| **Stock effect** | Returned meat is **not resold** → **spoilage write-off** (food safety) |
| **Refund logic** | Approved return → **refund** (prepaid via gateway; COD via store credit or cash-back per policy) **or replacement** (see Exchange) |
| **Notification** | Return status updates + resolution message |

### 7.2.3 Refund

```
 TRIGGER (cancel / return / failed delivery / weight-tolerance /
          partial line-out-of-stock)
        │
        ▼
 DETERMINE PAYMENT TYPE ──┬── PREPAID ──► gateway refund API ──► REFUND PENDING ──►(webhook)──► REFUNDED
                          │
                          └── COD ──► not-collected (nothing to refund)  OR  store credit / cash-back
```

| Aspect | Detail |
|---|---|
| **Who triggers** | System (auto for cancellations/failed prepaid), Admin/Support (manual for returns/goodwill) |
| **Scope** | Full order, single line (partial), or delta (weight-tolerance difference) |
| **Stock effect** | Depends on originating flow (see each) — refund itself does not move stock |
| **Refund logic** | **Prepaid:** gateway refund, async, reconciled via webhook; state `REFUND_PENDING → REFUNDED`. **COD:** if cash never collected → nothing to refund; if pre-collected/partial dispute → **store credit** or cash-back per Settings |
| **Notification** | Refund initiated + refund completed messages; ledger entry in Reports |

### 7.2.4 Exchange

```
 DELIVERED (issue) ──exchange approved──► REPLACEMENT ORDER CREATED
    │                                          │
    ▼                                          ▼
 original line → spoilage                 new stock decrement (kg) +
 (perishable, not restocked)              fresh slot assignment (same/next)
```

| Aspect | Detail |
|---|---|
| **Who triggers** | Customer request → Support/Admin approval |
| **Mechanism** | Modelled as a **linked replacement order** (not an in-place edit) for clean audit + accounting |
| **Stock effect** | Original returned item → **spoilage**; replacement item → **fresh kg decrement** |
| **Refund logic** | Usually **no net refund** (like-for-like swap); price difference charged/refunded if variant differs |
| **Notification** | Exchange approved + replacement dispatch/track messages |

### 7.2.5 Failed Payment

```
 CHECKOUT → PAYMENT ──gateway fail/timeout/abandon──► PAYMENT FAILED
        │                                                   │
        ▼                                                   ▼
 NO order confirmed                                  offer retry / switch method / COD
 (soft-reserve, if any, released on TTL)             cart preserved
```

| Aspect | Detail |
|---|---|
| **Who triggers** | Gateway (decline/timeout) or customer abandonment |
| **Order state** | Order **not** created/confirmed (or held as `PAYMENT_PENDING` then auto-voided on timeout) |
| **Stock effect** | **No hard decrement.** Any soft-reserve is **released** on TTL expiry — critical so perishable stock isn't locked by dead checkouts |
| **Refund logic** | None (no capture). If a rare double-charge occurs → auto-refund via reconciliation |
| **Notification** | "Payment failed — retry" prompt |

### 7.2.6 Failed Delivery

```
 OUT FOR DELIVERY ──cannot deliver──► FAILED DELIVERY (reason-coded)
        │                                    │
        ├── not home / unreachable ──────────┼──► REATTEMPT (same/next slot only)
        ├── customer refused ────────────────┤
        ├── wrong/incomplete address ────────┘
        │
        ▼ (no reattempt possible / perishable window closed)
   RETURN TO STORE (RTS) ──► spoilage write-off + refund logic
```

| Aspect | Detail |
|---|---|
| **Who triggers** | Delivery Partner (marks with reason code), confirmed by Delivery Manager |
| **Reason codes** | Not home / unreachable / refused / wrong address / OTP unverifiable |
| **Reattempt** | Only **same-slot or next-slot** (freshness); no multi-day retries |
| **Stock effect** | If reattempt fails / not viable → **RTS → spoilage** (meat can't be resold) |
| **Refund logic** | **Prepaid:** refund (minus policy fee if customer at fault, per Settings). **COD:** no cash collected → no refund; repeated COD failures flag customer for **prepaid-only** |
| **Notification** | Failed-attempt alert + reattempt/refund message |

## 7.3 Order-Status Reference Table

| Status | Meaning | Who sets it | Customer-visible? | Stock effect | Notification sent |
|---|---|---|---|:--:|---|
| **Cart** | Draft, not an order yet | System (client) | Yes (their cart) | Optional soft-reserve | No |
| **Checkout** | Address + slot chosen, validating | System | Yes | Soft-reserve (TTL) | No |
| **Payment Pending** | Awaiting prepaid capture / COD confirm | System/Payments | Yes | Soft-reserve held | Optional ("complete payment") |
| **Payment Failed** | Prepaid declined/timed-out/abandoned | Payments gateway | Yes | Soft-reserve released | Yes (retry prompt) |
| **Order Created** | Persisted, order ID + OTP generated | System | Yes | Pending hard-decrement | Yes (order received) |
| **Confirmed** | Accepted; entering fulfilment | System | Yes | **Hard-decrement (kg)** | Yes (order confirmed) |
| **Packing** | Store picking/cutting/weighing | Store staff | Yes | Consuming; **weight adjust** | Optional (packing) |
| **Ready** | Packed, QC passed | Store Manager | Yes | Consumed finalised | Yes (ready/dispatch soon) |
| **Assigned** | Delivery partner allocated | Delivery Mgr / Auto | Yes (partner name/ETA) | No change | Optional |
| **Picked Up** | Partner has parcel (barcode scan) | Delivery Partner | Yes | No change | Yes (on the way soon) |
| **Out For Delivery** | En route to customer | Delivery Partner | Yes (live tracking) | No change | Yes (out for delivery + OTP) |
| **Delivered** | OTP verified + COD collected | Delivery Partner | Yes | Consumed final | Yes (delivered + receipt) |
| **Cancelled** | Voided before dispatch | Customer/Support/Admin/System | Yes | Restock **or** spoilage | Yes (+ refund if prepaid) |
| **Return Requested** | Post-delivery complaint raised | Customer | Yes | None yet | Yes (received) |
| **Returned** | Return approved & closed | Support/Admin | Yes | **Spoilage** (not resold) | Yes (+ refund/replace) |
| **Refund Pending** | Refund initiated, awaiting settlement | System/Admin | Yes | — | Yes (refund initiated) |
| **Refunded** | Refund settled | Payments (webhook) | Yes | — | Yes (refund completed) |
| **Failed Delivery** | Attempt unsuccessful (reason-coded) | Delivery Partner | Yes | May → RTS/spoilage | Yes (attempt failed) |
| **Return To Store (RTS)** | Parcel back at store | Delivery Partner/Mgr | Partial | **Spoilage** likely | Yes (as applicable) |

## 7.4 Cross-Module Dependencies

Order Management does not act alone. The dependencies below are the contracts every developer must respect.

```
                            ┌──────────────────────┐
                            │    ORDER MANAGEMENT   │
                            │   (state machine +    │
                            │     lifecycle owner)  │
                            └───────┬───────┬───────┘
             reads/decrements       │       │        assigns / status sync
              stock (kg)            │       │
        ┌───────────────┐          │       │          ┌───────────────┐
        │   INVENTORY   │◄─────────┘       └─────────►│   DELIVERY    │
        │ stock, cut-off│                             │ zones, slots, │
        │ spoilage, wt. │                             │ assignment,OTP│
        └───────────────┘                             └───────────────┘
                    ▲                                          ▲
         capture / refund │                        status → messages │
                    │                                          │
        ┌───────────────┐                             ┌───────────────┐
        │   PAYMENTS    │                             │ NOTIFICATION  │
        │ RZP/PhonePe/  │                             │ CENTER        │
        │ Cashfree/COD  │                             │ SMS/WA/email  │
        └───────────────┘                             └───────────────┘
```

| Depends on | What Order Management needs from it | What it sends back |
|---|---|---|
| **Inventory** | Real-time availability (kg), cut-off status, weight-tolerance recompute | Hard-decrement on confirm; restock on eligible cancel; spoilage on RTS/return |
| **Payments** | Prepaid capture confirmation (webhook), COD eligibility, refund execution | Order `payment_status`, refund triggers, reconciliation records |
| **Delivery** | Partner assignment, pickup/OTP/delivered signals, failed-delivery reasons | `READY` handoff, final amount for COD, reattempt/RTS decisions |
| **Notification Center** | Delivery of SMS/WhatsApp/email/push events | Status-change events that trigger each notification |
| **(supporting)** Customers, Addresses, Coupons, Reports, Audit Logs | Identity, delivery address/zone, discounts, analytics, traceability | Order records, ledger entries, audit trail |

---
---

# CHAPTER 8 — DELIVERY MANAGEMENT (enterprise module)

The Delivery module owns the last mile end-to-end for an own-fleet, hyperlocal, perishable operation. Its job: get the **right `READY` order** to the **right delivery partner** at the **right time**, prove delivery via **OTP**, handle **cash (COD)**, and surface **operational analytics**. This chapter designs three assignment models, a weighted auto-assignment algorithm, OTP verification, Return-To-Store handling, and the dashboard/reports/analytics layer.

## 8.1 Assignment Models

The platform supports three assignment models. Operators can switch modes globally, per-zone, or per-slot, and the **Hybrid** model is the recommended production default.

### 8.1.1 Manual Assignment

The Delivery Manager assigns each `READY` order to a partner by hand from the dispatch board.

```
 READY ORDERS QUEUE                DELIVERY MANAGER               PARTNER
 ┌────────────────┐               ┌────────────────┐            ┌─────────┐
 │ #1021  Zone A  │──drag/select─►│ picks partner  │──assign──► │ accepts │
 │ #1022  Zone A  │               │ using judgment │            │ / declines
 │ #1023  Zone B  │               │ + live map     │            └─────────┘
 └────────────────┘               └────────────────┘
```

| Pros | Cons | Best for |
|---|---|---|
| Full human control; handles VIPs, exceptions, local knowledge | Slow at volume; error-prone; doesn't scale | Low volume, new zones, edge cases |

### 8.1.2 Automatic Assignment

The system scores every eligible partner against each `READY` order using the weighted algorithm (8.2) and assigns the best match with no human step.

```
 READY ORDER ──► SCORING ENGINE ──► RANK PARTNERS ──► AUTO-ASSIGN TOP ──► notify partner
                 (weighted model)    P3 > P1 > P2       (P3)
```

| Pros | Cons | Best for |
|---|---|---|
| Fast, consistent, scales; optimises workload + distance | Needs good data (GPS, availability); blind to nuance | High volume, steady-state peak slots |

### 8.1.3 Hybrid Assignment (recommended default)

The engine **auto-scores and proposes**, but rules route certain orders to a human, and the manager can always override.

```
 READY ORDER ──► SCORING ENGINE ──► CONFIDENCE / RULE CHECK
                                          │
              ┌───────────────────────────┼───────────────────────────┐
              ▼                                                         ▼
   HIGH-CONFIDENCE + normal            LOW-CONFIDENCE / priority / express /
   ▼                                   out-of-band → MANAGER REVIEW QUEUE
   AUTO-ASSIGN top partner                          │
              │                                     ▼
              └────────────► notify ◄──── MANAGER CONFIRMS / OVERRIDES
```

| Pros | Cons | Best for |
|---|---|---|
| Speed of auto + safety of human; exceptions handled well | Slightly more config | **Production default** for Ojiva |

**Routing rules to human queue (examples):** priority/VIP orders, express delivery, no partner above a minimum score, all partners over workload cap, high-value COD, new/low-trust partner, out-of-band weight-adjusted orders.

## 8.2 Auto-Assignment Scoring Algorithm

Each eligible delivery partner is scored against a specific `READY` order. The partner with the **highest total weighted score** wins (subject to hard eligibility gates). This is a **design specification**, not code.

### 8.2.1 Two-stage design: hard gates then soft scoring

```
 STAGE 1 — HARD ELIGIBILITY GATES (pass/fail; fail = excluded)
   ├─ Partner is ON-DUTY and within BUSINESS HOURS
   ├─ Partner's assigned DELIVERY ZONE matches order zone (or adjacent-allowed)
   ├─ Partner AVAILABLE (not over max concurrent load)
   └─ Partner vehicle/cold-bag capacity can carry the order
                         │  (survivors only)
                         ▼
 STAGE 2 — WEIGHTED SOFT SCORE (0–100), rank descending
   Score = Σ (factor_score × weight)
```

### 8.2.2 Scoring factors, weights, and rationale

| # | Factor | Weight | How it scores (0–1 normalised, ×100) | Why it matters |
|---|---|:--:|---|---|
| 1 | **Delivery Zone match** | 25% | Exact zone = 1.0; adjacent allowed zone = 0.6; else gated out | Keeps routes tight; freshness + fuel |
| 2 | **Partner Availability** | 20% | On-duty & idle = 1.0; on-duty & near-cap = 0.4; off = gated | Only assign to someone who can actually go |
| 3 | **Current Workload** | 20% | Inverse of active orders: `1 − (active / max)` | Balances load; prevents one partner overloaded |
| 4 | **Distance (Google Maps)** | 15% | Nearer store→drop or current-location→drop scores higher (decay curve) | Faster delivery, lower cost, fresher goods |
| 5 | **Business Hours fit** | 10% | Full shift remaining = 1.0; near shift-end (can't finish slot) = low/0 | Avoids assigning orders a partner can't complete before off-time |
| 6 | **Priority Orders** | 5% | Boost if partner is high-reliability for priority/VIP/high-COD orders | Route sensitive orders to trusted partners |
| 7 | **Express Delivery** | 5% | Boost partners currently closest / fastest for express SLAs | Meets tighter express promise |
|  | **Total** | **100%** |  |  |

> Weights are **configurable in Settings**; the values above are the recommended launch baseline. Zone, Availability, and Workload dominate (65%) because in a hyperlocal own-fleet model, *who is free, near, and in-zone* matters more than micro-optimising distance.

### 8.2.3 Worked scoring example

Order #1042 — Zone A, standard, COD ₹640, store→drop 3.2 km, slot ends in 90 min.

| Partner | Zone (25) | Avail (20) | Workload (20) | Distance (15) | Hours (10) | Priority (5) | Express (5) | **Total** |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| **P1** | 25 (exact) | 20 (idle) | 14 (1/3 load) | 12 (2.1km) | 10 | 4 | 3 | **88** ◄ win |
| **P2** | 25 (exact) | 8 (near cap) | 6 (2.5/3) | 13 (1.4km) | 9 | 3 | 4 | 68 |
| **P3** | 15 (adjacent) | 20 (idle) | 20 (0 load) | 7 (5.6km) | 6 | 2 | 2 | 72 |

P1 wins on balance of zone + availability + acceptable workload/distance, even though P2 is closer and P3 is idle. This illustrates why a single factor (e.g., nearest) is insufficient.

### 8.2.4 Assignment decision-flow diagram

```
                        ┌─────────────────────┐
                        │  ORDER = READY      │
                        └──────────┬──────────┘
                                   ▼
                        ┌─────────────────────┐
                        │ ASSIGNMENT MODE?    │
                        └───┬───────┬───────┬─┘
                  manual    │       │hybrid │ auto
                     ┌──────┘       │       └──────┐
                     ▼              ▼              ▼
             ┌──────────────┐  ┌──────────┐  ┌──────────┐
             │ MGR PICKS    │  │ SCORE ALL│  │ SCORE ALL│
             │ FROM BOARD   │  │ PARTNERS │  │ PARTNERS │
             └──────┬───────┘  └────┬─────┘  └────┬─────┘
                    │               ▼             │
                    │      ┌──────────────────┐   │
                    │      │ any score ≥ MIN   │   │
                    │      │ AND not priority/  │   │
                    │      │ express/out-of-band│  │
                    │      └───┬───────────┬────┘   │
                    │      no  │           │ yes     │
                    │          ▼           ▼         ▼
                    │   ┌────────────┐  ┌──────────────────┐
                    │   │ MGR REVIEW │  │ AUTO-ASSIGN TOP  │
                    │   │ QUEUE      │  │ PARTNER          │
                    │   └─────┬──────┘  └────────┬─────────┘
                    └─────────┴──────────────────┤
                                                 ▼
                                        ┌──────────────────┐
                                        │ NOTIFY PARTNER   │
                                        └────────┬─────────┘
                                        accept?  │
                                   ┌─────────────┼─────────────┐
                                   ▼ yes                       ▼ decline/timeout
                          ┌──────────────┐            ┌──────────────────┐
                          │ ORDER =      │            │ RE-SCORE (exclude│
                          │ ASSIGNED     │            │ this partner) → next
                          └──────────────┘            └──────────────────┘
```

**Re-assignment loop:** decline/timeout excludes that partner and re-scores the remaining pool. After N failed attempts, the order escalates to the manager review queue (never silently stuck — perishable goods are time-critical).

## 8.3 OTP Verification at Delivery

OTP is the **proof-of-delivery** mechanism and the anchor of COD trust.

```
 ORDER CONFIRMED ──► OTP GENERATED (per order) ──► delivered to customer
                                                    (SMS/WhatsApp on "Out for Delivery")
                                                              │
 PARTNER AT DOORSTEP ──asks customer──► CUSTOMER READS OTP ──►│
                                                              ▼
                                                     ┌─────────────────┐
                                                     │ PARTNER ENTERS  │
                                                     │ OTP IN APP/VIEW │
                                                     └───────┬─────────┘
                                              ┌──────────────┴──────────────┐
                                              ▼ valid                        ▼ invalid
                                    ┌──────────────────┐          ┌────────────────────┐
                                    │ COLLECT COD CASH │          │ RETRY (max 3)       │
                                    │ (if COD)         │          │ then support-verify │
                                    │ MARK DELIVERED   │          │ or FAILED DELIVERY  │
                                    └──────────────────┘          └────────────────────┘
```

| Rule | Detail |
|---|---|
| **Generation** | Unique OTP per order, generated at/near confirmation; not reused |
| **Delivery of OTP** | Sent to customer when order goes **Out For Delivery** (SMS/WhatsApp) |
| **Verification** | Partner enters OTP; server validates; only then can status → Delivered |
| **Retries** | Max 3; then escalation (Customer Support manual verification / alternate confirm) |
| **COD linkage** | Cash is collected **only after** OTP success; amount = final weight-adjusted total |
| **Security** | OTP expiry tied to slot; server-side validation only; attempts logged to Audit Logs |

## 8.4 Return To Store (RTS)

RTS handles the perishable-specific reality that undelivered meat usually cannot be resold.

```
 FAILED DELIVERY (reason-coded)
        │
        ├── reattempt viable (same/next slot)? ──yes──► back to OUT FOR DELIVERY
        │
        ▼ no / window closed
   RETURN TO STORE
        │
        ├─ partner returns parcel + any COD float
        ├─ store receives + scans barcode
        ├─ QC: sellable? (almost always NO for cut meat)
        │        │yes (rare, unopened cold-intact)      │no
        │        ▼                                       ▼
        │   restock kg (exceptional)              SPOILAGE WRITE-OFF (kg, cost, reason)
        ▼
   REFUND LOGIC (prepaid refund / COD nothing-collected / policy fee)
```

| Aspect | Detail |
|---|---|
| **Trigger** | Delivery Partner after exhausted/failed reattempt; confirmed by Delivery Manager |
| **Cash handling** | Any COD float returned; reconciled |
| **Stock effect** | Default **spoilage write-off**; restock only in rare intact-cold-chain cases (manager approval) |
| **Refund** | Prepaid → refund (minus policy fee if customer-fault, per Settings); COD → nothing collected |
| **Analytics** | Feeds failed-delivery rate + spoilage KPIs; repeat-offender customers flagged prepaid-only |

## 8.5 Delivery Dashboard (widgets)

The Delivery Manager's real-time cockpit. Designed for at-a-glance dispatch decisions during peak slots.

| Widget | Shows | Purpose |
|---|---|---|
| **Live order board** | Orders by status (Ready / Assigned / Picked Up / Out for Delivery) | Primary dispatch surface |
| **Unassigned queue** | `READY` orders awaiting a partner (+ auto-score suggestions) | Clear the queue before cut-off |
| **Partner status grid** | Each partner: on-duty, current load, location, last update | Availability + workload at a glance |
| **Live map** | Partner pins + drop pins (Google Maps) | Spatial dispatch decisions |
| **Slot capacity meter** | Orders vs capacity per active slot + cut-off countdown | Prevent slot overbooking |
| **Exceptions panel** | Failed deliveries, OTP retries, RTS, review queue | Fast intervention |
| **COD-in-field tally** | Cash out with partners, pending reconciliation | Cash risk visibility |
| **SLA / ETA alerts** | Orders trending late vs slot promise | Proactive rescue |

## 8.6 Delivery Reports

Operational and financial reporting, scoped by RBAC, exportable.

| Report | Contents | Primary consumer |
|---|---|---|
| **Daily delivery summary** | Delivered / failed / RTS counts, on-time % per slot | Delivery Manager |
| **Partner performance** | Deliveries, avg time, success %, failed %, ratings per partner | Delivery Manager / Admin |
| **COD reconciliation** | Cash expected vs collected vs deposited per partner/day; discrepancies | Finance / Admin |
| **Failed-delivery analysis** | Reason-code breakdown, repeat pincodes/customers | Ops / Support |
| **Spoilage-from-delivery** | RTS-driven wastage (kg, cost) | Inventory / Finance |
| **Zone performance** | Volume, success %, avg distance/time per zone | Admin / Strategy |
| **Slot utilisation** | Capacity used vs available; cut-off breaches | Ops planning |

## 8.7 Delivery Analytics (KPIs)

The KPI set that steers continuous improvement of the last mile.

| KPI | Definition | Target direction | Why it matters |
|---|---|:--:|---|
| **On-Time Delivery %** | Delivered within promised slot ÷ total delivered | ↑ | Core freshness/trust promise |
| **First-Attempt Success %** | Delivered on 1st attempt ÷ total | ↑ | Efficiency + spoilage avoidance |
| **Failed Delivery Rate** | Failed ÷ dispatched | ↓ | Cost + wastage driver |
| **Avg Delivery Time** | Pickup → delivered (mins) | ↓ | Fleet efficiency |
| **Avg Orders / Partner / Slot** | Throughput | ↑ (to healthy cap) | Utilisation without overload |
| **COD Collection Accuracy %** | Reconciled-correct ÷ COD orders | ↑ | Cash-leak control |
| **RTS / Spoilage-from-delivery %** | RTS kg ÷ dispatched kg | ↓ | Perishable loss control |
| **Assignment Acceptance %** | Accepted ÷ offered (auto/hybrid) | ↑ | Health of scoring model |
| **OTP Success Rate %** | OTP-verified 1st try ÷ delivered | ↑ | Process friction indicator |
| **Cost per Delivery** | Fleet cost ÷ deliveries | ↓ | Unit economics |

### 8.7.1 Delivery module cross-dependencies (summary)

| Depends on | For |
|---|---|
| **Orders** | `READY` handoff, status sync, final COD amount |
| **Inventory** | Spoilage write-off on RTS; slot-capacity coupling |
| **Payments** | COD reconciliation; refunds on failed delivery/RTS |
| **Notification Center** | OTP delivery, out-for-delivery/delivered messages |
| **Google Maps** | Distance scoring, live map, ETA |
| **Settings / Roles** | Assignment weights, zones, slots, cut-offs, RBAC scoping |
| **Audit Logs** | Manual assignments, OTP attempts, cash handling |

---

*End of 01 — Business Analysis (Chapters 1, 7, 8). Consistent with `00-PROJECT-BRIEF.md`: Ojiva AI Technologies single-store, Hyderabad hyperlocal, INR, sold-by-weight, COD-heavy, own-fleet, React/Node/TypeScript/PostgreSQL/Prisma/Redis/BullMQ stack, API-first for future mobile apps.*


---

# ═══════════════════════════════════════════════════════
# PART B — TECHNOLOGY & SYSTEM ARCHITECTURE
# ═══════════════════════════════════════════════════════

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


---

# ═══════════════════════════════════════════════════════
# PART C — FOLDER STRUCTURE & MODULES
# ═══════════════════════════════════════════════════════

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


---

# ═══════════════════════════════════════════════════════
# PART D — ROLES, INVENTORY & REPORTS
# ═══════════════════════════════════════════════════════

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


---

# ═══════════════════════════════════════════════════════
# PART E — DATABASE & API PLANNING
# ═══════════════════════════════════════════════════════

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


---

# ═══════════════════════════════════════════════════════
# PART F — UI, DEVELOPMENT PLAN & ROADMAP
# ═══════════════════════════════════════════════════════

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


---

# ═══════════════════════════════════════════════════════
# PART G — DEPLOYMENT (VPS) & CODE STANDARDS
# ═══════════════════════════════════════════════════════

# 07 — DEPLOYMENT (NATIVE VPS, NO DOCKER)

> **Project:** Ojiva AI Technologies — Enterprise E-Commerce Web Application (single-store, fresh-meat cold-chain delivery)
> **Reference:** elitenonveg.com · **Currency:** INR (₹) · **Service area:** Hyderabad (hyperlocal, pincode/zone based)
> **Stack (fixed):** React + Bootstrap 5 (Customer & Admin) · Node + Express + **TypeScript** REST + JWT · PostgreSQL + **Prisma** · Redis · **BullMQ** · S3/Cloudinary
> **Deployment (this chapter):** Single **Ubuntu VPS** · **NGINX** reverse proxy + static serving · **PM2** (cluster) · **PostgreSQL** + **Redis** installed natively on the host · GitHub Actions **SSH deploy** (`git pull` → install → migrate → build → `pm2 reload`). **No Docker, no docker-compose, no containers anywhere.**

---

# CHAPTER 16 — DEPLOYMENT (NATIVE VPS)

## 16.1 Purpose & Philosophy

This chapter is the operational runbook that takes the finished codebase (Chapters 2–15) to a live, monitored, zero-downtime production system on a **single Ubuntu VPS**. Every tier — NGINX, the Node API, the BullMQ worker, PostgreSQL and Redis — runs as a **native OS service** on one machine. There is no container runtime, no image registry, and no orchestration layer.

The rationale (detailed in Chapter 2.2.7) in one line: for a single-store, single-region (Hyderabad) business at Phase-1 volume, native processes under PM2 + NGINX are the **simplest, lowest-overhead, most debuggable** path to a resilient deployment — with a clean, no-rewrite upgrade path to Docker/orchestration if scale ever demands it.

| Principle | What it means operationally |
|-----------|-----------------------------|
| **One box, native services** | `nginx`, `postgresql`, `redis-server` run under systemd; Node processes run under PM2. Managed with standard Linux tooling the team already knows. |
| **NGINX is the only public door** | Only ports 80/443 are open to the internet. Node (`:4000`), PostgreSQL (`:5432`) and Redis (`:6379`) bind to `127.0.0.1` and are never exposed. |
| **Zero-downtime deploys** | `pm2 reload` restarts cluster workers one at a time; a live worker always serves traffic during a deploy. |
| **Idempotent, scripted ops** | Provisioning, deploy, backup and restore are shell scripts in `deployment/scripts/` — repeatable and reviewable, never ad-hoc SSH typing. |
| **Secrets never in git** | Real `.env` files live only on the server (`chmod 600`); the repo carries `.env.*.example` templates only. |
| **Split later, not now** | The same app runs unchanged when Postgres/Redis move to managed instances or when a second VPS joins the NGINX upstream. |

---

## 16.2 Target Server

**Phase 1: one Ubuntu VPS** (Ubuntu 22.04 LTS or 24.04 LTS) sized for the whole stack.

| Resource | Baseline recommendation | Notes |
|----------|-------------------------|-------|
| **vCPU** | 4 cores | PM2 runs one API worker per core; leaves headroom for Postgres/Redis. |
| **RAM** | 8 GB | Postgres shared buffers + Redis + Node cluster + NGINX comfortably fit. |
| **Disk** | 80–160 GB SSD | DB data, media temp, PM2 logs, NGINX logs, OS. Media itself lives in S3/Cloudinary. |
| **Network** | Static public IP, 1 Gbps | DNS A-records point the storefront + admin subdomain here. |
| **Region** | India (Mumbai) | Low latency to the Hyderabad customer base. |

**Splitting to multiple servers later (no app rewrite):**

| Growth signal | Action |
|---------------|--------|
| DB CPU/IO is the bottleneck | Move PostgreSQL to a **managed instance** (or a dedicated DB VPS); update `DATABASE_URL`. |
| Cache/queue contention | Move Redis to a dedicated/managed instance; update `REDIS_URL`. |
| Web tier saturated | Add a second **app VPS**; add it to the NGINX `upstream` block (or put a managed load balancer in front of two NGINX nodes). |
| Read/report load heavy | Add a **Postgres read replica**; point analytics/report queries at it. |

---

## 16.3 Server Topology

```
                                   Internet (customers, admin staff, payment webhooks)
                                                     │
                                             DNS A-records
                            store.example.com  ·  admin.example.com  ·  api.example.com
                                                     │  HTTPS 443 (HTTP 80 → 301 redirect)
                                                     ▼
        ┌──────────────────────────── Ubuntu VPS (single host) ─────────────────────────────┐
        │                                                                                    │
        │   ┌────────────────────────────── NGINX (systemd service) ───────────────────────┐ │
        │   │  TLS termination (Let's Encrypt) · HTTP→HTTPS · gzip · caching · rate-limit   │ │
        │   │                                                                               │ │
        │   │   store.example.com  ─▶ static  /var/www/customer/  (React build, SPA)        │ │
        │   │   admin.example.com  ─▶ static  /var/www/admin/     (React build, SPA)        │ │
        │   │   /api/*             ─▶ reverse-proxy  127.0.0.1:4000  (PM2 cluster)          │ │
        │   └───────────────────────────────────────────┬───────────────────────────────────┘ │
        │                                                │ loopback 127.0.0.1 (private)        │
        │                   ┌────────────────────────────┴───────────────┐                     │
        │                   ▼                                            ▼                      │
        │   ┌───────────────────────────────┐          ┌──────────────────────────────────┐    │
        │   │  PM2 — API (cluster mode)      │          │  PM2 — Worker (BullMQ)           │    │
        │   │  Node+Express+TS  :4000        │          │  notifications · invoices ·      │    │
        │   │  1 process per CPU core        │          │  image jobs · delivery assign    │    │
        │   └───────────────┬───────────────┘          └───────────────┬──────────────────┘    │
        │                   │                                          │                        │
        │        ┌──────────┴──────────────────────────────┬──────────┘                        │
        │        ▼                                          ▼                                   │
        │   ┌─────────────────────────┐          ┌──────────────────────────┐                   │
        │   │ PostgreSQL  :5432 local │          │ Redis  :6379 local       │                   │
        │   │ system of record (ACID) │          │ cache + BullMQ broker    │                   │
        │   └─────────────────────────┘          └──────────────────────────┘                   │
        │                                                                                    │
        │        (external, off-box) ──▶ AWS S3 / Cloudinary CDN  ·  Off-box backup bucket   │
        └────────────────────────────────────────────────────────────────────────────────────┘

   Deploy path: GitHub Actions ──SSH──▶ VPS ──▶ deployment/scripts/deploy.sh (pm2 reload, zero-downtime)
```

**Why two React SPAs are served as static files:** the customer and admin apps compile to static `index.html` + hashed JS/CSS bundles. NGINX serves them directly from `/var/www` (fast, cached, no Node involved). Only `/api/*` calls hit the Node cluster. This keeps the request path for browsing extremely light.

---

## 16.4 Provisioning the Server (step-by-step)

All of the following is codified in `deployment/scripts/setup-server.sh` (run once per fresh VPS). It is documented step-by-step here so an operator understands every action.

### 16.4.1 Users & SSH hardening

| Step | Action | Rationale |
|------|--------|-----------|
| 1 | Create a non-root `deploy` user with sudo | Never deploy or run services as root. |
| 2 | Add the CI/CD and operator **public keys** to `/home/deploy/.ssh/authorized_keys` | Key-based auth only. |
| 3 | In `/etc/ssh/sshd_config`: `PermitRootLogin no`, `PasswordAuthentication no`, `PubkeyAuthentication yes` | Eliminates password brute-force and root login. |
| 4 | (Recommended) move SSH to a non-default port; install **fail2ban** | Cuts automated scanning noise. |
| 5 | `sudo systemctl reload ssh` | Apply hardening. |

### 16.4.2 Firewall (ufw)

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow <ssh-port>/tcp        # SSH (custom port if changed)
sudo ufw allow 80/tcp                # HTTP (Certbot + 301 redirect)
sudo ufw allow 443/tcp               # HTTPS
sudo ufw enable
```

PostgreSQL (5432), Redis (6379) and Node (4000) are **deliberately not opened** — they are reachable only via `127.0.0.1` on the host.

### 16.4.3 Install the runtimes & services

| Component | Install approach | Notes |
|-----------|------------------|-------|
| **Node.js (LTS)** | NodeSource apt repo **or** `nvm` for the `deploy` user (pin via repo `.nvmrc`) | Match the version the app is built/tested against. |
| **PM2** | `npm install -g pm2` | Global process manager. |
| **PostgreSQL** | `sudo apt install postgresql` | Native service under systemd; create app DB + least-privilege role. |
| **Redis** | `sudo apt install redis-server` | Set `supervised systemd`; enable AOF persistence; bind to `127.0.0.1`; set a strong `requirepass`. |
| **NGINX** | `sudo apt install nginx` | Native reverse proxy + static server. |
| **Certbot** | `sudo apt install certbot python3-certbot-nginx` | Let's Encrypt certificates + auto-renewal. |
| **Build essentials** | `git`, `build-essential`, `ufw`, `fail2ban` | Required for `npm ci` native modules and hardening. |

### 16.4.4 Database & cache bootstrap

- Create the application database and a **least-privilege** role (owns only the app schema; no superuser).
- Redis: enable persistence (`appendonly yes`), set `maxmemory` + an eviction policy appropriate for cache keys, and require a password.
- Record `DATABASE_URL` and `REDIS_URL` into the server-side `.env` (see 16.8), never into git.

---

## 16.5 App Layout on the Server

```
/var/www/
├── customer/            # Customer React build (static) — served by NGINX at store.example.com
│   └── (index.html + assets/*.hashed.js|css)
└── admin/               # Admin React build (static) — served by NGINX at admin.example.com

/home/deploy/app/        # Backend + monorepo working tree (git clone)
├── backend/             # Node + Express + TS API (built to dist/)
├── database/            # Prisma schema + migrations
├── shared/              # Shared types/DTOs
├── deployment/
│   ├── nginx/           # customer.conf · admin.conf · api.conf · gzip.conf · rate-limit.conf
│   ├── pm2/ecosystem.config.js
│   └── scripts/         # setup-server.sh · deploy.sh · backup.sh · restore-db.sh · health-check.sh
├── .env                 # REAL backend secrets — chmod 600, NOT in git
└── .env.worker          # REAL worker secrets — chmod 600, NOT in git
```

**Frontend build placement:** the deploy script builds the two React apps and copies (`rsync`) their `dist/` output into `/var/www/customer` and `/var/www/admin`. The backend runs from `/home/deploy/app/backend` under PM2. NGINX config lives in the repo and is symlinked into `/etc/nginx/sites-available` + `/etc/nginx/sites-enabled`.

---

## 16.6 PM2 Process Model

PM2 runs **two logical apps** from one `ecosystem.config.js`: the HTTP **API in cluster mode** (one process per CPU core, load-balanced by PM2 across the cluster) and the **BullMQ worker** as a separate process (so a burst of notification/image jobs never steals CPU from request handling).

```js
// deployment/pm2/ecosystem.config.js  (illustrative — minimal essential config)
module.exports = {
  apps: [
    {
      name: "meat-api",
      cwd: "/home/deploy/app/backend",
      script: "dist/server.js",
      instances: "max",          // one worker per CPU core
      exec_mode: "cluster",      // enables zero-downtime `pm2 reload`
      max_memory_restart: "500M",
      env_file: "/home/deploy/app/.env"
    },
    {
      name: "meat-worker",
      cwd: "/home/deploy/app/backend",
      script: "dist/worker.js",  // BullMQ consumers
      instances: 1,              // scale up if queues back up
      exec_mode: "fork",
      max_memory_restart: "400M",
      env_file: "/home/deploy/app/.env.worker"
    }
  ]
};
```

**Persistence across reboots:** run `pm2 startup` once (generates a systemd unit that resurrects PM2 on boot) and `pm2 save` after the first successful start, so the API + worker come back automatically after any restart.

| PM2 command | Use |
|-------------|-----|
| `pm2 start ecosystem.config.js` | First-time start of API + worker. |
| `pm2 reload meat-api` | **Zero-downtime** rolling restart of the API cluster (used by every deploy). |
| `pm2 restart meat-worker` | Restart the worker (acceptable brief gap; jobs are retried). |
| `pm2 status` / `pm2 logs` / `pm2 monit` | Health, logs, live resource monitoring. |
| `pm2 save` | Persist the current process list for boot resurrection. |

---

## 16.7 NGINX Configuration

NGINX serves the two SPAs as static files, reverse-proxies `/api` to the PM2 cluster, terminates TLS, compresses responses, sets cache headers, and applies SPA fallback (so client-side routes deep-link correctly).

**Customer / admin SPA server block (pattern, `customer.conf`):**

```nginx
server {
    listen 443 ssl http2;
    server_name store.example.com;

    ssl_certificate     /etc/letsencrypt/live/store.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/store.example.com/privkey.pem;

    root /var/www/customer;
    index index.html;

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;

    # Long-cache hashed static assets
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA fallback — client-side routing
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```
*(`admin.conf` is identical with `server_name admin.example.com` and `root /var/www/admin`.)*

**API reverse-proxy server block (`api.conf`):**

```nginx
upstream meat_api { server 127.0.0.1:4000; keepalive 32; }

server {
    listen 443 ssl http2;
    server_name api.example.com;

    ssl_certificate     /etc/letsencrypt/live/api.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.example.com/privkey.pem;

    client_max_body_size 15m;               # product image uploads

    location /api/ {
        limit_req zone=api_zone burst=20 nodelay;   # from rate-limit.conf
        proxy_pass         http://meat_api;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

**HTTP → HTTPS redirect:** a `listen 80` server block per host issues a `301` to `https://`.

**Rate-limit zones (`rate-limit.conf`, in the `http {}` context):** separate zones for login/OTP/checkout/webhook mirror the edge-throttling design in Chapter 3.3.

### 16.7.1 SSL with Let's Encrypt

```bash
sudo certbot --nginx -d store.example.com -d admin.example.com -d api.example.com
```

Certbot installs the certs, wires them into the NGINX blocks, and adds a **systemd timer** that auto-renews (`certbot renew`) and reloads NGINX. Verify renewal with `sudo certbot renew --dry-run`.

---

## 16.8 Environment & Secrets Management

| Rule | Detail |
|------|--------|
| **Templates in git, secrets on server** | Repo ships `deployment/env/.env.*.example` (every key, no values). Real `.env` / `.env.worker` live only in `/home/deploy/app/`, `chmod 600`, owned by `deploy`. |
| **What lives here** | `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`, Razorpay/PhonePe/Cashfree keys + webhook secrets, S3/Cloudinary creds, SMTP/SMS/WhatsApp creds, `NODE_ENV=production`, `PORT=4000`. |
| **Loaded by PM2** | Via `env_file` in `ecosystem.config.js` — the app never reads secrets from anywhere but the server-side file. |
| **Rotation** | Rotating a secret = edit `.env` on the server → `pm2 reload meat-api`. No rebuild, no redeploy. |
| **GitHub side** | CI/CD stores only the **SSH deploy key** and host details as GitHub Actions **encrypted secrets** — never application secrets. |

---

## 16.9 CI/CD — GitHub Actions SSH Deploy

The pipeline is intentionally simple: on merge to the production branch, GitHub Actions **SSHes into the VPS and runs the deploy script**. There is no image build and no registry.

```
┌──────────────┐   push/merge    ┌─────────────────────┐   SSH (deploy key)   ┌──────────────────────┐
│ GitHub repo  │ ───────────────▶│  GitHub Actions job │ ────────────────────▶│  Ubuntu VPS (deploy) │
│ main branch  │                 │  lint · typecheck   │                      │  runs deploy.sh      │
└──────────────┘                 │  test (CI gate)     │                      └──────────┬───────────┘
                                 └─────────────────────┘                                 │
                                                                                         ▼
                     git pull ─▶ npm ci ─▶ prisma migrate deploy ─▶ build (api+SPAs) ─▶ pm2 reload
                                                                              (zero-downtime)
```

**Deploy workflow design (`.github/workflows/deploy.yml`):**

| Stage | Runs on | Action |
|-------|---------|--------|
| **CI gate** | GitHub runner | `npm ci`, ESLint, `tsc --noEmit`, unit/integration tests. Fails the deploy if red. |
| **Deploy** | GitHub runner → SSH | Uses the stored SSH key to connect as `deploy@vps` and execute `deployment/scripts/deploy.sh`. |

**`deployment/scripts/deploy.sh` (steps):**

```bash
#!/usr/bin/env bash
set -euo pipefail
cd /home/deploy/app

git pull --ff-only origin main            # fetch new code
npm ci                                    # install exact locked deps

npx prisma migrate deploy                 # apply pending DB migrations (safe, forward-only)

npm run build --workspace backend         # TS → dist/
npm run build --workspace frontend        # customer SPA → dist/
npm run build --workspace admin           # admin SPA → dist/

rsync -a --delete frontend/dist/ /var/www/customer/
rsync -a --delete admin/dist/    /var/www/admin/

pm2 reload deployment/pm2/ecosystem.config.js --only meat-api   # zero-downtime
pm2 restart meat-worker                                         # pick up new job code
pm2 save
```

**Zero-downtime guarantee:** `pm2 reload` on the clustered API restarts workers one at a time — at least one worker is always accepting connections, so in-flight requests are never dropped during a release.

### 16.9.1 Rollback

Because deploys are Git-driven, rollback is a redeploy of a known-good commit:

```bash
cd /home/deploy/app
git checkout <last-good-commit>     # or: git reset --hard <tag>
npm ci && npm run build --workspace backend
pm2 reload deployment/pm2/ecosystem.config.js --only meat-api
```

| Rollback concern | Handling |
|------------------|----------|
| **Code** | Check out the previous release tag and reload PM2 (seconds). |
| **Database migrations** | Prisma migrations are **forward-only**; write migrations to be **backward-compatible** (expand→migrate→contract) so the previous app version still runs against the new schema during a rollback window. Never destructive-drop in the same release that removes usage. |
| **Frontend** | Previous SPA build is restored by the same checkout + build + rsync. |
| **Fast safety net** | Tag every release (`git tag release-YYYYMMDD-HHMM`) so the last-good target is unambiguous. |

---

## 16.10 Database Migrations in Production

| Aspect | Practice |
|--------|----------|
| **Tool** | `prisma migrate deploy` (applies committed migrations only — never `migrate dev` in prod). |
| **When** | Inside `deploy.sh`, **before** the app build/reload, so schema is ready when new code starts. |
| **Safety** | Expand-and-contract pattern: add columns/tables first (compatible), backfill, switch code, then remove old columns in a **later** release. |
| **Pre-migration backup** | `deploy.sh` can invoke `backup.sh` immediately before `migrate deploy` for a restore point on risky migrations. |
| **Long migrations** | For big backfills, run as a one-off maintenance job/worker rather than blocking the deploy. |

---

## 16.11 Backups, Logs, Monitoring & Hardening

### 16.11.1 Database backups

```bash
# deployment/scripts/backup.sh  (cron: daily + before risky migrations)
pg_dump "$DATABASE_URL" | gzip > /tmp/meat-$(date +%F-%H%M).sql.gz
aws s3 cp /tmp/meat-*.sql.gz s3://ojiva-meat-backups/db/    # off-box, encrypted bucket
```

| Backup control | Setting |
|----------------|---------|
| **Schedule** | Daily `pg_dump` via cron; retain 7 daily + 4 weekly + 3 monthly. |
| **Off-box** | Uploaded to a private S3 bucket (never only on the VPS). |
| **Restore-tested** | `restore-db.sh` periodically validated on a staging DB — an untested backup is not a backup. |
| **PITR (later)** | When volume warrants, add WAL archiving for point-in-time recovery (see Chapter 3.7). |

### 16.11.2 Log rotation

| Source | Rotation |
|--------|----------|
| **PM2 logs** | `pm2-logrotate` module (size + date cap, compression, retention). |
| **NGINX logs** | System `logrotate` (`/etc/logrotate.d/nginx`), daily, compressed, 14–30 day retention. |
| **PostgreSQL logs** | Postgres log rotation + retention tuned to disk. |

### 16.11.3 Monitoring & health

| Signal | Mechanism |
|--------|-----------|
| **App health** | Backend exposes `GET /health` (checks DB + Redis connectivity); NGINX/uptime monitor pings it. |
| **Process health** | `pm2 status` + `pm2 monit`; `max_memory_restart` auto-recycles a leaking worker. |
| **Uptime/alerting** | External uptime monitor (e.g. UptimeRobot / BetterStack) on `store`, `admin`, `api` + TLS-expiry alert. |
| **Queue health** | BullMQ dashboard / metrics for depth, failures, retries. |
| **Resource** | `htop`, `df -h`, and a lightweight node exporter if metrics are centralised later. |

### 16.11.4 Basic hardening checklist

- SSH: key-only, no root, non-default port, `fail2ban`.
- `ufw`: only 80/443 (+ SSH) inbound; DB/Redis/Node bound to loopback.
- Unattended security updates (`unattended-upgrades`).
- NGINX security headers (HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy) + `client_max_body_size` caps.
- Redis `requirepass` + loopback bind; PostgreSQL least-privilege app role.
- Secrets `chmod 600`, owned by `deploy`; TLS auto-renew verified.

---

## 16.12 Deployment Checklist

| # | Item | Owner | Done when |
|---|------|-------|-----------|
| 1 | VPS provisioned (Ubuntu LTS, static IP, DNS A-records) | DevOps | `store`/`admin`/`api` resolve to the VPS |
| 2 | `deploy` user + SSH hardening (key-only, no root, fail2ban) | DevOps | Password/root login rejected |
| 3 | `ufw` firewall (only 80/443 + SSH) | DevOps | `ufw status` shows expected rules |
| 4 | Node + PM2 installed, version pinned | DevOps | `node -v` matches `.nvmrc`; `pm2 -v` works |
| 5 | PostgreSQL installed, app DB + least-priv role, loopback bind | DevOps | App connects via `DATABASE_URL` |
| 6 | Redis installed, AOF + password + loopback bind | DevOps | App connects via `REDIS_URL` |
| 7 | NGINX installed; customer/admin/api server blocks enabled | DevOps | `nginx -t` passes; sites reachable |
| 8 | SSL issued (Certbot) + auto-renew verified | DevOps | HTTPS green; `renew --dry-run` OK |
| 9 | Server-side `.env` / `.env.worker` populated (`chmod 600`) | DevOps | All required keys present, not in git |
| 10 | PM2 ecosystem started (API cluster + worker) | DevOps | `pm2 status` all online |
| 11 | `pm2 startup` + `pm2 save` (survives reboot) | DevOps | Processes return after `sudo reboot` |
| 12 | GitHub Actions deploy workflow + SSH deploy key wired | DevOps | Test deploy runs `deploy.sh` end-to-end |
| 13 | First deploy: migrate + build + reload succeeds | DevOps | Live site serves new build, zero downtime |
| 14 | Rollback tested (checkout prior tag + reload) | DevOps | Previous release restored cleanly |
| 15 | Backups: daily `pg_dump` → S3, restore-tested | DevOps | Restore verified on staging DB |
| 16 | Log rotation (PM2 + NGINX + Postgres) | DevOps | Logs rotate + compress on schedule |
| 17 | Monitoring: `/health`, uptime, TLS-expiry, queue depth | DevOps | Alerts fire on induced failure |
| 18 | Payment webhooks reachable + signature-verified in prod | Backend | Sandbox→live webhook round-trip OK |
| 19 | Serviceability + slot flow verified on real Hyderabad pincodes | QA | End-to-end order placed live |
| 20 | Ops runbook + handover complete | Tech Lead | Client team can deploy + roll back |

---

*End of Chapter 16 — Deployment (Native VPS, No Docker). Consistent with `00-PROJECT-BRIEF.md` (Ojiva AI Technologies, INR, Hyderabad hyperlocal cold-chain, fixed React/Bootstrap/Node/TS/PostgreSQL/Prisma/Redis/BullMQ stack, Phase-1 web-only, API-first) and the native-VPS deployment defined in Chapters 2–3.*


---

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


---

*End of Master Blueprint — Ojiva AI Technologies · Enterprise E-Commerce Web Application*
