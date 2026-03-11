import { getSignalConfig, formatEdge } from '../utils/formatters';

export default function EdgeBadge({ signal, edgePp, size = 'sm' }) {
  const config = getSignalConfig(signal);
  const sizeClasses = size === 'lg' ? 'px-3 py-1.5 text-sm' : 'px-2 py-0.5 text-xs';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold text-white ${config.color} ${sizeClasses}`}>
      {config.label}
      {edgePp != null && (
        <span className="opacity-80">{formatEdge(edgePp)}</span>
      )}
    </span>
  );
}
