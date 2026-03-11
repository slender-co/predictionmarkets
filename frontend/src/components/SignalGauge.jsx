export default function SignalGauge({ label, value, max = 1.0 }) {
  const pct = Math.min((value / max) * 100, 100);
  const color =
    pct >= 80 ? 'bg-green-500' :
    pct >= 50 ? 'bg-yellow-500' :
    pct >= 20 ? 'bg-orange-500' :
    'bg-red-500';

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-400 w-6">{label}</span>
      <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-300 w-8 text-right">{value.toFixed(2)}</span>
    </div>
  );
}
