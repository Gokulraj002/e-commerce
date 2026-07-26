/**
 * Vitest setup — shared by every backend test file.
 *
 * Responsibilities (in order):
 *   1. Load `backend/.env` so any DATABASE_URL / secrets configured for local
 *      dev are available BEFORE `src/config/env.ts` is imported.
 *   2. Force the env to a safe test profile:
 *        - `DATABASE_URL` is set to `DATABASE_URL_TEST` if provided, otherwise
 *          the developer's `DATABASE_URL` with `schema=test` forced on it.
 *          The fallback keeps the test schema isolated from `public`.
 *        - JWT secrets, REDIS_URL and CORS defaults are stubbed so
 *          `env.ts`'s Zod validation passes.
 *   3. Replace `src/lib/queue.ts` and `src/lib/redis.ts` with in-memory stubs
 *      via `vi.mock` — importing app modules must NOT open a Redis socket.
 *   4. Run `prisma migrate deploy` once against the test database (idempotent
 *      when nothing to apply). Gated on DATABASE_URL_TEST so we never touch
 *      the developer's dev database by accident.
 *   5. Export helpers: `truncateAll()` (per-test cleanup) and `buildApp()`
 *      (fresh Express app for supertest).
 *
 * Any suite that hits Postgres must be gated with
 *   `describe.skipIf(!process.env.DATABASE_URL_TEST)`
 * so `vitest run` still succeeds on machines without a test DB.
 */
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import { afterAll, beforeAll, vi } from 'vitest';

// ── Paths ───────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const testsDir = path.dirname(__filename);
const backendDir = path.resolve(testsDir, '..');

// 1. Load backend/.env so DATABASE_URL/SECRETS on disk are picked up before
//    we derive the test DB URL. dotenv never overrides an existing value, so
//    a CI env or shell export still wins.
dotenv.config({ path: path.join(backendDir, '.env') });

// 2. Force a safe test profile. Assign directly for values we want to own,
//    use `??=` for anything the developer/CI may have already set.
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET ??= 'test_access_secret_change_me_only_for_vitest';
process.env.JWT_REFRESH_SECRET ??= 'test_refresh_secret_change_me_only_for_vitest';
process.env.JWT_ACCESS_EXPIRES ??= '15m';
process.env.JWT_REFRESH_EXPIRES ??= '7d';
process.env.REDIS_URL ??= 'redis://localhost:6379';
process.env.CORS_ORIGINS ??= 'http://localhost:5173';
process.env.API_PREFIX ??= '/api/v1';
process.env.FREE_SHIPPING_THRESHOLD ??= '699';

function deriveTestDatabaseUrl(): string | undefined {
  if (process.env.DATABASE_URL_TEST) return process.env.DATABASE_URL_TEST;
  const base = process.env.DATABASE_URL;
  if (!base) return undefined;
  try {
    const url = new URL(base);
    url.searchParams.set('schema', 'test');
    return url.toString();
  } catch {
    return undefined;
  }
}

const testDbUrl = deriveTestDatabaseUrl();
if (testDbUrl) {
  process.env.DATABASE_URL = testDbUrl;
} else if (!process.env.DATABASE_URL) {
  // Give env.ts a syntactically-valid URL so pure-unit-test files can boot
  // even when no test DB is configured. Nothing will actually connect
  // because the DB suites are gated on DATABASE_URL_TEST.
  process.env.DATABASE_URL =
    'postgresql://placeholder:placeholder@localhost:5432/placeholder';
}

/** Only run DB migrations + DB tests when the test DB is explicitly opted in. */
const hasTestDb = Boolean(process.env.DATABASE_URL_TEST);

// 3. Stub infra singletons BEFORE any app module imports them. `vi.mock` is
//    hoisted per file; because this setup file is loaded by every worker,
//    every subsequent module import sees the stub.
vi.mock('../src/lib/queue.js', () => ({
  QUEUES: {
    NOTIFICATIONS: 'notifications',
    DELIVERY_ASSIGN: 'delivery-assign',
    INVOICE: 'invoice',
    REPORTS: 'reports',
  },
  queueConnection: {},
  getQueue: () => ({
    add: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('../src/lib/redis.js', () => {
  const store = new Map<string, string>();
  return {
    redis: {
      get: async (k: string) => store.get(k) ?? null,
      set: async (k: string, v: string) => {
        store.set(k, v);
        return 'OK';
      },
      del: async (...keys: string[]) => {
        let removed = 0;
        for (const k of keys) if (store.delete(k)) removed++;
        return removed;
      },
      ping: async () => 'PONG',
    },
  };
});

// 4. Migrate the test DB. Guarded by a module-level flag so the (idempotent
//    but slow) `npx prisma migrate deploy` runs exactly once per worker.
let migrated = false;

beforeAll(() => {
  if (!hasTestDb || migrated) return;
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: process.env,
    cwd: backendDir,
  });
  migrated = true;
});

afterAll(async () => {
  if (!hasTestDb) return;
  const { prisma } = await import('../src/lib/prisma.js');
  await prisma.$disconnect();
});

// 5. Helpers exposed to test files.

/**
 * Truncate every user table in the CURRENT postgres schema (the one the
 * Prisma URL points at). Called from `beforeEach` in DB-touching suites so
 * each test starts from an empty DB. `_prisma_migrations` is preserved so we
 * do not have to re-apply migrations.
 */
export async function truncateAll(): Promise<void> {
  const { prisma } = await import('../src/lib/prisma.js');
  await prisma.$executeRawUnsafe(`
    DO $$ DECLARE
      r RECORD;
    BEGIN
      FOR r IN (
        SELECT tablename FROM pg_tables
         WHERE schemaname = current_schema()
           AND tablename <> '_prisma_migrations'
      ) LOOP
        EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' RESTART IDENTITY CASCADE';
      END LOOP;
    END $$;
  `);
}

/**
 * Build a fresh Express app for a suite. `createApp()` returns a new Express
 * instance every call — the underlying Prisma client and mocked queue/redis
 * singletons are shared across the whole worker, which is what we want.
 */
export async function buildApp() {
  const { createApp } = await import('../src/app.js');
  return createApp();
}
