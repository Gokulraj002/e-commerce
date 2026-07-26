import { defineConfig, devices } from '@playwright/test';

/**
 * Elite NonVeg — Playwright end-to-end tests.
 *
 * The customer web app (5173) is the default `baseURL`; the admin spec pins
 * its own `baseURL` via `test.use({ baseURL: 'http://localhost:5174' })`.
 *
 * We DO NOT auto-start the dev servers. Every `webServer` entry uses
 * `reuseExistingServer: true` and a no-op-with-hint command so Playwright uses
 * whatever's already listening and fails fast (with an actionable message) if
 * it isn't. See `e2e/README.md` for how to start the three servers.
 */

const CUSTOMER_BASE_URL = process.env.E2E_CUSTOMER_URL ?? 'http://localhost:5173';
const ADMIN_BASE_URL = process.env.E2E_ADMIN_URL ?? 'http://localhost:5174';
const API_URL = process.env.E2E_API_BASE_URL ?? 'http://localhost:4000/api/v1';

/**
 * Playwright's `webServer` schema requires `command`. When the URL check
 * succeeds, `reuseExistingServer: true` short-circuits and `command` never
 * runs. When the URL check FAILS (a dev server we depend on isn't up),
 * Playwright runs this command — we print an actionable message and exit
 * non-zero so the failure surfaces early.
 *
 * The command uses a single-quoted shell argument to safely embed the
 * JSON-stringified message (which is itself double-quoted). None of the
 * substituted values contain single quotes, so this is shell-safe.
 */
function requireServerHint(name: string, startCommand: string): string {
  const message = `[e2e] ${name} is not running. Start it in another terminal: ${startCommand}. See e2e/README.md.`;
  return `node -e 'console.error(${JSON.stringify(message)}); process.exit(1)'`;
}

export default defineConfig({
  testDir: 'e2e',
  testMatch: /.*\.spec\.ts/,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [
    ['html', { outputFolder: 'e2e/report', open: 'never' }],
    ['list'],
  ],
  outputDir: 'e2e/test-results',

  use: {
    baseURL: CUSTOMER_BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
    },
  ],

  // Three servers must already be running. reuseExistingServer=true means
  // Playwright checks each URL first and only runs `command` (which fails fast
  // with an actionable message) when nothing is listening.
  webServer: [
    {
      command: requireServerHint('Backend API', 'npm run dev:backend'),
      url: `${API_URL}/health`,
      reuseExistingServer: true,
      timeout: 10_000,
    },
    {
      command: requireServerHint('Customer web app', 'npm run dev:frontend'),
      url: CUSTOMER_BASE_URL,
      reuseExistingServer: true,
      timeout: 10_000,
    },
    {
      command: requireServerHint('Admin panel', 'npm run dev:admin'),
      url: ADMIN_BASE_URL,
      reuseExistingServer: true,
      timeout: 10_000,
    },
  ],
});
