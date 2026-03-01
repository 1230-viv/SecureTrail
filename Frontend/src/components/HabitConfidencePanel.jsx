/**
 * HabitConfidencePanel — shows developer habit patterns with confidence scores.
 *
 * Props:
 *   repoName  string   repository to load habits for
 */

import React, { useEffect, useState } from 'react';
import {
  TrendingUp, TrendingDown, Minus, AlertTriangle,
  Loader2, ChevronDown, ChevronUp
} from 'lucide-react';
import { learningAPI } from '../services/api';

const TREND_CONFIG = {
  Improving:  { Icon: TrendingDown, color: 'text-emerald-400', label: 'Improving' },
  Stable:     { Icon: Minus,        color: 'text-slate-400',   label: 'Stable'    },
  Regressing: { Icon: TrendingUp,   color: 'text-red-400',     label: 'Regressing' },
  New:        { Icon: AlertTriangle, color: 'text-amber-400',  label: 'New'       },
};

function confidenceColor(score) {
  if (score >= 70) return '#ef4444'; // red — deeply entrenched
  if (score >= 40) return '#f59e0b'; // amber — moderate
  return '#10b981';                  // green — low confidence / mostly resolved
}

function confidenceLabel(score) {
  if (score >= 70) return 'High Risk Habit';
  if (score >= 40) return 'Moderate Habit';
  return 'Low Confidence';
}

function HabitCard({ habit }) {
  const [expanded, setExpanded] = useState(false);
  const trendCfg = TREND_CONFIG[habit.trend] || TREND_CONFIG.Stable;
  const { Icon: TrendIcon } = trendCfg;
  const score = habit.confidence_score;
  const color = confidenceColor(score);

  return (
    <div className="rounded-xl border border-white/10 bg-white/4 overflow-hidden">
      <button
        className="w-full flex items-start justify-between gap-3 p-4 text-left hover:bg-white/4 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        {/* Left */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-sm font-semibold text-white/90 truncate">{habit.pattern_name}</span>
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
              style={{ color, borderColor: `${color}40`, background: `${color}15` }}
            >
              {confidenceLabel(score)}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-white/45">
            <span className={`flex items-center gap-1 font-medium ${trendCfg.color}`}>
              <TrendIcon size={11} />
              {trendCfg.label}
            </span>
            <span>•</span>
            <span>
              {habit.occurrence_count}/{habit.scan_count} scans
            </span>
            {habit.last_count > 0 && (
              <>
                <span>•</span>
                <span>{habit.last_count} findings latest</span>
              </>
            )}
          </div>
        </div>

        {/* Confidence score ring */}
        <div className="shrink-0 flex flex-col items-center gap-0.5">
          <div className="relative w-11 h-11">
            <svg viewBox="0 0 36 36" className="rotate-[-90deg]">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
              <circle
                cx="18" cy="18" r="15.9"
                fill="none"
                stroke={color}
                strokeWidth="3"
                strokeDasharray={`${score} ${100 - score}`}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[11px] font-black" style={{ color }}>
              {score}
            </span>
          </div>
          <span className="text-[9px] text-white/35">confidence</span>
          {expanded ? <ChevronUp size={11} className="text-white/30 mt-1" /> : <ChevronDown size={11} className="text-white/30 mt-1" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-white/8 space-y-3 pt-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Recurrence Rate" value={`${Math.round(habit.recurrence_rate * 100)}%`} />
            <Stat label="Scans Detected" value={`${habit.occurrence_count}/${habit.scan_count}`} />
            {habit.first_detected_at && (
              <Stat label="First Detected" value={fmtDate(habit.first_detected_at)} />
            )}
            {habit.last_detected_at && (
              <Stat label="Last Detected" value={fmtDate(habit.last_detected_at)} />
            )}
          </div>

          {/* Count history sparkline */}
          {habit.count_history?.length > 1 && (
            <div className="space-y-1">
              <p className="text-[10px] text-white/35 uppercase tracking-wide font-semibold">Finding Count Per Scan</p>
              <Sparkline values={habit.count_history} color={color} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-white/4 rounded-lg px-3 py-2">
      <p className="text-[10px] text-white/40 font-medium">{label}</p>
      <p className="text-sm font-bold text-white/85 mt-0.5">{value}</p>
    </div>
  );
}

function Sparkline({ values, color }) {
  const max = Math.max(...values, 1);
  const w = 200;
  const h = 32;
  const step = values.length > 1 ? w / (values.length - 1) : w;
  const points = values
    .map((v, i) => `${i * step},${h - (v / max) * h}`)
    .join(' ');

  return (
    <svg width={w} height={h + 4} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.7"
      />
      {values.map((v, i) => (
        <circle key={i} cx={i * step} cy={h - (v / max) * h} r={2} fill={color} opacity={0.9} />
      ))}
    </svg>
  );
}

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
  } catch {
    return iso.slice(0, 10);
  }
}

export default function HabitConfidencePanel({ repoName }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    if (!repoName) { setLoading(false); return; }
    learningAPI.getHabits(repoName)
      .then(r => { setData(r.data); setError(''); })
      .catch(e => { setError(e?.response?.data?.detail || 'Failed to load habits'); })
      .finally(() => setLoading(false));
  }, [repoName]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 size={20} className="animate-spin text-white/30" />
      </div>
    );
  }

  if (error) return <p className="text-sm text-red-400 py-4">{error}</p>;

  const habits = data?.habits || [];
  if (!habits.length) {
    return (
      <p className="text-sm text-white/40 py-4">
        No persistent habits detected yet. Run multiple scans to see patterns.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-white/80">Habit Patterns</h3>
        <span className="text-xs text-white/35">{habits.length} habit{habits.length !== 1 ? 's' : ''} detected</span>
      </div>
      {habits.map(h => (
        <HabitCard key={`${h.trigger_category}`} habit={h} />
      ))}
    </div>
  );
}
