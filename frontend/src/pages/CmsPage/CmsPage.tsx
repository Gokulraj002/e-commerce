/**
 * CmsPage — editorial renderer for a single content page.
 *
 * V2 layout:
 *   1. Centred editorial column (max-width 720) with a big Playfair title,
 *      a gold small-caps eyebrow ("ELITE NON VEG") and a thin gold rule
 *      below.
 *   2. Meta row — "Updated <date> · X min read" (reading time is derived
 *      from the content word count / 200 wpm).
 *   3. Body content styled with `.en-prose`: bigger body text, generous
 *      paragraph rhythm, blockquotes with a gold left rule. Content that
 *      already contains HTML is rendered as HTML; plain text is rendered
 *      with preserved whitespace as before.
 *   4. "Related pages" strip — the other stable CMS slugs fetched in
 *      parallel via `useQueries` and rendered as three cards.
 *   5. Fine-print footer — a client-side "Was this helpful?" thumbs
 *      toggle (TODO: wire to backend when the feedback endpoint lands)
 *      and a "Contact support" WhatsApp link built from STORE constants.
 */
import { useQueries } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { STORE } from '@elite/shared';

import { EmptyState, Skeleton } from '@/components/ui';
import { fetchCmsPage, type CmsPageDTO } from '@/features/account/cms.api';
import { useCmsPage } from '@/features/account/useCmsPage';
import { paths } from '@/routes/routes';

/**
 * The public CMS surface only exposes `GET /cms/pages/:slug` — there is no
 * "list pages" endpoint for anonymous visitors — so the related-strip
 * enumerates the storefront's stable, well-known content slugs. Adding a
 * new footer page? Add its slug here to have it appear as a related tile.
 */
const KNOWN_SLUGS: ReadonlyArray<string> = [
  'about',
  'terms',
  'privacy',
  'contact',
];

const READING_WPM = 200;
const MAX_RELATED = 3;

/**
 * Detects HTML-ish content authored via the (eventually rich) admin CMS.
 * Today the admin ships a plain textarea and content is preserved-whitespace
 * prose; treat anything containing a tag as HTML for the future editor.
 */
function isHtmlContent(content: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(content);
}

/** Reading-time estimate in whole minutes (floored at 1). */
function readingTime(content: string): number {
  const words = content
    .replace(/<[^>]+>/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / READING_WPM));
}

interface MetaRowProps {
  updatedAt: string;
  minRead: number;
}

function MetaRow({ updatedAt, minRead }: MetaRowProps): JSX.Element {
  const date = new Date(updatedAt).toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  return (
    <div className="en-cms-v2-meta">
      <span>Updated {date}</span>
      <span className="en-cms-v2-meta__dot" aria-hidden>
        ·
      </span>
      <span>
        {minRead} min read
      </span>
    </div>
  );
}

interface RelatedStripProps {
  currentSlug: string;
}

/**
 * Fetches the other known CMS slugs concurrently and renders any that
 * resolve to a published page. Uses `useQueries` so a stale/404 slug does
 * not blast the whole strip.
 */
