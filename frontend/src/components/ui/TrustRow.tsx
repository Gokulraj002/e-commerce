/**
 * TrustRow — reusable premium trust-signal row.
 *
 * A horizontal band of 4–6 icon + label pairs with subtle dividers between
 * items and even spacing. Three surface tones so the same component reads
 * on the cream page (`cream`), a dark ink band (`ink`) or a warm gold
 * accent surface (`gold`).
 *
 * The icon is a plain string — usually an emoji, but any short glyph
 * (kbd shortcut, single letter, symbol) works. Callers pass 4–6 items;
 * on narrow viewports the row wraps to two rows without changing the
 * design system.
 */

export interface TrustRowItem {
  /** Short glyph or emoji rendered above/beside the label. */
  icon: string;
  label: string;
}

export type TrustRowTone = 'cream' | 'ink' | 'gold';

export interface TrustRowProps {
  items: ReadonlyArray<TrustRowItem>;
  /** Surface tone. Defaults to `cream` (matches the page background). */
  tone?: TrustRowTone;
  className?: string;
}

const TONE_CLASS: Record<TrustRowTone, string> = {
  cream: 'ui-trust-row--cream',
  ink: 'ui-trust-row--ink',
  gold: 'ui-trust-row--gold',
};

export function TrustRow({
  items,
  tone = 'cream',
  className,
}: TrustRowProps): JSX.Element {
  const classes = ['ui-trust-row', TONE_CLASS[tone], className]
    .filter(Boolean)
    .join(' ');

  return (
    <ul className={classes} role="list">
      {items.map((item, i) => (
        <li key={`${item.label}-${i}`} className="ui-trust-row__item">
          <span className="ui-trust-row__icon" aria-hidden>
            {item.icon}
          </span>
          <span className="ui-trust-row__label">{item.label}</span>
        </li>
      ))}
    </ul>
  );
}
