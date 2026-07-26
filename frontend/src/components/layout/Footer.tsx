/**
 * Footer v2 — a 4-band premium footer.
 *
 * Bands (top → bottom):
 *   1. Newsletter capture — full-bleed crimson-tinted row with an inline
 *      email + Subscribe button (client-side only for now; on submit we
 *      surface a friendly toast). TODO(backend): POST to /marketing/newsletter.
 *   2. Main columns — 5-col grid ≥lg → 2-col grid <lg → accordion <md.
 *   3. Trust strip — 4 half-size trust items reused from the home strip.
 *   4. Fine print — copyright, "made in Hyderabad" line, social ghost buttons.
 *
 * All internal links flow through `paths.*`. Routes that don't exist yet
 * fall back to `#` with a `TODO(routes)` marker so link-checking is trivial.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { z } from 'zod';

import { STORE } from '@elite/shared';

import { Button, useToast } from '@/components/ui';
import { paths } from '@/routes/routes';

// ── Static footer content ────────────────────────────────────
// Kept as module constants so the render function is pure composition.

interface FooterLink {
  label: string;
  to: string;
}

// TODO(routes): the customer-facing site does not yet ship dedicated
// pages for /careers, /blog, /press, /contact, /delivery-info, /shipping,
// /refund or /bulk. Point to `#` for now so search engines don't chase
// broken URLs — swap for `paths.*` when the routes land.
const SHOP_LINKS: ReadonlyArray<FooterLink> = [
  { label: 'Chicken', to: paths.category('chicken') },
  { label: 'Mutton', to: paths.category('mutton') },
  { label: 'Seafood', to: paths.category('seafood') },
  { label: 'Ready to cook', to: paths.category('ready-to-cook') },
  { label: 'Bulk & wholesale', to: '#' }, // TODO(routes): dedicated /bulk page
];

const COMPANY_LINKS: ReadonlyArray<FooterLink> = [
  { label: 'About us', to: paths.cms('about') },
  { label: 'Careers', to: '#' }, // TODO(routes): /careers
  { label: 'Blog', to: '#' }, // TODO(routes): /blog
  { label: 'Press', to: '#' }, // TODO(routes): /press
];

const HELP_LINKS: ReadonlyArray<FooterLink> = [
  { label: 'Contact', to: '#' }, // TODO(routes): /contact
  { label: 'FAQs', to: paths.cms('faq') },
  { label: 'Delivery info', to: '#' }, // TODO(routes): /pages/delivery-info
  { label: 'Returns', to: paths.cms('returns') },
];

const LEGAL_LINKS: ReadonlyArray<FooterLink> = [
  { label: 'Terms of service', to: paths.cms('terms') },
  { label: 'Privacy policy', to: paths.cms('privacy') },
  { label: 'Shipping policy', to: '#' }, // TODO(routes): /pages/shipping
  { label: 'Refund policy', to: '#' }, // TODO(routes): /pages/refund
];

// Payment gateway pills — text-only, no image files needed.
const PAYMENT_METHODS = ['Razorpay', 'PhonePe', 'Cashfree', 'COD'] as const;

// Half-size trust strip — mirrors the home strip in tone/copy but with
// tighter padding so it works as a footer band.
const TRUST_ITEMS: ReadonlyArray<{ icon: string; label: string }> = [
  { icon: '❄️', label: 'Unbroken cold-chain' },
  { icon: '⚡', label: 'Same-day delivery' },
  { icon: '💯', label: '100% fresh, never frozen' },
  { icon: '🔒', label: 'Secure payments' },
];

// Ghost social buttons — anchor targets can be swapped once brand handles land.
interface SocialLink {
  label: string;
  href: string;
  icon: JSX.Element;
}

const SOCIAL_LINKS: ReadonlyArray<SocialLink> = [
  {
    label: 'Instagram',
    href: 'https://instagram.com/', // TODO(routes): real handle
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden focusable="false">
        <path
          fill="currentColor"
          d="M12 2.2c3.2 0 3.6 0 4.85.07 1.17.05 1.8.25 2.23.42.56.22.96.48 1.38.9.42.42.68.82.9 1.38.17.42.37 1.06.42 2.23.06 1.26.07 1.65.07 4.85s0 3.6-.07 4.85c-.05 1.17-.25 1.8-.42 2.23a3.7 3.7 0 0 1-.9 1.38 3.7 3.7 0 0 1-1.38.9c-.42.17-1.06.37-2.23.42-1.26.06-1.65.07-4.85.07s-3.6 0-4.85-.07c-1.17-.05-1.8-.25-2.23-.42a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.17-.42-.37-1.06-.42-2.23C2.2 15.6 2.2 15.2 2.2 12s0-3.6.07-4.85c.05-1.17.25-1.8.42-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.17 1.06-.37 2.23-.42C8.4 2.2 8.8 2.2 12 2.2Zm0 1.8c-3.15 0-3.52 0-4.76.07-1.07.05-1.65.23-2.03.38-.5.2-.86.44-1.24.82-.38.38-.62.74-.82 1.24-.15.38-.33.96-.38 2.03C2.7 8.48 2.7 8.85 2.7 12s0 3.52.07 4.76c.05 1.07.23 1.65.38 2.03.2.5.44.86.82 1.24.38.38.74.62 1.24.82.38.15.96.33 2.03.38 1.24.07 1.61.07 4.76.07s3.52 0 4.76-.07c1.07-.05 1.65-.23 2.03-.38.5-.2.86-.44 1.24-.82.38-.38.62-.74.82-1.24.15-.38.33-.96.38-2.03.07-1.24.07-1.61.07-4.76s0-3.52-.07-4.76c-.05-1.07-.23-1.65-.38-2.03a3.34 3.34 0 0 0-.82-1.24 3.34 3.34 0 0 0-1.24-.82c-.38-.15-.96-.33-2.03-.38C15.52 4 15.15 4 12 4Zm0 3.05a4.95 4.95 0 1 1 0 9.9 4.95 4.95 0 0 1 0-9.9Zm0 1.8a3.15 3.15 0 1 0 0 6.3 3.15 3.15 0 0 0 0-6.3Zm5.16-2.05a1.16 1.16 0 1 1 0 2.32 1.16 1.16 0 0 1 0-2.32Z"
        />
      </svg>
    ),
  },
  {
    label: 'Facebook',
    href: 'https://facebook.com/', // TODO(routes): real handle
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden focusable="false">
        <path
          fill="currentColor"
          d="M13.5 21.95v-8.03h2.7l.4-3.13h-3.1V8.8c0-.9.25-1.52 1.55-1.52h1.66V4.48a22.2 22.2 0 0 0-2.42-.13c-2.4 0-4.04 1.46-4.04 4.15v2.31H7.55v3.13h2.7v8.01a10 10 0 1 0 3.25 0Z"
        />
      </svg>
    ),
  },
  {
    label: 'YouTube',
    href: 'https://youtube.com/', // TODO(routes): real handle
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden focusable="false">
        <path
          fill="currentColor"
          d="M23.5 6.8a3 3 0 0 0-2.1-2.13C19.55 4.2 12 4.2 12 4.2s-7.55 0-9.4.47A3 3 0 0 0 .5 6.8 31.4 31.4 0 0 0 0 12a31.4 31.4 0 0 0 .5 5.2 3 3 0 0 0 2.1 2.13c1.85.47 9.4.47 9.4.47s7.55 0 9.4-.47a3 3 0 0 0 2.1-2.13c.34-1.71.5-3.44.5-5.2a31.4 31.4 0 0 0-.5-5.2ZM9.6 15.6V8.4l6.24 3.6-6.24 3.6Z"
        />
      </svg>
    ),
  },
];

/** WhatsApp deep link — strips the leading + for wa.me. */
const whatsappHref = `https://wa.me/${STORE.SUPPORT_WHATSAPP.replace(/\D/g, '')}`;

