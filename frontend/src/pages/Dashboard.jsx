import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getSessions } from '../api/client';
import EdgeBadge from '../components/EdgeBadge';
import { formatEdge } from '../utils/formatters';

export default function Dashboard() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    getSessions()
      .then(setSessions)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const activeSessions = sessions.filter(s => s.status === 'active');
  const resolvedSessions = sessions.filter(s => s.status === 'resolved');
  const filtered = sessions.filter(s =>
    !filter || s.subject_name.toLowerCase().includes(filter.toLowerCase()) ||
    s.event_name.toLowerCase().includes(filter.toLowerCase())
  );

  if (loading) {
    return <div className="text-slate-400 text-center py-20">Loading...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Dashboard</h2>
        <Link
          to="/sessions/new"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          + New Session
        </Link>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <p className="text-xs text-slate-400 uppercase">Total Sessions</p>
          <p className="text-2xl font-bold text-white mt-1">{sessions.length}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <p className="text-xs text-slate-400 uppercase">Active</p>
          <p className="text-2xl font-bold text-green-400 mt-1">{activeSessions.length}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <p className="text-xs text-slate-400 uppercase">Resolved</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">{resolvedSessions.length}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <p className="text-xs text-slate-400 uppercase">Total Markets</p>
          <p className="text-2xl font-bold text-white mt-1">
            {sessions.reduce((sum, s) => sum + (s.term_count || 0), 0)}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search sessions..."
          className="w-full max-w-md bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
        />
      </div>

      {/* Sessions Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-lg mb-2">No sessions yet</p>
          <p className="text-sm">Create your first analysis session to get started.</p>
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-400 uppercase border-b border-slate-700">
                <th className="py-3 px-4 text-left">Subject</th>
                <th className="py-3 px-4 text-left">Event</th>
                <th className="py-3 px-4 text-left">Show</th>
                <th className="py-3 px-4 text-center">Date</th>
                <th className="py-3 px-4 text-center">Terms</th>
                <th className="py-3 px-4 text-center">Best Edge</th>
                <th className="py-3 px-4 text-center">Top Signal</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(session => (
                <tr key={session.id} className="border-b border-slate-700/50 hover:bg-slate-800/50">
                  <td className="py-3 px-4">
                    <Link to={`/sessions/${session.id}`} className="text-blue-400 hover:text-blue-300 font-medium">
                      {session.subject_name}
                    </Link>
                  </td>
                  <td className="py-3 px-4 text-slate-300">{session.event_name}</td>
                  <td className="py-3 px-4 text-slate-400">{session.show_name || '—'}</td>
                  <td className="py-3 px-4 text-center text-slate-400">{session.event_date || '—'}</td>
                  <td className="py-3 px-4 text-center text-slate-300">{session.term_count}</td>
                  <td className="py-3 px-4 text-center font-semibold">
                    {formatEdge(session.best_edge)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {session.top_signal && <EdgeBadge signal={session.top_signal} />}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      session.status === 'active' ? 'bg-green-600/20 text-green-400' :
                      session.status === 'resolved' ? 'bg-blue-600/20 text-blue-400' :
                      'bg-slate-600/20 text-slate-400'
                    }`}>
                      {session.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
