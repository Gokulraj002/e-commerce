# PROJECT BRIEF — Shared Context (read before writing any chapter)

> This file is the single source of truth about the business and tech stack.
> Every chapter author MUST stay consistent with these facts. Do NOT invent
> a different business, city, currency, or tech stack.

## Company
- **Company:** Ojiva AI Technologies
- **Project:** Enterprise E-Commerce Web Application (single-store)
- **Reference site analyzed:** https://elitenonveg.com/

## What the business actually is (from reference site analysis)
A **fresh non-veg (meat) delivery e-commerce** — a single-store, cold-chain,
perishable-goods D2C business. NOT a marketplace, NOT WordPress/Shopify/Magento.
Fully custom web app.

### Products & Categories
- **Poultry:** Chicken (boneless, breast, tenders, biryani cuts, curry cuts), Quails, Kadaknath chicken
- **Mutton / Goat:** Boti, boneless, biryani cuts, curry cuts
- **Seafood:** Fish (freshwater & seawater e.g. Seer fish), Prawns, Crabs, Scampi
- **Eggs**
- **Ready-to-Cook / Marinated**
- **Bulk / Wholesale orders** (B2B)

### Commercial facts
- **Currency:** INR (₹). Sample prices ₹79 (quail cuts) → ₹1,590 (seer fish).
- Products sold **by weight** (250g / 500g / 1kg packs) → weight-based variants are core.
- **Offers:** "Flat up to 20% off", **free shipping over ₹699**.
- **Ordering channels:** Website + WhatsApp (+91 7989020944).
- **Fulfilment:** Cold-chain / refrigerated packaging, pre-cut & cleaned.
- **Service area:** Hyderabad region (hyperlocal, pincode/zone based delivery).
- **Positioning:** No antibiotics, no hormones, no chemicals; freshness & hygiene.
- **Accounts:** Login/registration, membership plans, wishlist, product compare.

### Perishable-goods implications the blueprint MUST reflect
- Same-day / next-slot **delivery-slot booking** (not courier shipping).
- **Zone / pincode serviceability** check before checkout.
- Stock is in **kg/grams**, decremented by weight; cut-off times per slot.
- **Cash On Delivery** is important in the Indian meat-delivery market.
- Weight variance at packing → order total may adjust slightly (weight tolerance).
- Delivery is **hyperlocal own-fleet** ("delivery boy"), not 3rd-party logistics in Phase 1.

## Tech Stack (fixed — do not substitute)
- **Customer Web:** React.js, Bootstrap 5, React Router, Axios, React Hook Form, TanStack Query
- **Admin Panel:** React.js, Bootstrap 5, Chart.js, React Table
- **Backend:** Node.js, Express.js, **TypeScript**, REST APIs, JWT auth
- **DB:** PostgreSQL · **ORM:** Prisma · **Cache:** Redis · **Queue:** BullMQ
- **Storage:** AWS S3 or Cloudinary
- **Deploy:** **Native VPS (NO Docker)** — Ubuntu VPS + NGINX (reverse proxy) + PM2 (Node process manager) + PostgreSQL + Redis installed directly on the server. GitHub + CI/CD via SSH deploy (GitHub Actions → SSH → git pull → build → `pm2 reload`). **Do not use Docker / docker-compose anywhere.**
- **Payments:** Razorpay, PhonePe, Cashfree, Cash On Delivery
- **Maps:** Google Maps · **Notifications:** SMTP Email, SMS Gateway, WhatsApp API, Firebase Push (future)

## Scope
- **Phase 1 = Web only** (Customer Website + Admin Panel + Backend APIs).
- **NOT in Phase 1:** Android app, iOS app, Delivery Boy app (they consume the same APIs later).
- Architecture must be **API-first** so future mobile apps reuse the backend.

## Master module list (canonical names — use these everywhere)
Authentication, Dashboard, Products, Categories, Brands, Attributes, Variants,
Inventory, Warehouse, Customers, Addresses, Cart, Wishlist, Coupons, Checkout,
Orders, Payments, Delivery, Reports, Reviews, CMS, Settings, Roles, Permissions,
Logs, Audit Logs, Notification Center.

## Canonical roles (RBAC)
Super Admin, Admin, Store Manager, Inventory Manager, Delivery Manager,
Customer Support, Delivery Partner, Customer.

## Code-quality mandate (non-negotiable requirement)
The client's #1 engineering priority is a **clean, well-maintained codebase**:
- **No unwanted / dead / commented-out code lines.** Every line must earn its place.
- **Proper folder + file + component structure** — small, single-responsibility,
  reusable components; feature-based backend modules; consistent naming.
- **DRY** — shared logic lives in shared utils/hooks/services, never copy-pasted.
- Enforced by **ESLint + Prettier + TypeScript strict**, PR review checklist, and
  a documented folder/component convention every developer follows.
This is treated as a first-class deliverable, not an afterthought.

## Writing style for all chapters
- Write as a Senior Enterprise Solution Architect. Professional, decisive.
- **No code.** Design only. Use Markdown tables and ASCII flow diagrams.
- Explain every decision and every cross-module dependency.
- Be detailed enough that developers can start immediately.
- **Deployment is native VPS — never mention Docker/containers.**