// ── Newsletter form ──────────────────────────────────────────

const newsletterSchema = z.object({
  email: z
    .string()
    .min(1, 'Enter your email so we can keep you posted')
    .email('That email address does not look right'),
});
type NewsletterValues = z.infer<typeof newsletterSchema>;

function NewsletterBand(): JSX.Element {
  const toast = useToast();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<NewsletterValues>({
    resolver: zodResolver(newsletterSchema),
    defaultValues: { email: '' },
    mode: 'onSubmit',
  });

  const onSubmit = handleSubmit((values) => {
    // TODO(backend): POST { email } to /api/marketing/newsletter once the
    // subscribers endpoint ships. For now we keep this fully client-side so
    // the UI is production-visible without a broken network call.
    toast.success(`Thanks! We'll ping ${values.email} with fresh drops.`);
    reset();
  });

  return (
    <section className="en-footer-v2__newsletter" aria-labelledby="footer-newsletter-title">
      <div className="en-container en-footer-v2__newsletter-inner">
        <div className="en-footer-v2__newsletter-copy">
          <span className="en-eyebrow">Fresh from the block</span>
          <h2 id="footer-newsletter-title" className="en-display en-footer-v2__newsletter-title">
            Get first dibs on fresh drops
          </h2>
          <p className="en-text-dim mb-0">
            Weekly featured cuts, member-only prices and cold-chain updates —
            straight to your inbox. Zero spam, unsubscribe anytime.
          </p>
        </div>
        <form
          onSubmit={onSubmit}
          className="en-footer-v2__newsletter-form"
          noValidate
          aria-label="Newsletter signup"
        >
          <label htmlFor="footer-newsletter-email" className="visually-hidden">
            Email address
          </label>
          <div className="en-footer-v2__newsletter-field">
            <input
              id="footer-newsletter-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@yourdomain.com"
              className={`form-control en-footer-v2__newsletter-input${
                errors.email ? ' is-invalid' : ''
              }`}
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={errors.email ? 'footer-newsletter-error' : undefined}
              {...register('email')}
            />
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isSubmitting}
              className="en-footer-v2__newsletter-cta"
            >
              Subscribe
            </Button>
          </div>
          {errors.email && (
            <p id="footer-newsletter-error" className="en-footer-v2__newsletter-error" role="alert">
              {errors.email.message}
            </p>
          )}
        </form>
      </div>
    </section>
  );
}

