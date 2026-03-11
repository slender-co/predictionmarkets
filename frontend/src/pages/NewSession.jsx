import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createSession, getSettings } from '../api/client';
import MarketTermRow from '../components/MarketTermRow';

const EVENT_TYPES = ['', 'rally', 'press_conference', 'interview', 'speech', 'debate'];

const emptyTerm = () => ({
  term: '', yes_price: '', no_price: '',
  s1_score: 0, s2_score: 0, s3_score: 0,
  tweet_within_6h: false, notes: '',
  // V2 fields
  s7_score: null, event_type: '', controversy_score: null,
  breaking_news_count: null, social_posts_count: null, source_hours_ago: null,
});

export default function NewSession() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [meta, setMeta] = useState({
    subject_name: '', event_name: '', show_name: '',
    network: '', event_date: '', event_time: '', notes: '',
    event_type: '',
  });
  const [terms, setTerms] = useState([emptyTerm()]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    getSettings().then(setSettings).catch(() => {});
  }, []);

  const updateTerm = (index, updated) => {
    setTerms(prev => prev.map((t, i) => i === index ? updated : t));
  };

  const removeTerm = (index) => {
    setTerms(prev => prev.filter((_, i) => i !== index));
  };

  const addTerm = () => setTerms(prev => [...prev, emptyTerm()]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validTerms = terms.filter(t => t.term && t.yes_price > 0);
    if (!meta.subject_name || !meta.event_name || validTerms.length === 0) return;

    setSubmitting(true);
    try {
      const session = await createSession({
        ...meta,
        terms: validTerms.map(t => ({
          ...t,
          yes_price: parseFloat(t.yes_price) || 0,
          no_price: parseFloat(t.no_price) || 0,
          event_type: t.event_type || meta.event_type || null,
          controversy_score: t.controversy_score != null ? parseFloat(t.controversy_score) : null,
          breaking_news_count: t.breaking_news_count != null ? parseInt(t.breaking_news_count) : null,
          social_posts_count: t.social_posts_count != null ? parseInt(t.social_posts_count) : null,
          source_hours_ago: t.source_hours_ago != null ? parseFloat(t.source_hours_ago) : null,
          s7_score: t.s7_score != null ? parseFloat(t.s7_score) : null,
        })),
      });
      navigate(`/sessions/${session.id}`);
    } catch (err) {
      console.error('Failed to create session:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const text = await file.text();
    try {
      const data = JSON.parse(text);
      const sessionData = data.sessions ? data.sessions[0] : data;

      if (sessionData.subject_name) {
        setMeta(prev => ({
          ...prev,
          subject_name: sessionData.subject_name || prev.subject_name,
          event_name: sessionData.event_name || prev.event_name,
          show_name: sessionData.show_name || prev.show_name,
          network: sessionData.network || prev.network,
          event_date: sessionData.event_date || prev.event_date,
          event_time: sessionData.event_time || prev.event_time,
          event_type: sessionData.event_type || prev.event_type,
        }));
      }

      if (sessionData.terms?.length) {
        setTerms(sessionData.terms.map(t => ({
          term: t.term || '',
          yes_price: t.yes_price ?? '',
          no_price: t.no_price ?? '',
          s1_score: t.s1_score ?? 0,
          s2_score: t.s2_score ?? 0,
          s3_score: t.s3_score ?? 0,
          tweet_within_6h: t.tweet_within_6h ?? false,
          notes: t.notes || '',
          s7_score: t.s7_score ?? null,
          event_type: t.event_type || '',
          controversy_score: t.controversy_score ?? null,
          breaking_news_count: t.breaking_news_count ?? null,
          social_posts_count: t.social_posts_count ?? null,
          source_hours_ago: t.source_hours_ago ?? null,
        })));
      }
    } catch {
      const lines = text.trim().split('\n');
      if (lines.length > 1) {
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const parsed = lines.slice(1).map(line => {
          const vals = line.split(',').map(v => v.trim());
          const obj = {};
          headers.forEach((h, i) => { obj[h] = vals[i]; });
          return {
            term: obj.term || '',
            yes_price: parseFloat(obj.yes_price) || 0,
            no_price: parseFloat(obj.no_price) || 0,
            s1_score: parseFloat(obj.s1_score) || 0,
            s2_score: parseFloat(obj.s2_score) || 0,
            s3_score: parseFloat(obj.s3_score) || 0,
            tweet_within_6h: obj.tweet_within_6h === '1' || obj.tweet_within_6h === 'true',
            notes: '',
            s7_score: obj.s7_score ? parseFloat(obj.s7_score) : null,
            event_type: obj.event_type || '',
            controversy_score: obj.controversy_score ? parseFloat(obj.controversy_score) : null,
            breaking_news_count: obj.breaking_news_count ? parseInt(obj.breaking_news_count) : null,
            social_posts_count: obj.social_posts_count ? parseInt(obj.social_posts_count) : null,
            source_hours_ago: obj.source_hours_ago ? parseFloat(obj.source_hours_ago) : null,
          };
        });
        if (parsed.length) setTerms(parsed);
      }
    }
    e.target.value = '';
  };

  const settingsForCalc = settings ? {
    weights: [settings.s1_weight, settings.s2_weight, settings.s3_weight],
    k_value: settings.k_value,
    kelly_divisor: settings.kelly_divisor,
    thresholds: [settings.strong_edge_threshold, settings.long_edge_threshold, settings.watch_edge_threshold],
    // V2
    s4_weight: settings.s4_weight,
    s5_weight: settings.s5_weight,
    s6_weight: settings.s6_weight,
    s7_weight: settings.s7_weight,
    k_base: settings.k_base,
    w_base: settings.w_base,
    yes_pseudo: settings.yes_pseudo,
    no_pseudo: settings.no_pseudo,
    decay_half_life: settings.decay_half_life,
    source_half_life: settings.source_half_life,
    calibration_factor: settings.calibration_factor,
    repetition_bias_enabled: settings.repetition_bias_enabled,
    audience_bias_enabled: settings.audience_bias_enabled,
    escalation_bias_enabled: settings.escalation_bias_enabled,
    news_reactivity_bias_enabled: settings.news_reactivity_bias_enabled,
    platform_priming_bias_enabled: settings.platform_priming_bias_enabled,
    repetition_boost: settings.repetition_boost,
    escalation_rate: settings.escalation_rate,
    reactivity_coefficient: settings.reactivity_coefficient,
    priming_boost: settings.priming_boost,
    audience_multipliers: settings.audience_multipliers,
  } : {};

  return (
    <div className="max-w-[1400px]">
      <h2 className="text-2xl font-bold text-white mb-6">New Analysis Session</h2>

      <form onSubmit={handleSubmit}>
        {/* Session Metadata */}
        <div className="bg-slate-800/50 rounded-xl p-5 mb-6 border border-slate-700">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">Event Details</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Subject Name *</label>
              <input type="text" required value={meta.subject_name}
                onChange={(e) => setMeta(p => ({ ...p, subject_name: e.target.value }))}
                placeholder="Donald Trump"
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Event Name *</label>
              <input type="text" required value={meta.event_name}
                onChange={(e) => setMeta(p => ({ ...p, event_name: e.target.value }))}
                placeholder="Rally in Ohio"
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Event Type</label>
              <select value={meta.event_type}
                onChange={(e) => setMeta(p => ({ ...p, event_type: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none">
                {EVENT_TYPES.map(t => (
                  <option key={t} value={t}>{t ? t.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()) : '— Select —'}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Network</label>
              <input type="text" value={meta.network}
                onChange={(e) => setMeta(p => ({ ...p, network: e.target.value }))}
                placeholder="Fox News"
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Show Name</label>
              <input type="text" value={meta.show_name}
                onChange={(e) => setMeta(p => ({ ...p, show_name: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Event Date</label>
              <input type="date" value={meta.event_date}
                onChange={(e) => setMeta(p => ({ ...p, event_date: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Event Time</label>
              <input type="time" value={meta.event_time}
                onChange={(e) => setMeta(p => ({ ...p, event_time: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Notes</label>
              <input type="text" value={meta.notes}
                onChange={(e) => setMeta(p => ({ ...p, notes: e.target.value }))}
                placeholder="Context, key observations..."
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none" />
            </div>
          </div>
        </div>

        {/* Market Terms Table */}
        <div className="bg-slate-800/50 rounded-xl p-5 mb-6 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Market Terms</h3>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowAdvanced(!showAdvanced)}
                className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${showAdvanced ? 'bg-blue-600/30 text-blue-400' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>
                {showAdvanced ? 'Hide' : 'Show'} Advanced
              </button>
              <label className="cursor-pointer bg-slate-700 hover:bg-slate-600 text-sm text-slate-300 px-3 py-1.5 rounded-lg transition-colors">
                Import JSON/CSV
                <input type="file" accept=".json,.csv" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-400 uppercase border-b border-slate-600">
                  <th className="py-2 px-1 text-left">Term</th>
                  <th className="py-2 px-1 text-center">Yes $</th>
                  <th className="py-2 px-1 text-center">No $</th>
                  <th className="py-2 px-1 text-center">S1</th>
                  <th className="py-2 px-1 text-center">S2</th>
                  <th className="py-2 px-1 text-center">S3</th>
                  <th className="py-2 px-1 text-center">6h?</th>
                  {showAdvanced && <>
                    <th className="py-2 px-1 text-center text-purple-400">S7</th>
                    <th className="py-2 px-1 text-center text-purple-400">Controv</th>
                    <th className="py-2 px-1 text-center text-purple-400">News#</th>
                    <th className="py-2 px-1 text-center text-purple-400">Posts#</th>
                    <th className="py-2 px-1 text-center text-purple-400">Src hrs</th>
                  </>}
                  <th className="py-2 px-2 text-center text-blue-400">P_mkt</th>
                  <th className="py-2 px-2 text-center text-blue-400">R_adj</th>
                  <th className="py-2 px-2 text-center text-blue-400">P_model</th>
                  <th className="py-2 px-2 text-center text-blue-400">Edge</th>
                  <th className="py-2 px-2 text-center text-blue-400">Signal</th>
                  <th className="py-2 px-1"></th>
                </tr>
              </thead>
              <tbody>
                {terms.map((term, i) => (
                  <MarketTermRow
                    key={i}
                    term={term}
                    index={i}
                    onChange={updateTerm}
                    onRemove={removeTerm}
                    settings={settingsForCalc}
                    showAdvanced={showAdvanced}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <button type="button" onClick={addTerm}
            className="mt-3 text-sm text-blue-400 hover:text-blue-300 transition-colors">
            + Add Term
          </button>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate('/')}
            className="px-5 py-2.5 text-sm text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={submitting}
            className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors disabled:opacity-50">
            {submitting ? 'Creating...' : 'Create Session & Analyze'}
          </button>
        </div>
      </form>
    </div>
  );
}
