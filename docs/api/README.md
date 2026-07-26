# Elite NonVeg — API Collection

REST reference index and Postman collection for the `@elite/backend` service.

- **Base URL (local):** `http://localhost:4000/api/v1`
- **Prefix override:** `env.API_PREFIX` (default `/api/v1`).
- **Response envelope:** every response is `{ success: boolean, data?: T, message?: string, code?: string, details?: unknown }`.
- **Auth header:** `Authorization: Bearer <accessToken>` — obtain via `POST /auth/login`.
- **Content type:** `application/json`.

## Import into Postman

1. Open Postman → **Import** → **Choose file** → select
   [`postman-collection.json`](postman-collection.json).
2. The collection ships two variables:
   - `baseUrl` (default `http://localhost:4000/api/v1`)
   - `accessToken` (populated by the "Login" request's test script — see the
     script attached to that request)
3. Run **Auth → Login (email)** with a seeded admin (`admin@elitenonveg.in` /
   `Admin@123`) or **Auth → Login (phone)** with a customer
   (`+919000000010` / `Customer@123`). The test script writes
   `accessToken` and `refreshToken` back to the collection.
4. Subsequent requests use `{{accessToken}}` as the bearer.

Every request in the collection has sample bodies that match the Zod schemas in
the backend — dates in ISO-8601, money in paise, weight in grams.

## Endpoint coverage (in the collection)

The API surface is broader than the Postman collection — the collection focuses
on the core customer + admin flows so integrators can smoke-test end-to-end.
The full route inventory lives in `backend/src/routes/index.ts`.

| Group        | Requests                                                                                       |
| ------------ | ---------------------------------------------------------------------------------------------- |
| Health       | `GET /health`                                                                                  |
| Auth         | Register · Login (phone) · Login (email) · Refresh · Logout · Me                                |
| Catalog      | List products · List categories · Featured · Get product by slug                                |
| Cart         | Get · Add item · Update item · Remove item · Clear · Apply coupon · Remove coupon              |
| Wishlist     | Get · Add item · Remove item · Move to cart                                                     |
| Coupons      | Validate                                                                                        |
| Checkout     | Summary · Place order                                                                           |
| Orders       | List (customer) · Get by code (customer) · Cancel                                               |
| Payments     | Init · Verify · Razorpay webhook · PhonePe webhook · Cashfree webhook                           |
| Delivery     | Serviceability · Slots                                                                          |

## API prefix map

Cross-reference of every mounted prefix in `backend/src/routes/index.ts`:

| Prefix              | Router                       | Access                                                                 |
| ------------------- | ---------------------------- | ---------------------------------------------------------------------- |
| `/health`           | health                       | Public                                                                 |
| `/auth`             | auth                         | Public (`/register`, `/login`, `/refresh`, `/logout`) + Bearer (`/me`) |
| `/catalog`          | catalog                      | Public reads · staff writes                                            |
| `/cart`             | cart                         | Bearer (any authenticated user)                                        |
| `/wishlist`         | wishlist                     | Bearer                                                                  |
| `/coupons`          | coupon                       | Public `/validate` · staff CRUD                                        |
| `/checkout`         | checkout                     | Bearer                                                                  |
| `/orders`           | order                        | Bearer (customer) · staff for `/admin/all` and status transitions      |
| `/payments`         | payment                      | Bearer for `/init`, `/verify`; webhooks are unauth (signature-checked) |
| `/delivery`         | delivery                     | Public serviceability/slots · zone/dispatch admin · partner driver-app |
| `/inventory`        | inventory                    | Staff-only (Super Admin, Admin, Inventory Manager, Store Manager)      |
| `/reviews`          | review                       | Public reads · Bearer writes · staff moderation                        |
| `/users`            | user                         | Bearer profile + address book; staff customer listing                  |
| `/cms`              | cms                          | Public pages/banners; staff CRUD                                       |
| `/settings`         | settings                     | `/public` unauth; admin read/write                                     |
| `/notifications`    | notification                 | Bearer                                                                  |
| `/dashboard`        | dashboard                    | Staff-only                                                              |

## Error format

Every error response uses the same envelope:

```json
{
  "success": false,
  "message": "Human-readable summary",
  "code": "STABLE_ERROR_CODE",
  "details": { "fieldErrors": { "phone": ["Enter a valid Indian mobile number"] } }
}
```

Codes worth knowing: `VALIDATION_ERROR` (400 from Zod), `UNAUTHORIZED` (401),
`FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409, includes Prisma `P2002`),
`INTERNAL` (500 fallback).
