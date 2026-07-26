/**
 * Chef's note callout — warm cream-tinted editorial card sitting under the
 * buy box. Renders a Playfair-italic quote about the cut plus a pair of
 * inline chips for cook-time and ideal-preparation.
 *
 * Content strategy: prefer real spec rows from `product.attributes` when the
 * shop admin has supplied a matching key; fall back to a tasteful default so
 * the layout always reads as intentional.
 */
import type { ProductAttributePairDTO } from '@/features/catalog';

const NOTE_KEYS = ["chef's note", 'chef note', 'note'] as const;
const COOK_TIME_KEYS = ['cook time', 'cooking time', 'cooking duration'] as const;
const PREP_KEYS = [
  'ideal preparation',
  'best cooked as',
  'ideal for',
  'serving suggestion',
  'cooking style',
  'preparation',
] as const;

function findAttribute(
  attrs: ProductAttributePairDTO[],
  keys: readonly string[],
): string | null {
  const set = new Set(keys.map((k) => k.toLowerCase()));
  const hit = attrs.find((a) => set.has(a.attribute.toLowerCase()));
  return hit ? hit.value : null;
}

export interface ChefNoteProps {
  productName: string;
  attributes: ProductAttributePairDTO[];
}

export function ChefNote({ productName, attributes }: ChefNoteProps): JSX.Element {
  const note =
    findAttribute(attributes, NOTE_KEYS) ??
    `${productName} is a cut our head chef reaches for when balance matters — tender enough to sear fast, deep enough to hold up in a slow braise.`;
  const cookTime = findAttribute(attributes, COOK_TIME_KEYS) ?? '20–30 min';
  const idealPrep = findAttribute(attributes, PREP_KEYS) ?? 'Pan-sear, curry or grill';

  return (
    <aside className="en-pdp-v2__chef" aria-label="A note from the chef">
      <div className="en-pdp-v2__chef-inner">
        <span className="en-pdp-v2__chef-eyebrow">A note from the chef</span>
        <blockquote className="en-pdp-v2__chef-quote">
          <span aria-hidden className="en-pdp-v2__chef-mark">
            &ldquo;
          </span>
          <span>{note}</span>
        </blockquote>
        <div className="en-pdp-v2__chef-chips" aria-label="Cooking guidance">
          <span className="en-pdp-v2__chef-chip">
            <span aria-hidden className="en-pdp-v2__chef-chip-icon">
              ⏱
            </span>
            <span className="en-pdp-v2__chef-chip-label">Cook time</span>
            <span className="en-pdp-v2__chef-chip-value">{cookTime}</span>
          </span>
          <span className="en-pdp-v2__chef-chip">
            <span aria-hidden className="en-pdp-v2__chef-chip-icon">
              🔥
            </span>
            <span className="en-pdp-v2__chef-chip-label">Ideal for</span>
            <span className="en-pdp-v2__chef-chip-value">{idealPrep}</span>
          </span>
        </div>
      </div>
    </aside>
  );
}
