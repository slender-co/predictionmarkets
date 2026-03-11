import { useState, useEffect } from 'react';
import { getSettings, updateSettings } from '../api/client';

const SIGNAL_DEFS = [
  { field: 's1_weight', label: 'S1 — Social Sentiment', desc: 'Twitter/Truth Social keyword match, topic velocity, recency' },
  { field: 's2_weight', label: 'S2 — Transcript Pattern', desc: 'Phrase proximity, semantic drift, show structure' },
  { field: 's3_weight', label: 'S3 — News Momentum', desc: 'Network graph influence, topic overlap' },
  { field: 's4_weight', label: 'S4 — Base Rate Prior', desc: 'Historical mention frequency (auto-computed from DB)' },
  { field: 's5_weight', label: 'S5 — Source Proximity', desc: 'Recency-weighted source events (exponential decay)' },
  { field: 's6_weight', label: 'S6 — Cross-Term Correlation', desc: 'Boost from correlated terms in same session' },
  { field: 's7_weight', label: 'S7 — Contrarian Indicator', desc: 'Market mispricing conviction score' },
];

const WEIGHT_FIELDS = SIGNAL_DEFS.map(s => s.field);

export default function Settings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [biasOpen, setBiasOpen] = useState(false);
  const [bayesOpen, setBayesOpen] = useState(false);

  useEffect(() => {
    getSettings()
      .then(setSettings)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleWeightChange = (field, value) => {
    const numVal = Math.max(0, Math.min(1, parseFloat(value) || 0));
    setSettings(prev => {
      const updated = { ...prev, [field]: numVal };
      const others = WEIGHT_FIELDS.filter(f => f !== field);
      const remaining = 1.0 - numVal;
      const otherSum = others.reduce((s, f) => s + (prev[f] || 0), 0);
      if (otherSum > 0) {
        others.forEach(f => { updated[f] = Math.round((prev[f] / otherSum) * remaining * 1000) / 1000; });
      } else {
        others.forEach(f => { updated[f] = Math.round((remaining / others.length) * 1000) / 1000; });
      }
      return updated;
    });
  };

  const handleChange = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleToggle = (field) => {
    setSettings(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handleAudienceChange = (key, value) => {
    setSettings(prev => {
      const current = typeof prev.audience_multipliers === 'string'
        ? JSON.parse(prev.audience_multipliers || '{}')
        : (prev.audience_multipliers || {});
      const updated = { ...current, [key]: parseFloat(value) || 1.0 };
      return { ...prev, audience_multipliers: updated };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...settings };
      if (typeof payload.audience_multipliers === 'object' && payload.audience_multipliers !== null) {
        payload.audience_multipliers = JSON.stringify(payload.audience_multipliers);
      }
      const updated = await updateSettings(payload);
      setSettings(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-slate-400 text-center py-20">Loading...</div>;
  if (!settings) return <div className="text-red-400 text-center py-20">Failed to load settings</div>;

  const weightSum = WEIGHT_FIELDS.reduce((s, f) => s + (settings[f] || 0), 0).toFixed(3);
  const audienceMult = typeof settings.audience_multipliers === 'string'
    ? JSON.parse(settings.audience_multipliers || '{}')
    : (settings.audience_multipliers || {});

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold text-white mb-6">Model Settings</h2>

      {/* Signal Weights */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 mb-6">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">Signal Weights (S1–S7)</h3>
        <p className="text-xs text-slate-400 mb-4">
          Weights must sum to 1.0. Adjusting one slider auto-normalizes the others.
          When S4–S7 are null for a term, their weight redistributes proportionally to active signals.
          <span className={`ml-2 font-semibold ${Math.abs(parseFloat(weightSum) - 1.0) < 0.01 ? 'text-green-400' : 'text-red-400'}`}>
            Sum: {weightSum}
          </span>
        </p>
        {SIGNAL_DEFS.map(({ field, label, desc }) => (
          <div key={field} className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm text-white">{label}</label>
              <span className="text-sm font-mono text-slate-300">{(settings[field] || 0).toFixed(3)}</span>
            </div>
            <p className="text-xs text-slate-500 mb-2">{desc}</p>
            <input
              type="range" min="0" max="1" step="0.01"
              value={settings[field] || 0}
              onChange={(e) => handleWeightChange(field, e.target.value)}
              className="w-full accent-blue-500"
            />
          </div>
        ))}
      </div>

      {/* Bayesian Parameters (collapsible) */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 mb-6">
        <button onClick={() => setBayesOpen(!bayesOpen)} className="flex items-center justify-between w-full">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Bayesian & Kelly Parameters</h3>
          <span className="text-slate-400 text-xs">{bayesOpen ? '▲' : '▼'}</span>
        </button>
        {bayesOpen && (
          <div className="mt-4 grid grid-cols-2 gap-4">
            {[
              { field: 'k_value', label: 'k (Market Confidence)', desc: 'Higher = market price anchors posterior more strongly', min: 1, max: 100, step: 1, parse: parseInt },
              { field: 'k_base', label: 'k_base (Base Rate Confidence)', desc: 'Strength of base rate prior in Bayesian update', min: 1, max: 50, step: 1, parse: parseInt },
              { field: 'w_base', label: 'w_base (Base Rate Weight)', desc: 'Weight of base rate vs market prior (0-1)', min: 0, max: 1, step: 0.05, parse: parseFloat },
              { field: 'yes_pseudo', label: 'Yes Pseudo-Count', desc: 'Signal-driven pseudo-observations for YES', min: 0.5, max: 20, step: 0.5, parse: parseFloat },
              { field: 'no_pseudo', label: 'No Pseudo-Count', desc: 'Signal-driven pseudo-observations for NO', min: 0.5, max: 20, step: 0.5, parse: parseFloat },
              { field: 'decay_half_life', label: 'Decay Half-Life (hours)', desc: 'Signal time decay exponential half-life', min: 1, max: 168, step: 1, parse: parseFloat },
              { field: 'source_half_life', label: 'Source Half-Life (hours)', desc: 'S5 source proximity exponential half-life', min: 1, max: 48, step: 0.5, parse: parseFloat },
              { field: 'kelly_divisor', label: 'Kelly Divisor', desc: '1.0 = full Kelly, 2.0 = half Kelly', min: 0.5, max: 10, step: 0.5, parse: parseFloat },
              { field: 'calibration_factor', label: 'Calibration Factor', desc: 'Auto-updated after resolutions (EMA)', min: 0, max: 2, step: 0.01, parse: parseFloat },
            ].map(({ field, label, desc, min, max, step, parse }) => (
              <div key={field}>
                <label className="block text-sm text-white mb-1">{label}</label>
                <p className="text-xs text-slate-500 mb-2">{desc}</p>
                <input
                  type="number" value={settings[field] ?? ''} min={min} max={max} step={step}
                  onChange={(e) => handleChange(field, parse(e.target.value) || min)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edge Thresholds */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 mb-6">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">Edge Thresholds (pp)</h3>
        <div className="grid grid-cols-3 gap-4">
          {[
            { field: 'strong_edge_threshold', label: 'STRONG LONG' },
            { field: 'long_edge_threshold', label: 'LONG' },
            { field: 'watch_edge_threshold', label: 'WATCH' },
          ].map(({ field, label }) => (
            <div key={field}>
              <label className="block text-sm text-white mb-1">{label}</label>
              <input
                type="number" value={settings[field]} min="0" step="1"
                onChange={(e) => handleChange(field, parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Bias Modules (collapsible) */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 mb-6">
        <button onClick={() => setBiasOpen(!biasOpen)} className="flex items-center justify-between w-full">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Bias Modules</h3>
          <span className="text-slate-400 text-xs">{biasOpen ? '▲' : '▼'}</span>
        </button>
        {biasOpen && (
          <div className="mt-4 space-y-5">
            {/* Repetition Bias */}
            <div className="border-b border-slate-700 pb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-white font-medium">Repetition Bias</label>
                <button onClick={() => handleToggle('repetition_bias_enabled')}
                  className={`px-3 py-1 text-xs rounded-full ${settings.repetition_bias_enabled ? 'bg-green-600/30 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
                  {settings.repetition_bias_enabled ? 'ON' : 'OFF'}
                </button>
              </div>
              <p className="text-xs text-slate-500 mb-2">Boost = 1 + boost * (repetitions / window)</p>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs text-slate-400 mb-1">Boost Factor</label>
                  <input type="number" value={settings.repetition_boost ?? 0.3} min="0" max="1" step="0.05"
                    onChange={(e) => handleChange('repetition_boost', parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none" />
                </div>
              </div>
            </div>

            {/* Audience Bias */}
            <div className="border-b border-slate-700 pb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-white font-medium">Audience Bias</label>
                <button onClick={() => handleToggle('audience_bias_enabled')}
                  className={`px-3 py-1 text-xs rounded-full ${settings.audience_bias_enabled ? 'bg-green-600/30 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
                  {settings.audience_bias_enabled ? 'ON' : 'OFF'}
                </button>
              </div>
              <p className="text-xs text-slate-500 mb-2">Multiplier by event type</p>
              <div className="grid grid-cols-3 gap-3">
                {['rally', 'press_conference', 'interview', 'speech', 'debate'].map(evt => (
                  <div key={evt}>
                    <label className="block text-xs text-slate-400 mb-1 capitalize">{evt.replace('_', ' ')}</label>
                    <input type="number" value={audienceMult[evt] ?? 1.0} min="0.5" max="2" step="0.05"
                      onChange={(e) => handleAudienceChange(evt, e.target.value)}
                      className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none" />
                  </div>
                ))}
              </div>
            </div>

            {/* Escalation Bias */}
            <div className="border-b border-slate-700 pb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-white font-medium">Emotional Escalation Bias</label>
                <button onClick={() => handleToggle('escalation_bias_enabled')}
                  className={`px-3 py-1 text-xs rounded-full ${settings.escalation_bias_enabled ? 'bg-green-600/30 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
                  {settings.escalation_bias_enabled ? 'ON' : 'OFF'}
                </button>
              </div>
              <p className="text-xs text-slate-500 mb-2">1 + rate * controversy * min(days, 7)</p>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Escalation Rate</label>
                <input type="number" value={settings.escalation_rate ?? 0.05} min="0" max="0.5" step="0.01"
                  onChange={(e) => handleChange('escalation_rate', parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none" />
              </div>
            </div>

            {/* News Reactivity Bias */}
            <div className="border-b border-slate-700 pb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-white font-medium">News Reactivity Bias</label>
                <button onClick={() => handleToggle('news_reactivity_bias_enabled')}
                  className={`px-3 py-1 text-xs rounded-full ${settings.news_reactivity_bias_enabled ? 'bg-green-600/30 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
                  {settings.news_reactivity_bias_enabled ? 'ON' : 'OFF'}
                </button>
              </div>
              <p className="text-xs text-slate-500 mb-2">1 + coeff * (breaking_count / 5)</p>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Reactivity Coefficient</label>
                <input type="number" value={settings.reactivity_coefficient ?? 0.15} min="0" max="1" step="0.05"
                  onChange={(e) => handleChange('reactivity_coefficient', parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none" />
              </div>
            </div>

            {/* Platform Priming Bias */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-white font-medium">Platform Priming Bias</label>
                <button onClick={() => handleToggle('platform_priming_bias_enabled')}
                  className={`px-3 py-1 text-xs rounded-full ${settings.platform_priming_bias_enabled ? 'bg-green-600/30 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
                  {settings.platform_priming_bias_enabled ? 'ON' : 'OFF'}
                </button>
              </div>
              <p className="text-xs text-slate-500 mb-2">1 + min(boost * social_posts, 0.4)</p>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Priming Boost</label>
                <input type="number" value={settings.priming_boost ?? 0.1} min="0" max="0.5" step="0.01"
                  onChange={(e) => handleChange('priming_boost', parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
        {saved && <span className="text-sm text-green-400">Settings saved!</span>}
      </div>
    </div>
  );
}
