/**
 * Admin happy path — fulfil a customer order through the first three staff
 * transitions (CREATED → CONFIRMED → PACKING → READY).
 *
 * Preconditions: backend on :4000, admin panel on :5174, DB seeded.
 * See `e2e/README.md` for how to start the servers.
 *
 * We seed the order via API (fresh customer + address + slot + cart + COD
 * checkout) so the test is fully self-contained: no dependency on any UI test
 * running first, no assumption about existing orders in the DB. Then we log
 * in as super-admin, open the order in the admin panel, and drive the status
 * dropdown three times, asserting the status badge updates each step.
 *
 * COD orders start at CREATED (non-COD start at PENDING_PAYMENT, which
 * transitions to CREATED after payment). The three linear staff steps that
 * follow are CONFIRMED → PACKING → READY.
 */
import {
  expect,
  installAdminSession,
  loginAsSuperAdmin,
  seedCodOrder,
  test,
} from './helpers/fixtures';

const ADMIN_BASE_URL = process.env.E2E_ADMIN_URL ?? 'http://localhost:5174';

// The admin panel is served on a different port than the customer app —
// override the default baseURL for this whole spec.
test.use({ baseURL: ADMIN_BASE_URL });

const STATUS_STEPS = ['CONFIRMED', 'PACKING', 'READY'] as const;

/** SNAKE → Snake — matches `humanizeStatus` in the admin UI. */
function humanize(status: string): string {
  return status
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

test.describe('admin order fulfillment', () => {
  test('super-admin can advance a COD order CREATED → CONFIRMED → PACKING → READY', async ({
    page,
    request,
  }) => {
    // ── 1. Seed an order via API (bypasses the customer UI for speed) ──
    const { code } = await seedCodOrder(request);

    // ── 2. Log in as super-admin and install tokens for the admin app ──
    const adminSession = await loginAsSuperAdmin(request);
    await installAdminSession(page, adminSession.tokens);

    // ── 3. Navigate straight to the Orders list (sidebar link exists but is
    //      not always visible on narrow viewports — direct nav is robust). ──
    await page.goto('/sales/orders');
    await expect(page.getByRole('heading', { name: /^orders$/i })).toBeVisible();

    // ── 4. Search for the seeded order so the row is unambiguous ──
    await page.getByPlaceholder(/search by code/i).fill(code);

    const row = page.locator('tr', { has: page.getByText(code, { exact: true }) });
    await expect(row).toBeVisible();

    // ── 5. Open the order detail ──
    await row.click();
    await expect(page).toHaveURL(new RegExp(`/sales/orders/${code}$`));
    await expect(page.getByRole('heading', { name: new RegExp(`Order ${code}`, 'i') })).toBeVisible();

    // The page-header badge starts at CREATED for a COD order.
    const headerBadge = page.locator('.ui-page-header .ui-badge').first();
    await expect(headerBadge).toHaveText(/created/i);

    // ── 6. Walk CREATED → CONFIRMED → PACKING → READY ──
    for (const status of STATUS_STEPS) {
      const nextStatusSelect = page.getByLabel(/^next status$/i);
      await nextStatusSelect.selectOption(status);

      const [statusResponse] = await Promise.all([
        page.waitForResponse(
          (r) =>
            /\/api\/v1\/orders\/[^/]+\/status$/.test(r.url()) &&
            r.request().method() === 'PATCH',
        ),
        page.getByRole('button', { name: /^update$/i }).click(),
      ]);
      expect(statusResponse.ok()).toBeTruthy();

      // Header badge (in .ui-page-header) reflects the new status.
      const expected = humanize(status);
      await expect(headerBadge).toHaveText(new RegExp(`^${expected}$`, 'i'));

      // The Change-Status card's select resets to the empty placeholder after
      // a successful update; wait for that before the next iteration.
      await expect(nextStatusSelect).toHaveValue('');
    }

    // Final sanity check: the badge is on READY.
    await expect(headerBadge).toHaveText(/ready/i);
  });
});
