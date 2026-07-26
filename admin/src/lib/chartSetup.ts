import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartOptions,
} from 'chart.js';

/**
 * Register the Chart.js pieces we use, once, and expose shared defaults so all
 * charts read as one system. Import this module for its side effect (done by
 * ChartCard) before rendering any chart.
 */
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend,
);

ChartJS.defaults.font.family =
  "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
ChartJS.defaults.color = '#64748b';
ChartJS.defaults.plugins.legend.labels.boxWidth = 12;
ChartJS.defaults.plugins.legend.labels.usePointStyle = true;

/** Brand-aligned categorical palette for series colors. */
export const CHART_PALETTE = [
  '#C1121F',
  '#0ea5e9',
  '#16a34a',
  '#d97706',
  '#7c3aed',
  '#0891b2',
  '#db2777',
];

/** Sensible base options shared by cartesian (line/bar) charts. */
export const cartesianDefaults: ChartOptions<'line' | 'bar'> = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: { position: 'bottom' },
  },
  scales: {
    x: { grid: { display: false } },
    y: { border: { display: false }, grid: { color: '#eef1f5' }, beginAtZero: true },
  },
};
