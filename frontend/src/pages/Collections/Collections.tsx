/**
 * Collections — landing page for curated meal boxes.
 *
 * Editorial layout:
 *   1. Breadcrumb + hero band ("Curated boxes for special meals").
 *   2. Responsive grid of `<CollectionCard>` — 1 col on mobile, 2 cols
 *      on desktop for a magazine-spread feel.
 *
 * Data is currently hard-coded in `features/collections/collections.data.ts`
 * — see the TODO(backend) at the top of that file for the eventual swap.
 */
import { Link } from 'react-router-dom';

import { CollectionCard, COLLECTIONS } from '@/features/collections';
import { PageMeta } from '@/features/seo';
import { paths } from '@/routes/routes';

export default function Collections(): JSX.Element {
  return (
    <>
      <PageMeta
        title="Curated meal boxes · Elite NonVeg"
        description="Hand-picked meat boxes for Sunday biryani, weekend BBQ, Kerala fish curry and more — one tap, everything you need. Hand-cut, cold-chain delivered."
        canonical="/collections"
      />

      <section className="en-section en-container">
        <nav className="en-text-muted small mb-3" aria-label="Breadcrumb">
          <Link to={paths.home()} className="en-link-reset">
            Home
          </Link>{' '}
          / <span className="en-text-dim">Boxes</span>
        </nav>

        <header className="en-collections-hero">
          <span className="en-eyebrow d-block mb-2">Curated by our chefs</span>
          <h1 className="en-collections-hero__title en-display">
            Curated boxes for <span className="en-text-gradient">special meals</span>
          </h1>
          <p className="en-collections-hero__lede en-text-dim">
            One tap. Every cut, every seasoning, every side you need for the
            meal on your mind — pre-portioned by our butchers, packed on ice
            and delivered the same day.
          </p>
        </header>

        <div className="en-collections-grid">
          {COLLECTIONS.map((c, i) => (
            <CollectionCard key={c.id} collection={c} index={i} />
          ))}
        </div>
      </section>
    </>
  );
}
