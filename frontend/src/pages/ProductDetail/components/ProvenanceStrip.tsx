/**
 * Provenance timeline — the "farm → your door" journey rendered as a horizontal
 * five-step timeline. Replaces the earlier 3-column strip.
 *
 * Design:
 *   - Cream editorial card, gold hairline top.
 *   - Five dots linked by a soft gold rail. Each dot carries a glyph, a bold
 *     label underneath, and a small time caption below that.
 *   - On desktop the timeline reads left-to-right in a single row. On mobile
 *     it collapses into a scroll-snap track so every step stays touch-legible
 *     without stacking vertically (which would kill the "journey" metaphor).
 */
interface ProvenanceStep {
  icon: string;
  label: string;
  time: string;
}

const STEPS: ReadonlyArray<ProvenanceStep> = [
  { icon: '🌾', label: 'Farm-audited source', time: 'Day 1 · 06:00' },
  { icon: '🚛', label: 'Chilled arrival at facility', time: 'Day 1 · 09:00' },
  { icon: '🔪', label: 'Hand-cut to order', time: 'Order + 15 min' },
  { icon: '📦', label: 'Vacuum-sealed at 0–4°C', time: 'Order + 30 min' },
  { icon: '🚚', label: 'On its way to you', time: 'Order + 90 min' },
];

export function ProvenanceStrip(): JSX.Element {
  return (
    <section
      className="en-pdp-v3__timeline"
      aria-label="How this cut reaches you"
    >
      <div className="en-pdp-v3__timeline-head">
        <span className="en-eyebrow d-block mb-2">Provenance</span>
        <h2 className="en-display en-pdp-v3__timeline-headline">
          From farm to your kitchen
        </h2>
      </div>

      <ol
        className="en-pdp-v3__timeline-track"
        aria-label="Journey timeline"
      >
        {STEPS.map((step, i) => (
          <li key={step.label} className="en-pdp-v3__timeline-step">
            <span className="en-pdp-v3__timeline-dot" aria-hidden>
              <span className="en-pdp-v3__timeline-dot-icon">{step.icon}</span>
            </span>
            <span className="en-pdp-v3__timeline-label">{step.label}</span>
            <span className="en-pdp-v3__timeline-time">{step.time}</span>
            <span className="visually-hidden">Step {i + 1} of {STEPS.length}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
