/**
 * Shared helpers + Playwright test fixtures for the Elite NonVeg e2e suite.
 *
 * Every helper talks to the backend directly at `${API_BASE}` (not through the
 * Vite proxy) so tests can arrange preconditions (fresh customer, seeded order,
 * admin session) without walking the UI. The Playwright `test` re-export adds
 * a `freshCustomer` fixture — a just-registered account that tests can inject
 * into `localStorage` to skip the login page.
 */
import {
  test as base,
  expect,
  type APIRequestContext,
  type Page,
} from '@playwright/test';

// ── Config ─────────────────────────────────────────────────────────

export const API_BASE = process.env.E2E_API_BASE_URL ?? 'http://localhost:4000/api/v1';
export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@elitenonveg.in';
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'Admin@123';

// ── Envelope + typed HTTP wrappers ─────────────────────────────────

interface Envelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

type Headers = Record<string, string>;

function authHeader(token?: string): Headers {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiPost<T>(
  request: APIRequestContext,
  path: string,
  body: unknown,
  token?: string,
): Promise<T> {
  const res = await request.post(`${API_BASE}${path}`, {
    data: body,
    headers: { 'Content-Type': 'application/json', ...authHeader(token) },
  });
  if (!res.ok()) {
    throw new Error(`POST ${path} failed: ${res.status()} ${await res.text()}`);
  }
  const env = (await res.json()) as Envelope<T>;
  return env.data;
}

async function apiGet<T>(
  request: APIRequestContext,
  path: string,
  token?: string,
): Promise<T> {
  const res = await request.get(`${API_BASE}${path}`, { headers: authHeader(token) });
  if (!res.ok()) {
    throw new Error(`GET ${path} failed: ${res.status()} ${await res.text()}`);
  }
  const env = (await res.json()) as Envelope<T>;
  return env.data;
}

// ── Domain shapes (structural — no dependency on the backend types) ─

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface UserDTO {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  role: string;
  isMember: boolean;
  createdAt: string;
}

export interface AuthPayload {
  user: UserDTO;
  tokens: AuthTokens;
}

export interface VariantSummary {
  id: string;
  sku: string;
  weightG: number;
  pricePaise: number;
  mrpPaise: number;
  inStock: boolean;
}

export interface ProductSummary {
  id: string;
  slug: string;
  name: string;
  variants: VariantSummary[];
}

export interface AddressDTO {
  id: string;
  label: string;
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  pincode: string;
  isDefault?: boolean;
}

export interface DeliverySlotDTO {
  id: string;
  label: string;
  date: string;
  startTime: string;
  endTime: string;
  available: boolean;
  cutoffAt: string;
}

interface PlaceOrderResult {
  order: { id: string; code: string; status: string };
  paymentMethod: string;
  requiresPaymentInit: boolean;
}

// ── Random data ────────────────────────────────────────────────────

/**
 * Return a phone number for a fresh registration.
 *
 * Order of precedence:
 *   1. `E2E_CUSTOMER_PHONE` env var (useful for pinning a specific test user)
 *   2. A random, valid Indian mobile number (+91 6-9…) — the default so each
 *      test run gets a brand-new account, avoiding "phone already registered".
 */
export function randomIndianPhone(): string {
  const pinned = process.env.E2E_CUSTOMER_PHONE?.trim();
  if (pinned) return pinned;
  const first = String(6 + Math.floor(Math.random() * 4)); // 6-9
  let rest = '';
  for (let i = 0; i < 9; i += 1) rest += String(Math.floor(Math.random() * 10));
  return `+91${first}${rest}`;
}

// ── High-level helpers ─────────────────────────────────────────────

export interface CustomerAccount {
  auth: AuthPayload;
  phone: string;
  password: string;
}

export interface RegisterOptions {
  name?: string;
  phone?: string;
  email?: string;
  password?: string;
}

/**
 * Register a brand-new customer via `POST /auth/register` and return the
 * server-issued session (user + tokens). Phone defaults to a random valid
 * Indian mobile so parallel or repeated runs don't collide.
 */
export async function registerFreshCustomer(
  request: APIRequestContext,
  opts: RegisterOptions = {},
): Promise<CustomerAccount> {
  const phone = opts.phone ?? randomIndianPhone();
  const password = opts.password ?? 'E2ePass!12345';
  const name = opts.name ?? 'E2E Buyer';
  const body: Record<string, string> = { name, phone, password };
  if (opts.email) body.email = opts.email;
  const auth = await apiPost<AuthPayload>(request, '/auth/register', body);
  return { auth, phone, password };
}

/** Log in as the seeded super-admin (or the credentials passed in). */
export async function loginAsSuperAdmin(
  request: APIRequestContext,
  email: string = ADMIN_EMAIL,
  password: string = ADMIN_PASSWORD,
): Promise<AuthPayload> {
  return apiPost<AuthPayload>(request, '/auth/login', { email, password });
}

/**
 * Fetch a sample product for the store. Prefers `chicken-curry-cut` (a stable,
 * featured seed product); if that call fails, falls back to the featured rail
 * so the tests keep working if the seed evolves.
 */
export async function getSampleProduct(
  request: APIRequestContext,
  preferredSlug = 'chicken-curry-cut',
): Promise<ProductSummary> {
  try {
    return await apiGet<ProductSummary>(request, `/catalog/products/${preferredSlug}`);
  } catch {
    const featured = await apiGet<ProductSummary[]>(request, '/catalog/products/featured');
    if (featured.length === 0) {
      throw new Error('No products found — did you run the seed? (npm run seed --workspace backend)');
    }
    return featured[0];
  }
}

// ── Address / slot / cart / checkout — used by the admin test to seed data ─

export async function createDeliverableAddress(
  request: APIRequestContext,
  token: string,
  overrides: Partial<AddressDTO> = {},
): Promise<AddressDTO> {
  const body = {
    label: overrides.label ?? 'Home',
    name: overrides.name ?? 'E2E Buyer',
    phone: overrides.phone ?? '+919812345678',
    line1: overrides.line1 ?? '10 Playwright Lane',
    line2: overrides.line2,
    city: overrides.city ?? 'Hyderabad',
    pincode: overrides.pincode ?? '500001',
    isDefault: true,
  };
  return apiPost<AddressDTO>(request, '/users/addresses', body, token);
}

/** Return `YYYY-MM-DD` for a Date in local time — matches the checkout page. */
export function ymd(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

export async function firstAvailableSlot(
  request: APIRequestContext,
  date: string,
  pincode?: string,
): Promise<DeliverySlotDTO> {
  const query = pincode ? `?date=${date}&pincode=${pincode}` : `?date=${date}`;
  const slots = await apiGet<DeliverySlotDTO[]>(request, `/delivery/slots${query}`);
  const found = slots.find((s) => s.available);
  if (!found) {
    throw new Error(
      `No available delivery slot on ${date}${pincode ? ` for ${pincode}` : ''} — reseed to refresh slots.`,
    );
  }
  return found;
}

export async function addToServerCart(
  request: APIRequestContext,
  token: string,
  variantId: string,
  quantity = 1,
): Promise<void> {
  await apiPost(request, '/cart/items', { variantId, quantity }, token);
}

export async function placeCodOrder(
  request: APIRequestContext,
  token: string,
  addressId: string,
  slotId: string,
): Promise<PlaceOrderResult> {
  return apiPost<PlaceOrderResult>(
    request,
    '/checkout/place',
    { addressId, slotId, paymentMethod: 'COD' },
    token,
  );
}

export interface SeededOrder {
  code: string;
  customer: CustomerAccount;
}

/**
 * One-shot: register a fresh customer, add an address, put one product in the
 * cart, and place a COD order. Returns the human order code so the admin test
 * can locate the order in the orders list.
 *
 * Uses TOMORROW as the delivery date so the slot cutoffs (06:00 / 16:00) are
 * always in the future regardless of when the test runs today.
 */
export async function seedCodOrder(request: APIRequestContext): Promise<SeededOrder> {
  const customer = await registerFreshCustomer(request);
  const token = customer.auth.tokens.accessToken;

  const product = await getSampleProduct(request);
  const variant = product.variants.find((v) => v.inStock) ?? product.variants[0];
  if (!variant) {
    throw new Error(`Product ${product.slug} has no variants — cannot seed an order.`);
  }

  const address = await createDeliverableAddress(request, token, {
    name: customer.auth.user.name,
    phone: customer.phone,
  });

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const slot = await firstAvailableSlot(request, ymd(tomorrow), address.pincode);

  await addToServerCart(request, token, variant.id, 1);
  const placed = await placeCodOrder(request, token, address.id, slot.id);

  return { code: placed.order.code, customer };
}

// ── Page session installers (localStorage keys the apps read on boot) ─

/**
 * Seed the customer webapp's `authStore` so the given page is signed in from
 * the very first navigation. Must be called BEFORE the first `page.goto(...)`.
 *
 * The customer webapp persists `{ user, tokens }` under the `elite.auth` key
 * (see `frontend/src/features/auth/authStore.ts`); reading that on module
 * load is what makes the axios client attach a Bearer token to every request.
 */
export async function installCustomerSession(page: Page, auth: AuthPayload): Promise<void> {
  const snapshot = JSON.stringify({ user: auth.user, tokens: auth.tokens });
  await page.addInitScript((serialized: string) => {
    window.localStorage.setItem('elite.auth', serialized);
  }, snapshot);
}

/**
 * Seed the admin panel's tokenStore. The admin `AuthProvider` calls `GET
 * /auth/me` on boot; a staff role there flips the app to "authenticated" and
 * unlocks protected routes (see `admin/src/lib/tokenStore.ts`).
 */
export async function installAdminSession(page: Page, tokens: AuthTokens): Promise<void> {
  await page.addInitScript((t: AuthTokens) => {
    window.localStorage.setItem('elite.admin.accessToken', t.accessToken);
    window.localStorage.setItem('elite.admin.refreshToken', t.refreshToken);
  }, tokens);
}

// ── Playwright test.extend ─────────────────────────────────────────

interface E2EFixtures {
  freshCustomer: CustomerAccount;
}

export const test = base.extend<E2EFixtures>({
  freshCustomer: async ({ request }, use) => {
    const customer = await registerFreshCustomer(request);
    await use(customer);
  },
});

export { expect };
