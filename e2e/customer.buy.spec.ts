/**
 * Customer happy path — from home to a placed COD order.
 *
 * Preconditions: backend on :4000, customer web on :5173, DB seeded.
 * See `e2e/README.md` for how to start the servers.
 *
 * Flow (all via the UI except for the one API call that pre-registers the
 * account — the login page itself is not part of the happy path we're covering
 * here, but proving the checkout works end-to-end with a fresh account is):
 *   home → Shop → Chicken Curry Cut PDP → choose 1 kg pack → add to cart →
 *   cart → checkout → add address in Hyderabad 500001 → pick tomorrow slot →
 *   COD → place order → assert Order Confirmed with a fresh order code.
 */
import { expect, installCustomerSession, test } from './helpers/fixtures';

test.describe('customer buy flow', () => {
  test('browse the store, add a product to the cart, and place a COD order', async ({
    page,
    freshCustomer,
  }) => {
    // Sign in the fresh customer before the app boots — hydrates the store's
    // localStorage so the axios interceptor picks up the Bearer token.
    await installCustomerSession(page, freshCustomer.auth);

    // ── 1. Home ────────────────────────────────────────────────────
    await page.goto('/');
    await expect(page.getByRole('link', { name: /^shop fresh cuts$/i }).first()).toBeVisible();

    // ── 2. Click "Shop" → category listing ─────────────────────────
    await page.getByRole('link', { name: /^shop fresh cuts$/i }).first().click();
    await expect(page).toHaveURL(/\/category\//);

    // Wait for the products API to populate the grid before we hunt for a link.
    await page
      .waitForResponse(
        (r) => r.url().includes('/api/v1/catalog/products') && r.request().method() === 'GET',
      )
      .catch(() => undefined); // cached responses may not fire — the visibility wait below covers that

    const productLink = page.getByRole('link', { name: /chicken curry cut/i }).first();
    await expect(productLink).toBeVisible();

    // ── 3. Open the product ────────────────────────────────────────
    await productLink.click();
    await expect(page).toHaveURL(/\/product\/chicken-curry-cut/);
    await expect(page.getByRole('heading', { name: /chicken curry cut/i })).toBeVisible();

    // ── 4. Change weight variant (default is smallest in-stock; pick 1 kg) ──
    const kilo = page.getByRole('radio', { name: /1\s*kg/i });
    await expect(kilo).toBeVisible();
    await kilo.click();
    await expect(kilo).toHaveAttribute('aria-checked', 'true');

    // ── 5. Add to cart — wait for the POST to complete ─────────────
    // Note: the button text flips to "✓ Added to cart" only for ~1.8s, so we
    // rely on the network response (and the cart contents on the next page)
    // for confirmation rather than a text assertion that could race the timer.
    const [addResponse] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/v1/cart/items') && r.request().method() === 'POST',
      ),
      page.getByRole('button', { name: /^add to cart$/i }).click(),
    ]);
    expect(addResponse.ok()).toBeTruthy();

    // ── 6. Open cart ───────────────────────────────────────────────
    await page.goto('/cart');
    await expect(page.getByRole('heading', { name: /^your cart$/i })).toBeVisible();
    await expect(page.getByText(/chicken curry cut/i).first()).toBeVisible();

    // ── 7. Proceed to checkout ─────────────────────────────────────
    await page.getByRole('button', { name: /proceed to checkout/i }).click();
    await expect(page).toHaveURL(/\/checkout/);
    await expect(page.getByRole('heading', { name: /^checkout$/i })).toBeVisible();

    // ── 8. Fresh customer has no addresses → open the address form ─
    await page.getByRole('button', { name: /add a new address/i }).click();

    // Prefilled fields (name/phone from the signed-in user). Fill/overwrite as
    // needed, then use pincode 500001 (in the seeded Hyderabad Central zone).
    await page.getByLabel('Label').fill('Home');
    await page.getByLabel('Full name').fill(freshCustomer.auth.user.name);
    // Backend accepts +91 or bare 10-digit; the form input is a plain number field.
    const bareTenDigit = freshCustomer.phone.replace(/^\+91/, '');
    await page.getByLabel('Phone').fill(bareTenDigit);
    await page.getByLabel('Address line 1').fill('10 Playwright Lane, Gachibowli');
    await page.getByLabel('City').fill('Hyderabad');

    // Wait for the pincode's serviceability check to succeed — the "Save
    // address" button stays disabled until then.
    const pincodeInput = page.getByLabel('Pincode');
    await pincodeInput.fill('500001');
    await expect(page.getByText(/we deliver here/i)).toBeVisible();

    // ── 9. Save address (POST /users/addresses) ────────────────────
    const [addressResponse] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/v1/users/addresses') && r.request().method() === 'POST',
      ),
      page.getByRole('button', { name: /save address/i }).click(),
    ]);
    expect(addressResponse.ok()).toBeTruthy();

    // The new address auto-selects; the form closes and the address radio list
    // is shown. Wait for the delivery date buttons to render (they only show
    // once an address is selected).
    const tomorrowButton = page.getByRole('button', { name: /^tomorrow$/i });
    await expect(tomorrowButton).toBeVisible();

    // ── 10. Pick tomorrow — its slot cutoffs are always in the future ──
    await tomorrowButton.click();
    // Slot chips render after the /delivery/slots?date=... call resolves.
    // We only want an enabled one.
    const availableSlot = page
      .getByRole('button', { name: /Tomorrow.*(AM|PM)/i, disabled: false })
      .first();
    await expect(availableSlot).toBeVisible();
    await availableSlot.click();

    // ── 11. COD is the default payment method; verify + place order ────
    const codRadio = page.getByRole('radio', { name: /cash on delivery/i });
    await expect(codRadio).toBeChecked();

    const [placeResponse] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/v1/checkout/place') && r.request().method() === 'POST',
      ),
      page.getByRole('button', { name: /^place order$/i }).click(),
    ]);
    expect(placeResponse.ok()).toBeTruthy();

    // ── 12. Order Confirmed — check the URL and the visible order code ──
    await expect(page).toHaveURL(/\/order\/[^/]+\/success$/);
    await expect(page.getByRole('heading', { name: /order confirmed/i })).toBeVisible();

    const urlMatch = page.url().match(/\/order\/([^/]+)\/success$/);
    const orderCode = urlMatch?.[1];
    expect(orderCode, 'expected an order code in the success URL').toBeTruthy();

    // The success page renders the code inside a <code> tag ("Your order <code>…</code>").
    await expect(page.locator('code').filter({ hasText: orderCode as string }).first()).toBeVisible();
  });
});
