import { useState, useEffect } from 'react';
import { getSourceEvents, createSourceEvent, createSourceEventsBatch, deleteSourceEvent } from '../api/client';

const SOURCE_TYPES = ['truth_social', 'twitter', 'news', 'transcript', 'press_conference', 'interview', 'rally', 'other'];

export default function SourceEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterSpeaker, setFilterSpeaker] = useState('');
  const [filterType, setFilterType] = useState('');

  // New event form
  const [form, setForm] = useState({
    speaker: '', source_type: 'truth_social', content_summary: '',
    terms_mentioned: '', relevance_score: 0.5, event_timestamp: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // Batch paste
  const [batchMode, setBatchMode] = useState(false);
  const [batchText, setBatchText] = useState('');

  const loadEvents = () => {
    const params = {};
    if (filterSpeaker) params.speaker = filterSpeaker;
    if (filterType) params.source_type = filterType;
    getSourceEvents(params)
      .then(setEvents)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(loadEvents, [filterSpeaker, filterType]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.speaker || !form.content_summary) return;
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        terms_mentioned: form.terms_mentioned
          ? JSON.stringify(form.terms_mentioned.split(',').map(t => t.trim()).filter(Boolean))
          : null,
        relevance_score: parseFloat(form.relevance_score) || 0.5,
        event_timestamp: form.event_timestamp || new Date().toISOString(),
      };
      await createSourceEvent(payload);
      setForm({ speaker: form.speaker, source_type: form.source_type, content_summary: '', terms_mentioned: '', relevance_score: 0.5, event_timestamp: '' });
      loadEvents();
    } catch (err) {
      console.error('Failed to create event:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleBatchSubmit = async () => {
    if (!batchText.trim()) return;
    setSubmitting(true);
    try {
      // Parse batch: each line is "content | terms | relevance"
      const lines = batchText.trim().split('\n').filter(l => l.trim());
      const events = lines.map(line => {
        const parts = line.split('|').map(p => p.trim());
        return {
          speaker: form.speaker || 'unknown',
          source_type: form.source_type || 'truth_social',
          content_summary: parts[0] || '',
          terms_mentioned: parts[1] ? JSON.stringify(parts[1].split(',').map(t => t.trim()).filter(Boolean)) : null,
          relevance_score: parts[2] ? parseFloat(parts[2]) : 0.5,
          event_timestamp: new Date().toISOString(),
        };
      });
      await createSourceEventsBatch(events);
      setBatchText('');
      loadEvents();
    } catch (err) {
      console.error('Failed to batch create:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (eventId) => {
    try {
      await deleteSourceEvent(eventId);
      setEvents(prev => prev.filter(e => e.id !== eventId));
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  const formatTime = (ts) => {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="max-w-[1200px]">
      <h2 className="text-2xl font-bold text-white mb-2">Source Events</h2>
      <p className="text-sm text-slate-400 mb-6">
        Log Truth Social posts, tweets, news items, and transcripts. These feed into S4 (base rate) and S5 (source proximity) computations.
      </p>

      {/* New Event Form */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Log New Event</h3>
          <button onClick={() => setBatchMode(!batchMode)}
            className={`text-xs px-3 py-1 rounded-lg ${batchMode ? 'bg-blue-600/30 text-blue-400' : 'bg-slate-700 text-slate-400'}`}>
            {batchMode ? 'Single Mode' : 'Batch Mode'}
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Speaker *</label>
            <input type="text" value={form.speaker}
              onChange={(e) => setForm(p => ({ ...p, speaker: e.target.value }))}
              placeholder="donald trump"
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Source Type</label>
            <select value={form.source_type}
              onChange={(e) => setForm(p => ({ ...p, source_type: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none">
              {SOURCE_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
            </select>
          </div>
          {!batchMode && (
            <>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Relevance (0-1)</label>
                <input type="number" value={form.relevance_score} min="0" max="1" step="0.1"
                  onChange={(e) => setForm(p => ({ ...p, relevance_score: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Event Time</label>
                <input type="datetime-local" value={form.event_timestamp}
                  onChange={(e) => setForm(p => ({ ...p, event_timestamp: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none" />
              </div>
            </>
          )}
        </div>

        {batchMode ? (
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Batch Input (one per line: content | terms,comma,sep | relevance)
            </label>
            <textarea value={batchText} onChange={(e) => setBatchText(e.target.value)}
              rows={6} placeholder={'Posted about tariffs on China | tariffs, china, trade | 0.8\nMentioned border wall again | border, wall, immigration | 0.6'}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none font-mono" />
            <button onClick={handleBatchSubmit} disabled={submitting}
              className="mt-3 px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors disabled:opacity-50">
              {submitting ? 'Submitting...' : 'Submit Batch'}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="block text-xs text-slate-400 mb-1">Content Summary *</label>
              <textarea value={form.content_summary}
                onChange={(e) => setForm(p => ({ ...p, content_summary: e.target.value }))}
                rows={2} placeholder="Truth Social post about tariffs on China..."
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none" />
            </div>
            <div className="mb-3">
              <label className="block text-xs text-slate-400 mb-1">Terms Mentioned (comma-separated)</label>
              <input type="text" value={form.terms_mentioned}
                onChange={(e) => setForm(p => ({ ...p, terms_mentioned: e.target.value }))}
                placeholder="tariffs, china, trade war"
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none" />
            </div>
            <button type="submit" disabled={submitting}
              className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors disabled:opacity-50">
              {submitting ? 'Logging...' : 'Log Event'}
            </button>
          </form>
        )}
      </div>

      {/* Filter & Event Feed */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Recent Events</h3>
          <div className="flex gap-3">
            <input type="text" value={filterSpeaker} onChange={(e) => setFilterSpeaker(e.target.value)}
              placeholder="Filter speaker..."
              className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none" />
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
              className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none">
              <option value="">All Types</option>
              {SOURCE_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="text-slate-400 text-center py-10">Loading...</div>
        ) : events.length === 0 ? (
          <div className="text-slate-500 text-center py-10">No events logged yet. Start logging source events above.</div>
        ) : (
          <div className="space-y-3">
            {events.map(evt => (
              <div key={evt.id} className="flex items-start gap-4 py-3 px-4 rounded-lg bg-slate-800/80 border border-slate-700/50">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-white capitalize">{evt.speaker}</span>
                    <span className="text-xs px-2 py-0.5 bg-slate-700 text-slate-300 rounded">{evt.source_type?.replace('_', ' ')}</span>
                    <span className="text-xs text-slate-500">{formatTime(evt.event_timestamp)}</span>
                    {evt.relevance_score != null && (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${evt.relevance_score >= 0.7 ? 'bg-green-600/20 text-green-400' : evt.relevance_score >= 0.4 ? 'bg-yellow-600/20 text-yellow-400' : 'bg-slate-700 text-slate-400'}`}>
                        {evt.relevance_score.toFixed(1)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-300">{evt.content_summary}</p>
                  {evt.terms_mentioned && (
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {(() => { try { const arr = typeof evt.terms_mentioned === 'string' ? JSON.parse(evt.terms_mentioned) : evt.terms_mentioned; return Array.isArray(arr) ? arr : []; } catch { return []; } })().map((term, i) => (
                        <span key={i} className="text-xs px-2 py-0.5 bg-blue-600/20 text-blue-400 rounded">{term}</span>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={() => handleDelete(evt.id)}
                  className="text-red-400/50 hover:text-red-400 text-xs px-2 py-1 transition-colors">
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
