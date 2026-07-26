/**
 * Brand + per-route SEO defaults for `<PageMeta>`.
 *
 * The brand defaults are the fall-back for anything unset on a page. Each
 * per-route helper returns a `PageMetaProps` object ready to spread into
 * `<PageMeta {...} />` at the top of the corresponding page component.
 */
import { STORE } from '@elite/shared';

export interface PageMetaProps {
  /** Full <title>. Composed via `formatTitle` when only a page name is given. */
  title: string;
  description: string;
  /** Absolute or root-relative canonical URL for this page. */
  canonical?: string;
  /** Overrides the OpenGraph title (defaults to `title`). */
  ogTitle?: string;
  /** Overrides the OpenGraph description (defaults to `description`). */
  ogDescription?: string;
}

/** Brand-wide fallbacks. Do not put page-specific copy here. */
export const SEO_DEFAULTS = {
  siteName: STORE.NAME,
  city: STORE.CITY,
  titleSuffix: `${STORE.NAME} — Premium Fresh Meat, Delivered in ${STORE.CITY}`,
  description: `Elite NonVeg — premium fresh chicken, mutton, seafood & eggs, delivered across ${STORE.CITY}. Antibiotic-free, hand-cut to order, on an unbroken cold chain.`,
} as const;

/**
 * Compose a page title like `Chicken curry cut · Elite NonVeg`. The suffix is
 * stable across pages so the brand always trails the specific-most first.
 */
export function formatTitle(pageTitle: string): string {
  return `${pageTitle} · ${SEO_DEFAULTS.siteName}`;
}

// ─── Per-route helpers ─────────────────────────────────────────

export function homeSeo(): PageMetaProps {
  return {
    title: SEO_DEFAULTS.titleSuffix,
    description: SEO_DEFAULTS.description,
    canonical: '/',
  };
}

export function categorySeo(name: string, slug: string): PageMetaProps {
  return {
    title: formatTitle(`${name} — Fresh cuts delivered`),
    description: `Shop premium ${name.toLowerCase()} from ${SEO_DEFAULTS.siteName}. Hand-cut to order, delivered fresh across ${SEO_DEFAULTS.city}.`,
    canonical: `/category/${slug}`,
  };
}

export function productSeo(
  name: string,
  slug: string,
  shortDesc?: string | null,
): PageMetaProps {
  const description =
    shortDesc?.trim() ||
    `${name} from ${SEO_DEFAULTS.siteName}. Antibiotic-free, hand-cut to order and delivered fresh across ${SEO_DEFAULTS.city}.`;
  return {
    title: formatTitle(name),
    description,
    canonical: `/product/${slug}`,
  };
}

export function cartSeo(): PageMetaProps {
  return {
    title: formatTitle('Your cart'),
    description: `Review your ${SEO_DEFAULTS.siteName} cart and check out for same-day fresh meat delivery in ${SEO_DEFAULTS.city}.`,
    canonical: '/cart',
  };
}

export function checkoutSeo(): PageMetaProps {
  return {
    title: formatTitle('Checkout'),
    description: `Complete your ${SEO_DEFAULTS.siteName} order — fresh meat, delivered on an unbroken cold chain across ${SEO_DEFAULTS.city}.`,
    canonical: '/checkout',
  };
}

export function membershipSeo(): PageMetaProps {
  return {
    title: formatTitle('Elite Club membership'),
    description: `Join Elite Club for member pricing, priority delivery slots and premium cuts, curated by the ${SEO_DEFAULTS.siteName} team.`,
    canonical: '/membership',
  };
}

export function loginSeo(): PageMetaProps {
  return {
    title: formatTitle('Sign in'),
    description: `Sign in to ${SEO_DEFAULTS.siteName} to track orders, manage addresses and check out faster.`,
    canonical: '/login',
  };
}

export function registerSeo(): PageMetaProps {
  return {
    title: formatTitle('Create an account'),
    description: `Create a ${SEO_DEFAULTS.siteName} account for same-day fresh meat delivery, saved addresses and Elite Club perks.`,
    canonical: '/register',
  };
}

export function accountSeo(): PageMetaProps {
  return {
    title: formatTitle('My account'),
    description: `Manage your ${SEO_DEFAULTS.siteName} profile, orders, addresses and preferences.`,
    canonical: '/account',
  };
}
