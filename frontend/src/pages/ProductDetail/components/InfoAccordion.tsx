/**
 * Info accordion — the "Freshness & storage" / "Preparation & cooking" blocks
 * beneath the product spec table.
 *
 * Uses the native `<details>` / `<summary>` pair so keyboard interaction and
 * a screen-reader's expandable-region semantics come for free. Styling is
 * driven by the `.en-accordion` classes in `_components.scss`.
 *
 * Content strategy: each item optionally receives spec rows harvested from
 * `product.attributes` — when the shop admin supplied a "Freshness" row the
 * shopper sees it, otherwise the fallback body copy carries the promise.
 */
import type { ReactNode } from 'react';

import type { ProductAttributePairDTO } from '@/features/catalog';

export interface InfoAccordionItem {
  id: string;
  title: string;
  /** Small pictogram — plain string glyph, no image dependencies. */
  icon?: string;
  /** Spec rows harvested from `product.attributes` — rendered as a mini dl. */
  rows?: ProductAttributePairDTO[];
  /** Prose fallback / narrative that always renders below the rows. */
  body: ReactNode;
  /** Whether the panel starts expanded. */
  defaultOpen?: boolean;
}

export interface InfoAccordionProps {
  items: InfoAccordionItem[];
}

export function InfoAccordion({ items }: InfoAccordionProps): JSX.Element {
  return (
    <div className="en-accordion" role="group" aria-label="Product information">
      {items.map((item) => (
        <details
          key={item.id}
          className="en-accordion__item"
          open={item.defaultOpen ?? false}
        >
          <summary className="en-accordion__trigger">
            <span className="en-accordion__title">
              {item.icon && (
                <span className="en-accordion__icon" aria-hidden>
                  {item.icon}
                </span>
              )}
              {item.title}
            </span>
            <span className="en-accordion__chevron" aria-hidden>
              ▾
            </span>
          </summary>
          <div className="en-accordion__panel">
            {item.rows && item.rows.length > 0 && (
              <dl className="en-accordion__rows">
                {item.rows.map((row) => (
                  <div
                    key={`${row.attribute}-${row.value}`}
                    className="en-accordion__row"
                  >
                    <dt>{row.attribute}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            <div className="en-accordion__body">{item.body}</div>
          </div>
        </details>
      ))}
    </div>
  );
}
