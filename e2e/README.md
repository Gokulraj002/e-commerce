# Elite NonVeg — End-to-end tests

Playwright-driven happy-path tests for the two flows that matter most:

- **`customer.buy.spec.ts`** — a shopper lands on the home page, opens a
  product, changes the weight variant, adds it to the cart, checks out with
  COD, and lands on the Order Confirmed page with a fresh order code.
- **`admin.fulfill.spec.ts`** — a super-admin opens the freshly-placed order
  and walks it through `CREATED → CONFIRMED → PACKING → READY`, asserting the
  status badge updates each step.

The tests use **real dev servers**. They never spawn or restart them — see
[Running the tests](#running-the-tests). Preconditions are seeded via the
backend REST API (`POST /auth/register`, `POST /users/addresses`,
`POST /checkout/place`, etc.) so tests are self-contained and re-runnable.

## Prerequisites (one-time)

1. **Node 20+** installed (workspace already requires it).
2. **PostgreSQL** running locally and `backend/.env` pointing at it (copy
   `.env.example`).
3. **Redis** running locally (used by the cart / catalog cache).
4. From the repo root:
   ```bash
   npm install              # installs @playwright/test into devDependencies
   npx playwright install   # downloads the browser binaries once per machine
   ```

## Seed the database

The tests expect the seed data — the super-admin account, the featured product
`chicken-curry-cut`, the `500001` delivery pincode, and today/tomorrow slots:

```bash
npm run seed --workspace backend
```

`seed.ts` is idempotent, so it's safe to re-run any time you suspect the
fixtures drifted.

## Start the three dev servers

The tests do **not** start these — open three terminals and leave them
running:

| Terminal | Command                | Port | What it serves            |
|----------|------------------------|------|---------------------------|
| 1        | `npm run dev:backend`  | 4000 | REST API at `/api/v1`     |
| 2        | `npm run dev:frontend` | 5173 | Customer web (React+Vite) |
| 3        | `npm run dev:admin`    | 5174 | Admin panel (React+Vite)  |

The Playwright config uses `webServer.reuseExistingServer: true` and only
prints an actionable error if it can't reach any of the three URLs — it never
tries to spawn a dev server on your behalf.

## Running the tests

From the repo root:

```bash
npm run e2e         # headless run, HTML report at e2e/report/index.html
npm run e2e:ui      # Playwright UI mode — great for debugging
```

Direct Playwright CLI works too:

```bash
npx playwright test                       # all tests, all projects
npx playwright test --project=chromium    # desktop Chrome only
npx playwright test customer.buy.spec.ts  # one file
npx playwright show-report e2e/report     # open the last report
```

### Projects

Two Playwright projects run against the same suite:

- `chromium` — Desktop Chrome, 1440×900.
- `mobile-chrome` — Pixel 7 emulation, touch-first.

## Environment variables

All variables are optional — sensible defaults from the seed are used.

| Variable              | Default                     | Notes                                                                                                    |
|-----------------------|-----------------------------|----------------------------------------------------------------------------------------------------------|
| `E2E_ADMIN_EMAIL`     | `admin@elitenonveg.in`      | Staff account used by `admin.fulfill.spec.ts` (matches the seed).                                        |
| `E2E_ADMIN_PASSWORD`  | `Admin@123`                 | Password for the above (matches the seed).                                                               |
| `E2E_CUSTOMER_PHONE`  | *random valid Indian mobile* | Pin a specific phone. Leave unset for parallel/repeated runs so each run gets a brand-new account.       |
| `E2E_API_BASE_URL`    | `http://localhost:4000/api/v1` | Backend base for fixture calls (register, addresses, slots, place order).                             |
| `E2E_CUSTOMER_URL`    | `http://localhost:5173`     | Customer web `baseURL`.                                                                                  |
| `E2E_ADMIN_URL`       | `http://localhost:5174`     | Admin panel `baseURL` (the admin spec pins this via `test.use`).                                          |

## Files

- `playwright.config.ts` — project + reporter config, `baseURL`, `webServer`.
- `e2e/helpers/fixtures.ts` — API helpers (register, admin login, seed order)
  and the `freshCustomer` Playwright fixture.
- `e2e/customer.buy.spec.ts` — customer happy path.
- `e2e/admin.fulfill.spec.ts` — admin fulfilment happy path.
- `e2e/report/` — HTML report output (generated).
- `e2e/test-results/` — traces, screenshots, videos on failure (generated).

## Troubleshooting

- **`[e2e] … is not running`** — one of the dev servers isn't listening. Start
  it in the terminal shown in the message and re-run the tests.
- **`No products found — did you run the seed?`** — the fixture couldn't find
  `chicken-curry-cut`. Run `npm run seed --workspace backend`.
- **`No available delivery slot on YYYY-MM-DD`** — seed slots may have expired
  their cutoff. Re-run the seed; it regenerates today+tomorrow slots.
- **Test flakes on `.getByLabel('Full name')`** — you probably have another
  address form open (a stale AddressForm from a previous run in UI mode).
  Reset the app tab and re-run.
