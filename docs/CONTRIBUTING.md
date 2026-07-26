# Contributing — Elite NonVeg

Welcome. This guide covers day-to-day workflow rules. Detailed engineering
standards live in
[docs/blueprint/08-code-standards.md](blueprint/08-code-standards.md) — that
chapter wins if any other document conflicts with it on structure or naming.

- **Language:** TypeScript strict, ESM. No `any`, no unused locals/params (ESLint enforces).
- **Money & weight:** integer paise / integer grams. The server owns pricing math.
- **Shared contracts:** every enum, DTO, and Zod schema that crosses the API boundary lives in `@elite/shared`. Do not redefine them per app.
- **Formatting:** Prettier + ESLint. Run `npm run format` before committing.

---

## 1. Branch naming

`<type>/<short-slug>` — lower-kebab-case.

| Prefix       | Use for                                              |
| ------------ | ---------------------------------------------------- |
| `feat/`      | New user-visible feature or endpoint.                 |
| `fix/`       | Bug fix.                                             |
| `refactor/`  | Internal restructuring — no behaviour change.        |
| `docs/`      | Docs / README / comments only.                       |
| `chore/`     | Tooling, deps, scripts, CI.                          |
| `test/`      | Adding or refactoring tests.                         |

Example: `feat/wishlist-move-to-cart`, `fix/cart-coupon-percent-rounding`,
`chore/bump-prisma-5.19`.

Base every branch off the latest `main`. Never push directly to `main`; it is
protected.

---

## 2. Commit style — Conventional Commits

`<type>(<scope>): <subject>` — imperative present tense, no trailing period,
≤72 chars.

| Type       | Meaning                                       |
| ---------- | --------------------------------------------- |
| `feat`     | User-visible feature.                         |
| `fix`      | Bug fix.                                      |
| `refactor` | Structural change, no behaviour change.       |
| `perf`     | Performance improvement.                      |
| `test`     | Test additions/changes.                       |
| `docs`     | Documentation only.                           |
| `chore`    | Build / tooling / dependencies / CI.          |
| `style`    | Whitespace, formatting, no code change.       |
| `build`    | Build system or external deps.                |
| `ci`       | Workflow / pipeline change.                   |

Scope is the module or package touched: `auth`, `cart`, `payment`,
`admin/products`, `frontend/checkout`, `shared`, `prisma`, `deploy`. Examples:

- `feat(cart): support flat coupons on subtotal`
- `fix(payment): dedupe razorpay webhook events by id`
- `refactor(delivery): extract haversine into its own helper`
- `docs(readme): add seeded login credentials`
- `chore(prisma): add index on orders.status`

Body (optional) explains *why*; wrap at 72. Reference issues at the bottom:
`Fixes #123`.

---

## 3. Pull-request checklist

