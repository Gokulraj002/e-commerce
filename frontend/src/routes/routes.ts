/**
 * Central route path constants + typed URL builders.
 * Never hardcode a path string in a component — import from here so links and
 * route definitions can never drift apart.
 */
export const ROUTES = {
  HOME: '/',
  CATEGORY: '/category/:slug',
  PRODUCT: '/product/:slug',
  CART: '/cart',
  CHECKOUT: '/checkout',
  ORDER_SUCCESS: '/order/:code/success',
  MEMBERSHIP: '/membership',

  // Account area (nested under /account)
  ACCOUNT: '/account',
  ORDERS: '/account/orders',
  ORDER_TRACKING: '/account/orders/:code/track',
  WISHLIST: '/account/wishlist',
  ADDRESSES: '/account/addresses',

  // Auth
  LOGIN: '/login',
  REGISTER: '/register',

  // Content
  CMS: '/pages/:slug',

  // Search
  SEARCH: '/search',

  // Curated meal boxes (client-side hard-coded today — see
  // frontend/src/features/collections/collections.data.ts).
  COLLECTIONS: '/collections',
  COLLECTION_DETAIL: '/collections/:slug',

  NOT_FOUND: '*',
} as const;

/** Typed helpers that fill in path params — prefer these over string templates. */
export const paths = {
  home: (): string => '/',
  category: (slug: string): string => `/category/${slug}`,
  product: (slug: string): string => `/product/${slug}`,
  cart: (): string => '/cart',
  checkout: (): string => '/checkout',
  orderSuccess: (code: string): string => `/order/${code}/success`,
  membership: (): string => '/membership',
  account: (): string => '/account',
  orders: (): string => '/account/orders',
  orderTracking: (code: string): string => `/account/orders/${code}/track`,
  wishlist: (): string => '/account/wishlist',
  addresses: (): string => '/account/addresses',
  login: (): string => '/login',
  register: (): string => '/register',
  cms: (slug: string): string => `/pages/${slug}`,
  /**
   * Search results page. `q` is optional so callers can link to a bare
   * `/search` too; when provided it is URL-encoded.
   */
  search: (q?: string): string =>
    q && q.length > 0 ? `/search?q=${encodeURIComponent(q)}` : '/search',
  /** Landing page for curated meal boxes. */
  collections: (): string => '/collections',
  /** Detail page for a single curated meal box. */
  collection: (slug: string): string => `/collections/${slug}`,
};
