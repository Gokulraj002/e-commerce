import type { ReactNode } from 'react';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import type { ChartData, ChartOptions } from 'chart.js';

import { cartesianDefaults } from '@/lib/chartSetup';

import { Spinner } from './Spinner';

export type ChartKind = 'line' | 'bar' | 'doughnut';

interface ChartCardProps<K extends ChartKind> {
  title: string;
  subtitle?: string;
  type: K;
  data: ChartData<K>;
  options?: ChartOptions<K>;
  /** Right-aligned header controls (e.g. a range selector). */
  actions?: ReactNode;
  /** Canvas height in px. Defaults to 280. */
  height?: number;
  loading?: boolean;
}

function renderChart<K extends ChartKind>(
  type: K,
  data: ChartData<K>,
  options?: ChartOptions<K>,
): ReactNode {
  switch (type) {
    case 'line':
      return (
        <Line
          data={data as ChartData<'line'>}
          options={{ ...(cartesianDefaults as ChartOptions<'line'>), ...(options as ChartOptions<'line'>) }}
        />
      );
    case 'bar':
      return (
        <Bar
          data={data as ChartData<'bar'>}
          options={{ ...(cartesianDefaults as ChartOptions<'bar'>), ...(options as ChartOptions<'bar'>) }}
        />
      );
    default:
      return <Doughnut data={data as ChartData<'doughnut'>} options={options as ChartOptions<'doughnut'>} />;
  }
}

/**
 * Card wrapper around Chart.js (via react-chartjs-2). Handles the header,
 * fixed-height responsive canvas, and a loading state so pages stay terse:
 *
 *   <ChartCard title="Revenue" type="line" data={data} />
 */
export function ChartCard<K extends ChartKind>({
  title,
  subtitle,
  type,
  data,
  options,
  actions,
  height = 280,
  loading,
}: ChartCardProps<K>) {
  return (
    <div className="card h-100">
      <div className="card-body d-flex flex-column">
        <div className="d-flex align-items-start justify-content-between mb-3">
          <div>
            <h3 className="ui-card-title">{title}</h3>
            {subtitle && <p className="ui-card-subtitle">{subtitle}</p>}
          </div>
          {actions}
        </div>
        <div style={{ position: 'relative', height, flex: '1 1 auto' }}>
          {loading ? (
            <div className="center-fill" style={{ minHeight: height }}>
              <Spinner label="Loading chart…" />
            </div>
          ) : (
            renderChart(type, data, options)
          )}
        </div>
      </div>
    </div>
  );
}
