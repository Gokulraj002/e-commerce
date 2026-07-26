import type { ReactNode } from 'react';

import { Icon, type IconName } from './Icon';

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon?: IconName;
  /** Signed percentage delta vs. the previous period, e.g. 12.5 or -3. */
  delta?: number;
  /** Small caption under the value, e.g. "vs last week". */
  caption?: string;
  loading?: boolean;
}

/** Compact KPI tile for dashboards. */
export function StatCard({ label, value, icon, delta, caption, loading }: StatCardProps) {
  const hasDelta = typeof delta === 'number' && !Number.isNaN(delta);
  const up = hasDelta && delta >= 0;

  return (
    <div className="card h-100">
      <div className="ui-stat">
        {icon && (
          <div className="ui-stat__icon">
            <Icon name={icon} size={20} />
          </div>
        )}
        <div className="flex-grow-1 min-w-0">
          <div className="ui-stat__label">{label}</div>
          {loading ? (
            <div className="placeholder-glow mt-1">
              <span className="placeholder col-6" style={{ height: 20 }} />
            </div>
          ) : (
            <div className="ui-stat__value">{value}</div>
          )}
          {(hasDelta || caption) && (
            <div className="d-flex align-items-center gap-2 mt-1">
              {hasDelta && (
                <span className={`ui-stat__delta ${up ? 'is-up' : 'is-down'}`}>
                  <Icon name={up ? 'arrow-up' : 'arrow-down'} size={13} />
                  {Math.abs(delta).toFixed(1)}%
                </span>
              )}
              {caption && <span className="text-muted-2 small">{caption}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
