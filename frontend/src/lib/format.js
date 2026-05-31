export function formatPercent(value) {
  if (value == null || Number.isNaN(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${Number(value).toFixed(1)}%`;
}

export function formatScore(score) {
  if (score == null) return '—';
  return Math.round(score);
}

export function formatDate(value) {
  if (!value) return 'Present';
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
}

export const BAND_STYLES = {
  stable: {
    label: 'Stable',
    exposureLabel: 'Low growth exposure',
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    ring: 'ring-slate-200',
    dot: 'bg-slate-500',
    bar: 'bg-slate-400',
  },
  moderate: {
    label: 'Moderate',
    exposureLabel: 'Moderate growth exposure',
    bg: 'bg-sky-50',
    text: 'text-sky-800',
    ring: 'ring-sky-200',
    dot: 'bg-sky-500',
    bar: 'bg-sky-500',
  },
  fast: {
    label: 'Fast growth',
    exposureLabel: 'High growth exposure',
    bg: 'bg-amber-50',
    text: 'text-amber-900',
    ring: 'ring-amber-200',
    dot: 'bg-amber-500',
    bar: 'bg-amber-500',
  },
  hypergrowth: {
    label: 'Hypergrowth',
    exposureLabel: 'Very high growth exposure',
    bg: 'bg-emerald-50',
    text: 'text-emerald-900',
    ring: 'ring-emerald-200',
    dot: 'bg-emerald-500',
    bar: 'bg-emerald-600',
  },
};

export function getBandStyle(band) {
  return BAND_STYLES[band] || BAND_STYLES.stable;
}
