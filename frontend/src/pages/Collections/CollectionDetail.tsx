/**
 * CollectionDetail — /collections/:slug.
 *
 * Full-bleed cinematic hero of the box, big description, items-breakdown
 * table, and a primary Add-to-cart CTA. A related-collections strip sits
 * below the fold.
 *
 * Data is currently hard-coded in `features/collections/collections.data.ts`
 * (see the TODO(backend) there); once the API ships this page will move to
 * a `useCollection(slug)` hook and the bulk-add mutation will replace the
 * simulated add in `onConfirmAdd`.
 */
import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { Button, EmptyState, Modal, useToast } from '@/components/ui';
import {
  CollectionCard,
  COLLECTIONS,
  findCollectionBySlug,
} from '@/features/collections';
import { PageMeta } from '@/features/seo';
import { formatPaise, formatWeight, rupeesToPaise } from '@/lib/money';
import { paths } from '@/routes/routes';

export default function CollectionDetail(): JSX.Element {
  const { slug = '' } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const collection = findCollectionBySlug(slug);

  const [modalOpen, setModalOpen] = useState(false);
  const [adding, setAdding] = useState(false);

  const related = useMemo(
    () =>
      collection
        ? COLLECTIONS.filter((c) => c.id !== collection.id).slice(0, 3)
        : [],
    [collection],
  );

  const onConfirmAdd = useCallback(async (): Promise<void> => {
    if (!collection) return;
    setAdding(true);
    // TODO(backend): bulk-add mutation — same one used by CollectionCard.
    await new Promise((resolve) => window.setTimeout(resolve, 240));
    setAdding(false);
    setModalOpen(false);
    toast.success(`${collection.title} added — proceed to cart to review`);
    navigate(paths.cart());
  }, [collection, navigate, toast]);

  if (!collection) {
    return (
      <section className="en-section en-container">
        <PageMeta
          title="Box not found · Elite NonVeg"
          description="This curated meal box is no longer available."
          canonical="/collections"
        />
        <EmptyState
          icon="📦"
          title="That box has been retired"
          description="It may have been renamed or is out of season. Browse the other curated boxes below."
          action={
            <Link to={paths.collections()}>
              <Button variant="gold">See all boxes</Button>
            </Link>
          }
        />
      </section>
    );
  }

  const pricePaise = rupeesToPaise(collection.priceRupees);
  const mrpPaise = rupeesToPaise(collection.mrpRupees);
  const savingsRupees = Math.max(0, collection.mrpRupees - collection.priceRupees);

  return (
    <>
      <PageMeta
        title={`${collection.title} · Elite NonVeg`}
        description={collection.tagline}
        canonical={`/collections/${collection.slug}`}
      />

      <section className="en-section en-container pb-0">
        <nav className="en-text-muted small mb-3" aria-label="Breadcrumb">
          <Link to={paths.home()} className="en-link-reset">
            Home
          </Link>{' '}
          /{' '}
          <Link to={paths.collections()} className="en-link-reset">
            Boxes
          </Link>{' '}
          / <span className="en-text-dim">{collection.title}</span>
        </nav>
      </section>

      {/* Cinematic hero */}
      <section className="en-collection-detail__hero">
        <img
          src={collection.imageUrl}
          alt={collection.title}
          className="en-collection-detail__hero-img"
        />
        <span className="en-collection-detail__hero-scrim" aria-hidden />
        <div className="en-container en-collection-detail__hero-inner">
          <span className="en-collection-detail__hero-badge">
            <span aria-hidden>★</span> {collection.badge}
          </span>
          <h1 className="en-display display-4 en-collection-detail__title">
            {collection.title}
          </h1>
          <p className="en-collection-detail__tagline">{collection.tagline}</p>
        </div>
      </section>

      <section className="en-section en-container en-collection-detail">
        <div className="en-collection-detail__cols">
          <div>
            <p className="en-collection-detail__desc">{collection.description}</p>

            <h2 className="en-display h4 en-collection-detail__section-title">
              What&rsquo;s inside
            </h2>
            <div className="en-collection-detail__table-wrap">
              <table className="en-collection-detail__table">
                <thead>
                  <tr>
                    <th scope="col">Item</th>
                    <th scope="col" className="text-end">
                      Weight
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {collection.items.map((it) => (
                    <tr key={it.label}>
                      <td>{it.label}</td>
                      <td className="text-end en-text-dim">{formatWeight(it.weightG)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="en-collection-detail__note en-text-muted small">
              All items are hand-cut and vacuum-sealed to your order. Delivered
              chilled between 0–4&deg;C.
            </p>
          </div>

          {/* Sticky buy card */}
          <aside className="en-collection-detail__buy">
            <div className="en-collection-detail__buy-inner">
              <span className="en-eyebrow d-block mb-2">Box total</span>
              <div className="en-collection-detail__buy-price">
                <span className="en-collection-detail__price">{formatPaise(pricePaise)}</span>
                {collection.mrpRupees > collection.priceRupees && (
                  <span className="en-collection-detail__mrp">{formatPaise(mrpPaise)}</span>
                )}
              </div>
              {savingsRupees > 0 && (
                <span className="en-collection-detail__save">
                  You save {formatPaise(rupeesToPaise(savingsRupees))}
                </span>
              )}
              <p className="en-collection-detail__meta">
                <span aria-hidden>🍽️</span> Serves {collection.serves}
                <span aria-hidden> · </span>
                <span aria-hidden>⏱️</span> Ready in {collection.cookTimeMinutes} min
              </p>
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={() => setModalOpen(true)}
                aria-haspopup="dialog"
              >
                Add box to cart
              </Button>
              <p className="en-text-muted small mt-3 mb-0">
                Adds every item in one shot. You can adjust quantities on the cart page.
              </p>
            </div>
          </aside>
        </div>

        {related.length > 0 && (
          <div className="en-collection-detail__related">
            <div className="en-section-head">
              <div>
                <span className="en-eyebrow d-block mb-2">Also curated</span>
                <h2 className="en-display h2 mb-0">More boxes to explore</h2>
              </div>
              <Link to={paths.collections()} className="en-link-reset en-text-dim small">
                View all &nbsp;→
              </Link>
            </div>
            <div className="en-collections-grid">
              {related.map((c, i) => (
                <CollectionCard key={c.id} collection={c} index={i} />
              ))}
            </div>
          </div>
        )}
      </section>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={`Add "${collection.title}" to cart?`}
        footer={
          <div className="d-flex justify-content-end gap-2 w-100">
            <Button variant="ghost" onClick={() => setModalOpen(false)} disabled={adding}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                void onConfirmAdd();
              }}
              isLoading={adding}
            >
              Add {collection.items.length} items
            </Button>
          </div>
        }
      >
        <p className="mb-2">This will add every item in the box to your cart in one shot:</p>
        <ul className="en-collection-card__modal-list">
          {collection.items.map((it) => (
            <li key={it.label}>{it.label}</li>
          ))}
        </ul>
        <p className="en-text-muted small mb-0 mt-3">
          You can adjust or remove any item on the cart page before checkout.
        </p>
      </Modal>
    </>
  );
}
