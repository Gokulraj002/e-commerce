/**
 * Reusable product image gallery.
 *
 * Composition:
 *   - Large square main image (theme-tinted placeholder when a product has none).
 *   - Horizontal thumbnail rail — click / arrow-key to swap the main image.
 *   - Zoom-on-hover: pointer position drives CSS `transform-origin`, so the
 *     lens follows the cursor. Pure CSS transform — no third-party libs, no
 *     layout thrash, and it silently no-ops on coarse pointers.
 *
 * Presentational: selection lives in local state, images are `loading="lazy"`.
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';

export interface ImageGalleryProps {
  images: string[];
  name: string;
  /** Placeholder emoji when the product has no images. */
  fallbackEmoji?: string;
  /** Max zoom scale when hovering the main image. */
  zoomScale?: number;
}

interface ZoomOrigin {
  x: number;
  y: number;
}

const DEFAULT_ZOOM = 1.75;

/**
 * Product gallery used by the PDP. Reusable — pass any product's `images` +
 * `name` and it renders a self-contained zoomable viewer.
 */
export function ImageGallery({
  images,
  name,
  fallbackEmoji = '🍖',
  zoomScale = DEFAULT_ZOOM,
}: ImageGalleryProps): JSX.Element {
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState<ZoomOrigin | null>(null);
  const thumbsRef = useRef<HTMLDivElement>(null);

  // Reset selection whenever the image set changes (e.g. new product loads).
  useEffect(() => {
    setActive(0);
    setZoom(null);
  }, [images]);

  const clampedActive = Math.min(active, Math.max(images.length - 1, 0));
  const main = images[clampedActive] ?? null;

  const onMouseMove = useCallback((event: ReactMouseEvent<HTMLDivElement>): void => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setZoom({ x, y });
  }, []);

  const onMouseLeave = useCallback((): void => {
    setZoom(null);
  }, []);

  const onThumbKey = useCallback(
    (event: KeyboardEvent<HTMLDivElement>): void => {
      if (images.length < 2) return;
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setActive((i) => (i + 1) % images.length);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setActive((i) => (i - 1 + images.length) % images.length);
      }
    },
    [images.length],
  );

  const imgStyle: CSSProperties = zoom
    ? {
        transform: `scale(${zoomScale})`,
        transformOrigin: `${zoom.x}% ${zoom.y}%`,
      }
    : {};

  return (
    <div className="en-gallery">
      <div
        className={`en-gallery__main${zoom ? ' is-zooming' : ''}`}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        aria-live="polite"
      >
        {main ? (
          <img
            key={main}
            src={main}
            alt={name}
            loading="lazy"
            decoding="async"
            className="en-gallery__img"
            style={imgStyle}
            draggable={false}
          />
        ) : (
          <div className="en-gallery__fallback" aria-hidden>
            {fallbackEmoji}
          </div>
        )}
      </div>

      {images.length > 1 && (
        <div
          ref={thumbsRef}
          className="en-gallery__thumbs"
          role="tablist"
          aria-label={`${name} images`}
          onKeyDown={onThumbKey}
        >
          {images.map((src, i) => {
            const isActive = i === clampedActive;
            return (
              <button
                key={src}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={`View image ${i + 1} of ${images.length}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActive(i)}
                className={`en-gallery__thumb${isActive ? ' is-active' : ''}`}
              >
                <img src={src} alt="" loading="lazy" decoding="async" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
