export const SIGNAL_CONFIG = {
  STRONG_LONG: { label: 'STRONG LONG', color: 'bg-green-500', textColor: 'text-green-400', emoji: '' },
  LONG: { label: 'LONG', color: 'bg-green-600', textColor: 'text-green-400', emoji: '' },
  WATCH: { label: 'WATCH', color: 'bg-yellow-500', textColor: 'text-yellow-400', emoji: '' },
  PASS: { label: 'PASS', color: 'bg-slate-600', textColor: 'text-slate-400', emoji: '' },
  SHORT: { label: 'SHORT', color: 'bg-red-500', textColor: 'text-red-400', emoji: '' },
};

export function formatPercent(value, decimals = 1) {
  if (value == null) return '—';
  return `${(value * 100).toFixed(decimals)}%`;
}

export function formatEdge(pp) {
  if (pp == null) return '—';
  const sign = pp >= 0 ? '+' : '';
  return `${sign}${pp.toFixed(1)}pp`;
}

export function formatKelly(fraction) {
  if (fraction == null) return '—';
  return `${(fraction * 100).toFixed(1)}%`;
}

export function formatPrice(cents) {
  if (cents == null) return '—';
  return `${Math.round(cents * 100)}¢`;
}

export function getSignalConfig(signal) {
  return SIGNAL_CONFIG[signal] || SIGNAL_CONFIG.PASS;
}
