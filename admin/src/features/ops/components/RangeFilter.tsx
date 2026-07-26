import { useCallback } from 'react';

/**
 * Report range selector used across the Reports page. Presents a segmented
 * "pill" of preset ranges plus a Custom option that reveals two date pickers.
 * Kept dumb — parents own the state and can pass the derived `{from, to}` into
 * range-aware hooks (e.g. `useWastage`).
 */

export type RangeKey = 'today' | '7d' | '30d' | '90d' | 'custom';

interface Option {
  key: RangeKey;
  label: string;
}

const OPTIONS: readonly Option[] = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7d' },
  { key: '30d', label: '30d' },
  { key: '90d', label: '90d' },
  { key: 'custom', label: 'Custom' },
];

/** Convert a Date to a `YYYY-MM-DD` string in the local timezone. */
export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Number of days the preset covers, inclusive of "today". */
export function rangeDays(key: RangeKey, from?: string, to?: string): number {
  if (key === 'today') return 1;
  if (key === '7d') return 7;
  if (key === '30d') return 30;
  if (key === '90d') return 90;
  if (from && to) {
    const start = new Date(from);
    const end = new Date(to);
    const diff = Math.round((end.getTime() - start.getTime()) / 86_400_000);
    return Math.max(1, diff + 1);
  }
  return 1;
}

/**
 * Resolve a range key + custom endpoints into concrete ISO date strings
 * suitable for the API. `today` yields the same value for `from` and `to`.
 */
export function resolveRange(
  key: RangeKey,
  customFrom: string,
  customTo: string,
): { from: string; to: string } {
  if (key === 'custom') {
    return { from: customFrom, to: customTo };
  }
  const days = rangeDays(key);
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));
  return { from: toIsoDate(start), to: toIsoDate(end) };
}

interface RangeFilterProps {
  value: RangeKey;
  onChange: (value: RangeKey) => void;
  /** Custom-range endpoints (only used when value === 'custom'). */
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
}

export function RangeFilter({
  value,
  onChange,
  from,
  to,
  onFromChange,
  onToChange,
}: RangeFilterProps) {
  const handleSelect = useCallback(
    (key: RangeKey) => {
      // Default custom pickers to the last-selected preset if empty.
      if (key === 'custom' && (!from || !to)) {
        const { from: f, to: t } = resolveRange('7d', '', '');
        onFromChange(f);
        onToChange(t);
      }
      onChange(key);
    },
    [from, to, onChange, onFromChange, onToChange],
  );

  return (
    <div className="d-flex align-items-center gap-2 flex-wrap">
      <div
        className="d-inline-flex align-items-center bg-white border rounded-pill"
        style={{ padding: 3 }}
        role="tablist"
        aria-label="Report date range"
      >
        {OPTIONS.map((o) => {
          const active = o.key === value;
          return (
            <button
              key={o.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => handleSelect(o.key)}
              className="btn btn-sm rounded-pill border-0"
              style={{
                padding: '0.28rem 0.9rem',
                fontSize: '0.82rem',
                fontWeight: 600,
                letterSpacing: 0.2,
                lineHeight: 1.2,
                background: active ? 'var(--brand)' : 'transparent',
                color: active ? '#fff' : 'var(--text-muted)',
                transition: 'background 140ms ease, color 140ms ease',
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>

      {value === 'custom' && (
        <div className="d-flex align-items-center gap-2">
          <input
            type="date"
            className="form-control form-control-sm"
            style={{ width: 150 }}
            value={from}
            max={to || undefined}
            onChange={(e) => onFromChange(e.target.value)}
            aria-label="From date"
          />
          <span className="text-muted-2 small">to</span>
          <input
            type="date"
            className="form-control form-control-sm"
            style={{ width: 150 }}
            value={to}
            min={from || undefined}
            onChange={(e) => onToChange(e.target.value)}
            aria-label="To date"
          />
        </div>
      )}
    </div>
  );
}
