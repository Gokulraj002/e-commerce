const TRUST_ITEMS: ReadonlyArray<{ icon: string; label: string; sub: string }> = [
  { icon: '🔪', label: 'Cut to order', sub: 'Hand-cut by expert butchers' },
  { icon: '❄️', label: 'Unbroken cold-chain', sub: 'Chilled 0–4°C to your door' },
  { icon: '✅', label: '100% Halal', sub: 'Ethically sourced & certified' },
  { icon: '💯', label: 'Freshness promise', sub: 'Replaced or refunded' },
];

/** Static reassurance strip shown under the buy box on the product page. */
export function TrustBadges(): JSX.Element {
  return (
    <div className="row g-2">
      {TRUST_ITEMS.map((item) => (
        <div key={item.label} className="col-6">
          <div
            className="d-flex align-items-center gap-2 h-100"
            style={{
              padding: '0.65rem 0.8rem',
              borderRadius: 'var(--en-radius)',
              background: 'var(--en-surface)',
              border: '1px solid var(--en-border)',
            }}
          >
            <span style={{ fontSize: '1.35rem', lineHeight: 1 }} aria-hidden>
              {item.icon}
            </span>
            <span className="d-flex flex-column">
              <span className="small fw-semibold" style={{ color: 'var(--en-text)' }}>
                {item.label}
              </span>
              <span style={{ color: 'var(--en-muted)', fontSize: '0.78rem' }}>{item.sub}</span>
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
