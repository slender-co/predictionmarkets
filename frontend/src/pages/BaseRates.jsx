import { useState, useEffect } from 'react';
import { getBaseRateSummary, getBaseRateTrends, getBaseRates } from '../api/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

export default function BaseRates() {
  const [summaries, setSummaries] = useState([]);
  const [trends, setTrends] = useState([]);
  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ speaker: '', show: '', term: '' });
  const [selectedPair, setSelectedPair] = useState(null);

  const loadSummaries = () => {
    setLoading(true);
    const params = {};
    if (filters.speaker) params.speaker = filters.speaker;
    if (filters.show) params.show = filters.show;
    if (filters.term) params.term = filters.term;

    Promise.all([
      getBaseRateSummary(params),
      getBaseRates({ ...params, limit: 50 }),
    ])
      .then(([sums, raw]) => {
        setSummaries(sums);
        setRawData(raw);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(loadSummaries, []);

  const handleSearch = (e) => {
    e.preventDefault();
    loadSummaries();
  };

  const loadTrends = (speaker, term) => {
    setSelectedPair({ speaker, term });
    getBaseRateTrends({ speaker, term })
      .then(setTrends)
      .catch(console.error);
  };

  return (
    <div className="max-w-[1200px]">
      <h2 className="text-2xl font-bold text-white mb-6">Base Rate Explorer</h2>

      {/* Filters */}
      <form onSubmit={handleSearch} className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 mb-6">
        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Speaker</label>
            <input
              type="text"
              value={filters.speaker}
              onChange={(e) => setFilters(p => ({ ...p, speaker: e.target.value }))}
              placeholder="mark kelly"
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Show</label>
            <input
              type="text"
              value={filters.show}
              onChange={(e) => setFilters(p => ({ ...p, show: e.target.value }))}
              placeholder="the last word"
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Term</label>
            <input
              type="text"
              value={filters.term}
              onChange={(e) => setFilters(p => ({ ...p, term: e.target.value }))}
              placeholder="missile"
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div className="flex items-end">
            <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors">
              Search
            </button>
          </div>
        </div>
      </form>

      {loading ? (
        <div className="text-slate-400 text-center py-10">Loading...</div>
      ) : summaries.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-lg mb-2">No base rate data yet</p>
          <p className="text-sm">Data accumulates automatically when you resolve sessions.</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 mb-6">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">Mention Rate Summary</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-400 uppercase border-b border-slate-600">
                    <th className="py-2 px-3 text-left">Speaker</th>
                    <th className="py-2 px-3 text-left">Term</th>
                    <th className="py-2 px-3 text-left">Show</th>
                    <th className="py-2 px-3 text-center">Appearances</th>
                    <th className="py-2 px-3 text-center">Mentioned</th>
                    <th className="py-2 px-3 text-center">Rate</th>
                    <th className="py-2 px-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {summaries.map((s, i) => (
                    <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-800/50">
                      <td className="py-3 px-3 text-white">{s.speaker}</td>
                      <td className="py-3 px-3 text-slate-300">{s.term}</td>
                      <td className="py-3 px-3 text-slate-400">{s.show || '—'}</td>
                      <td className="py-3 px-3 text-center">{s.total_appearances}</td>
                      <td className="py-3 px-3 text-center text-green-400">{s.times_mentioned}</td>
                      <td className="py-3 px-3 text-center font-semibold">
                        {(s.mention_rate * 100).toFixed(1)}%
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => loadTrends(s.speaker, s.term)}
                          className="text-xs text-blue-400 hover:text-blue-300"
                        >
                          Trends
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Trend Chart */}
          {selectedPair && trends.length > 0 && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 mb-6">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
                Mention Rate Trend: {selectedPair.speaker} / "{selectedPair.term}"
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={trends} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="period" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} domain={[0, 1]} tickFormatter={v => `${(v * 100).toFixed(0)}%`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                    formatter={(val) => [`${(val * 100).toFixed(1)}%`, 'Mention Rate']}
                  />
                  <Line type="monotone" dataKey="rate" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Raw Data */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">Recent Entries</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-400 uppercase border-b border-slate-600">
                    <th className="py-2 px-3 text-left">Speaker</th>
                    <th className="py-2 px-3 text-left">Term</th>
                    <th className="py-2 px-3 text-left">Show</th>
                    <th className="py-2 px-3 text-center">Mentioned</th>
                    <th className="py-2 px-3 text-center">Date</th>
                    <th className="py-2 px-3 text-center">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {rawData.map(entry => (
                    <tr key={entry.id} className="border-b border-slate-700/50">
                      <td className="py-2 px-3 text-white">{entry.speaker}</td>
                      <td className="py-2 px-3 text-slate-300">{entry.term}</td>
                      <td className="py-2 px-3 text-slate-400">{entry.show || '—'}</td>
                      <td className="py-2 px-3 text-center">
                        <span className={entry.mentioned ? 'text-green-400' : 'text-red-400'}>
                          {entry.mentioned ? 'YES' : 'NO'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center text-slate-400">{entry.event_date || '—'}</td>
                      <td className="py-2 px-3 text-center text-slate-500">{entry.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
