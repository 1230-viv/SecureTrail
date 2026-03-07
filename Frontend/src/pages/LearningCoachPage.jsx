/**
 * LearningCoachPage.jsx — SecureTrail Learning System v4
 *
 * v4 coach-first architecture:
 *   1. DeepDiveV4 — per-finding AI coach with real copy-paste secure code fixes
 *   2. Fields: coach_explanation, what_is_wrong, why_this_is_insecure, security_impact,
 *              insecure_code_example, secure_code_fix.code, why_the_fix_is_secure,
 *              secure_coding_lesson, endpoint, cwe, inferred
 *   3. Overview (XP, maturity, habits, roadmap) remains deterministic — unaffected by AI
 *   4. Single "Learn & Fix" tab — Submit Fix tab removed
 *   5. AWS Bedrock — Llama 4 Maverick branding
 */

import React, { useEffect, useState, useCallback } from 'react';
import SkillTree            from '../components/SkillTree';
import HabitConfidencePanel from '../components/HabitConfidencePanel';
import BadgeGrid            from '../components/BadgeGrid';
import LongitudinalPanel    from '../components/LongitudinalPanel';
import { LifecycleBadge }   from '../components/LifecycleBadge';
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
  alertTriangle: 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01',
  file:     'M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM13 2v7h7',
};

const SEV_COLORS = {
  critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e', info: '#6366f1',
};

const LEVEL_COLORS = {
  critical:   { bg: 'rgba(239,68,68,0.15)',  border: '#ef4444', text: '#f87171' },
  beginner:   { bg: 'rgba(239,68,68,0.12)',  border: '#f87171', text: '#fca5a5' },
  developing: { bg: 'rgba(249,115,22,0.15)', border: '#fb923c', text: '#fdba74' },
  secure:     { bg: 'rgba(34,197,94,0.12)',  border: '#4ade80', text: '#86efac' },
  hardened:   { bg: 'rgba(99,102,241,0.15)', border: '#818cf8', text: '#a5b4fc' },
};

// ── Shared UI atoms ───────────────────────────────────────────────────────────
const Chip = ({ label, color = '#6366f1', bg }) => (
  <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold"
    style={{ color, background: bg || `${color}22` }}>{label}</span>
);

const Skeleton = ({ h = 'h-4', w = 'w-full', className = '' }) => (
  <div className={`${h} ${w} ${className} rounded animate-pulse bg-slate-200 dark:bg-white/8`} />
);

