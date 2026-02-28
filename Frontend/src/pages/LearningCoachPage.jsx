/**
 * LearningCoachPage.jsx — SecureTrail Learning System v3
 *
 * v3 new features:
 *   1. XP Bar — XP gained this scan + level progress bar
 *   2. Risk Momentum Badge — increasing / decreasing / stable
 *   3. Historical Comparison Panel — resolved / new / recurring counts
 *   4. Habit Evidence Cards — each habit with evidence[] + fix_now
 *   5. Deep Dive v3 — before/after secure examples + learning_takeaway
 *   6. v3 Maturity Score — 100 - CRIT×15 - HIGH×8 - MED×3 - LOW×1
 *   7. Priority Roadmap with recurrence multiplier + score_improvement
 *   8. All safe educational language
 *   9. AWS Bedrock — Amazon Nova Pro branding
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { learningAPI, scanAPI } from '../services/api';
import { useTheme } from '../context/ThemeContext';

// ── Icon helper ───────────────────────────────────────────────────────────────
const Icon = ({ d, size = 18, className = '', color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color || 'currentColor'} strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d} />
  </svg>
);

const IC = {
  shield:   'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  brain:    'M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.44-4.14M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.44-4.14',
  trendUp:  'M22 7l-9.5 9.5-5-5L2 17',
  trendDn:  'M22 17l-9.5-9.5-5 5L2 7',
  zap:      'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  star:     'M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z',
  check:    'M20 6L9 17l-5-5',
  info:     'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 8h.01M12 12v4',
  refresh:  'M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15',
  chevDn:   'M6 9l6 6 6-6',
  chevUp:   'M18 15l-6-6-6 6',
  book:     'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15z',
  repeat:   'M17 2l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3',
  target:   'M22 12A10 10 0 1 1 12 2M22 12h-4M18 12a6 6 0 1 1-6-6M18 12h-4M14 12a2 2 0 1 1-2-2',
  award:    'M12 15a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM8.21 13.89L7 23l5-3 5 3-1.21-9.12',
  flame:    'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z',
  arrowUp:  'M12 19V5M5 12l7-7 7 7',
  arrowDn:  'M12 5v14M5 12l7 7 7-7',
  lock:     'M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0-2-2zM7 11V7a5 5 0 0 1 10 0v4',
  code:     'M16 18l6-6-6-6M8 6l-6 6 6 6',
  list:     'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  wrench:   'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z',
  minus:    'M5 12h14',
};

const SEV_COLORS = {
  critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e', info: '#6366f1',
};

const LEVEL_COLORS = {
  critical:   { bg: '#fef2f2', border: '#ef4444', text: '#dc2626' },
  beginner:   { bg: '#fef2f2', border: '#f87171', text: '#ef4444' },
  developing: { bg: '#fff7ed', border: '#fb923c', text: '#f97316' },
  secure:     { bg: '#f0fdf4', border: '#4ade80', text: '#16a34a' },
  hardened:   { bg: '#eef2ff', border: '#818cf8', text: '#6366f1' },
};

// ── Shared UI atoms ───────────────────────────────────────────────────────────
const Chip = ({ label, color = '#6366f1', bg }) => (
  <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold"
    style={{ color, background: bg || `${color}20` }}>{label}</span>
);

const Skeleton = ({ h = 'h-4', w = 'w-full', className = '' }) => (
  <div className={`${h} ${w} ${className} rounded animate-pulse bg-gray-200 dark:bg-gray-700`} />
);

const Card = ({ children, className = '' }) => (
  <div className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 ${className}`}>
    {children}
  </div>
);

// ── XP Bar (v3) ───────────────────────────────────────────────────────────────
function XPBar({ xpData }) {
  if (!xpData) return null;
  const {
    xp_gained = 0, xp_total = 0, level = 1, level_label = 'Apprentice',
    next_level_label, next_level_xp, level_progress_pct = 0,
    breakdown = [], leveled_up = false,
  } = xpData;

  return (
    <Card className="border-amber-200 dark:border-amber-700 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon d={IC.award} size={20} color="#f59e0b" />
          <span className="font-bold text-gray-900 dark:text-white">Developer XP</span>
          {leveled_up && (
            <span className="px-2 py-0.5 bg-amber-400 text-amber-900 text-xs font-bold rounded-full animate-bounce">
              LEVEL UP!
            </span>
          )}
        </div>
        <div className="text-right">
          <span className="text-2xl font-black text-amber-600 dark:text-amber-400">Lv.{level}</span>
          <span className="ml-1 text-sm text-gray-500 dark:text-gray-400">{level_label}</span>
        </div>
      </div>
      <div className="mb-2">
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
          <span>{level_label}</span>
          <span>{next_level_label || 'Max Level'}</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
          <div
            className="h-3 rounded-full bg-gradient-to-r from-amber-400 to-yellow-400 transition-all duration-700"
            style={{ width: `${level_progress_pct}%` }}
          />
        </div>
        <div className="flex justify-between text-xs mt-1">
          <span className="text-gray-500 dark:text-gray-400">{level_progress_pct}% through level</span>
          {next_level_xp != null && (
            <span className="text-amber-600 dark:text-amber-400 font-semibold">{next_level_xp} XP to next level</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-4 mt-3">
        <div className="flex items-center gap-1.5">
          <Icon d={IC.zap} size={14} color="#f59e0b" />
          <span className="text-sm font-bold text-amber-600 dark:text-amber-400">+{xp_gained} XP this scan</span>
        </div>
        <span className="text-xs text-gray-400">Total: {xp_total} XP</span>
        {breakdown.length > 0 && (
          <div className="ml-auto flex gap-1.5 flex-wrap">
            {breakdown.map(b => (
              <span key={b.severity} className="text-xs px-1.5 py-0.5 rounded"
                style={{ background: `${SEV_COLORS[b.severity]}20`, color: SEV_COLORS[b.severity] }}>
                {b.count} {b.severity} (+{b.xp_gained})
              </span>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

// ── Risk Momentum Badge (v3) ──────────────────────────────────────────────────
function RiskMomentumBadge({ momentum, explanation }) {
  const config = {
    increasing: { icon: IC.arrowUp, color: '#ef4444', bg: '#fee2e2', label: 'Risk Increasing' },
    decreasing: { icon: IC.arrowDn, color: '#22c55e', bg: '#dcfce7', label: 'Risk Decreasing' },
    stable:     { icon: IC.minus,   color: '#6366f1', bg: '#eef2ff', label: 'Risk Stable'     },
  };
  const cfg = config[momentum] || config.stable;
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg" style={{ background: cfg.bg }}>
      <div className="rounded-full p-1.5 flex-shrink-0" style={{ background: `${cfg.color}20` }}>
        <Icon d={cfg.icon} size={16} color={cfg.color} />
      </div>
      <div>
        <span className="font-semibold text-sm" style={{ color: cfg.color }}>{cfg.label}</span>
        {explanation && <p className="text-xs text-gray-600 mt-0.5">{explanation}</p>}
      </div>
    </div>
  );
}

// ── Historical Comparison Panel (v3) ─────────────────────────────────────────
function HistoricalComparisonPanel({ comparison }) {
  if (!comparison || comparison.is_first_scan) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400 italic p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
        First scan for this repository — no previous data to compare.
      </div>
    );
  }
  const { resolved_count = 0, new_findings_count = 0, recurring_count = 0 } = comparison;
  const stats = [
    { label: 'Resolved',  value: resolved_count,      color: '#22c55e', icon: IC.check,   note: 'fixed since last scan'       },
    { label: 'New',       value: new_findings_count,   color: '#ef4444', icon: IC.arrowUp, note: 'introduced this scan'        },
    { label: 'Recurring', value: recurring_count,      color: '#f97316', icon: IC.repeat,  note: 'present in both scans'       },
  ];
  return (
    <div className="grid grid-cols-3 gap-3">
      {stats.map(s => (
        <div key={s.label} className="text-center p-3 rounded-lg border"
          style={{ borderColor: `${s.color}40`, background: `${s.color}08` }}>
          <div className="flex justify-center mb-1"><Icon d={s.icon} size={16} color={s.color} /></div>
          <div className="text-2xl font-black" style={{ color: s.color }}>{s.value}</div>
          <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">{s.label}</div>
          <div className="text-xs text-gray-400">{s.note}</div>
        </div>
      ))}
    </div>
  );
}

// ── Score Ring ────────────────────────────────────────────────────────────────
function ScoreRing({ score, delta, level }) {
  const r = 44, circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const lc = LEVEL_COLORS[level?.id] || LEVEL_COLORS.hardened;
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-28 h-28">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r={r} fill="none" stroke="#e5e7eb" strokeWidth="10" />
          <circle cx="50" cy="50" r={r} fill="none"
            stroke={lc.text} strokeWidth="10"
            strokeDasharray={circ} strokeDashoffset={offset}
            strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black text-gray-900 dark:text-white">{score}</span>
          <span className="text-xs text-gray-400">/100</span>
        </div>
      </div>
      {delta != null && (
        <div className={`mt-1 text-sm font-bold flex items-center gap-1 ${delta >= 0 ? 'text-green-600' : 'text-red-500'}`}>
          <Icon d={delta >= 0 ? IC.trendUp : IC.trendDn} size={14} />
          {delta >= 0 ? '+' : ''}{delta} pts
        </div>
      )}
      {level && (
        <span className="mt-1 px-3 py-0.5 rounded-full text-xs font-bold"
          style={{ background: lc.bg, color: lc.text, border: `1px solid ${lc.border}` }}>
          {level.label}
        </span>
      )}
    </div>
  );
}

// ── AI Mentor Banner ──────────────────────────────────────────────────────────
function AIMentorBanner({ summary, source, cached, aiError, loading }) {
  if (loading) return (
    <div className="space-y-2">
      <Skeleton h="h-4" w="w-full" />
      <Skeleton h="h-4" w="w-3/4" />
    </div>
  );
  const isPowered = source === 'ai';
  return (
    <div>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
          <Icon d={IC.brain} size={13} />
          {isPowered ? 'AWS Bedrock — Amazon Nova Pro' : 'Deterministic Analysis'}
        </div>
        {cached && <Chip label="Cached" color="#6366f1" />}
        {aiError && <Chip label="AI unavailable — fallback used" color="#ef4444" />}
      </div>
      <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{summary}</p>
    </div>
  );
}

// ── Habit Evidence Cards (v3) ─────────────────────────────────────────────────
function HabitEvidenceCards({ habits, loading }) {
  const [expanded, setExpanded] = useState({});
  if (loading) return (
    <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} h="h-20" />)}</div>
  );
  if (!habits?.length) return (
    <p className="text-sm text-gray-400 italic">No behavioral patterns detected in this scan.</p>
  );
  const priorityColor = { high: '#ef4444', medium: '#f97316', low: '#22c55e' };
  return (
    <div className="space-y-3">
      {habits.map((h, i) => {
        const isExpanded = expanded[i];
        const pc = priorityColor[h.priority] || '#6366f1';
        return (
          <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <button
              onClick={() => setExpanded(p => ({ ...p, [i]: !p[i] }))}
              className="w-full flex items-start gap-3 p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
              <div className="flex-shrink-0 w-2 h-2 rounded-full mt-2" style={{ background: pc }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-gray-900 dark:text-white">{h.pattern_name}</span>
                  <Chip label={h.priority} color={pc} />
                  <Chip label={h.effort} color="#6366f1" />
                  {h.is_recurring && <Chip label="Recurring" color="#f97316" />}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{h.habit}</p>
              </div>
              <Icon d={isExpanded ? IC.chevUp : IC.chevDn} size={16} className="flex-shrink-0 text-gray-400 mt-1" />
            </button>
            {isExpanded && (
              <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700 space-y-3">
                {h.fix_now && (
                  <div className="mt-3 p-2.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon d={IC.zap} size={13} color="#16a34a" />
                      <span className="text-xs font-bold text-green-700 dark:text-green-400">Fix Now</span>
                    </div>
                    <p className="text-xs text-green-800 dark:text-green-300">{h.fix_now}</p>
                  </div>
                )}
                <div className="mt-2">
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Recommendation</span>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{h.recommendation}</p>
                </div>
                {h.evidence?.length > 0 && (
                  <div>
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Evidence in your code</span>
                    <div className="mt-1 space-y-1">
                      {h.evidence.map((ev, ei) => (
                        <div key={ei} className="flex items-start gap-1.5 p-1.5 bg-gray-50 dark:bg-gray-700/40 rounded text-xs font-mono text-gray-700 dark:text-gray-300">
                          <Icon d={IC.code} size={11} className="flex-shrink-0 mt-0.5 text-gray-400" />
                          <span className="break-all">{ev}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {h.tags?.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap">
                    {h.tags.map(t => <Chip key={t} label={t} color="#64748b" />)}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Deep Dive v3 ─────────────────────────────────────────────────────────────
function DeepDiveV3({ deepDive, loading }) {
  const [expanded, setExpanded] = useState({ 0: true });
  if (loading) return (
    <div className="space-y-3">{[1,2].map(i => <Skeleton key={i} h="h-28" />)}</div>
  );
  if (!deepDive?.length) return (
    <p className="text-sm text-gray-400 italic">No deep-dive analysis available.</p>
  );
  return (
    <div className="space-y-3">
      {deepDive.map((item, i) => {
        const isOpen = expanded[i];
        const fid      = item.finding_id || item.vuln_id || `Finding ${i + 1}`;
        const whatHappened = item.what_happened || '';
        const whyMatters   = item.why_it_matters || item.business_impact || '';
        const bizImpact    = item.business_impact || '';
        const before       = item.secure_example_before || item.secure_pattern || '';
        const after        = item.secure_example_after  || '';
        const takeaway     = item.learning_takeaway || item.takeaway || '';
        return (
          <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <button
              onClick={() => setExpanded(p => ({ ...p, [i]: !p[i] }))}
              className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-xs font-bold text-indigo-600 dark:text-indigo-400">
                {i + 1}
              </div>
              <span className="flex-1 font-mono text-xs text-gray-700 dark:text-gray-300 truncate">{fid}</span>
              <Icon d={isOpen ? IC.chevUp : IC.chevDn} size={16} className="flex-shrink-0 text-gray-400" />
            </button>
            {isOpen && (
              <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700 space-y-3 mt-1">
                {whatHappened && (
                  <div>
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">What happened</span>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{whatHappened}</p>
                  </div>
                )}
                {whyMatters && (
                  <div>
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Why it matters</span>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{whyMatters}</p>
                  </div>
                )}
                {bizImpact && bizImpact !== whyMatters && (
                  <div className="p-2.5 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-lg">
                    <span className="text-xs font-bold text-orange-700 dark:text-orange-400">Business Impact</span>
                    <p className="text-xs text-orange-800 dark:text-orange-300 mt-0.5">{bizImpact}</p>
                  </div>
                )}
                {(before || after) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {before && (
                      <div>
                        <span className="text-xs font-bold text-red-500 uppercase tracking-wide mb-1 block">Insecure Pattern</span>
                        <pre className="text-xs bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 p-2.5 rounded-lg overflow-auto max-h-40 border border-red-200 dark:border-red-700 whitespace-pre-wrap">{before}</pre>
                      </div>
                    )}
                    {after && (
                      <div>
                        <span className="text-xs font-bold text-green-600 uppercase tracking-wide mb-1 block">Secure Pattern</span>
                        <pre className="text-xs bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 p-2.5 rounded-lg overflow-auto max-h-40 border border-green-200 dark:border-green-700 whitespace-pre-wrap">{after}</pre>
                      </div>
                    )}
                  </div>
                )}
                {takeaway && (
                  <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-lg">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon d={IC.book} size={13} color="#6366f1" />
                      <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400">Learning Takeaway</span>
                    </div>
                    <p className="text-xs text-indigo-800 dark:text-indigo-300">{takeaway}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Priority Roadmap v3 ───────────────────────────────────────────────────────
function PriorityRoadmapV3({ roadmap, loading }) {
  if (loading) return <Skeleton h="h-32" />;
  if (!roadmap?.length) return (
    <p className="text-sm text-gray-400 italic">No priority roadmap available.</p>
  );
  return (
    <div className="space-y-2">
      {roadmap.map((item, i) => {
        const rankColor = i === 0 ? '#ef4444' : i === 1 ? '#f97316' : '#eab308';
        return (
          <div key={i} className="flex items-start gap-3 p-3 rounded-lg border bg-gray-50 dark:bg-gray-700/30 border-gray-200 dark:border-gray-700">
            <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-black text-white"
              style={{ background: rankColor }}>{item.rank || i + 1}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm text-gray-900 dark:text-white capitalize">
                  {(item.category || '').replace(/_/g, ' ')}
                </span>
                {item.score_improvement > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-bold">
                    +{item.score_improvement} pts
                  </span>
                )}
                {item.is_recurring && <Chip label="Recurring" color="#f97316" />}
                {item.estimated_time && <span className="text-xs text-gray-400">{item.estimated_time}</span>}
              </div>
              {item.reason  && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.reason}</p>}
              {item.action  && (
                <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400 mt-1 flex items-center gap-1">
                  <Icon d={IC.arrowUp} size={11} />{item.action}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Recurring Weakness Alert ──────────────────────────────────────────────────
function RecurringWeaknessAlert({ report }) {
  if (!report?.has_recurring_patterns) return null;
  const recurring = report.recurring_categories || [];
  return (
    <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-300 dark:border-orange-700 rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        <Icon d={IC.repeat} size={15} color="#f97316" />
        <span className="font-bold text-sm text-orange-700 dark:text-orange-400">
          {recurring.length} Recurring Pattern{recurring.length !== 1 ? 's' : ''} Detected
        </span>
      </div>
      <p className="text-xs text-orange-600 dark:text-orange-300 mb-2">{report.summary_text}</p>
      <div className="flex flex-wrap gap-1.5">
        {recurring.slice(0, 5).map((r, i) => (
          <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 font-medium">
            {r.label || r.category}
            {r.consecutive_streak > 1 && ` (${r.consecutive_streak} scans)`}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Maturity Card (v3) ────────────────────────────────────────────────────────
function TransparentMaturityCard({ maturity, loading }) {
  if (loading) return <Skeleton h="h-32" />;
  const transparent = maturity?.transparent;
  const level = maturity?.level;
  const lc = LEVEL_COLORS[level?.id] || LEVEL_COLORS.hardened;
  return (
    <div className="space-y-3">
      <div className="p-3 rounded-lg text-xs bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-600">
        <div className="font-semibold text-gray-700 dark:text-gray-300 mb-1">How your score is calculated</div>
        <p className="text-gray-500 dark:text-gray-400 font-mono">score = 100 − (critical×15) − (high×8) − (medium×3) − (low×1)</p>
        <p className="text-gray-400 mt-1">Fix a critical → +15 pts · High → +8 pts · Medium → +3 pts · Low → +1 pt</p>
      </div>
      {transparent?.reasons?.length > 0 && (
        <div>
          <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Why you're at {level?.label}</span>
          <ul className="mt-1.5 space-y-1">
            {transparent.reasons.map((r, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                <Icon d={IC.info} size={12} color={lc.text} className="flex-shrink-0 mt-0.5" />{r}
              </li>
            ))}
          </ul>
        </div>
      )}
      {transparent?.to_advance?.length > 0 && (
        <div>
          <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">To reach next level</span>
          <ul className="mt-1.5 space-y-1">
            {transparent.to_advance.map((a, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-gray-700 dark:text-gray-300">
                <Icon d={IC.check} size={12} color="#22c55e" className="flex-shrink-0 mt-0.5" />{a}
              </li>
            ))}
          </ul>
        </div>
      )}
      {transparent?.encouragement && (
        <p className="text-xs italic text-indigo-600 dark:text-indigo-400 p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
          ✦ {transparent.encouragement}
        </p>
      )}
    </div>
  );
}

// ── Badges Section ────────────────────────────────────────────────────────────
function BadgesSection({ maturity, loading }) {
  if (loading) return <Skeleton h="h-20" />;
  const badges   = maturity?.badges || [];
  const earned   = badges.filter(b => b.earned);
  const unearned = badges.filter(b => !b.earned);
  return (
    <div className="space-y-3">
      {earned.length > 0 && (
        <div>
          <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Earned ({earned.length})</span>
          <div className="flex flex-wrap gap-2 mt-2">
            {earned.map(b => (
              <div key={b.id} title={b.description}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold"
                style={{ borderColor: b.color, color: b.color, background: `${b.color}12` }}>
                <Icon d={IC.award} size={13} color={b.color} />{b.label}
              </div>
            ))}
          </div>
        </div>
      )}
      {unearned.length > 0 && (
        <div>
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Locked ({unearned.length})</span>
          <div className="flex flex-wrap gap-2 mt-2">
            {unearned.slice(0, 6).map(b => (
              <div key={b.id} title={b.description}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold opacity-40 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400">
                <Icon d={IC.lock} size={13} />{b.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Score Trend Chart ─────────────────────────────────────────────────────────
function ScoreTrendChart({ progress, loading }) {
  const { theme } = useTheme();
  if (loading) return <Skeleton h="h-48" />;
  if (!progress?.score_history?.length) return (
    <p className="text-sm text-gray-400 italic">No trend data yet. Run more scans on this repository.</p>
  );
  const data = progress.score_history.map(s => ({
    date: s.scan_date ? s.scan_date.split('T')[0] : '',
    score: s.score,
  }));
  const textColor = theme === 'dark' ? '#9ca3af' : '#6b7280';
  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: -15 }}>
        <defs>
          <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}   />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#374151' : '#e5e7eb'} />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: textColor }} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: textColor }} tickLine={false} />
        <Tooltip contentStyle={{
          background: theme === 'dark' ? '#1f2937' : '#fff',
          border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12,
        }} />
        <ReferenceLine y={60} stroke="#22c55e" strokeDasharray="4 4" strokeOpacity={0.5} />
        <Area type="monotone" dataKey="score" stroke="#6366f1" fill="url(#scoreGrad)" strokeWidth={2} dot={{ r: 3 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Tab Bar ───────────────────────────────────────────────────────────────────
function TabBar({ tabs, active, onChange }) {
  return (
    <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl overflow-x-auto">
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all
            ${active === t.id
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
          <Icon d={t.icon} size={14} />{t.label}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function LearningCoachPage({ jobId: propJobId, repoName: propRepoName }) {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState('coach');

  const [jobs, setJobs]         = useState([]);
  const [jobId, setJobId]       = useState(propJobId || '');
  const [repoName, setRepoName] = useState(propRepoName || '');

  const [summary,  setSummary]  = useState(null);
  const [insights, setInsights] = useState(null);
  const [progress, setProgress] = useState(null);
  const [maturity, setMaturity] = useState(null);

  const [loadingJobs,     setLoadingJobs]     = useState(false);
  const [loadingSummary,  setLoadingSummary]  = useState(false);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(false);
  const [loadingMaturity, setLoadingMaturity] = useState(false);
  const [error, setError] = useState('');

  // Load jobs on mount
  useEffect(() => {
    if (propJobId) { setJobId(propJobId); return; }
    setLoadingJobs(true);
    scanAPI.getJobs()
      .then(r => {
        const raw = r?.data ?? r;
        const list = Array.isArray(raw) ? raw : (raw?.jobs || raw?.data || []);
        setJobs(list);
        if (list.length && !jobId) {
          setJobId(list[0].job_id || list[0].id || '');
          setRepoName(list[0].repository_name || '');
        }
      })
      .catch(() => {})
      .finally(() => setLoadingJobs(false));
  }, []);

  useEffect(() => {
    if (!jobId) return;
    const found = jobs.find(j => (j.job_id || j.id) === jobId);
    if (found?.repository_name) setRepoName(found.repository_name);
  }, [jobId, jobs]);

  const fetchSummary = useCallback(() => {
    if (!jobId) return;
    setLoadingSummary(true);
    learningAPI.getSummary(jobId)
      .then(r => setSummary(r?.data ?? r))
      .catch(e => setError(e.message || 'Summary load failed'))
      .finally(() => setLoadingSummary(false));
  }, [jobId]);

  const fetchInsights = useCallback((forceRefresh = false) => {
    if (!jobId) return;
    setLoadingInsights(true);
    learningAPI.getInsights(jobId, forceRefresh)
      .then(r => setInsights(r?.data ?? r))
      .catch(e => setError(e.message || 'Insights load failed'))
      .finally(() => setLoadingInsights(false));
  }, [jobId]);

  const fetchProgress = useCallback(() => {
    if (!repoName) return;
    setLoadingProgress(true);
    learningAPI.getProgress(repoName)
      .then(r => setProgress(r?.data ?? r))
      .catch(() => {})
      .finally(() => setLoadingProgress(false));
  }, [repoName]);

  const fetchMaturity = useCallback(() => {
    if (!repoName) return;
    setLoadingMaturity(true);
    learningAPI.getMaturity(repoName)
      .then(r => setMaturity(r?.data ?? r))
      .catch(() => {})
      .finally(() => setLoadingMaturity(false));
  }, [repoName]);

  useEffect(() => { fetchSummary();  fetchInsights();  }, [fetchSummary,  fetchInsights]);
  useEffect(() => { fetchProgress(); fetchMaturity(); }, [fetchProgress, fetchMaturity]);

  // Derived
  const healthScore     = insights?.health_score ?? summary?.health_score ?? 0;
  const scoreDelta      = insights?.score_delta  ?? summary?.score_delta  ?? null;
  const maturityLevel   = maturity?.level;
  const riskMomentum    = insights?.risk_momentum || 'stable';
  const xpData          = insights?.xp_data;
  const comparison      = insights?.historical_comparison;
  const behavioralFull  = insights?.behavioral_insights_full || [];
  const aiDeepDive      = insights?.deep_dive || [];
  const aiRoadmap       = insights?.priority_roadmap_v3 || insights?.priority_roadmap || [];
  const recurringReport = insights?.recurring_report || summary?.recurring_report;
  const riskMomExpl     = insights?.risk_momentum_explanation || '';

  const TABS = [
    { id: 'coach',    label: 'AI Coach',  icon: IC.brain   },
    { id: 'summary',  label: 'Summary',   icon: IC.shield  },
    { id: 'maturity', label: 'Maturity',  icon: IC.award   },
    { id: 'trend',    label: 'Trend',     icon: IC.trendUp },
  ];

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900'}`}>
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
              <Icon d={IC.brain} size={22} color="#6366f1" />
              Security Learning Coach
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Personalised security mentoring for {repoName || 'your repository'}
            </p>
          </div>
          <button
            onClick={() => fetchInsights(true)}
            disabled={loadingInsights}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50">
            <Icon d={IC.refresh} size={14} />
            {loadingInsights ? 'Refreshing...' : 'Refresh AI'}
          </button>
        </div>

        {/* Job Selector */}
        {!propJobId && jobs.length > 0 && (
          <Card>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Select Scan</label>
            <select value={jobId} onChange={e => setJobId(e.target.value)}
              className="mt-1 w-full text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white p-2 focus:ring-2 focus:ring-indigo-500">
              {jobs.map(j => {
                const jid = j.job_id || j.id || '';
                const date = (j.updated_at || j.completed_at || j.created_at || '').split('T')[0] || 'no date';
                return (
                  <option key={jid} value={jid}>
                    {j.repository_name} — {date} ({j.total_vulnerabilities || 0} findings)
                  </option>
                );
              })}
            </select>
          </Card>
        )}

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Score + XP row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="flex flex-col items-center justify-center">
            {(loadingInsights || loadingSummary)
              ? <Skeleton h="h-28" w="w-28" className="rounded-full" />
              : <ScoreRing score={healthScore} delta={scoreDelta} level={maturityLevel} />}
            <p className="text-xs text-gray-400 mt-2 text-center">100 − (CRIT×15) − (HIGH×8) − (MED×3) − (LOW×1)</p>
          </Card>
          <div className="md:col-span-2">
            {xpData
              ? <XPBar xpData={xpData} />
              : loadingInsights
                ? <Skeleton h="h-full" />
                : <Card className="h-full flex items-center justify-center">
                    <p className="text-sm text-gray-400 italic">Complete a scan to earn XP</p>
                  </Card>
            }
          </div>
        </div>

        {/* Risk Momentum */}
        <Card>
          <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2 mb-3">
            <Icon d={IC.flame} size={15} color="#f97316" />
            Risk Momentum &amp; Scan Comparison
          </h3>
          <div className="space-y-3">
            <RiskMomentumBadge momentum={riskMomentum} explanation={riskMomExpl} />
            {comparison && <HistoricalComparisonPanel comparison={comparison} />}
          </div>
        </Card>

        {/* Recurring alert */}
        {recurringReport?.has_recurring_patterns && (
          <RecurringWeaknessAlert report={recurringReport} />
        )}

        {/* Tabs */}
        <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />

        {/* ── AI Coach tab ── */}
        {activeTab === 'coach' && (
          <div className="space-y-4">
            <Card>
              <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2 mb-3">
                <Icon d={IC.brain} size={15} color="#6366f1" />AI Security Assessment
              </h3>
              <AIMentorBanner
                summary={insights?.learning_summary}
                source={insights?.source}
                cached={insights?.cached}
                aiError={insights?.ai_error}
                loading={loadingInsights} />
            </Card>
            <Card>
              <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2 mb-3">
                <Icon d={IC.wrench} size={15} color="#f97316" />
                Detected Developer Habits
                {behavioralFull.length > 0 && <span className="ml-auto text-xs text-gray-400">{behavioralFull.length} patterns</span>}
              </h3>
              <HabitEvidenceCards habits={behavioralFull} loading={loadingInsights} />
            </Card>
            <Card>
              <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2 mb-3">
                <Icon d={IC.target} size={15} color="#6366f1" />
                Deep Dive Analysis
                {aiDeepDive.length > 0 && <span className="ml-auto text-xs text-gray-400">{aiDeepDive.length} findings</span>}
              </h3>
              <DeepDiveV3 deepDive={aiDeepDive} loading={loadingInsights} />
            </Card>
            <Card>
              <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2 mb-3">
                <Icon d={IC.list} size={15} color="#22c55e" />Priority Fix Roadmap
              </h3>
              <PriorityRoadmapV3 roadmap={aiRoadmap} loading={loadingInsights} />
            </Card>
          </div>
        )}

        {/* ── Summary tab ── */}
        {activeTab === 'summary' && (
          <div className="space-y-4">
            <Card>
              <h3 className="font-bold text-sm text-gray-900 dark:text-white mb-3">Severity Breakdown</h3>
              {loadingSummary ? <Skeleton h="h-20" /> : (
                <div className="grid grid-cols-5 gap-2">
                  {['critical','high','medium','low','info'].map(sev => {
                    const count = summary?.sev_counts?.[sev] ?? 0;
                    return (
                      <div key={sev} className="text-center p-2 rounded-lg border"
                        style={{ borderColor: `${SEV_COLORS[sev]}40`, background: `${SEV_COLORS[sev]}10` }}>
                        <div className="text-2xl font-black" style={{ color: SEV_COLORS[sev] }}>{count}</div>
                        <div className="text-xs font-medium capitalize text-gray-500 dark:text-gray-400">{sev}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
            <Card>
              <h3 className="font-bold text-sm text-gray-900 dark:text-white mb-3">Vulnerability Categories</h3>
              {loadingSummary ? <Skeleton h="h-32" /> : (
                <div className="space-y-2">
                  {Object.entries(summary?.categories || {})
                    .sort(([,a],[,b]) => (b?.count||0) - (a?.count||0))
                    .map(([cat, val]) => {
                      const count = val?.count ?? val;
                      const label = val?.knowledge?.label || cat.replace(/_/g,' ');
                      const color = val?.knowledge?.color || '#6366f1';
                      return (
                        <div key={cat} className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                          <span className="text-xs text-gray-700 dark:text-gray-300 flex-1 capitalize">{label}</span>
                          <span className="text-xs font-bold" style={{ color }}>{count}</span>
                        </div>
                      );
                    })}
                </div>
              )}
            </Card>
            {insights?.recurring_patterns?.length > 0 && (
              <Card>
                <h3 className="font-bold text-sm text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <Icon d={IC.repeat} size={15} color="#f97316" />AI Recurring Pattern Analysis
                </h3>
                <div className="space-y-3">
                  {insights.recurring_patterns.map((rp, i) => (
                    <div key={i} className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                      <span className="font-semibold text-sm text-orange-700 dark:text-orange-400 capitalize">
                        {(rp.category||'').replace(/_/g,' ')}
                      </span>
                      {rp.observation && <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{rp.observation}</p>}
                      {rp.root_cause_hypothesis && (
                        <p className="text-xs italic text-gray-500 dark:text-gray-400 mt-1">Root cause: {rp.root_cause_hypothesis}</p>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* ── Maturity tab ── */}
        {activeTab === 'maturity' && (
          <div className="space-y-4">
            <Card>
              <div className="flex items-center gap-3 mb-4">
                <ScoreRing score={maturity?.score ?? healthScore} delta={null} level={maturityLevel} />
                <div>
                  <h3 className="font-black text-lg text-gray-900 dark:text-white">{maturityLevel?.label || 'Loading...'}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{maturityLevel?.description}</p>
                </div>
              </div>
              <TransparentMaturityCard maturity={maturity} loading={loadingMaturity} />
            </Card>
            {insights?.maturity_explanation && (
              <Card>
                <h3 className="font-bold text-sm text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <Icon d={IC.brain} size={15} color="#6366f1" />AI Maturity Analysis
                </h3>
                <div className="space-y-3">
                  {insights.maturity_explanation.reasons?.length > 0 && (
                    <div>
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Why at this level</span>
                      <ul className="mt-2 space-y-1">
                        {insights.maturity_explanation.reasons.map((r,i) => (
                          <li key={i} className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-1.5">
                            <Icon d={IC.info} size={12} color="#6366f1" className="flex-shrink-0 mt-1" />{r}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {insights.maturity_explanation.to_advance?.length > 0 && (
                    <div>
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">To advance</span>
                      <ul className="mt-2 space-y-1">
                        {insights.maturity_explanation.to_advance.map((a,i) => (
                          <li key={i} className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-1.5">
                            <Icon d={IC.check} size={12} color="#22c55e" className="flex-shrink-0 mt-1" />{a}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {insights.maturity_explanation.encouragement && (
                    <p className="text-sm italic text-indigo-600 dark:text-indigo-400 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                      ✦ {insights.maturity_explanation.encouragement}
                    </p>
                  )}
                </div>
              </Card>
            )}
            <Card>
              <h3 className="font-bold text-sm text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Icon d={IC.award} size={15} color="#f59e0b" />
                Achievement Badges
                {maturity?.earned_count > 0 && (
                  <span className="ml-auto text-xs px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full font-bold">
                    {maturity.earned_count} earned
                  </span>
                )}
              </h3>
              <BadgesSection maturity={maturity} loading={loadingMaturity} />
            </Card>
          </div>
        )}

        {/* ── Trend tab ── */}
        {activeTab === 'trend' && (
          <div className="space-y-4">
            <Card>
              <h3 className="font-bold text-sm text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Icon d={IC.trendUp} size={15} color="#6366f1" />Security Score History
              </h3>
              <ScoreTrendChart progress={progress} loading={loadingProgress} />
              {progress && (
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: 'Best',   value: progress.best_score, color: '#22c55e' },
                    { label: 'Latest', value: progress.score_history?.slice(-1)[0]?.score ?? healthScore, color: '#6366f1' },
                    { label: 'Trend',  value: progress.trend,
                      color: progress.trend === 'improving' ? '#22c55e' : progress.trend === 'declining' ? '#ef4444' : '#6366f1' },
                  ].map(s => (
                    <div key={s.label} className="p-2 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                      <div className="font-black text-lg" style={{ color: s.color }}>{s.value}</div>
                      <div className="text-xs text-gray-400">{s.label}</div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
            {progress?.category_trends && Object.keys(progress.category_trends).length > 0 && (
              <Card>
                <h3 className="font-bold text-sm text-gray-900 dark:text-white mb-3">Category Trends</h3>
                <div className="space-y-2">
                  {Object.entries(progress.category_trends).slice(0, 8).map(([cat, counts]) => {
                    const latest = counts[counts.length - 1] ?? 0;
                    const prev   = counts[counts.length - 2] ?? latest;
                    const delta  = latest - prev;
                    return (
                      <div key={cat} className="flex items-center gap-3">
                        <span className="text-xs text-gray-600 dark:text-gray-400 w-32 capitalize truncate">{cat.replace(/_/g,' ')}</span>
                        <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                          <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${Math.min(100, latest * 5)}%` }} />
                        </div>
                        <span className="text-xs font-bold w-6 text-right text-gray-700 dark:text-gray-300">{latest}</span>
                        {delta !== 0 && (
                          <span className={`text-xs font-bold ${delta < 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {delta > 0 ? '+' : ''}{delta}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}
          </div>
        )}

        <p className="text-center text-xs text-gray-400 pt-2 pb-4">
          Learning Coach — AWS Bedrock powered by Amazon Nova Pro · SecureTrail v3
        </p>
      </div>
    </div>
  );
}
