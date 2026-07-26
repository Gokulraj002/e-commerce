# Backend Module Authoring Guide (read before writing any module)

Every feature lives in `src/modules/<name>/` and follows the **same 6-file anatomy**.
Thin controllers, fat services, Prisma only in repositories. No business logic in
routes or controllers. No `any`. All money = paise (Int), weight/stock = grams (Int).

```
src/modules/<name>/
├── <name>.routes.ts       # Express Router. Wires paths → controller. Applies auth/validate middleware.
├── <name>.controller.ts   # (req,res) → calls service → ok()/created(). No logic, no Prisma.
├── <name>.service.ts      # Business logic. Throws ApiError. Calls repository + other services.
├── <name>.repository.ts   # Prisma queries ONLY. Returns plain data.
├── <name>.schema.ts       # Zod schemas for body/query/params.
└── <name>.types.ts        # Module-local TS types (optional).
```

### Rules
- Export the router as `export const <name>Router` (already imported in `src/routes/index.ts`).
- Use shared helpers: `ok`, `created`, `asyncHandler`, `parsePagination` from `utils/http.ts`.
- Throw `ApiError.badRequest/unauthorized/forbidden/notFound/conflict` — never `res.status(...).json` for errors.
- Protect routes with `requireAuth` + `requireRole(...)` from `middlewares/auth.ts`.
- Validate input with `validate(schema, 'body'|'query'|'params')` from `middlewares/validate.ts`.
- Import enums/DTOs from `@elite/shared` — do not redefine them.
- Import the singleton `prisma` from `lib/prisma.js`, `redis` from `lib/redis.js`.
- Map Prisma entities → shared DTOs before returning to clients (never leak `passwordHash`).
- ESM imports use the `.js` extension (e.g. `import { prisma } from '../../lib/prisma.js'`).

### Reference implementation
See `src/modules/health/health.routes.ts` for the canonical style.

### Response envelope (fixed)
Success: `{ success: true, data, message? }`
Error:   `{ success: false, message, code, details? }`
