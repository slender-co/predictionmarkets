import { useState, useEffect } from 'react';
import { getCalibrationLogs, getSessions } from '../api/client';
import { Link } from 'react-router-dom';

export default function Calibration() {
  const [logs, setLogs] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getCalibrationLogs().catch(() => []),
      getSessions({ status: 'resolved', limit: 50 }).catch(() => []),
    ]).then(([logData, sessionData]) => {
      setLogs(logData);
      setSessions(sessionData);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-slate-400 text-center py-20">Loading...</div>;

  // Compute aggregate stats from resolved sessions
  const resolvedSessions = sessions.filter(s => s.status === 'resolved');
  const allTerms = resolvedSessions.flatMap(s => s.terms || []);
  const resolvedTerms = allTerms.filter(t => t.resolution);
  const correctPredictions = resolvedTerms.filter(t => {
    if (!t.signal || t.signal === 'PASS') return false;
    const predictedYes = t.signal !== 'SHORT';
    const actualYes = t.resolution === 'YES';
    return predictedYes === actualYes;
  });
  const actionableTerms = resolvedTerms.filter(t => t.signal && t.signal !== 'PASS');

  const accuracy = actionableTerms.length > 0
    ? (correctPredictions.length / actionableTerms.length * 100).toFixed(1)
    : '—';

  // Brier score computation
  const brierScores = resolvedTerms
    .filter(t => t.p_model != null)
    .map(t => {
      const outcome = t.resolution === 'YES' ? 1 : 0;
      return Math.pow(t.p_model - outcome, 2);
    });
  const avgBrier = brierScores.length > 0
    ? (brierScores.reduce((s, b) => s + b, 0) / brierScores.length).toFixed(4)
    : '—';

  const formatDate = (ts) => {
    if (!ts) return '—';
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="max-w-[1000px]">
      <h2 className="text-2xl font-bold text-white mb-2">Calibration & Accuracy</h2>
      <p className="text-sm text-slate-400 mb-6">
        Track model performance across resolved sessions. Lower Brier score = better calibration.
      </p>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-center">
          <div className="text-xs text-slate-400 uppercase mb-1">Resolved Sessions</div>
          <div className="text-2xl font-bold text-white">{resolvedSessions.length}</div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-center">
          <div className="text-xs text-slate-400 uppercase mb-1">Actionable Calls</div>
          <div className="text-2xl font-bold text-white">{actionableTerms.length}</div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-center">
          <div className="text-xs text-slate-400 uppercase mb-1">Hit Rate</div>
          <div className={`text-2xl font-bold ${typeof accuracy === 'string' && accuracy !== '—' && parseFloat(accuracy) >= 50 ? 'text-green-400' : 'text-white'}`}>
            {accuracy}{accuracy !== '—' ? '%' : ''}
          </div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-center">
          <div className="text-xs text-slate-400 uppercase mb-1">Avg Brier Score</div>
          <div className={`text-2xl font-bold ${typeof avgBrier === 'string' && avgBrier !== '—' && parseFloat(avgBrier) <= 0.25 ? 'text-green-400' : avgBrier !== '—' && parseFloat(avgBrier) <= 0.35 ? 'text-yellow-400' : 'text-white'}`}>
            {avgBrier}
          </div>
          <div className="text-xs text-slate-500 mt-1">0 = perfect, 0.25 = baseline</div>
        </div>
      </div>

      {/* Calibration Logs */}
      {logs.length > 0 && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 mb-6">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">Calibration Log</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-400 uppercase border-b border-slate-600">
                  <th className="py-2 px-3 text-left">Session</th>
                  <th className="py-2 px-2 text-center">Correct</th>
                  <th className="py-2 px-2 text-center">Total</th>
                  <th className="py-2 px-2 text-center">Brier</th>
                  <th className="py-2 px-2 text-center">Cal Before</th>
                  <th className="py-2 px-2 text-center">Cal After</th>
                  <th className="py-2 px-2 text-center">Date</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} className="border-b border-slate-700/50 hover:bg-slate-800/50">
                    <td className="py-2 px-3">
                      <Link to={`/sessions/${log.session_id}`} className="text-blue-400 hover:text-blue-300">
                        Session #{log.session_id}
                      </Link>
                    </td>
                    <td className="py-2 px-2 text-center text-green-400">{log.predicted_correct}</td>
                    <td className="py-2 px-2 text-center">{log.predicted_total}</td>
                    <td className="py-2 px-2 text-center font-mono">{log.brier_score?.toFixed(4)}</td>
                    <td className="py-2 px-2 text-center font-mono text-slate-400">{log.calibration_factor_before?.toFixed(3)}</td>
                    <td className="py-2 px-2 text-center font-mono text-white">{log.calibration_factor_after?.toFixed(3)}</td>
                    <td className="py-2 px-2 text-center text-slate-400 text-xs">{formatDate(log.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Resolved Sessions List */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">Resolved Sessions</h3>
        {resolvedSessions.length === 0 ? (
          <p className="text-slate-500 text-center py-8">No resolved sessions yet. Resolve sessions to see calibration data.</p>
        ) : (
          <div className="space-y-2">
            {resolvedSessions.map(s => {
              const terms = s.terms || [];
              const resolved = terms.filter(t => t.resolution);
              const actionable = resolved.filter(t => t.signal && t.signal !== 'PASS');
              const correct = actionable.filter(t => {
                const predictedYes = t.signal !== 'SHORT';
                return (predictedYes && t.resolution === 'YES') || (!predictedYes && t.resolution === 'NO');
              });
              const acc = actionable.length > 0 ? (correct.length / actionable.length * 100).toFixed(0) : '—';

              return (
                <Link key={s.id} to={`/sessions/${s.id}`}
                  className="flex items-center justify-between py-3 px-4 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 transition-colors">
                  <div>
                    <span className="text-sm font-medium text-white">{s.subject_name}</span>
                    <span className="text-xs text-slate-400 ml-2">{s.event_name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-slate-400">{correct.length}/{actionable.length} correct</span>
                    <span className={`text-sm font-semibold ${acc !== '—' && parseFloat(acc) >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                      {acc}{acc !== '—' ? '%' : ''}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