// ── Column links ─────────────────────────────────────────────

/**
 * Renders a link column that is a plain heading + list on ≥md and a native
 * `<details>` accordion below that. Using `<details>` keeps behaviour
 * accessible without extra JS state.
 */
function FooterColumn({
  title,
  links,
  id,
}: {
  title: string;
  links: ReadonlyArray<FooterLink>;
  id: string;
}): JSX.Element {
  return (
    <details className="en-footer-v2__col" id={id}>
      <summary className="en-footer-v2__col-title en-eyebrow">
        <span>{title}</span>
        <span className="en-footer-v2__col-chevron" aria-hidden>
          ▾
        </span>
      </summary>
      <ul className="en-footer-v2__col-list list-unstyled">
        {links.map((link) => (
          <li key={link.label}>
            {link.to.startsWith('#') || link.to.startsWith('http') ? (
              <a href={link.to}>{link.label}</a>
            ) : (
              <Link to={link.to}>{link.label}</Link>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}

function MainColumnsBand(): JSX.Element {
  return (
    <section className="en-container en-footer-v2__main">
      <div className="en-footer-v2__grid">
        {/* Brand column */}
        <div className="en-footer-v2__brand">
          <span className="en-logo d-inline-flex mb-3">
            Elite<span className="en-logo__accent">NonVeg</span>
          </span>
          <p className="en-text-dim en-footer-v2__brand-blurb">
            Premium fresh chicken, mutton, seafood and eggs — cut to order and
            delivered cold across {STORE.CITY}. No preservatives, ever.
          </p>
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="en-whatsapp en-footer-v2__whatsapp"
          >
            <span aria-hidden>💬</span>
            WhatsApp us · {STORE.SUPPORT_WHATSAPP}
          </a>
          <div className="en-footer-v2__payments" aria-label="Payment methods accepted">
            {PAYMENT_METHODS.map((method) => (
              <span key={method} className="en-footer-v2__payment-pill">
                {method}
              </span>
            ))}
          </div>
        </div>

        <FooterColumn id="footer-shop" title="Shop" links={SHOP_LINKS} />
        <FooterColumn id="footer-company" title="Company" links={COMPANY_LINKS} />
        <FooterColumn id="footer-help" title="Help" links={HELP_LINKS} />
        <FooterColumn id="footer-legal" title="Legal" links={LEGAL_LINKS} />
      </div>
    </section>
  );
}

// ── Trust strip band ─────────────────────────────────────────

function TrustBand(): JSX.Element {
  return (
    <section className="en-container en-footer-v2__trust" aria-label="Why shop with us">
      <ul className="en-footer-v2__trust-grid list-unstyled">
        {TRUST_ITEMS.map((item) => (
          <li key={item.label} className="en-footer-v2__trust-item">
            <span className="en-footer-v2__trust-icon" aria-hidden>
              {item.icon}
            </span>
            <span className="en-footer-v2__trust-label">{item.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── Fine print band ──────────────────────────────────────────

function FinePrintBand({ year }: { year: number }): JSX.Element {
  return (
    <div className="en-container en-footer-v2__fine">
      <div className="en-footer-v2__fine-inner">
        <span>
          © {year} {STORE.NAME}. All rights reserved.
        </span>
        <span className="en-footer-v2__fine-sep" aria-hidden>
          ·
        </span>
        <span>
          Made with care in {STORE.CITY}
          <span aria-hidden> 🇮🇳</span>
        </span>
      </div>
      <ul className="en-footer-v2__socials list-unstyled" aria-label="Follow us">
        {SOCIAL_LINKS.map((social) => (
          <li key={social.label}>
            <a
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              className="en-footer-v2__social-btn"
              aria-label={social.label}
            >
              {social.icon}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Root ─────────────────────────────────────────────────────

export function Footer(): JSX.Element {
  const year = new Date().getFullYear();

  return (
    <footer className="en-footer en-footer-v2">
      <NewsletterBand />
      <MainColumnsBand />
      <TrustBand />
      <hr className="en-divider en-footer-v2__divider" />
      <FinePrintBand year={year} />
    </footer>
  );
}
