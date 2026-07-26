/**
 * Premium editorial card for a curated meal box.
 *
 * Fully presentational — the card renders a hero image, a gold "Chef's pick"
 * (or other) badge, an italic tagline, the pack's item chips, a meta row
 * ("Serves N · ready in X min"), a price row with strike-through MRP + a
 * green "Save ₹X" pill, and a full-width crimson "Add box to cart" CTA.
 *
 * The whole card is a stretched `<Link>` to the collection's detail page;
 * the CTA sits above (z-index 2) and stopPropagation-s so a tap on the
 * button does not also navigate.
 *
 * On CTA click we open a confirmation `<Modal>` that lists every item in
 * the box. Confirming currently toasts + navigates to /cart — see the
 * TODO(backend) below.
 */
import { motion, useReducedMotion } from 'framer-motion';
import { useCallback, useState, type MouseEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Button, Modal, useToast } from '@/components/ui';
import { formatPaise, rupeesToPaise } from '@/lib/money';
import { paths } from '@/routes/routes';

import type { Collection } from './collections.data';

export interface CollectionCardProps {
  collection: Collection;
  /** Optional entrance-animation index for staggered grids. */
  index?: number;
}

const EASE = [0.22, 1, 0.36, 1] as const;

export function CollectionCard({ collection, index = 0 }: CollectionCardProps): JSX.Element {
  const navigate = useNavigate();
  const toast = useToast();
  const reduce = useReducedMotion();

  const [modalOpen, setModalOpen] = useState(false);
  const [adding, setAdding] = useState(false);

  const pricePaise = rupeesToPaise(collection.priceRupees);
  const mrpPaise = rupeesToPaise(collection.mrpRupees);
  const savingsRupees = Math.max(0, collection.mrpRupees - collection.priceRupees);
  const detailTo = paths.collection(collection.slug);

  const onCtaClick = useCallback((e: MouseEvent<HTMLButtonElement>): void => {
    // The parent <Link> is a stretched anchor covering the whole card, so we
    // must stop the button click from also navigating to the detail page.
    e.preventDefault();
    e.stopPropagation();
    setModalOpen(true);
  }, []);

  const onConfirmAdd = useCallback(async (): Promise<void> => {
    setAdding(true);
    // TODO(backend): call the bulk-add mutation with this box's variantIds
    // (POST /api/v1/cart/add-bulk). For now we simulate a short async pause
    // so the "Adding…" state is visible, then bounce the user to /cart.
    await new Promise((resolve) => window.setTimeout(resolve, 240));
    setAdding(false);
    setModalOpen(false);
    toast.success(`${collection.title} added — proceed to cart to review`);
    navigate(paths.cart());
  }, [collection.title, navigate, toast]);

  return (
    <motion.article
      className="en-collection-card"
      initial={reduce ? undefined : { opacity: 0, y: 24 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{
        duration: 0.55,
        delay: Math.min(index, 6) * 0.06,
        ease: EASE,
      }}
    >
      {/* Stretched-link — covers the media + copy so the whole card is a
          tap target that navigates to the detail page. */}
      <Link to={detailTo} className="en-collection-card__link" aria-label={`View ${collection.title}`}>
        <span className="visually-hidden">View {collection.title}</span>
      </Link>

      <div className="en-collection-card__media">
        <img
          src={collection.imageUrl}
          alt={collection.title}
          loading="lazy"
          className="en-collection-card__img"
        />
        <span className="en-collection-card__scrim" aria-hidden />
        <span className="en-collection-card__badge">
          <span aria-hidden>★</span> {collection.badge}
        </span>
      </div>

      <div className="en-collection-card__body">
        <h3 className="en-collection-card__title en-display">{collection.title}</h3>
        <p className="en-collection-card__tagline">{collection.tagline}</p>

        <ul className="en-collection-card__chips" aria-label="What's inside">
          {collection.items.map((item) => (
            <li key={item.label} className="en-collection-card__chip">
              {item.label}
            </li>
          ))}
        </ul>

        <p className="en-collection-card__meta">
          <span aria-hidden>🍽️</span> Serves {collection.serves}
          <span className="en-collection-card__meta-dot" aria-hidden>
            ·
          </span>
          <span aria-hidden>⏱️</span> Ready in {collection.cookTimeMinutes} min
        </p>

        <div className="en-collection-card__price-row">
          <div className="en-collection-card__price-col">
            <span className="en-collection-card__price">{formatPaise(pricePaise)}</span>
            {collection.mrpRupees > collection.priceRupees && (
              <span className="en-collection-card__mrp">{formatPaise(mrpPaise)}</span>
            )}
          </div>
          {savingsRupees > 0 && (
            <span className="en-collection-card__save">
              Save {formatPaise(rupeesToPaise(savingsRupees))}
            </span>
          )}
        </div>

        <button
          type="button"
          className="btn btn-primary btn-lg en-collection-card__cta"
          onClick={onCtaClick}
          aria-haspopup="dialog"
          aria-label={`Add ${collection.title} to cart`}
        >
          Add box to cart
        </button>
      </div>

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
    </motion.article>
  );
}
