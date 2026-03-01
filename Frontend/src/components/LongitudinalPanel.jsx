/**
 * LongitudinalPanel — behavioral security trend analysis across last 3 scans.
 *
 * Props:
 *   jobId   string   current scan job ID
 */

import React, { useEffect, useState } from 'react';
import {
  TrendingUp, TrendingDown, Minus, Target,
  Brain, Loader2, ChevronRight, Lightbulb
} from 'lucide-react';
import { learningAPI } from '../services/api';

const DRIFT_CONFIG = {
  improving:  { Icon: TrendingDown, color: '#10b981', label: 'Improving',  bg: 'from-emerald-900/40 to-emerald-800/10' },
  stable:     { Icon: Minus,        color: '#64748b', label: 'Stable',     bg: 'from-slate-800/60  to-slate-700/10'    },
  degrading:  { Icon: TrendingUp,   color: '#ef4444', label: 'Degrading',  bg: 'from-red-900/40    to-red-800/10'      },
};

function DriftBadge({ drift }) {
  const cfg = DRIFT_CONFIG[drift?.toLowerCase()] || DRIFT_CONFIG.stable;
  const { Icon } = cfg;
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-gradient-to-r ${cfg.bg} border`}
      style={{ color: cfg.color, borderColor: `${cfg.color}30` }}
    >
      <Icon size={12} />
      {cfg.label}
    </span>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-bold text-white/50 uppercase tracking-wide">
        <Icon size={12} />
        <span>{title}</span>
      </div>
      {children}
    </div>
  );
}

export default function LongitudinalPanel({ jobId }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    if (!jobId) { setLoading(false); return; }
    learningAPI.getLongitudinal(jobId)
      .then(r => { setData(r.data); setError(''); })
      .catch(e => { setError(e?.response?.data?.detail || 'Failed to load analysis.'); })
      .finally(() => setLoading(false));
  }, [jobId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-white/30">
        <Loader2 size={16} className="animate-spin" />
        <span className="text-sm">Analyzing security trends…</span>
      </div>
    );
  }

  if (error) return <p className="text-sm text-red-400 py-4">{error}</p>;

  if (!data) return null;

  const {
    behavioral_summary,
    security_drift,
    drift_explanation,
    top_recurring_habit,
    improvement_trajectory,
    thirty_day_advice,
    focus_domain,
    scan_count,
  } = data;

  const adviceList = Array.isArray(thirty_day_advice)
    ? thirty_day_advice
    : typeof thirty_day_advice === 'string'
      ? thirty_day_advice.split(/\n+/).filter(Boolean)
      : [];

  return (
    <div className="rounded-xl border border-white/10 bg-white/4 p-5 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Brain size={16} className="text-violet-400 shrink-0" />
          <div>
            <h3 className="text-sm font-bold text-white/85">Longitudinal Analysis</h3>
            {scan_count && (
              <p className="text-[10px] text-white/35 mt-0.5">Based on last {scan_count} scan{scan_count > 1 ? 's' : ''}</p>
            )}
          </div>
        </div>
        <DriftBadge drift={security_drift} />
      </div>

      {/* Behavioral Summary */}
      {behavioral_summary && (
        <Section icon={Target} title="Behavioral Pattern">
          <p className="text-sm text-white/70 leading-relaxed">{behavioral_summary}</p>
        </Section>
      )}

      {/* Drift Explanation */}
      {drift_explanation && (
        <div className="text-xs text-white/50 italic border-l-2 border-white/10 pl-3 py-1 leading-relaxed">
          {drift_explanation}
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3">
        {top_recurring_habit && (
          <div className="bg-white/4 rounded-lg px-3 py-2.5">
            <p className="text-[10px] text-white/35 font-medium uppercase mb-1">Top Recurring Habit</p>
            <p className="text-xs font-semibold text-amber-400 truncate">{top_recurring_habit}</p>
          </div>
        )}
        {improvement_trajectory && (
          <div className="bg-white/4 rounded-lg px-3 py-2.5">
            <p className="text-[10px] text-white/35 font-medium uppercase mb-1">Trajectory</p>
            <p className="text-xs font-semibold text-white/75 truncate">{improvement_trajectory}</p>
          </div>
        )}
        {focus_domain && (
          <div className="bg-white/4 rounded-lg px-3 py-2.5 col-span-2 sm:col-span-1">
            <p className="text-[10px] text-white/35 font-medium uppercase mb-1">Recommended Focus</p>
            <p className="text-xs font-semibold text-blue-400 capitalize truncate">
              {focus_domain.replace(/_/g, ' ')}
            </p>
          </div>
        )}
      </div>

      {/* 30-day Advice */}
      {adviceList.length > 0 && (
        <Section icon={Lightbulb} title="30-Day Action Plan">
          <ul className="space-y-2">
            {adviceList.map((tip, i) => (
              <li key={i} className="flex items-start gap-2">
                <ChevronRight size={12} className="shrink-0 text-blue-400 mt-0.5" />
                <span className="text-xs text-white/65 leading-relaxed">{tip}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
