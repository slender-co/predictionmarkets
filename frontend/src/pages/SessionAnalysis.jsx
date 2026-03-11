import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getSession, resolveSession, recalculateSession, exportSession, calibrateSession } from '../api/client';
import MarketTermRow from '../components/MarketTermRow';
import EdgeBadge from '../components/EdgeBadge';
import { formatPercent, formatEdge, formatKelly } from '../utils/formatters';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const SIGNAL_COLORS = {
  STRONG_LONG: '#22c55e',
  LONG: '#16a34a',
  WATCH: '#eab308',
  PASS: '#64748b',
  SHORT: '#ef4444',
};

const SIGNAL_LABELS = {
  s1_score: 'S1 Social',
  s2_score: 'S2 Transcript',
  s3_score: 'S3 News',
  s4_score: 'S4 Base Rate',
  s5_score: 'S5 Source Prox',
  s6_score: 'S6 Correlation',
  s7_score: 'S7 Contrarian',
};

export default function SessionAnalysis() {
  const { id } = useParams();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const [resolutions, setResolutions] = useState({});
  const [expandedTerm, setExpandedTerm] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const loadSession = () => {
    getSession(id)
      .then(data => {
        setSession(data);
        const res = {};
        data.terms.forEach(t => { res[t.id] = t.resolution || ''; });
        setResolutions(res);
        // Auto-show advanced if any V2 data exists
        const hasV2 = data.terms.some(t => t.s4_score != null || t.s5_score != null || t.bias_total != null);
        if (hasV2) setShowAdvanced(true);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(loadSession, [id]);

  const handleRecalculate = async () => {
    await recalculateSession(id);
    loadSession();
  };

  const handleCalibrate = async () => {
    setCalibrating(true);
    try {
      await calibrateSession(id);
      loadSession();
    } catch (err) {
      console.error('Failed to calibrate:', err);
    } finally {
      setCalibrating(false);
    }
  };

  const handleResolve = async () => {
    const payload = {
      resolutions: Object.entries(resolutions)
        .filter(([_, val]) => val === 'YES' || val === 'NO')
        .map(([termId, resolution]) => ({ term_id: parseInt(termId), resolution })),
    };
    if (payload.resolutions.length === 0) return;
    setResolving(true);
    try {
      await resolveSession(id, payload);
      loadSession();
    } catch (err) {
      console.error('Failed to resolve:', err);
    } finally {
      setResolving(false);
    }
  };

  const handleExport = async () => {
    const data = await exportSession(id);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session-${id}-export.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="text-slate-400 text-center py-20">Loading...</div>;
  if (!session) return <div className="text-red-400 text-center py-20">Session not found</div>;

  const sortedTerms = [...(session.terms || [])].sort((a, b) => {
    if (a.edge_pp == null) return 1;
    if (b.edge_pp == null) return -1;
    return Math.abs(b.edge_pp) - Math.abs(a.edge_pp);
  });

  const kellyChartData = sortedTerms
    .filter(t => t.signal && t.signal !== 'PASS')
    .map(t => ({
      term: t.term,
      kelly: t.signal === 'SHORT' ? -(t.kelly_fraction || 0) * 100 : (t.kelly_fraction || 0) * 100,
      signal: t.signal,
    }));

  return (
    <div className="max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link to="/" className="text-sm text-slate-400 hover:text-slate-300 mb-1 inline-block">&larr; Dashboard</Link>
          <h2 className="text-2xl font-bold text-white">{session.subject_name}</h2>
          <p className="text-slate-400 text-sm">
            {session.event_name} {session.show_name && `| ${session.show_name}`} {session.network && `(${session.network})`}
            {session.event_date && ` | ${session.event_date}`}
            {session.event_type && <span className="ml-2 px-2 py-0.5 bg-purple-600/20 text-purple-400 rounded text-xs">{session.event_type}</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAdvanced(!showAdvanced)}
            className={`px-3 py-2 text-sm rounded-lg transition-colors ${showAdvanced ? 'bg-purple-600/20 text-purple-400' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}>
            {showAdvanced ? 'Hide V2' : 'Show V2'}
          </button>
          <button onClick={handleRecalculate} className="px-3 py-2 text-sm bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors">
            Recalculate
          </button>
          <button onClick={handleExport} className="px-3 py-2 text-sm bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors">
            Export JSON
          </button>
          {session.status === 'resolved' && (
            <button onClick={handleCalibrate} disabled={calibrating}
              className="px-3 py-2 text-sm bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 rounded-lg transition-colors disabled:opacity-50">
              {calibrating ? 'Calibrating...' : 'Calibrate'}
            </button>
          )}
          <span className={`px-3 py-2 text-sm rounded-lg ${session.status === 'active' ? 'bg-green-600/20 text-green-400' : 'bg-blue-600/20 text-blue-400'}`}>
            {session.status}
          </span>
        </div>
      </div>

      {/* Analysis Table */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 mb-6">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">Full Analysis</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-400 uppercase border-b border-slate-600">
                <th className="py-2 px-3 text-left">Term</th>
                <th className="py-2 px-2 text-center">P_mkt</th>
                <th className="py-2 px-2 text-center">S1</th>
                <th className="py-2 px-2 text-center">S2</th>
                <th className="py-2 px-2 text-center">S3</th>
                <th className="py-2 px-2 text-center">6h Mult</th>
                {showAdvanced && <>
                  <th className="py-2 px-2 text-center text-purple-400">S4</th>
                  <th className="py-2 px-2 text-center text-purple-400">S5</th>
                  <th className="py-2 px-2 text-center text-purple-400">S6</th>
                  <th className="py-2 px-2 text-center text-purple-400">S7</th>
                  <th className="py-2 px-2 text-center text-purple-400">Bias</th>
                  <th className="py-2 px-2 text-center text-purple-400">Conf</th>
                </>}
                <th className="py-2 px-2 text-center">R_adj</th>
                <th className="py-2 px-2 text-center">P_model</th>
                <th className="py-2 px-2 text-center">Edge</th>
                <th className="py-2 px-2 text-center">Kelly f*</th>
                <th className="py-2 px-2 text-center">Signal</th>
              </tr>
            </thead>
            <tbody>
              {sortedTerms.map(term => (
                <MarketTermRow key={term.id} term={term} readOnly showAdvanced={showAdvanced} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Signal Breakdown (expandable per term) */}
      {showAdvanced && sortedTerms.some(t => t.s4_score != null || t.bias_total != null) && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 mb-6">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">Signal Breakdown</h3>
          <div className="space-y-2">
            {sortedTerms.filter(t => t.signal && t.signal !== 'PASS').map(t => (
              <div key={t.id}>
                <button onClick={() => setExpandedTerm(expandedTerm === t.id ? null : t.id)}
                  className="w-full flex items-center justify-between py-2 px-3 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-white">{t.term}</span>
                    <EdgeBadge signal={t.signal} />
                  </div>
                  <span className="text-xs text-slate-400">{expandedTerm === t.id ? '▲' : '▼'}</span>
                </button>
                {expandedTerm === t.id && (
                  <div className="ml-4 mt-2 mb-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                    {Object.entries(SIGNAL_LABELS).map(([key, label]) => {
                      const val = t[key];
                      return (
                        <div key={key} className="bg-slate-900/50 rounded-lg p-3">
                          <div className="text-xs text-slate-400">{label}</div>
                          <div className={`text-lg font-mono ${val != null ? 'text-white' : 'text-slate-600'}`}>
                            {val != null ? val.toFixed(3) : 'N/A'}
                          </div>
                          {val != null && (
                            <div className="mt-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(val * 100, 100)}%` }} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {t.bias_total != null && (
                      <div className="bg-slate-900/50 rounded-lg p-3">
                        <div className="text-xs text-slate-400">Bias Total</div>
                        <div className="text-lg font-mono text-amber-400">{t.bias_total.toFixed(3)}</div>
                      </div>
                    )}
                    {t.confidence != null && (
                      <div className="bg-slate-900/50 rounded-lg p-3">
                        <div className="text-xs text-slate-400">Confidence</div>
                        <div className="text-lg font-mono text-cyan-400">{(t.confidence * 100).toFixed(1)}%</div>
                      </div>
                    )}
                    {t.p_base_rate != null && (
                      <div className="bg-slate-900/50 rounded-lg p-3">
                        <div className="text-xs text-slate-400">Base Rate P</div>
                        <div className="text-lg font-mono text-green-400">{(t.p_base_rate * 100).toFixed(1)}%</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Kelly Chart */}
      {kellyChartData.length > 0 && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 mb-6">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">Kelly Position Sizing</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={kellyChartData} margin={{ top: 5, right: 30, left: 20, bottom: 50 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="term" tick={{ fill: '#94a3b8', fontSize: 11 }} angle={-30} textAnchor="end" />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} label={{ value: 'Kelly %', angle: -90, position: 'insideLeft', fill: '#94a3b8' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                labelStyle={{ color: '#e2e8f0' }}
                formatter={(val) => [`${val.toFixed(1)}%`, 'Kelly f*']}
              />
              <Bar dataKey="kelly" radius={[4, 4, 0, 0]}>
                {kellyChartData.map((entry, i) => (
                  <Cell key={i} fill={SIGNAL_COLORS[entry.signal] || '#64748b'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Priority Order */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 mb-6">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">Priority Order</h3>
        <div className="space-y-2">
          {sortedTerms
            .filter(t => t.signal && t.signal !== 'PASS')
            .map((t, i) => (
              <div key={t.id} className="flex items-center gap-4 py-2 px-3 rounded-lg bg-slate-800/80">
                <span className="text-lg font-bold text-slate-500 w-8">#{i + 1}</span>
                <span className="font-medium text-white flex-1">{t.term}</span>
                <span className="text-sm text-slate-400">
                  {t.signal === 'SHORT' ? 'NO' : 'YES'} @ {formatPercent(t.signal === 'SHORT' ? (1 - t.p_market) : t.p_market, 0)}
                </span>
                <span className="text-sm font-semibold">{formatEdge(t.edge_pp)}</span>
                <EdgeBadge signal={t.signal} size="lg" />
              </div>
            ))}
        </div>
      </div>

      {/* Resolution Panel */}
      {session.status === 'active' && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
            Resolve Session (Post-Event)
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Mark each term as YES (mentioned) or NO (not mentioned) to resolve the session and feed base rate data.
          </p>
          <div className="space-y-2 mb-4">
            {session.terms.map(t => (
              <div key={t.id} className="flex items-center gap-4 py-2">
                <span className="text-sm text-white flex-1">{t.term}</span>
                <select
                  value={resolutions[t.id] || ''}
                  onChange={(e) => setResolutions(prev => ({ ...prev, [t.id]: e.target.value }))}
                  className="bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none">
                  <option value="">—</option>
                  <option value="YES">YES (Mentioned)</option>
                  <option value="NO">NO (Not Mentioned)</option>
                </select>
              </div>
            ))}
          </div>
          <button onClick={handleResolve} disabled={resolving}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors disabled:opacity-50">
            {resolving ? 'Resolving...' : 'Resolve Session'}
          </button>
        </div>
      )}

      {/* Notes */}
      {session.notes && (
        <div className="mt-6 bg-slate-800/50 border border-slate-700 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-2">Notes</h3>
          <p className="text-sm text-slate-300 whitespace-pre-wrap">{session.notes}</p>
        </div>
      )}
    </div>
  );
}
