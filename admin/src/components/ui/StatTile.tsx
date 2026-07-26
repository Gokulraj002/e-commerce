import type { ReactNode } from 'react';

import { Icon, type IconName } from './Icon';

export type StatTileTone = 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface StatTileProps {
  /** Small uppercase eyebrow label. */
  label: string;
  /** Big value — rendered with tabular numerals. */
  value: ReactNode;
  /** Supporting caption under the value. */
  caption?: ReactNode;
  /** Optional icon shown in a tinted rounded tile in the top-right. */
  icon?: IconName;
  /** Tint used for the icon chip; defaults to `'brand'`. */
  tone?: StatTileTone;
  /** Signed percentage delta vs the previous period. */
  delta?: number;
  loading?: boolean;
}

/**
 * Premium KPI tile — small uppercase eyebrow, oversized tabular value,
 * tinted icon chip. Sits alongside plain `StatCard`s without conflict.
 */
export function StatTile({
  label,
  value,
  caption,
  icon,
  tone = 'brand',
  delta,
  loading = false,
}: StatTileProps) {
  const hasDelta = typeof delta === 'number' && !Number.isNaN(delta);
  const up = hasDelta && delta >= 0;

  return (
    <div className="card ui-stat-tile h-100" data-tone={tone}>
      <div className="ui-stat-tile__body">
        <div className="ui-stat-tile__row">
          <span className="ui-stat-tile__label">{label}</span>
          {icon && (
            <span className="ui-stat-tile__icon" aria-hidden="true">
              <Icon name={icon} size={16} />
            </span>
          )}
        </div>
        {loading ? (
          <div className="placeholder-glow mt-2">
            <span className="placeholder col-6" style={{ height: 26 }} />
          </div>
        ) : (
          <div className="ui-stat-tile__value tabular">{value}</div>
        )}
        {(hasDelta || caption) && (
          <div className="ui-stat-tile__meta">
            {hasDelta && (
              <span className={`ui-stat-tile__delta ${up ? 'is-up' : 'is-down'}`}>
                <Icon name={up ? 'arrow-up' : 'arrow-down'} size={12} />
                {Math.abs(delta).toFixed(1)}%
              </span>
            )}
            {caption && <span className="ui-stat-tile__caption">{caption}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
