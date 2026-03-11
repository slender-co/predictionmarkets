import EdgeBadge from './EdgeBadge';
import { formatPercent, formatEdge, formatKelly } from '../utils/formatters';
import { runFullAnalysis, runFullAnalysisV2 } from '../utils/calculations';

export default function MarketTermRow({ term, index, onChange, onRemove, settings, readOnly = false, showAdvanced = false }) {
  const hasV2 = term.s7_score != null || term.controversy_score != null ||
    term.breaking_news_count != null || term.social_posts_count != null || term.source_hours_ago != null;

  const analysis = readOnly
    ? {
        pMarket: term.p_market,
        rAdj: term.r_adj,
        pModel: term.p_model,
        edgePp: term.edge_pp,
        kellyFraction: term.kelly_fraction,
        signal: term.signal,
        biasTotal: term.bias_total,
        confidence: term.confidence,
        pBaseRate: term.p_base_rate,
        s4: term.s4_score,
        s5: term.s5_score,
        s6: term.s6_score,
      }
    : (hasV2 && settings.s4_weight != null)
      ? runFullAnalysisV2(
          term.yes_price || 0, term.no_price || 0,
          term.s1_score || 0, term.s2_score || 0, term.s3_score || 0,
          term.tweet_within_6h || false,
          settings,
          {
            s7: term.s7_score,
            event_type: term.event_type,
            controversy_score: term.controversy_score,
            breaking_news_count: term.breaking_news_count,
            social_posts_count: term.social_posts_count,
            source_hours_ago: term.source_hours_ago,
          },
        )
      : runFullAnalysis(
          term.yes_price || 0, term.no_price || 0,
          term.s1_score || 0, term.s2_score || 0, term.s3_score || 0,
          term.tweet_within_6h || false,
          settings,
        );

  if (readOnly) {
    return (
      <tr className="border-b border-slate-700/50 hover:bg-slate-800/50">
        <td className="py-3 px-3 font-medium text-white">{term.term}</td>
        <td className="py-3 px-2 text-center">{formatPercent(analysis.pMarket)}</td>
        <td className="py-3 px-2 text-center">{term.s1_score?.toFixed(2)}</td>
        <td className="py-3 px-2 text-center">{term.s2_score?.toFixed(2)}</td>
        <td className="py-3 px-2 text-center">{term.s3_score?.toFixed(2)}</td>
        <td className="py-3 px-2 text-center">{term.tweet_within_6h ? 'x1.5' : '—'}</td>
        {showAdvanced && <>
          <td className="py-3 px-2 text-center text-purple-300 text-xs">{term.s4_score != null ? term.s4_score.toFixed(2) : '—'}</td>
          <td className="py-3 px-2 text-center text-purple-300 text-xs">{term.s5_score != null ? term.s5_score.toFixed(2) : '—'}</td>
          <td className="py-3 px-2 text-center text-purple-300 text-xs">{term.s6_score != null ? term.s6_score.toFixed(2) : '—'}</td>
          <td className="py-3 px-2 text-center text-purple-300 text-xs">{term.s7_score != null ? term.s7_score.toFixed(2) : '—'}</td>
          <td className="py-3 px-2 text-center text-purple-300 text-xs">{analysis.biasTotal != null ? analysis.biasTotal.toFixed(3) : '—'}</td>
          <td className="py-3 px-2 text-center text-purple-300 text-xs">{analysis.confidence != null ? (analysis.confidence * 100).toFixed(0) + '%' : '—'}</td>
        </>}
        <td className="py-3 px-2 text-center">{analysis.rAdj?.toFixed(3)}</td>
        <td className="py-3 px-2 text-center">{formatPercent(analysis.pModel)}</td>
        <td className="py-3 px-2 text-center font-semibold">{formatEdge(analysis.edgePp)}</td>
        <td className="py-3 px-2 text-center">{formatKelly(analysis.kellyFraction)}</td>
        <td className="py-3 px-2 text-center">
          <EdgeBadge signal={analysis.signal} />
        </td>
      </tr>
    );
  }

  const update = (field, value) => onChange(index, { ...term, [field]: value });

  return (
    <tr className="border-b border-slate-700/50">
      <td className="py-2 px-1">
        <input type="text" value={term.term || ''} onChange={(e) => update('term', e.target.value)}
          placeholder="Term / Phrase"
          className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none" />
      </td>
      <td className="py-2 px-1">
        <input type="number" value={term.yes_price ?? ''} onChange={(e) => update('yes_price', parseFloat(e.target.value) || 0)}
          step="0.01" min="0" max="1" placeholder="0.00"
          className="w-20 bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-center text-white focus:border-blue-500 focus:outline-none" />
      </td>
      <td className="py-2 px-1">
        <input type="number" value={term.no_price ?? ''} onChange={(e) => update('no_price', parseFloat(e.target.value) || 0)}
          step="0.01" min="0" max="1" placeholder="0.00"
          className="w-20 bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-center text-white focus:border-blue-500 focus:outline-none" />
      </td>
      <td className="py-2 px-1">
        <input type="number" value={term.s1_score ?? ''} onChange={(e) => update('s1_score', parseFloat(e.target.value) || 0)}
          step="0.1" min="0" max="1"
          className="w-16 bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-center text-white focus:border-blue-500 focus:outline-none" />
      </td>
      <td className="py-2 px-1">
        <input type="number" value={term.s2_score ?? ''} onChange={(e) => update('s2_score', parseFloat(e.target.value) || 0)}
          step="0.1" min="0" max="1"
          className="w-16 bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-center text-white focus:border-blue-500 focus:outline-none" />
      </td>
      <td className="py-2 px-1">
        <input type="number" value={term.s3_score ?? ''} onChange={(e) => update('s3_score', parseFloat(e.target.value) || 0)}
          step="0.1" min="0" max="1"
          className="w-16 bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-center text-white focus:border-blue-500 focus:outline-none" />
      </td>
      <td className="py-2 px-1 text-center">
        <input type="checkbox" checked={term.tweet_within_6h || false}
          onChange={(e) => update('tweet_within_6h', e.target.checked)}
          className="w-4 h-4 accent-blue-500" />
      </td>
      {showAdvanced && <>
        <td className="py-2 px-1">
          <input type="number" value={term.s7_score ?? ''} onChange={(e) => update('s7_score', e.target.value === '' ? null : parseFloat(e.target.value))}
            step="0.1" min="0" max="1" placeholder="—"
            className="w-14 bg-slate-800 border border-purple-600/50 rounded px-1 py-1.5 text-sm text-center text-white focus:border-purple-500 focus:outline-none" />
        </td>
        <td className="py-2 px-1">
          <input type="number" value={term.controversy_score ?? ''} onChange={(e) => update('controversy_score', e.target.value === '' ? null : parseFloat(e.target.value))}
            step="0.1" min="0" max="1" placeholder="—"
            className="w-14 bg-slate-800 border border-purple-600/50 rounded px-1 py-1.5 text-sm text-center text-white focus:border-purple-500 focus:outline-none" />
        </td>
        <td className="py-2 px-1">
          <input type="number" value={term.breaking_news_count ?? ''} onChange={(e) => update('breaking_news_count', e.target.value === '' ? null : parseInt(e.target.value))}
            min="0" max="50" placeholder="—"
            className="w-14 bg-slate-800 border border-purple-600/50 rounded px-1 py-1.5 text-sm text-center text-white focus:border-purple-500 focus:outline-none" />
        </td>
        <td className="py-2 px-1">
          <input type="number" value={term.social_posts_count ?? ''} onChange={(e) => update('social_posts_count', e.target.value === '' ? null : parseInt(e.target.value))}
            min="0" max="100" placeholder="—"
            className="w-14 bg-slate-800 border border-purple-600/50 rounded px-1 py-1.5 text-sm text-center text-white focus:border-purple-500 focus:outline-none" />
        </td>
        <td className="py-2 px-1">
          <input type="number" value={term.source_hours_ago ?? ''} onChange={(e) => update('source_hours_ago', e.target.value === '' ? null : parseFloat(e.target.value))}
            step="0.5" min="0" max="168" placeholder="—"
            className="w-14 bg-slate-800 border border-purple-600/50 rounded px-1 py-1.5 text-sm text-center text-white focus:border-purple-500 focus:outline-none" />
        </td>
      </>}
      {/* Live preview columns */}
      <td className="py-2 px-2 text-center text-xs text-slate-400">{formatPercent(analysis.pMarket)}</td>
      <td className="py-2 px-2 text-center text-xs text-slate-400">{analysis.rAdj?.toFixed(3)}</td>
      <td className="py-2 px-2 text-center text-xs text-slate-400">{formatPercent(analysis.pModel)}</td>
      <td className="py-2 px-2 text-center text-xs font-semibold">{formatEdge(analysis.edgePp)}</td>
      <td className="py-2 px-2 text-center">
        <EdgeBadge signal={analysis.signal} />
      </td>
      <td className="py-2 px-1 text-center">
        <button onClick={() => onRemove(index)} className="text-red-400 hover:text-red-300 text-sm px-1">X</button>
      </td>
    </tr>
  );
}