Copy this into the PR description and tick each item before requesting review.
The full expectation is codified in
[docs/blueprint/08-code-standards.md](blueprint/08-code-standards.md#chapter-17).

- [ ] Branch is up to date with `main`; no merge commits (rebased).
- [ ] Small, single-purpose change (split otherwise).
- [ ] No `any`, no dead code, no commented-out blocks, no `console.log`.
- [ ] Money handled as paise; weight as grams. No client-side pricing math.
- [ ] Public request / response shapes use DTOs from `@elite/shared`.
- [ ] New request bodies / query strings have Zod schemas in `*.schema.ts`.
- [ ] Errors are thrown as `ApiError.<kind>(...)` — never `res.status(...).json(...)` for errors.
- [ ] All new routes protected with `requireAuth` / `requireRole` where appropriate.
- [ ] Prisma migration checked in (`prisma/migrations/<timestamp>_...`); `prisma:deploy` is safe on a live DB.
- [ ] `npm run lint`, `npm run typecheck`, `npm run build` pass locally.
- [ ] `npm run format` has been run.
- [ ] Screenshots or a short recording attached for UI changes.
- [ ] Env-var additions documented in [docs/DEPLOY.md](DEPLOY.md#environment-variables) and [.env.example](../.env.example).
- [ ] Docs updated (`README.md`, module guide, API collection) where behaviour changes.

CI must be green before merge — branch protection expects `Lint`, `Typecheck`,
`Build (backend|frontend|admin)`, and `Backend tests`.

---

## 4. Adding a new backend module

Reference: [backend/MODULE_GUIDE.md](../backend/MODULE_GUIDE.md) — the canonical
authoring guide.

1. Scaffold `backend/src/modules/<name>/` with the six files
   (`.routes.ts`, `.controller.ts`, `.service.ts`, `.repository.ts`, `.schema.ts`,
   `.types.ts`). Copy `modules/health/health.routes.ts` as the reference pattern.
2. Wire the router into `backend/src/routes/index.ts`
   (`apiRouter.use('/<prefix>', <name>Router)`).
3. Put Zod schemas in `<name>.schema.ts`. Reuse `@elite/shared` schemas
   (`registerSchema`, `addressSchema`, etc.) where they already exist.
4. Business logic goes in the service. Prisma access goes only in the repository.
   Throw `ApiError.*` — never format errors in the controller.
5. Add / extend Prisma models in `backend/prisma/schema.prisma`, then run
   `npm --workspace backend run prisma:migrate` — commit the generated
   migration folder.
6. Extend `@elite/shared` with any enums, DTOs, or Zod contracts consumed by
   the frontend or admin.
7. Add sample requests to `docs/api/postman-collection.json` so QA / integrators
   can exercise it.
8. If admin surface is needed, register a nav entry in
   `admin/src/components/layout/nav.config.ts` (see the admin guide below).

---

## 5. Adding a new customer page

Reference: [frontend/FRONTEND_GUIDE.md](../frontend/FRONTEND_GUIDE.md) — full
patterns, design system, and the feature-folder rule.

1. Create `frontend/src/pages/<Name>/<Name>.tsx` with a default export
   returning `JSX.Element`. Replace the `PageStub` body.
2. Register the route: add the path to `ROUTES` in
   `frontend/src/routes/routes.ts`, add a typed builder in `paths`, and add
   a `<Route>` in `AppRouter.tsx`. Link only via `paths.foo(id)`, never a raw
   string.
3. Put feature logic (API calls, react-query hooks, cross-page state) in
   `frontend/src/features/<feature>/`. The page composes UI primitives
   (`@/components/ui`) with the feature's hooks.
4. Use the design tokens in `src/styles/_tokens.scss` — never hardcode hex.
5. Never do money math in the client. Format with `formatPaise`, `formatWeight`,
   or drop in the `<Price>` primitive. All totals come from the API.
6. Respect `prefers-reduced-motion` (already handled globally).

---

## 6. Adding a new admin page

Reference: [admin/ADMIN_GUIDE.md](../admin/ADMIN_GUIDE.md).

1. Add the route constant to `admin/src/routes/paths.ts` and a `<Route>` in
   `AppRouter.tsx`. Guard admin-only sub-trees with
   `<ProtectedRoute roles={[ROLES.SUPER_ADMIN, ROLES.ADMIN]} />`.
2. Register the sidebar entry in
   `admin/src/components/layout/nav.config.ts` — include `roles` for
   restricted items and `matchPrefix` for detail routes.
3. Create the feature folder `admin/src/features/<domain>/` with
   `<domain>.api.ts`, `<domain>.schema.ts` (Zod), and optional
   `<domain>.queries.ts` for react-query hooks.
4. Build the page in `admin/src/pages/<Name>/<Name>.tsx` — default export.
   Compose `PageHeader` + `DataTable` for list views, `Drawer` for inline
   create/edit, `ConfirmModal` for destructive actions.
5. Use the shared `api` client (`admin/src/lib/apiClient.ts`) — it returns the
   unwrapped payload and handles silent refresh on 401.
6. Convert rupee input to paise with `rupeesToPaise` before POSTing.
7. Keep `npm --workspace admin run typecheck` green.
