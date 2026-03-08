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
import { useTheme } from '../context/ThemeContext';

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

function Section({ icon: Icon, title, children, isDark }) {
  return (
    <div className="space-y-2.5">
      <div className={`flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider ${
        isDark ? 'text-white/50' : 'text-gray-500'
      }`}>
        <Icon size={13} />
        <span>{title}</span>
      </div>
      {children}
    </div>
  );
}

export default function LongitudinalPanel({ jobId }) {
  const { isDark } = useTheme();
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
      <div className={`flex items-center gap-2 py-6 ${
        isDark ? 'text-white/30' : 'text-gray-400'
      }`}>
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
    <div className={`rounded-xl border p-6 space-y-5 ${
      isDark ? 'border-white/10 bg-white/4' : 'border-neutral-200 bg-white'
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            isDark ? 'bg-violet-900/30' : 'bg-violet-50'
          }`}>
            <Brain size={16} className="text-violet-400" />
          </div>
          <div>
            <h3 className={`text-[15px] font-semibold ${
              isDark ? 'text-white/85' : 'text-gray-900'
            }`}>Longitudinal Analysis</h3>
            {scan_count && (
              <p className={`text-[11px] mt-0.5 ${
                isDark ? 'text-white/35' : 'text-gray-400'
              }`}>Based on last {scan_count} scan{scan_count > 1 ? 's' : ''}</p>
            )}
          </div>
        </div>
        <DriftBadge drift={security_drift} />
      </div>

      {/* Behavioral Summary */}
      {behavioral_summary && (
        <Section icon={Target} title="Behavioral Pattern" isDark={isDark}>
          <p className={`text-sm leading-relaxed ${
            isDark ? 'text-white/70' : 'text-gray-700'
          }`}>{behavioral_summary}</p>
        </Section>
      )}

      {/* Drift Explanation */}
      {drift_explanation && (
        <div className={`text-xs italic border-l-2 pl-3 py-1 leading-relaxed ${
          isDark ? 'text-white/50 border-white/10' : 'text-gray-500 border-gray-200'
        }`}>
          {drift_explanation}
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3">
        {top_recurring_habit && (
          <div className={`rounded-lg px-4 py-3 ${
            isDark ? 'bg-white/4' : 'bg-[#f8fafc]'
          }`}>
            <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1.5 ${
              isDark ? 'text-white/35' : 'text-gray-400'
            }`}>Top Recurring Habit</p>
            <p className="text-[13px] font-semibold text-amber-500 truncate">{top_recurring_habit}</p>
          </div>
        )}
        {improvement_trajectory && (
          <div className={`rounded-lg px-4 py-3 ${
            isDark ? 'bg-white/4' : 'bg-[#f8fafc]'
          }`}>
            <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1.5 ${
              isDark ? 'text-white/35' : 'text-gray-400'
            }`}>Trajectory</p>
            <p className={`text-[13px] font-semibold truncate ${
              isDark ? 'text-white/75' : 'text-gray-700'
            }`}>{improvement_trajectory}</p>
          </div>
        )}
        {focus_domain && (
          <div className={`rounded-lg px-4 py-3 col-span-2 sm:col-span-1 ${
            isDark ? 'bg-white/4' : 'bg-[#f8fafc]'
          }`}>
            <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1.5 ${
              isDark ? 'text-white/35' : 'text-gray-400'
            }`}>Recommended Focus</p>
            <p className="text-[13px] font-semibold text-blue-500 capitalize truncate">
              {focus_domain.replace(/_/g, ' ')}
            </p>
          </div>
        )}
      </div>

      {/* 30-day Advice */}
      {adviceList.length > 0 && (
        <Section icon={Lightbulb} title="30-Day Action Plan" isDark={isDark}>
          <ul className="space-y-2">
            {adviceList.map((tip, i) => (
              <li key={i} className="flex items-start gap-2">
                <ChevronRight size={12} className="shrink-0 text-blue-400 mt-0.5" />
                <span className={`text-xs leading-relaxed ${
                  isDark ? 'text-white/65' : 'text-gray-600'
                }`}>{tip}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