const Card = ({ children, className = '' }) => (
  <div className={`bg-white dark:bg-[#1a1d27] border border-slate-200 dark:border-white/10 rounded-xl p-5 ${className}`}>
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

  // v4 source values: 'ai' | 'deterministic' | 'clean'
  const sourceConfig = {
    ai:            { label: 'Per-Finding AI Coach · Llama 4 Maverick', color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' },
    deterministic: { label: 'Deterministic Analysis',                  color: 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300' },
    clean:         { label: 'Clean Codebase ✓',                        color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' },
  };
  const cfg = sourceConfig[source] || sourceConfig.deterministic;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold ${cfg.color}`}>
          <Icon d={IC.brain} size={13} />
          {cfg.label}
        </div>
        {source === 'ai' && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/8 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/10">
            Overview · deterministic
          </span>
        )}
        {cached && <Chip label="Cached" color="#6366f1" />}
        {aiError && !aiError.includes(';') && <Chip label="AI unavailable — fallback used" color="#ef4444" />}
        {aiError && aiError.includes(';') && <Chip label="Partial AI — some findings used fallback" color="#f97316" />}
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

// ── Deep Dive v4 — per-finding AI coach with real code fixes ─────────────────
function DeepDiveV4({ deepDive, loading }) {
  const [expanded, setExpanded] = useState({ 0: true });
  const [copied, setCopied]     = useState({});

  const copyCode = (code, key) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(p => ({ ...p, [key]: true }));
      setTimeout(() => setCopied(p => ({ ...p, [key]: false })), 2000);
    });
  };

  if (loading) return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 pb-1">
        <Icon d={IC.brain} size={13} color="#6366f1" />
        <span>Coaching each finding individually…</span>
      </div>
      {[1,2,3,4,5].map(i => <Skeleton key={i} h="h-14" />)}
    </div>
  );
  if (!deepDive?.length) return (
    <p className="text-sm text-gray-400 italic">No deep-dive analysis available.</p>
  );
  return (
    <div className="space-y-3">
      {deepDive.map((item, i) => {
        const isOpen = expanded[i];

        // v4 fields with v3 fallbacks for backward compat
        const fid             = item.vulnerability || item.finding_id || item.vuln_id || `Finding ${i + 1}`;
        const file            = item.file || '';
        const line            = item.line || '';
        const severity        = (item.severity || '').toLowerCase();
        const endpoint        = item.endpoint || '';
        const cwe             = item.cwe || '';
        const isInferred      = item.inferred || false;
        const coachExpl       = item.coach_explanation || '';
        const whatIsWrong     = item.what_is_wrong     || item.what_happened || '';
        const whyInsecure     = item.why_this_is_insecure || item.why_it_matters || '';
        const securityImpact  = item.security_impact   || item.business_impact || '';
        const insecureCode    = item.insecure_code_example || item.secure_example_before || item.secure_pattern || '';
        const secureCode      = item.secure_code_fix?.code || item.secure_example_after || '';
        const secureNotes     = item.secure_code_fix?.notes || '';
        const whyFixSecure    = item.why_the_fix_is_secure || '';
        const lesson          = item.secure_coding_lesson  || item.learning_takeaway || item.takeaway || '';

        return (
          <div key={i} className="border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden bg-white dark:bg-[#1a1d27]">
            {/* ── Accordion header ── */}
            <button
              onClick={() => setExpanded(p => ({ ...p, [i]: !p[i] }))}
              className="w-full flex items-center gap-3 p-3.5 text-left hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
              <div className="flex-shrink-0 px-2.5 py-1 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-xs font-black text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                Issue {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-gray-800 dark:text-gray-100 truncate">{fid}</span>
                  {severity && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                      style={{ background: `${SEV_COLORS[severity]}20`, color: SEV_COLORS[severity] }}>
                      {severity.toUpperCase()}
                    </span>
                  )}
                  {!isInferred && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 border border-purple-200 dark:border-purple-700/40 flex-shrink-0">
                      AI coached
                    </span>
                  )}
                  {isInferred && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/10 flex-shrink-0">
                      deterministic
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {file && (
                    <span className="text-xs text-gray-400 dark:text-gray-500 font-mono truncate">
                      {file}{line ? `:${line}` : ''}
                    </span>
                  )}
                  {endpoint && (
                    <span className="text-[10px] font-mono bg-slate-100 dark:bg-white/8 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded border border-slate-200 dark:border-white/10 flex-shrink-0">
                      {endpoint}
                    </span>
                  )}
                  {cwe && (
                    <a href={`https://cwe.mitre.org/data/definitions/${cwe.replace('CWE-','')}.html`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-[10px] font-mono text-indigo-500 dark:text-indigo-400 hover:underline flex-shrink-0"
                      onClick={e => e.stopPropagation()}>
                      {cwe} ↗
                    </a>
                  )}
                </div>
              </div>
              <Icon d={isOpen ? IC.chevUp : IC.chevDn} size={16} className="flex-shrink-0 text-gray-400" />
            </button>

            {/* ── Expanded body ── */}
            {isOpen && (
              <div className="px-4 pb-5 border-t border-gray-100 dark:border-white/8 space-y-4 pt-4">

                {/* Coach explanation banner */}
                {coachExpl && (
                  <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700/40">
                    <Icon d={IC.brain} size={16} color="#6366f1" className="flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wide block mb-1">Coach Explanation</span>
                      <p className="text-sm text-indigo-800 dark:text-indigo-200 leading-relaxed">{coachExpl}</p>
                    </div>
                  </div>
                )}

                {/* What's wrong */}
                {whatIsWrong && (
                  <div>
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                      <Icon d={IC.alertTriangle} size={12} color="#f97316" />What You Did Wrong
                    </span>
                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{whatIsWrong}</p>
                  </div>
                )}

                {/* Why insecure */}
                {whyInsecure && (
                  <div>
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                      <Icon d={IC.shield} size={12} color="#ef4444" />Why This Is Insecure
                    </span>
                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{whyInsecure}</p>
                  </div>
                )}

                {/* Security impact */}
                {securityImpact && (
                  <div className="p-3.5 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700/40 rounded-xl">
                    <span className="text-xs font-bold text-orange-700 dark:text-orange-400 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                      <Icon d={IC.flame} size={12} color="#f97316" />Security Impact
                    </span>
                    <p className="text-sm text-orange-800 dark:text-orange-200 leading-relaxed">{securityImpact}</p>
                  </div>
                )}

                {/* Code comparison */}
                {(insecureCode || secureCode) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {insecureCode && (
                      <div>
                        <span className="text-xs font-bold text-red-500 uppercase tracking-wide mb-1.5 block">❌ Insecure Code Pattern</span>
                        <pre className="text-xs bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300 p-3 rounded-xl overflow-auto max-h-48 border border-red-200 dark:border-red-900/50 whitespace-pre-wrap font-mono leading-relaxed">{insecureCode}</pre>
                      </div>
                    )}
                    {secureCode && (
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">✅ Secure Implementation</span>
                          <button
                            onClick={() => copyCode(secureCode, `${i}-fix`)}
                            className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700/40 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors">
                            {copied[`${i}-fix`] ? 'Copied ✓' : 'Copy'}
                          </button>
                        </div>
                        <pre className="text-xs bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200 p-3 rounded-xl overflow-auto max-h-48 border border-emerald-200 dark:border-emerald-900/50 whitespace-pre-wrap font-mono leading-relaxed">{secureCode}</pre>
                        {secureNotes && (
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5 italic leading-relaxed">{secureNotes}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Why the fix is secure */}
                {whyFixSecure && (
                  <div>
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                      <Icon d={IC.check} size={12} color="#22c55e" />Why the Fix Is Secure
                    </span>
                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{whyFixSecure}</p>
                  </div>
                )}

                {/* Lesson takeaway pill */}
                {lesson && (
                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700/40">
                    <Icon d={IC.book} size={13} color="#6366f1" className="flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wide block mb-0.5">Secure Coding Lesson</span>
                      <p className="text-xs text-indigo-800 dark:text-indigo-200 leading-relaxed">{lesson}</p>
                    </div>
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
  const { isDark } = useTheme();
  if (loading) return <Skeleton h="h-48" />;
  if (!progress?.score_history?.length) return (
    <p className="text-sm text-gray-400 italic">No trend data yet. Run more scans on this repository.</p>
  );
  const data = progress.score_history.map(s => ({
    date: s.scan_date ? s.scan_date.split('T')[0] : '',
    score: s.score,
  }));
  const textColor = isDark ? '#9ca3af' : '#6b7280';
  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: -15 }}>
        <defs>
          <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}   />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#e5e7eb'} />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: textColor }} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: textColor }} tickLine={false} />
        <Tooltip contentStyle={{
          background: isDark ? '#1f2937' : '#fff',
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
// Markdown renderer (lightweight — handles ```, **, `inline`, - lists, ##)
// ─────────────────────────────────────────────────────────────────────────────
function renderMarkdown(text) {
  if (!text) return null;
  const parts = [];
  // Split out fenced code blocks first
  const codeRe = /```(\w*)\n([\s\S]*?)```/g;
  let last = 0;
  let m;
  while ((m = codeRe.exec(text)) !== null) {
    if (m.index > last) {
      parts.push({ type: 'text', content: text.slice(last, m.index) });
    }
    parts.push({ type: 'code', lang: m[1] || 'text', content: m[2] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ type: 'text', content: text.slice(last) });

  return parts.map((p, pi) => {
    if (p.type === 'code') return <CodeBlock key={pi} lang={p.lang} code={p.content} />;
    // Inline rendering: bold, inline-code, bullet lines
    const lines = p.content.split('\n');
    return (
      <span key={pi}>
        {lines.map((line, li) => {
          const isBullet = /^[-*]\s/.test(line.trimStart());
          const rendered = inlineRender(isBullet ? line.replace(/^[-*]\s/, '') : line);
          if (isBullet) {
            return (
              <div key={li} className="flex items-start gap-2 my-0.5">
                <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-indigo-400 mt-2" />
                <span>{rendered}</span>
              </div>
            );
          }
          return (
            <span key={li}>
              {rendered}
              {li < lines.length - 1 && line.trim() === '' ? (
                <div className="h-2" />
              ) : li < lines.length - 1 ? (
                <br />
              ) : null}
            </span>
          );
        })}
      </span>
    );
  });
}

function inlineRender(text) {
  const parts = [];
  const re = /(\*\*(.+?)\*\*|`([^`]+)`)/g;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(<span key={last}>{text.slice(last, m.index)}</span>);
    if (m[0].startsWith('**')) {
      parts.push(<strong key={m.index} className="font-semibold">{m[2]}</strong>);
    } else {
      parts.push(
        <code key={m.index}
          className="px-1 py-0.5 mx-0.5 rounded text-xs font-mono bg-gray-200 dark:bg-gray-700 text-indigo-600 dark:text-indigo-300">
          {m[3]}
        </code>
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(<span key={last}>{text.slice(last)}</span>);
  return parts;
}

function CodeBlock({ lang, code }) {
  const [copied, setCopied] = React.useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="my-2 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-100 dark:bg-gray-800">
        <span className="text-xs font-mono font-semibold text-gray-500 dark:text-gray-400">
          {lang || 'code'}
        </span>
        <button onClick={copy}
          className="text-xs text-gray-400 hover:text-indigo-500 transition-colors flex items-center gap-1">
          <Icon d={copied ? IC.check : IC.code} size={12} />
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="p-3 text-xs font-mono text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-900 overflow-x-auto whitespace-pre leading-relaxed">
        {code}
      </pre>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Typing indicator
// ─────────────────────────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-2">
      {[0, 1, 2].map(i => (
        <span key={i} className="w-2 h-2 rounded-full bg-indigo-400 inline-block"
          style={{ animation: `bounce 1.2s ${i * 0.2}s infinite` }} />
      ))}
      <style>{`@keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}`}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Severity sort order
// ─────────────────────────────────────────────────────────────────────────────
const SEV_ORDER = ['critical', 'high', 'medium', 'low', 'info'];
const SEV_WEIGHT = { critical: 5, high: 4, medium: 3, low: 2, info: 1 };
function categoryScore(sevCounts) {
  return Object.entries(sevCounts).reduce(
    (acc, [s, c]) => acc + (SEV_WEIGHT[s] || 0) * c, 0
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CategoryCard — one tile in the hub grid
// ─────────────────────────────────────────────────────────────────────────────
function CategoryCard({ catSlug, catData, onSelect, learned }) {
  const knowledge = catData?.knowledge || {};
  const label  = knowledge.label || catSlug.replace(/_/g, ' ');
  const color  = knowledge.color || '#6366f1';
  const count  = catData?.count || 0;
  const sevCounts = catData?.sev_counts || {};
  const fileCount = catData?.file_count || 0;
  const isLearned = !!learned;

  // top severity badge
  const topSev = SEV_ORDER.find(s => (sevCounts[s] || 0) > 0);

  return (
    <button onClick={onSelect}
      className={`group relative text-left w-full rounded-2xl overflow-hidden transition-all duration-300 ease-out
        bg-white dark:bg-[#1a1d27] hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-black/20 hover:-translate-y-1 active:translate-y-0 active:shadow-md
        ring-1 ${isLearned ? 'ring-emerald-300/60 dark:ring-emerald-700/40' : 'ring-slate-200/80 dark:ring-white/6 hover:ring-slate-300 dark:hover:ring-white/10'}`}>

      {/* Gradient accent strip */}
      <div className="h-[3px] w-full" style={{ background: `linear-gradient(90deg, ${color}, ${color}60)` }} />

      {/* Learned shimmer overlay */}
      {isLearned && (
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-emerald-500/[0.03] to-transparent" />
      )}

      <div className="p-4">
        {/* Header: icon + count */}
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm transition-transform duration-300 group-hover:scale-110"
            style={{ background: `linear-gradient(135deg, ${color}18, ${color}08)`, border: `1px solid ${color}15` }}>
            <Icon d={IC.shield} size={18} color={color} />
          </div>
          <div className="flex flex-col items-end">
            <span className="text-2xl font-black leading-none tracking-tight" style={{ color }}>{count}</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">{count === 1 ? 'issue' : 'issues'}</span>
          </div>
        </div>

        {/* Name */}
        <h3 className="font-bold text-[13px] text-slate-900 dark:text-white mb-2 leading-snug tracking-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
          {label}
        </h3>

        {/* Severity pills */}
        <div className="flex flex-wrap gap-1 mb-3">
          {SEV_ORDER.filter(s => sevCounts[s] > 0).map(s => (
            <span key={s} className="text-[10px] px-2 py-[2px] rounded-md font-bold"
              style={{ background: `${SEV_COLORS[s]}10`, color: SEV_COLORS[s], border: `1px solid ${SEV_COLORS[s]}15` }}>
              {sevCounts[s]} {s}
            </span>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/5">
          {fileCount > 0
            ? <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                <Icon d={IC.file} size={9} className="opacity-40" />{fileCount} file{fileCount !== 1 ? 's' : ''}
              </span>
            : <span />}
          {isLearned
            ? <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-md border border-emerald-200/50 dark:border-emerald-700/30">
                <Icon d={IC.check} size={10} color="#34d399" />Reviewed
              </span>
            : <span className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                Start Learning <span className="transition-transform duration-200 group-hover:translate-x-0.5 inline-block">→</span>
              </span>}
        </div>
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FindingRow — one affected file in the detail view
// ─────────────────────────────────────────────────────────────────────────────
function FindingRow({ finding, idx }) {
  const [open, setOpen] = useState(false);
  const { file, line, line_start, line_end, severity, title, message, code_snippet, rule_id } = finding;
  const sev = severity || 'info';
  
  // Determine line number to display (try line, then line_start)
  const lineNum = line || line_start;
  const endLine = line_end;
  const lineDisplay = lineNum 
    ? (endLine && endLine !== lineNum ? `Lines ${lineNum}-${endLine}` : `Line ${lineNum}`)
    : null;
  
  return (
    <div className="border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden bg-white dark:bg-[#1a1d27]">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
        <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white"
          style={{ background: SEV_COLORS[sev] || '#6366f1' }}>
          {idx + 1}
        </span>
        {finding.lifecycle_state && (
          <LifecycleBadge state={finding.lifecycle_state} />
        )}
        <span className="px-1.5 py-0.5 rounded text-xs font-bold mr-1 flex-shrink-0"
          style={{ background: `${SEV_COLORS[sev]}20`, color: SEV_COLORS[sev] }}>
          {sev.toUpperCase()}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-mono text-xs text-indigo-600 dark:text-indigo-400 truncate">
              {file || 'unknown file'}
            </span>
          </div>
          {lineDisplay && (
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-xs font-semibold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded border border-orange-200 dark:border-orange-700/40">
                {lineDisplay}
              </span>
            </div>
          )}
          {title && title !== (rule_id || '') && (
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{title}</p>
          )}
        </div>
        <Icon d={open ? IC.chevUp : IC.chevDn} size={15} className="flex-shrink-0 text-slate-400 dark:text-slate-500 ml-1" />
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-slate-100 dark:border-white/8 space-y-2 pt-3">
          {message && <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{message}</p>}
          {code_snippet && (
            <div>
              <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Code snippet</span>
              <pre className="mt-1.5 p-3 rounded-lg bg-slate-100 dark:bg-[#0d0f17] text-slate-700 dark:text-slate-200 text-xs font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed border border-slate-200 dark:border-white/8">
                {code_snippet}
              </pre>
            </div>
          )}
          {rule_id && (
            <p className="text-xs text-slate-400 dark:text-slate-500">Rule: <code className="font-mono text-indigo-600 dark:text-indigo-400">{rule_id}</code></p>
          )}

        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StaticGuide — fallback educational content from category_knowledge
// ─────────────────────────────────────────────────────────────────────────────
function StaticGuide({ guide }) {
  const { plain_what, plain_why, plain_fix, code_example, checklist, cwe_refs } = guide;
  return (
    <div className="space-y-5">
      {plain_what && (
        <section>
          <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-2 flex items-center gap-2">
            <Icon d={IC.info} size={15} color="#6366f1" />What is this vulnerability?
          </h4>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{plain_what}</p>
        </section>
      )}
      {plain_why && (
        <section>
          <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-2 flex items-center gap-2">
            <Icon d={IC.flame} size={15} color="#f97316" />Why it matters
          </h4>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{plain_why}</p>
        </section>
      )}
      {plain_fix && (
        <section>
          <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-2 flex items-center gap-2">
            <Icon d={IC.wrench} size={15} color="#22c55e" />How to fix it
          </h4>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{plain_fix}</p>
        </section>
      )}
      {(code_example?.bad || code_example?.good) && (
        <section>
          <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-3 flex items-center gap-2">
            <Icon d={IC.code} size={15} color="#6366f1" />Code example
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {code_example.bad && (
              <div>
                <span className="text-xs font-bold text-red-400 uppercase tracking-wide block mb-1.5">❌ Insecure</span>
                <pre className="text-xs p-3 rounded-xl bg-red-950/30 border border-red-900/50 text-red-300 font-mono overflow-x-auto whitespace-pre-wrap">{code_example.bad}</pre>
              </div>
            )}
            {code_example.good && (
              <div>
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wide block mb-1.5">✅ Secure</span>
                <pre className="text-xs p-3 rounded-xl bg-emerald-950/30 border border-emerald-900/50 text-emerald-300 font-mono overflow-x-auto whitespace-pre-wrap">{code_example.good}</pre>
              </div>
            )}
          </div>
        </section>
      )}
      {checklist?.length > 0 && (
        <section>
          <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-2 flex items-center gap-2">
            <Icon d={IC.check} size={15} color="#22c55e" />Quick checklist
          </h4>
          <ul className="space-y-1.5">
            {checklist.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-50 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-700/40 flex items-center justify-center mt-0.5">
                  <Icon d={IC.check} size={10} color="#34d399" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}
      {cwe_refs?.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {cwe_refs.map(ref => (
            <a key={ref} href={`https://cwe.mitre.org/data/definitions/${ref.replace('CWE-','')}.html`}
              target="_blank" rel="noopener noreferrer"
              className="text-xs px-2 py-1 rounded-lg bg-slate-100 dark:bg-white/8 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors font-mono border border-slate-200 dark:border-white/10">
              {ref} ↗
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LearningPanel — right sidebar that explains the security concept
// ─────────────────────────────────────────────────────────────────────────────
function LearningPanel({ item, guide, isVisible }) {
  // Static knowledge from the guide for generic concept info
  const { plain_what, plain_why, plain_fix, code_example, checklist, cwe_refs, label, color } = guide || {};

  // If a specific item is selected via "Explain Concept", show concept for that item
  const conceptTitle = item?.vulnerability || item?.finding_id || label || 'Security Concept';
  const coachExpl    = item?.coach_explanation || '';
  const whyInsecure  = item?.why_this_is_insecure || item?.why_it_matters || '';
  const whatIsWrong  = item?.what_is_wrong || item?.what_happened || '';
  const lesson       = item?.secure_coding_lesson || item?.learning_takeaway || '';
  const whyFixSecure = item?.why_the_fix_is_secure || '';
  const secImpact    = item?.security_impact || item?.business_impact || '';
  const cwe          = item?.cwe || '';

  // Key for animation reset on item change
  const animKey = item ? (item.file || '') + (item.line || '') + (item.vulnerability || '') : 'default';

  return (
    <div className="flex flex-col h-full">
      {/* Panel header — gradient accent */}
      <div className="flex-shrink-0 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ background: `linear-gradient(135deg, ${color || '#6366f1'}, transparent)` }} />
        <div className="relative px-5 py-4 border-b border-slate-200/80 dark:border-white/6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm"
              style={{ background: `linear-gradient(135deg, ${color || '#6366f1'}25, ${color || '#6366f1'}10)`, border: `1px solid ${color || '#6366f1'}20` }}>
              <Icon d={IC.book} size={16} color={color || '#6366f1'} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-[13px] text-slate-900 dark:text-white leading-tight tracking-tight">Security Learning</h3>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 leading-tight">
                {item ? 'Concept deep-dive' : 'Click "Explain Concept" on any issue'}
              </p>
            </div>
            {item && (
              <span className="flex-shrink-0 w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            )}
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div key={animKey} className="flex-1 overflow-y-auto">
        <div className={`px-5 py-5 space-y-4 transition-all duration-300 ease-out ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
        }`}>
        {!item ? (
          /* Empty state — elegant placeholder + static knowledge */
          <>
            <div className="text-center py-8">
              <div className="relative w-16 h-16 mx-auto mb-4">
                <div className="absolute inset-0 rounded-2xl opacity-20 animate-pulse"
                  style={{ background: `linear-gradient(135deg, ${color || '#6366f1'}, transparent)` }} />
                <div className="relative w-full h-full rounded-2xl flex items-center justify-center"
                  style={{ background: `${color || '#6366f1'}08`, border: `1.5px dashed ${color || '#6366f1'}30` }}>
                  <Icon d={IC.brain} size={24} color={color || '#6366f1'} className="opacity-60" />
                </div>
              </div>
              <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-1.5">{label || 'Select an Issue'}</h4>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 max-w-[220px] mx-auto leading-relaxed">
                Tap <strong className="text-indigo-500">Explain Concept</strong> on any issue to see a deep explanation here
              </p>
            </div>

            {/* Separator */}
            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 h-px bg-slate-200 dark:bg-white/6" />
              <span className="text-[9px] font-bold text-slate-300 dark:text-slate-600 uppercase tracking-widest">Overview</span>
              <div className="flex-1 h-px bg-slate-200 dark:bg-white/6" />
            </div>

            {plain_what && (
              <LearnCard icon={IC.info} iconColor="#6366f1" title="What is this?">
                <p className="text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed">{plain_what}</p>
              </LearnCard>
            )}
            {plain_why && (
              <LearnCard icon={IC.flame} iconColor="#f97316" title="Why it matters">
                <p className="text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed">{plain_why}</p>
              </LearnCard>
            )}
            {plain_fix && (
              <LearnCard icon={IC.wrench} iconColor="#22c55e" title="How to fix">
                <p className="text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed">{plain_fix}</p>
              </LearnCard>
            )}
            {checklist?.length > 0 && (
              <LearnCard icon={IC.check} iconColor="#22c55e" title="Quick checklist">
                <ul className="space-y-2">
                  {checklist.map((c, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-[13px] text-slate-600 dark:text-slate-300">
                      <span className="flex-shrink-0 w-[18px] h-[18px] rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mt-0.5">
                        <Icon d={IC.check} size={9} color="#34d399" />
                      </span>
                      <span className="leading-relaxed">{c}</span>
                    </li>
                  ))}
                </ul>
              </LearnCard>
            )}
          </>
        ) : (
          /* Active concept — deep-dive on a specific finding */
          <>
            {/* Concept hero */}
            <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-white/8">
              <div className="px-4 py-3" style={{ background: `linear-gradient(135deg, ${color || '#6366f1'}08, ${color || '#6366f1'}03)` }}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[9px] font-black uppercase tracking-widest text-indigo-500 dark:text-indigo-400">Concept</span>
                  {item?.severity && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
                      style={{ background: `${SEV_COLORS[item.severity?.toLowerCase()]}12`, color: SEV_COLORS[item.severity?.toLowerCase()] }}>
                      {item.severity.toUpperCase()}
                    </span>
                  )}
                </div>
                <h4 className="font-black text-[15px] text-slate-900 dark:text-white leading-snug">{conceptTitle}</h4>
                {item?.file && (
                  <p className="text-[11px] font-mono text-slate-400 dark:text-slate-500 mt-1.5 truncate flex items-center gap-1.5">
                    <Icon d={IC.file} size={10} className="opacity-50" />
                    {item.file}{item.line ? `:${item.line}` : ''}
                  </p>
                )}
              </div>
            </div>

            {/* Explanation */}
            {coachExpl && (
              <LearnCard icon={IC.brain} iconColor="#6366f1" title="Simple Explanation" accent>
                <p className="text-[13px] text-slate-700 dark:text-slate-200 leading-relaxed">{coachExpl}</p>
              </LearnCard>
            )}

            {whatIsWrong && (
              <LearnCard icon={IC.alertTriangle} iconColor="#f97316" title="What Happened in Your Code">
                <p className="text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed">{whatIsWrong}</p>
              </LearnCard>
            )}

            {whyInsecure && (
              <LearnCard icon={IC.info} iconColor="#ef4444" title="Why This Is Insecure">
                <p className="text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed">{whyInsecure}</p>
              </LearnCard>
            )}

            {/* Security Impact — highlighted card */}
            {secImpact && (
              <div className="rounded-xl border border-orange-200/60 dark:border-orange-800/30 overflow-hidden">
                <div className="px-4 py-1.5 bg-orange-500/5 border-b border-orange-200/40 dark:border-orange-800/20">
                  <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Icon d={IC.flame} size={10} color="#f97316" />Security Impact
                  </span>
                </div>
                <div className="px-4 py-3 bg-orange-50/50 dark:bg-orange-950/10">
                  <p className="text-[13px] text-orange-800 dark:text-orange-200 leading-relaxed">{secImpact}</p>
                </div>
              </div>
            )}

            {whyFixSecure && (
              <LearnCard icon={IC.shield} iconColor="#22c55e" title="Secure Coding Rules">
                <p className="text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed">{whyFixSecure}</p>
              </LearnCard>
            )}

            {/* Key takeaway — prominent callout */}
            {lesson && (
              <div className="rounded-xl border border-indigo-200/50 dark:border-indigo-800/30 overflow-hidden">
                <div className="px-4 py-1.5 bg-indigo-500/5 border-b border-indigo-200/40 dark:border-indigo-800/20">
                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Icon d={IC.star} size={10} color="#6366f1" />Key Takeaway
                  </span>
                </div>
                <div className="px-4 py-3 bg-indigo-50/40 dark:bg-indigo-950/10">
                  <p className="text-[13px] text-indigo-900 dark:text-indigo-200 leading-relaxed font-medium">{lesson}</p>
                </div>
              </div>
            )}

            {/* References */}
            {(cwe || cwe_refs?.length > 0) && (
              <LearnCard icon={IC.file} iconColor="#64748b" title="References">
                <div className="flex flex-wrap gap-1.5">
                  {cwe && (
                    <a href={`https://cwe.mitre.org/data/definitions/${cwe.replace('CWE-','')}.html`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-white dark:bg-white/5 text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 font-mono border border-slate-200 dark:border-white/10 shadow-sm hover:shadow transition-all">
                      {cwe} ↗
                    </a>
                  )}
                  {cwe_refs?.filter(r => r !== cwe).map(ref => (
                    <a key={ref} href={`https://cwe.mitre.org/data/definitions/${ref.replace('CWE-','')}.html`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-white dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:text-indigo-500 font-mono border border-slate-200 dark:border-white/10 shadow-sm hover:shadow transition-all">
                      {ref} ↗
                    </a>
                  ))}
                </div>
              </LearnCard>
            )}

            {plain_fix && (
              <LearnCard icon={IC.wrench} iconColor="#22c55e" title="Prevention Techniques">
                <p className="text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed">{plain_fix}</p>
              </LearnCard>
            )}
          </>
        )}
        </div>
      </div>
    </div>
  );
}

function LearnCard({ icon, iconColor, title, children, accent }) {
  return (
    <div className={`rounded-xl border p-4 transition-all duration-200 ${
      accent
        ? 'border-indigo-200/50 dark:border-indigo-800/25 bg-indigo-50/30 dark:bg-indigo-950/10'
        : 'border-slate-200/80 dark:border-white/6 bg-white dark:bg-white/[0.02]'
    }`}>
      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-2.5">
        <span className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: `${iconColor}10` }}>
          <Icon d={icon} size={10} color={iconColor} />
        </span>
        {title}
      </span>
      {children}
    </div>
  );
}

function LearningSection({ icon, iconColor, title, children }) {
  return (
    <div>
      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1.5 mb-2">
        <Icon d={icon} size={12} color={iconColor} />{title}
      </span>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// IssueCoachCard — single issue card in the review panel
// ─────────────────────────────────────────────────────────────────────────────
function IssueCoachCard({ item, index, isOpen, onToggle, onExplain, isExplaining, onCopyFix }) {
  const [copiedFix, setCopiedFix] = useState(false);

  const fid            = item.vulnerability || item.finding_id || item.vuln_id || `Finding ${index + 1}`;
  const file           = item.file || '';
  const line           = item.line || '';
  const severity       = (item.severity || '').toLowerCase();
  const endpoint       = item.endpoint || '';
  const cwe            = item.cwe || '';
  const isInferred     = item.inferred || false;
  const coachExpl      = item.coach_explanation || '';
  const whatIsWrong    = item.what_is_wrong || item.what_happened || '';
  const whyInsecure    = item.why_this_is_insecure || item.why_it_matters || '';
  const securityImpact = item.security_impact || item.business_impact || '';
  const insecureCode   = item.insecure_code_example || item.secure_example_before || item.secure_pattern || '';
  const secureCode     = item.secure_code_fix?.code || item.secure_example_after || '';
  const secureNotes    = item.secure_code_fix?.notes || '';
  const whyFixSecure   = item.why_the_fix_is_secure || '';
  const lesson         = item.secure_coding_lesson || item.learning_takeaway || item.takeaway || '';

  const handleCopyFix = () => {
    if (!secureCode) return;
    navigator.clipboard.writeText(secureCode).then(() => {
      setCopiedFix(true);
      setTimeout(() => setCopiedFix(false), 2000);
      onCopyFix?.();
    });
  };

  const sevColor = SEV_COLORS[severity] || '#64748b';

  return (
    <div className={`group rounded-2xl overflow-hidden transition-all duration-300 ease-out ${
      isOpen
        ? 'shadow-lg shadow-slate-200/60 dark:shadow-black/20 ring-1 ring-slate-200 dark:ring-white/8'
        : 'shadow-sm hover:shadow-md ring-1 ring-slate-200/80 dark:ring-white/6 hover:ring-slate-300 dark:hover:ring-white/10'
    } bg-white dark:bg-[#1a1d27]`}>

      {/* ── Header ── */}
      <button onClick={onToggle}
        className="w-full flex items-center gap-3.5 px-4 py-3.5 text-left group/header transition-colors relative">
        {/* Left accent line on open */}
        {isOpen && (
          <div className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full" style={{ background: sevColor }} />
        )}
        <div className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-[11px] font-black transition-all duration-200 ${
          isOpen
            ? 'text-white shadow-md'
            : 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/25'
        }`}
        style={isOpen ? { background: `linear-gradient(135deg, #6366f1, #818cf8)`, boxShadow: '0 4px 12px rgba(99,102,241,0.25)' } : {}}>
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-[13px] text-slate-900 dark:text-white leading-tight">{fid}</span>
            {severity && (
              <span className="text-[9px] font-black px-2 py-[3px] rounded-md flex-shrink-0 uppercase tracking-wider"
                style={{ background: `${sevColor}12`, color: sevColor, border: `1px solid ${sevColor}20` }}>
                {severity}
              </span>
            )}
            {!isInferred && (
              <span className="text-[9px] font-bold px-2 py-[3px] rounded-md bg-violet-50 dark:bg-violet-900/25 text-violet-600 dark:text-violet-300 border border-violet-200/60 dark:border-violet-700/30 flex-shrink-0 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />AI
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {file && (
              <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono truncate flex items-center gap-1">
                <Icon d={IC.file} size={9} className="opacity-40" />
                {file}{line ? `:${line}` : ''}
              </span>
            )}
            {endpoint && (
              <span className="text-[9px] font-mono bg-slate-50 dark:bg-white/5 text-slate-400 dark:text-slate-500 px-1.5 py-[2px] rounded-md border border-slate-200/80 dark:border-white/6 flex-shrink-0">
                {endpoint}
              </span>
            )}
          </div>
        </div>
        <div className={`flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center transition-all duration-200 ${
          isOpen ? 'bg-indigo-50 dark:bg-indigo-900/20 rotate-0' : 'bg-slate-50 dark:bg-white/5 group-hover/header:bg-slate-100 dark:group-hover/header:bg-white/8'
        }`}>
          <Icon d={isOpen ? IC.chevUp : IC.chevDn} size={13} className={isOpen ? 'text-indigo-500' : 'text-slate-400'} />
        </div>
      </button>

      {/* ── Body ── */}
      {isOpen && (
        <div className="border-t border-slate-100 dark:border-white/5">
          <div className="px-5 py-5 space-y-4">

            {/* Coach explanation — hero banner */}
            {coachExpl && (
              <div className="rounded-xl overflow-hidden border border-indigo-200/50 dark:border-indigo-800/30">
                <div className="px-4 py-1.5 bg-indigo-500/[0.06] border-b border-indigo-200/40 dark:border-indigo-800/20 flex items-center gap-2">
                  <Icon d={IC.brain} size={12} color="#6366f1" />
                  <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Coach Insight</span>
                </div>
                <div className="px-4 py-3 bg-indigo-50/30 dark:bg-indigo-950/10">
                  <p className="text-[13px] text-indigo-900 dark:text-indigo-200 leading-relaxed">{coachExpl}</p>
                </div>
              </div>
            )}

            {/* What you did wrong */}
            {whatIsWrong && (
              <CoachSection icon={IC.alertTriangle} iconColor="#f97316" title="What You Did Wrong">
                <p className="text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed">{whatIsWrong}</p>
              </CoachSection>
            )}

            {/* Why insecure */}
            {whyInsecure && (
              <CoachSection icon={IC.shield} iconColor="#ef4444" title="Why This Is Insecure">
                <p className="text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed">{whyInsecure}</p>
              </CoachSection>
            )}

            {/* Security impact — accented card */}
            {securityImpact && (
              <div className="rounded-xl overflow-hidden border border-orange-200/50 dark:border-orange-800/30">
                <div className="px-4 py-1.5 bg-orange-500/[0.06] border-b border-orange-200/40 dark:border-orange-800/20 flex items-center gap-2">
                  <Icon d={IC.flame} size={11} color="#f97316" />
                  <span className="text-[10px] font-black text-orange-600 dark:text-orange-400 uppercase tracking-widest">Security Impact</span>
                </div>
                <div className="px-4 py-3 bg-orange-50/30 dark:bg-orange-950/10">
                  <p className="text-[13px] text-orange-800 dark:text-orange-200 leading-relaxed">{securityImpact}</p>
                </div>
              </div>
            )}

            {/* Code comparison — unified container */}
            {(insecureCode || secureCode) && (
              <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-white/8">
                <div className="px-4 py-2 bg-slate-800 dark:bg-slate-900 flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Icon d={IC.code} size={11} color="#94a3b8" />Code Comparison
                  </span>
                  {secureCode && (
                    <button onClick={handleCopyFix}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition-all ${
                        copiedFix
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                      }`}>
                      {copiedFix ? '✓ Copied' : 'Copy Fix'}
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-white/6">
                  {insecureCode && (
                    <div className="relative">
                      <div className="px-3 py-1.5 bg-red-500/[0.06] border-b border-red-200/30 dark:border-red-900/30 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-red-500/80" />
                        <span className="text-[9px] font-bold text-red-500/80 dark:text-red-400/80 uppercase tracking-wider">Before (Insecure)</span>
                      </div>
                      <pre className="text-[12px] bg-red-50/40 dark:bg-red-950/15 text-red-800 dark:text-red-300 p-3.5 overflow-auto max-h-56 whitespace-pre-wrap font-mono leading-[1.7] selection:bg-red-200 dark:selection:bg-red-800">
{insecureCode}
                      </pre>
                    </div>
                  )}
                  {secureCode && (
                    <div className="relative">
                      <div className="px-3 py-1.5 bg-emerald-500/[0.06] border-b border-emerald-200/30 dark:border-emerald-900/30 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500/80" />
                        <span className="text-[9px] font-bold text-emerald-600/80 dark:text-emerald-400/80 uppercase tracking-wider">After (Secure)</span>
                      </div>
                      <pre className="text-[12px] bg-emerald-50/40 dark:bg-emerald-950/15 text-emerald-800 dark:text-emerald-200 p-3.5 overflow-auto max-h-56 whitespace-pre-wrap font-mono leading-[1.7] selection:bg-emerald-200 dark:selection:bg-emerald-800">
{secureCode}
                      </pre>
                      {secureNotes && (
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 px-3.5 pb-2 italic leading-relaxed">{secureNotes}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Why the fix works */}
            {whyFixSecure && (
              <CoachSection icon={IC.check} iconColor="#22c55e" title="Why The Fix Works">
                <p className="text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed">{whyFixSecure}</p>
              </CoachSection>
            )}

            {/* Lesson — key takeaway callout */}
            {lesson && (
              <div className="rounded-xl overflow-hidden border border-indigo-200/50 dark:border-indigo-800/30">
                <div className="px-4 py-1.5 bg-indigo-500/[0.06] border-b border-indigo-200/40 dark:border-indigo-800/20 flex items-center gap-2">
                  <Icon d={IC.star} size={10} color="#6366f1" />
                  <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Key Takeaway</span>
                </div>
                <div className="px-4 py-3 bg-indigo-50/30 dark:bg-indigo-950/10">
                  <p className="text-[13px] text-indigo-900 dark:text-indigo-200 leading-relaxed font-medium">{lesson}</p>
                </div>
              </div>
            )}

            {/* ── Action toolbar ── */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
              <button onClick={() => onExplain(item)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-bold transition-all duration-200 ${
                  isExplaining
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25 scale-[0.98]'
                    : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-700/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 hover:shadow-sm'
                }`}>
                <Icon d={IC.brain} size={13} color={isExplaining ? 'white' : undefined} />
                {isExplaining ? 'Active' : 'Explain Concept'}
              </button>
              {secureCode && (
                <button onClick={handleCopyFix}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-semibold transition-all duration-200 ${
                    copiedFix
                      ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/25'
                      : 'text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/8 hover:text-emerald-600 hover:border-emerald-200 dark:hover:text-emerald-400 dark:hover:border-emerald-700/40 hover:bg-emerald-50 dark:hover:bg-emerald-900/15'
                  }`}>
                  <Icon d={copiedFix ? IC.check : IC.code} size={12} color={copiedFix ? 'white' : undefined} />
                  {copiedFix ? 'Copied!' : 'Copy Fix'}
                </button>
              )}
              <div className="flex-1" />
              {cwe && (
                <a href={`https://cwe.mitre.org/data/definitions/${cwe.replace('CWE-','')}.html`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2.5 py-2 rounded-xl text-[11px] font-mono text-slate-400 dark:text-slate-500 border border-slate-200/70 dark:border-white/6 hover:text-indigo-500 hover:border-indigo-200/50 transition-all"
                  onClick={e => e.stopPropagation()}>
                  {cwe} ↗
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CoachSection({ icon, iconColor, title, children }) {
  return (
    <div className="rounded-xl border border-slate-100 dark:border-white/5 p-4 bg-slate-50/50 dark:bg-white/[0.015]">
      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-2">
        <span className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: `${iconColor}10` }}>
          <Icon d={icon} size={10} color={iconColor} />
        </span>
        {title}
      </span>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CategoryDetailView — two-panel layout: Issue Review | Learning Panel
// ─────────────────────────────────────────────────────────────────────────────
function CategoryDetailView({ guide, loading, onBack, onMarkLearned, isLearned, jobId, category, onVerified }) {
  const [expandedCards, setExpandedCards] = useState({ 0: true });
  const [explainItem, setExplainItem]   = useState(null);
  const [panelVisible, setPanelVisible] = useState(false);
  const [showPanel, setShowPanel]       = useState(false);   // for responsive toggle on small screens

  const toggleCard = (i) => setExpandedCards(p => ({ ...p, [i]: !p[i] }));

  const handleExplain = useCallback((item) => {
    setExplainItem(item);
    setPanelVisible(true);
    setShowPanel(true); // auto-show on mobile when explain is clicked
  }, []);

  if (loading) return (
    <div className="flex-1 overflow-y-auto px-6 py-8 space-y-4 max-w-5xl mx-auto w-full">
      <Skeleton h="h-8" w="w-48" />
      <Skeleton h="h-24" />
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-3">
          <Skeleton h="h-40" /><Skeleton h="h-40" /><Skeleton h="h-40" />
        </div>
        <div className="lg:col-span-2 space-y-3">
          <Skeleton h="h-64" /><Skeleton h="h-32" />
        </div>
      </div>
    </div>
  );
  if (!guide) return null;

  const { label, color, total, sev_counts = {}, findings = [], source,
          coaching_reviews = [], plain_what, plain_why, plain_fix, code_example,
          checklist, cwe_refs } = guide;

  const items = coaching_reviews.length > 0 ? coaching_reviews : [];

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/30 dark:bg-transparent">
      {/* ── Top bar: back + hero strip ── */}
      <div className="flex-shrink-0 bg-white dark:bg-[#1a1d27] border-b border-slate-200/80 dark:border-white/6">
        <div className="max-w-[1400px] mx-auto px-5 py-3 flex items-center gap-4">
          <button onClick={onBack}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/15 transition-all flex-shrink-0">
            <Icon d={IC.arrowDn} size={11} className="rotate-90" />Back
          </button>
          <div className="w-px h-6 bg-slate-200 dark:bg-white/8" />
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
              style={{ background: `linear-gradient(135deg, ${color}20, ${color}08)`, border: `1px solid ${color}20` }}>
              <Icon d={IC.shield} size={18} color={color} />
            </div>
            <div className="min-w-0">
              <h2 className="font-black text-[15px] text-slate-900 dark:text-white truncate tracking-tight">{label}</h2>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-[11px] font-bold" style={{ color }}>{total} issue{total !== 1 ? 's' : ''}</span>
                {SEV_ORDER.filter(s => (sev_counts[s] || 0) > 0).map(s => (
                  <span key={s} className="text-[9px] px-1.5 py-[2px] rounded-md font-bold"
                    style={{ background: `${SEV_COLORS[s]}10`, color: SEV_COLORS[s], border: `1px solid ${SEV_COLORS[s]}15` }}>
                    {sev_counts[s]} {s}
                  </span>
                ))}
                {source === 'ai' && (
                  <span className="text-[9px] px-2 py-[2px] rounded-md bg-violet-50 dark:bg-violet-900/25 text-violet-600 dark:text-violet-300 border border-violet-200/60 dark:border-violet-700/30 font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />AI-powered
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Mobile toggle for learning panel */}
            <button onClick={() => setShowPanel(p => !p)}
              className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-700/40">
              <Icon d={IC.book} size={11} />{showPanel ? 'Issues' : 'Learn'}
            </button>
            <button onClick={onMarkLearned}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-bold transition-all duration-200 ${
                isLearned
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-700/40'
                  : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/25'
              }`}>
              <Icon d={IC.check} size={11} color={isLearned ? '#34d399' : 'white'} />
              {isLearned ? 'Reviewed ✓' : 'Mark Reviewed'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Two-panel content ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* LEFT: Issue Review Panel (63%) */}
        <div className={`flex-1 lg:flex-none overflow-y-auto transition-all duration-300 ${
          showPanel ? 'hidden lg:block' : ''
        }`}
        style={{ flexBasis: '63%', minWidth: 0 }}>
          <div className="px-5 py-5 space-y-3 max-w-[840px]">

            {/* Issue count header */}
            <div className="flex items-center gap-2.5 pb-3">
              <div className="flex items-center gap-2 flex-1">
                <div className="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center">
                  <Icon d={IC.brain} size={12} color="#6366f1" />
                </div>
                <span className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  {items.length > 0
                    ? `${items.length} Coaching Review${items.length !== 1 ? 's' : ''}`
                    : `${findings.length} Finding${findings.length !== 1 ? 's' : ''}`
                  }
                </span>
              </div>
              {items.length > 1 && (
                <button onClick={() => setExpandedCards(p => {
                  const allOpen = items.every((_, i) => p[i]);
                  const next = {};
                  items.forEach((_, i) => { next[i] = !allOpen; });
                  return next;
                })}
                  className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 hover:text-indigo-500 transition-colors px-2 py-1 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-900/15">
                  {items.every((_, i) => expandedCards[i]) ? 'Collapse all' : 'Expand all'}
                </button>
              )}
            </div>

            {/* Issue cards */}
            {items.length > 0 ? (
              items.map((item, i) => (
                <IssueCoachCard
                  key={i}
                  item={item}
                  index={i}
                  isOpen={!!expandedCards[i]}
                  onToggle={() => toggleCard(i)}
                  onExplain={handleExplain}
                  isExplaining={explainItem === item}
                  onCopyFix={() => {}}
                />
              ))
            ) : (
              /* Fallback: finding list + static guide */
              <>
                {findings.length > 0 && (
                  <div className="space-y-2">
                    {findings.map((f, i) => (
                      <FindingRow key={i} finding={f} idx={i} />
                    ))}
                  </div>
                )}
                <div className="bg-slate-50 dark:bg-[#1a1d27] rounded-xl border border-slate-200 dark:border-white/10 p-5">
                  <StaticGuide guide={{ plain_what, plain_why, plain_fix, code_example, checklist, cwe_refs }} />
                </div>
              </>
            )}
          </div>
        </div>

        {/* DIVIDER — subtle shadow separator */}
        <div className="hidden lg:flex flex-col items-center flex-shrink-0 relative">
          <div className="w-px h-full bg-gradient-to-b from-slate-200 via-slate-200/60 to-transparent dark:from-white/8 dark:via-white/5 dark:to-transparent" />
          <div className="absolute inset-0 w-3 -left-1.5 bg-gradient-to-r from-black/[0.02] to-transparent dark:from-black/10 dark:to-transparent pointer-events-none" />
        </div>

        {/* RIGHT: Learning Panel (37%) */}
        <div className={`flex-shrink-0 overflow-hidden bg-slate-50/80 dark:bg-[#111318] transition-all duration-300 ${
          showPanel ? 'fixed inset-0 top-auto bottom-0 h-[70vh] lg:static lg:h-auto z-50 rounded-t-2xl lg:rounded-none shadow-2xl lg:shadow-none border-t lg:border-t-0 border-slate-300 dark:border-white/15' : 'hidden lg:block'
        }`}
        style={{ flexBasis: '37%', minWidth: 0 }}>
          {/* Mobile close button */}
          {showPanel && (
            <button onClick={() => setShowPanel(false)}
              className="lg:hidden absolute top-3 right-3 z-10 w-7 h-7 rounded-full bg-slate-200 dark:bg-white/10 flex items-center justify-center text-slate-500">
              <span className="text-xs font-bold">✕</span>
            </button>
          )}
          <LearningPanel
            item={explainItem}
            guide={guide}
            isVisible={panelVisible || !explainItem}
          />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VulnHubView — two-panel: left repo list + right category grid
// ─────────────────────────────────────────────────────────────────────────────
function VulnHubView({ summary, loadingSummary, healthScore, maturityLevel, onSelectCategory, learned, repoName, jobId, jobs, onSelectJob }) {
  const categories = summary?.categories || {};

  // ─ Group jobs by repository_name ─
  const repoGroups = React.useMemo(() => {
    const groups = {};
    (jobs || []).forEach(j => {
      const name = j.repository_name || 'Unknown';
      if (!groups[name]) groups[name] = [];
      groups[name].push(j);
    });
    // Sort each group newest-first
    Object.values(groups).forEach(arr => arr.sort((a, b) => {
      const da = a.updated_at || a.completed_at || a.created_at || '';
      const db = b.updated_at || b.completed_at || b.created_at || '';
      return db.localeCompare(da);
    }));
    return groups;
  }, [jobs]);
  const repoNames = Object.keys(repoGroups).sort();

  // Build sorted category list
  const catList = React.useMemo(() => {
    return Object.entries(categories)
      .map(([slug, val]) => {
        const cnt = typeof val === 'number' ? val : (val?.count ?? 0);
        const knowledge = (typeof val === 'object' && val !== null) ? (val?.knowledge || {}) : {};
        const sevCounts = {};
        if (summary?.findings_by_category?.[slug]) {
          summary.findings_by_category[slug].forEach(f => {
            const s = (f.severity || 'info').toLowerCase();
            sevCounts[s] = (sevCounts[s] || 0) + 1;
          });
        }
        return { slug, count: cnt, knowledge, sevCounts };
      })
      .filter(c => c.count > 0)
      .sort((a, b) => categoryScore(b.sevCounts) - categoryScore(a.sevCounts) || b.count - a.count);
  }, [categories, summary]);

  const learnedCount = catList.filter(c => learned[c.slug]).length;

  return (
    <div className="flex-1 flex overflow-hidden">

      {/* ── Left: Repository List ── */}
      <div className="w-56 flex-shrink-0 border-r border-slate-200/80 dark:border-white/6 flex flex-col overflow-hidden bg-white dark:bg-[#15171f]">
        <div className="px-4 py-3 border-b border-slate-200/80 dark:border-white/6 flex-shrink-0 flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center">
            <Icon d={IC.code} size={10} color="#6366f1" />
          </div>
          <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Repositories</p>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {repoNames.length === 0 && (
            <p className="text-[11px] text-slate-400 dark:text-slate-500 px-4 py-6 italic text-center">No repositories found</p>
          )}
          {repoNames.map(name => {
            const repoJobs = repoGroups[name];
            const latestJob = repoJobs[0];
            const latestScore = latestJob?.health_score ?? null;
            const latestVulns = latestJob?.total_vulnerabilities ?? 0;
            const latestDate  = (latestJob?.updated_at || latestJob?.completed_at || '').split('T')[0] || '';
            const isActive    = repoNames.length === 1 ? true : repoName === name;
            const scoreColor  = latestScore == null ? '#64748b' : latestScore >= 70 ? '#34d399' : latestScore >= 40 ? '#f59e0b' : '#f87171';
            return (
              <button
                key={name}
                onClick={() => onSelectJob(latestJob?.job_id || latestJob?.id || '')}
                className={`w-full text-left px-4 py-3 transition-all group relative ${
                  isActive
                    ? 'bg-indigo-50/50 dark:bg-indigo-900/15'
                    : 'hover:bg-slate-50 dark:hover:bg-white/[0.03]'
                }`}
              >
                {/* Active indicator */}
                {isActive && (
                  <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-indigo-500" />
                )}
                <p className={`text-[12px] font-bold truncate leading-snug ${
                  isActive ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white'
                }`}>{name}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[10px] font-bold" style={{ color: scoreColor }}>
                    {latestScore != null ? `${latestScore}/100` : '–'}
                  </span>
                  <span className="w-0.5 h-0.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                  <span className="text-[10px] text-slate-400 dark:text-slate-600">{latestVulns} issues</span>
                </div>
                {latestDate && <p className="text-[9px] text-slate-400 dark:text-slate-600 mt-0.5">{latestDate}</p>}

                {/* Scan picker for active repo */}
                {isActive && repoJobs.length > 1 && (
                  <select
                    className="mt-1.5 w-full text-[10px] bg-slate-50 dark:bg-white/8 border border-slate-200 dark:border-white/15 rounded text-slate-600 dark:text-slate-300 px-1.5 py-1 outline-none focus:ring-1 focus:ring-indigo-500"
                    value={jobId}
                    onClick={e => e.stopPropagation()}
                    onChange={e => { e.stopPropagation(); onSelectJob(e.target.value); }}
                  >
                    {repoJobs.map(j => {
                      const jid  = j.job_id || j.id || '';
                      const date = (j.updated_at || j.completed_at || j.created_at || '').split('T')[0];
                      return <option key={jid} value={jid}>{date || jid.slice(0, 8)} ({j.total_vulnerabilities || 0})</option>;
                    })}
                  </select>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Right: Category Grid + Behavioral Panels ── */}
      <div className="flex-1 overflow-y-auto">
        {loadingSummary ? (
          <div className="px-5 py-6">
            <Skeleton h="h-7" w="w-48" className="mb-2" />
            <Skeleton h="h-4" w="w-72" className="mb-6" />
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {[1,2,3,4,5,6].map(i => <Skeleton key={i} h="h-44" className="rounded-2xl" />)}
            </div>
          </div>
        ) : !catList.length ? (
          <div className="flex-1 flex items-center justify-center h-full">
            <div className="text-center px-4">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/25 flex items-center justify-center mx-auto mb-4">
                <Icon d={IC.check} size={30} color="#34d399" />
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white mb-2">No findings detected</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {repoName ? `${repoName} looks clean.` : 'Select a repository to view findings.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="px-5 py-5">

            {/* Hub header */}
            <div className="mb-6">
              <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center shadow-sm border border-indigo-200/30 dark:border-indigo-700/20">
                    <Icon d={IC.shield} size={18} color="#6366f1" />
                  </div>
                  <div>
                    <h2 className="text-[16px] font-black text-slate-900 dark:text-white tracking-tight">
                      {repoName || 'Security Learning Hub'}
                    </h2>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 flex items-center gap-2">
                      <span>{catList.length} vulnerability type{catList.length !== 1 ? 's' : ''}</span>
                      {healthScore > 0 && (
                        <>
                          <span className="w-0.5 h-0.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                          <span>Score: <strong style={{ color: healthScore >= 70 ? '#34d399' : healthScore >= 40 ? '#f59e0b' : '#f87171' }}>{healthScore}/100</strong></span>
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {learnedCount > 0 && (
                    <span className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-500 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/50 dark:border-emerald-700/30 rounded-lg">
                      <Icon d={IC.check} size={10} color="#34d399" />{learnedCount}/{catList.length} reviewed
                    </span>
                  )}
                  {healthScore > 0 && maturityLevel && (
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg border"
                      style={{ color: maturityLevel.text || '#a5b4fc', borderColor: `${maturityLevel.border || '#818cf8'}30`, background: `${maturityLevel.border || '#818cf8'}08` }}>
                      {maturityLevel.label}
                    </span>
                  )}
                </div>
              </div>
              {/* Progress bar */}
              {catList.length > 0 && (
                <div className="mt-3 h-1.5 rounded-full bg-slate-100 dark:bg-white/5 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500 ease-out"
                    style={{
                      width: `${Math.round((learnedCount / catList.length) * 100)}%`,
                      background: 'linear-gradient(90deg, #6366f1, #34d399)'
                    }} />
                </div>
              )}
            </div>

            {/* Category grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {catList.map(c => (
                <CategoryCard
                  key={c.slug}
                  catSlug={c.slug}
                  catData={{ count: c.count, knowledge: c.knowledge, sev_counts: c.sevCounts }}
                  onSelect={() => onSelectCategory(c.slug)}
                  learned={learned[c.slug]}
                />
              ))}
            </div>

            {/* Behavioral Insights */}
            <div className="mt-8 space-y-5">
              {jobId && <LongitudinalPanel jobId={jobId} />}
              {repoName && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Icon d={IC.star} size={12} color="#f59e0b" />Skill Tree
                  </p>
                  <SkillTree repoName={repoName} />
                </div>
              )}
              {repoName && <HabitConfidencePanel repoName={repoName} />}
              {repoName && <BadgeGrid repoName={repoName} />}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Report View — existing v3 analysis panels (unchanged, in separate tab)
// ─────────────────────────────────────────────────────────────────────────────
function ReportView({
  summary, insights, progress, maturity,
  loadingSummary, loadingInsights, loadingProgress, loadingMaturity,
  healthScore, scoreDelta, maturityLevel, riskMomentum, riskMomExpl,
  xpData, comparison, behavioralFull, aiDeepDive, aiRoadmap, recurringReport,
  fetchInsights,
}) {
  const [activeTab, setActiveTab] = useState('coach');
  const TABS = [
    { id: 'coach',    label: 'AI Coach',  icon: IC.brain   },
    { id: 'summary',  label: 'Summary',   icon: IC.shield  },
    { id: 'maturity', label: 'Maturity',  icon: IC.award   },
    { id: 'trend',    label: 'Trend',     icon: IC.trendUp },
  ];
  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      {/* Score + XP row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="flex flex-col items-center justify-center">
          {(loadingInsights || loadingSummary)
            ? <Skeleton h="h-28" w="w-28" className="rounded-full" />
            : <ScoreRing score={healthScore} delta={scoreDelta} level={maturityLevel} />}
          <p className="text-xs text-slate-500 mt-2 text-center">100 − (CRIT×15) − (HIGH×8) − (MED×3) − (LOW×1)</p>
        </Card>
        <div className="md:col-span-2">
          {xpData ? <XPBar xpData={xpData} /> : loadingInsights ? <Skeleton h="h-full" /> : (
            <Card className="h-full flex items-center justify-center">
              <p className="text-sm text-slate-500 italic">Complete a scan to earn XP</p>
            </Card>
          )}
        </div>
      </div>
      <Card>
        <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2 mb-3">
          <Icon d={IC.flame} size={15} color="#f97316" />Risk Momentum &amp; Scan Comparison
        </h3>
        <div className="space-y-3">
          <RiskMomentumBadge momentum={riskMomentum} explanation={riskMomExpl} />
          {comparison && <HistoricalComparisonPanel comparison={comparison} />}
        </div>
      </Card>
      {recurringReport?.has_recurring_patterns && <RecurringWeaknessAlert report={recurringReport} />}
      <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />
      {activeTab === 'coach' && (
        <div className="space-y-4">
          <Card>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2 mb-3">
              <Icon d={IC.brain} size={15} color="#6366f1" />AI Security Assessment
            </h3>
            <AIMentorBanner summary={insights?.learning_summary} source={insights?.source}
              cached={insights?.cached} aiError={insights?.ai_error} loading={loadingInsights} />
          </Card>
          <Card>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2 mb-3">
              <Icon d={IC.wrench} size={15} color="#f97316" />Detected Developer Habits
              {behavioralFull.length > 0 && <span className="ml-auto text-xs text-slate-400 dark:text-slate-500">{behavioralFull.length} patterns</span>}
            </h3>
            <HabitEvidenceCards habits={behavioralFull} loading={loadingInsights} />
          </Card>
          <Card>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2 mb-3">
              <Icon d={IC.brain} size={15} color="#6366f1" />AI Security Coach
              {aiDeepDive.length > 0 && (
                <span className="ml-auto flex items-center gap-1.5">
                  <span className="text-xs text-slate-400 dark:text-slate-500">{aiDeepDive.length} {aiDeepDive.length !== 1 ? 'reviews' : 'review'}</span>
                  {insights?.source === 'ai' && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300">
                      AI coached
                    </span>
                  )}
                </span>
              )}
            </h3>
            <DeepDiveV4 deepDive={aiDeepDive} loading={loadingInsights} />
          </Card>
          <Card>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2 mb-3">
              <Icon d={IC.list} size={15} color="#22c55e" />Priority Fix Roadmap
            </h3>
            <PriorityRoadmapV3 roadmap={aiRoadmap} loading={loadingInsights} />
          </Card>
        </div>
      )}
      {activeTab === 'summary' && (
        <div className="space-y-4">
          <Card>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-3">Severity Breakdown</h3>
            {loadingSummary ? <Skeleton h="h-20" /> : (
              <div className="grid grid-cols-5 gap-2">
                {['critical','high','medium','low','info'].map(sev => {
                  const count = summary?.sev_counts?.[sev] ?? 0;
                  return (
                    <div key={sev} className="text-center p-2 rounded-lg border"
                      style={{ borderColor: `${SEV_COLORS[sev]}40`, background: `${SEV_COLORS[sev]}10` }}>
                      <div className="text-2xl font-black" style={{ color: SEV_COLORS[sev] }}>{count}</div>
                      <div className="text-xs font-medium capitalize text-slate-400">{sev}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}
      {activeTab === 'maturity' && (
        <div className="space-y-4">
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <ScoreRing score={maturity?.score ?? healthScore} delta={null} level={maturityLevel} />
              <div>
                <h3 className="font-black text-lg text-slate-900 dark:text-white">{maturityLevel?.label || 'Loading...'}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">{maturityLevel?.description}</p>
              </div>
            </div>
            <TransparentMaturityCard maturity={maturity} loading={loadingMaturity} />
          </Card>
          <Card>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <Icon d={IC.award} size={15} color="#f59e0b" />Achievement Badges
            </h3>
            <BadgesSection maturity={maturity} loading={loadingMaturity} />
          </Card>
        </div>
      )}
      {activeTab === 'trend' && (
        <div className="space-y-4">
          <Card>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <Icon d={IC.trendUp} size={15} color="#6366f1" />Security Score History
            </h3>
            <ScoreTrendChart progress={progress} loading={loadingProgress} />
          </Card>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function LearningCoachPage({ jobId: propJobId, repoName: propRepoName }) {
  const { isDark } = useTheme();
  // View: 'hub' | 'detail' | 'report'
  const [view, setView] = useState('hub');
  const [selectedCategory, setSelectedCategory] = useState(null);

  const [jobs, setJobs]         = useState([]);
  const [jobId, setJobId]       = useState(propJobId || '');
  const [repoName, setRepoName] = useState(propRepoName || '');

  const [summary,  setSummary]  = useState(null);
  const [insights, setInsights] = useState(null);
  const [progress, setProgress] = useState(null);
  const [maturity, setMaturity] = useState(null);

  // Vuln guide state
  const [guide, setGuide]           = useState(null);
  const [loadingGuide, setLoadingGuide] = useState(false);
  const [guideError, setGuideError] = useState('');

  const [loadingJobs,     setLoadingJobs]     = useState(false);
  const [loadingSummary,  setLoadingSummary]  = useState(false);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(false);
  const [loadingMaturity, setLoadingMaturity] = useState(false);
  const [error, setError] = useState('');

  // Learned state persisted in localStorage (per repository, not per job)
  const [learned, setLearned] = useState(() => {
    try { return JSON.parse(localStorage.getItem('st_learned') || '{}'); } catch { return {}; }
  });
  const markLearned = (cat) => {
    if (!repoName) return;
    const key = `${repoName}__${cat}`;
    const next = { ...learned, [key]: true };
    setLearned(next);
    try { localStorage.setItem('st_learned', JSON.stringify(next)); } catch {}
  };
  const isLearned = (cat) => {
    if (!repoName) return false;
    return !!learned[`${repoName}__${cat}`];
  };

  // Load jobs on mount
  useEffect(() => {
    if (propJobId) { setJobId(propJobId); return; }
    setLoadingJobs(true);
    scanAPI.getJobs()
      .then(r => {
        const raw = r?.data ?? r;
        const list = Array.isArray(raw) ? raw : (raw?.jobs || raw?.data || []);
        setJobs(list);
        if (list.length) {
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

  useEffect(() => { fetchSummary(); fetchInsights(); }, [fetchSummary, fetchInsights]);
  useEffect(() => { fetchProgress(); fetchMaturity(); }, [fetchProgress, fetchMaturity]);

  // When scan changes, go back to hub and clear guide
  useEffect(() => {
    setView('hub');
    setGuide(null);
    setSelectedCategory(null);
    setGuideError('');
  }, [jobId]);

  const handleSelectCategory = useCallback(async (catSlug) => {
    setSelectedCategory(catSlug);
    setView('detail');
    setGuide(null);
    setGuideError('');
    setLoadingGuide(true);
    try {
      const r = await learningAPI.getVulnGuide(jobId, catSlug);
      setGuide(r?.data ?? r);
    } catch (e) {
      setGuideError(e?.response?.data?.detail || e.message || 'Failed to load guide');
    } finally {
      setLoadingGuide(false);
    }
  }, [jobId]);

  const handleBack = () => {
    setView('hub');
    setGuide(null);
    setSelectedCategory(null);
  };

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

  // Handle repo/job selection from the left panel
  const handleSelectJob = useCallback((jid) => {
    if (!jid || jid === jobId) return;
    setJobId(jid);
    const found = jobs.find(j => (j.job_id || j.id) === jid);
    if (found?.repository_name) setRepoName(found.repository_name);
  }, [jobId, jobs]);

  return (
    <div className={`h-screen flex flex-col overflow-hidden ${isDark ? 'bg-[#0d0f17] text-white' : 'bg-[#f4f6fb] text-slate-900'}`}>

      {/* ── Header ── */}
      <div className={`flex-shrink-0 flex items-center gap-4 px-5 py-2.5 border-b ${isDark ? 'border-white/6 bg-[#0d0f17]/95 backdrop-blur-xl' : 'border-slate-200/80 bg-white/95 backdrop-blur-xl shadow-sm shadow-slate-200/50'}`}>

        {/* Brand */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md shadow-indigo-500/20">
            <Icon d={IC.shield} size={16} color="white" />
          </div>
          <div>
            <span className="font-black text-[13px] leading-none tracking-tight">Security Coach</span>
            <div className="text-[9px] text-slate-400 dark:text-slate-500 leading-tight mt-0.5 font-mono">Llama 4 Maverick</div>
          </div>
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-slate-200/80 dark:bg-white/6" />

        {/* Active repo + score */}
        <div className="flex-1 flex items-center gap-2.5 min-w-0">
          {loadingJobs
            ? <Skeleton h="h-5" w="w-36" />
            : repoName
              ? <span className="text-[12px] font-bold text-slate-700 dark:text-slate-200 truncate">{repoName}</span>
              : <span className="text-[12px] text-slate-400 dark:text-slate-600 italic">No scan selected</span>
          }
          {healthScore > 0 && !loadingInsights && (
            <span className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black"
              style={{
                background: healthScore >= 70 ? 'rgba(52,211,153,0.08)' : healthScore >= 40 ? 'rgba(245,158,11,0.08)' : 'rgba(248,113,113,0.08)',
                color:      healthScore >= 70 ? '#34d399' : healthScore >= 40 ? '#f59e0b' : '#f87171',
                border:     `1px solid ${healthScore >= 70 ? '#34d39920' : healthScore >= 40 ? '#f59e0b20' : '#f8717120'}`,
              }}>
              <Icon d={IC.shield} size={10} />{healthScore}
            </span>
          )}
        </div>

        {/* View toggle — pill switcher */}
        <div className="flex-shrink-0 flex items-center gap-0.5 p-1 bg-slate-100/80 dark:bg-white/5 rounded-xl border border-slate-200/50 dark:border-white/5">
          {[
            { id: 'hub',    label: 'Learn',  icon: IC.book    },
            { id: 'report', label: 'Report', icon: IC.trendUp },
          ].map(v => (
            <button key={v.id} onClick={() => setView(v.id)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[11px] font-bold transition-all duration-200
                ${view === v.id || (view === 'detail' && v.id === 'hub')
                  ? 'bg-white dark:bg-[#1a1d27] text-indigo-600 dark:text-indigo-400 shadow-sm ring-1 ring-slate-200/60 dark:ring-white/8'
                  : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}>
              <Icon d={v.icon} size={12} />{v.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Error strip ── */}
      {(error || guideError) && (
        <div className="flex-shrink-0 mx-4 mt-2 px-3 py-2 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 rounded-lg text-xs text-red-600 dark:text-red-400 flex items-center justify-between">
          <span>{error || guideError}</span>
          <button onClick={() => { setError(''); setGuideError(''); }} className="ml-2 font-bold hover:text-red-800 dark:hover:text-red-300">✕</button>
        </div>
      )}

      {/* ── Main content ── */}
      {view === 'hub' && (
        <VulnHubView
          summary={summary}
          loadingSummary={loadingSummary}
          healthScore={healthScore}
          maturityLevel={maturityLevel}
          onSelectCategory={handleSelectCategory}
          learned={{ ...Object.fromEntries(Object.entries(learned).map(([k, v]) => [k.replace(`${repoName}__`, ''), v])) }}
          repoName={repoName}
          jobId={jobId}
          jobs={jobs}
          onSelectJob={handleSelectJob}
        />
      )}
      {view === 'detail' && (
        <CategoryDetailView
          guide={guide}
          loading={loadingGuide}
          onBack={handleBack}
          onMarkLearned={() => selectedCategory && markLearned(selectedCategory)}
          isLearned={selectedCategory ? isLearned(selectedCategory) : false}
          jobId={jobId}
          category={selectedCategory}
          onVerified={() => { fetchInsights(true); fetchMaturity(); }}
        />
      )}
      {view === 'report' && (
        <ReportView
          summary={summary} insights={insights} progress={progress} maturity={maturity}
          loadingSummary={loadingSummary} loadingInsights={loadingInsights}
          loadingProgress={loadingProgress} loadingMaturity={loadingMaturity}
          healthScore={healthScore} scoreDelta={scoreDelta} maturityLevel={maturityLevel}
          riskMomentum={riskMomentum} riskMomExpl={riskMomExpl}
          xpData={xpData} comparison={comparison} behavioralFull={behavioralFull}
          aiDeepDive={aiDeepDive} aiRoadmap={aiRoadmap} recurringReport={recurringReport}
          fetchInsights={fetchInsights}
        />
      )}
    </div>
  );
}