function RelatedStrip({ currentSlug }: RelatedStripProps): JSX.Element | null {
  const slugs = useMemo(
    () => KNOWN_SLUGS.filter((s) => s !== currentSlug),
    [currentSlug],
  );

  const results = useQueries({
    queries: slugs.map((slug) => ({
      queryKey: ['cms-page', slug],
      queryFn: () => fetchCmsPage(slug),
      staleTime: 5 * 60_000,
      // If a related page 404s (or is unpublished), swallow so the whole
      // strip does not fall over.
      retry: false,
    })),
  });

  const related: CmsPageDTO[] = results
    .map((r) => r.data)
    .filter((p): p is CmsPageDTO => Boolean(p))
    .slice(0, MAX_RELATED);

  if (related.length === 0) return null;

  return (
    <section className="en-cms-v2-related" aria-labelledby="cms-related-heading">
      <div className="en-cms-v2-related__head">
        <span className="en-cms-v2-eyebrow">Read next</span>
        <h2 id="cms-related-heading" className="en-cms-v2-related__title">
          Related pages
        </h2>
      </div>
      <div className="en-cms-v2-related__grid">
        {related.map((pg) => (
          <Link
            key={pg.id}
            to={paths.cms(pg.slug)}
            className="en-cms-v2-card en-link-reset"
          >
            <span className="en-cms-v2-card__eyebrow">
              {STORE.NAME}
            </span>
            <h3 className="en-cms-v2-card__title">{pg.title}</h3>
            <p className="en-cms-v2-card__meta">
              {readingTime(pg.content)} min read
            </p>
            <span className="en-cms-v2-card__cta" aria-hidden>
              Read →
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

interface FinePrintFooterProps {
  slug: string;
}

/**
 * "Was this helpful?" thumbs + a support WhatsApp link. The thumbs are
 * client-side only (state resets on page change); a follow-up backend
 * endpoint can persist the vote without touching the visual shape.
 */
function FinePrintFooter({ slug }: FinePrintFooterProps): JSX.Element {
  const [vote, setVote] = useState<'up' | 'down' | null>(null);

  // Strip the leading '+' from the STORE constant so wa.me is happy —
  // wa.me requires the international number in digits only.
  const waNumber = STORE.SUPPORT_WHATSAPP.replace(/[^\d]/g, '');
  const waMessage = encodeURIComponent(
    `Hi ${STORE.NAME}, I have a question about the "${slug}" page.`,
  );
  const waHref = `https://wa.me/${waNumber}?text=${waMessage}`;

  return (
    <footer className="en-cms-v2-footer">
      <div className="en-cms-v2-footer__block">
        <span className="en-cms-v2-footer__label">Was this helpful?</span>
        <div className="en-cms-v2-footer__thumbs" role="group" aria-label="Feedback">
          <button
            type="button"
            className={`en-cms-v2-thumb${vote === 'up' ? ' is-active is-up' : ''}`}
            aria-pressed={vote === 'up'}
            onClick={() => setVote((v) => (v === 'up' ? null : 'up'))}
          >
            <span aria-hidden>👍</span>
            <span>Yes</span>
          </button>
          <button
            type="button"
            className={`en-cms-v2-thumb${vote === 'down' ? ' is-active is-down' : ''}`}
            aria-pressed={vote === 'down'}
            onClick={() => setVote((v) => (v === 'down' ? null : 'down'))}
          >
            <span aria-hidden>👎</span>
            <span>No</span>
          </button>
        </div>
        {vote !== null && (
          <span className="en-cms-v2-footer__thanks" role="status">
            Thanks for the feedback.
          </span>
        )}
      </div>

      <a
        className="en-cms-v2-footer__wa"
        href={waHref}
        target="_blank"
        rel="noopener noreferrer"
      >
        <span aria-hidden>💬</span>
        Contact support on WhatsApp
      </a>
    </footer>
  );
}

export default function CmsPage(): JSX.Element {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading, isError } = useCmsPage(slug);

  if (isLoading) {
    return (
      <div className="en-cms-v2">
        <article className="en-cms-v2-article">
          <Skeleton height={20} width="30%" />
          <div className="mt-3">
            <Skeleton height={44} width="80%" />
          </div>
          <div className="mt-3">
            <Skeleton height={16} width="45%" />
          </div>
          <div className="mt-4" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Skeleton height={16} />
            <Skeleton height={16} />
            <Skeleton height={16} width="90%" />
            <Skeleton height={16} width="75%" />
          </div>
        </article>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="en-cms-v2">
        <div className="en-cms-v2-article">
          <EmptyState
            title="Page not found"
            description="That content page doesn't exist or isn't published."
          />
        </div>
      </div>
    );
  }

  const minRead = readingTime(data.content);
  const bodyIsHtml = isHtmlContent(data.content);

  return (
    <div className="en-cms-v2">
      <article className="en-cms-v2-article">
        <span className="en-cms-v2-eyebrow">{STORE.NAME.toUpperCase()}</span>

        <h1 className="en-cms-v2-title">{data.title}</h1>

        <hr className="en-cms-v2-rule" aria-hidden />

        <MetaRow updatedAt={data.updatedAt} minRead={minRead} />

        {bodyIsHtml ? (
          <div
            className="en-prose en-cms-v2-body"
            // Content is authored via the admin CMS and stored as HTML once
            // the editor upgrade lands. For now the seed sends plain text,
            // which the `bodyIsHtml` guard routes to the whitespace branch.
            dangerouslySetInnerHTML={{ __html: data.content }}
          />
        ) : (
          <div
            className="en-prose en-cms-v2-body en-cms-v2-body--pre"
          >
            {data.content}
          </div>
        )}

        <FinePrintFooter slug={data.slug} />
      </article>

      <div className="en-cms-v2-related-wrap">
        <RelatedStrip currentSlug={data.slug} />
      </div>
    </div>
  );
}
