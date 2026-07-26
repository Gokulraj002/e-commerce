import { useId } from 'react';

interface SparkLineProps {
  /** Raw values, oldest → newest. Length should be ≥ 2 for a visible line. */
  data: number[];
  /** Rendered width in px. */
  width?: number;
  /** Rendered height in px. */
  height?: number;
  /** Stroke color. Accepts any CSS color, including `var(--…)` custom props. */
  color?: string;
  /** Opacity of the soft area fill under the line. */
  fillOpacity?: number;
  /** Accessible label. Defaults to a hidden decorative sparkline. */
  ariaLabel?: string;
}

/**
 * Tiny inline sparkline drawn as a plain SVG polyline. Zero dependencies.
 *
 *  - Renders a smooth stroked line with a subtly-filled area under it.
 *  - When all values are equal (or the series is empty / a single point),
 *    draws a flat baseline through the vertical middle — never a spike.
 *  - `color` accepts CSS custom properties, so the caller can theme it via
 *    `var(--brand)` etc.
 */
export function SparkLine({
  data,
  width = 96,
  height = 32,
  color = 'var(--brand)',
  fillOpacity = 0.12,
  ariaLabel,
}: SparkLineProps) {
  const gradientId = useId();
  const pad = 2;
  const w = width;
  const h = height;
  const innerW = Math.max(w - pad * 2, 1);
  const innerH = Math.max(h - pad * 2, 1);

  // Empty guard — render a flat neutral baseline so tiles never collapse.
  const safe = data && data.length > 0 ? data : [0, 0];
  const min = Math.min(...safe);
  const max = Math.max(...safe);
  const range = max - min;
  const flat = range === 0;

  const stepX = safe.length > 1 ? innerW / (safe.length - 1) : 0;
  const yFor = (v: number): number =>
    flat ? h / 2 : pad + innerH * (1 - (v - min) / range);

  const points = safe.map((v, i) => `${(pad + i * stepX).toFixed(2)},${yFor(v).toFixed(2)}`);
  const line = points.join(' ');
  const lastX = pad + (safe.length - 1) * stepX;
  const area = `${pad.toFixed(2)},${h} ${line} ${lastX.toFixed(2)},${h}`;

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      role={ariaLabel ? 'img' : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      style={{ display: 'block', overflow: 'visible' }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={fillOpacity} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${gradientId})`} stroke="none" />
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
