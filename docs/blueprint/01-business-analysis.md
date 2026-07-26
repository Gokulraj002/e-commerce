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
