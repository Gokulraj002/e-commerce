import { useEffect, useState } from 'react';

export interface ProductGalleryProps {
  images: string[];
  name: string;
}

/**
 * Image gallery: a large main image with a thumbnail rail. Presentational —
 * selection is local state. Falls back to a branded placeholder when a product
 * has no imagery.
 */
export function ProductGallery({ images, name }: ProductGalleryProps): JSX.Element {
  const [active, setActive] = useState(0);

  // Reset selection if the product (and its image set) changes.
  useEffect(() => {
    setActive(0);
  }, [images]);

  const main = images[active] ?? null;

  return (
    <div className="d-flex flex-column gap-3">
      <div
        className="en-card"
        style={{
          padding: 0,
          overflow: 'hidden',
          aspectRatio: '1 / 1',
          background: 'var(--en-surface)',
        }}
      >
        {main ? (
          <img
            src={main}
            alt={name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div
            className="d-flex align-items-center justify-content-center h-100"
            style={{ fontSize: '5rem' }}
            aria-hidden
          >
            🍖
          </div>
        )}
      </div>

      {images.length > 1 && (
        <div className="d-flex flex-wrap gap-2" role="tablist" aria-label={`${name} images`}>
          {images.map((src, i) => {
            const isActive = i === active;
            return (
              <button
                key={src}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={`View image ${i + 1}`}
                onClick={() => setActive(i)}
                className="en-link-reset"
                style={{
                  width: 68,
                  height: 68,
                  padding: 0,
                  borderRadius: 'var(--en-radius)',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  background: 'var(--en-surface)',
                  border: `2px solid ${isActive ? 'var(--en-gold)' : 'transparent'}`,
                  opacity: isActive ? 1 : 0.7,
                  transition: 'opacity 0.15s ease, border-color 0.15s ease',
                }}
              >
                <img
                  src={src}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
