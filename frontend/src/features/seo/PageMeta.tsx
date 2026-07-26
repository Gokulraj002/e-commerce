/**
 * Lightweight per-page SEO tag setter — no external dep (no react-helmet).
 *
 * Imperatively syncs `document.title`, `<meta name="description">`,
 * `<link rel="canonical">`, and the corresponding OpenGraph tags whenever the
 * props change. Missing tags are created; existing ones are updated in place.
 *
 * Renders nothing.
 */
import { useEffect } from 'react';

import { SEO_DEFAULTS, type PageMetaProps } from './seoDefaults';

/** Find or create a `<meta>` tag by attribute and set its `content`. */
function upsertMeta(attr: 'name' | 'property', key: string, content: string): void {
  const selector = `meta[${attr}="${key}"]`;
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

/** Find or create the `<link rel="canonical">` tag and set its `href`. */
function upsertCanonical(href: string): void {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

/** Resolve a relative canonical to an absolute URL using window.location.origin. */
function absoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
}

/**
 * Drop `<PageMeta {...} />` at the top of a page component. Prefer the helpers
 * from `seoDefaults.ts` (e.g. `productSeo(name, slug)`) so brand copy stays
 * consistent instead of being hand-written per page.
 */
export function PageMeta({
  title,
  description,
  canonical,
  ogTitle,
  ogDescription,
}: PageMetaProps): null {
  useEffect(() => {
    document.title = title;
    upsertMeta('name', 'description', description);

    const effectiveOgTitle = ogTitle ?? title;
    const effectiveOgDesc = ogDescription ?? description;

    upsertMeta('property', 'og:title', effectiveOgTitle);
    upsertMeta('property', 'og:description', effectiveOgDesc);
    upsertMeta('property', 'og:site_name', SEO_DEFAULTS.siteName);
    upsertMeta('property', 'og:type', 'website');

    if (canonical) {
      const abs = absoluteUrl(canonical);
      upsertCanonical(abs);
      upsertMeta('property', 'og:url', abs);
    }
  }, [title, description, canonical, ogTitle, ogDescription]);

  return null;
}
