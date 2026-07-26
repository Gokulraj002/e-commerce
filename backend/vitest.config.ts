/**
 * Vitest configuration for the Elite NonVeg backend.
 *
 * Single-fork + isolate:false keep every test file in the same Node.js
 * process, so the mocked queue/redis singletons and the Prisma client are
 * created once and shared. That is what makes the test-database migration
 * (registered from `tests/setup.ts`) run exactly once, and lets the
 * `truncateAll()` helper reset state between suites without reconnecting.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: false,
    watch: false,
    // One worker process: safer for a shared test database and lets
    // module-level flags (e.g. `migrated`) persist across files.
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    isolate: false,
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
