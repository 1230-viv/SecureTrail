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

// ── Deep Dive v4 — per-finding AI coach with real code fixes ─────────────────
function DeepDiveV3({ deepDive, loading }) {
  const [expanded, setExpanded] = useState({ 0: true });
  const [copied, setCopied]     = useState({});

  const copyCode = (code, key) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(p => ({ ...p, [key]: true }));
      setTimeout(() => setCopied(p => ({ ...p, [key]: false })), 2000);
    });
  };

  if (loading) return (
    <div className="space-y-3">{[1,2].map(i => <Skeleton key={i} h="h-32" />)}</div>
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
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-xs font-black text-indigo-600 dark:text-indigo-400">
                {i + 1}
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
                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700/40">
                    <Icon d={IC.brain} size={15} color="#6366f1" className="flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-indigo-800 dark:text-indigo-200 leading-relaxed">{coachExpl}</p>
                  </div>
                )}

                {/* What's wrong */}
                {whatIsWrong && (
                  <div>
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                      <Icon d={IC.alertTriangle} size={12} color="#f97316" />What's Wrong
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
                  <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700/40 rounded-xl">
                    <span className="text-xs font-bold text-orange-700 dark:text-orange-400 uppercase tracking-wide flex items-center gap-1.5 mb-1">
                      <Icon d={IC.flame} size={12} color="#f97316" />Security Impact
                    </span>
                    <p className="text-xs text-orange-800 dark:text-orange-200 leading-relaxed">{securityImpact}</p>
                  </div>
                )}

                {/* Code comparison */}
                {(insecureCode || secureCode) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {insecureCode && (
                      <div>
                        <span className="text-xs font-bold text-red-500 uppercase tracking-wide mb-1.5 block">❌ Insecure Code</span>
                        <pre className="text-xs bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300 p-3 rounded-xl overflow-auto max-h-48 border border-red-200 dark:border-red-900/50 whitespace-pre-wrap font-mono leading-relaxed">{insecureCode}</pre>
                      </div>
                    )}
                    {secureCode && (
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">✅ Secure Fix</span>
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
      className="group relative text-left w-full rounded-2xl border transition-all duration-200 overflow-hidden
        bg-white dark:bg-[#1a1d27] hover:bg-slate-50 dark:hover:bg-[#1e2130] hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0"
      style={{ borderColor: isLearned ? '#22c55e' : `${color}35` }}>

      {/* Color accent bar */}
      <div className="h-1 w-full" style={{ background: color }} />

      <div className="p-5">
        {/* Icon + count row */}
        <div className="flex items-start justify-between mb-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${color}18` }}>
            <Icon d={IC.shield} size={22} color={color} />
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-2xl font-black leading-none" style={{ color }}>{count}</span>
            <span className="text-xs text-slate-400 dark:text-slate-500">findings</span>
          </div>
        </div>

        {/* Name */}
        <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-2 leading-snug">{label}</h3>

        {/* Severity chips */}
        <div className="flex flex-wrap gap-1 mb-3">
          {SEV_ORDER.filter(s => sevCounts[s] > 0).map(s => (
            <span key={s} className="text-xs px-1.5 py-0.5 rounded font-semibold"
              style={{ background: `${SEV_COLORS[s]}20`, color: SEV_COLORS[s] }}>
              {sevCounts[s]} {s}
            </span>
          ))}
        </div>

        {/* Footer row */}
        <div className="flex items-center justify-between">
          {fileCount > 0
            ? <span className="text-xs text-slate-400 dark:text-slate-500">{fileCount} file{fileCount !== 1 ? 's' : ''} affected</span>
            : <span />}
          {isLearned
            ? <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <Icon d={IC.check} size={12} color="#34d399" />Reviewed
              </span>
            : <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-500 dark:group-hover:text-indigo-300 group-hover:underline">
                Start Learning →
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
// CategoryDetailView — the full lesson page
// ─────────────────────────────────────────────────────────────────────────────
function CategoryDetailView({ guide, loading, onBack, onMarkLearned, isLearned, jobId, category, onVerified }) {
  const [guideTab, setGuideTab] = useState('learn'); // 'files' | 'learn' | 'fix'

  if (loading) return (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 max-w-3xl mx-auto w-full">
      <Skeleton h="h-8" w="w-48" />
      <Skeleton h="h-24" />
      <Skeleton h="h-48" />
      <Skeleton h="h-32" />
    </div>
  );
  if (!guide) return null;

  const { label, color, total, sev_counts = {}, findings = [], source,
          ai_guide = {}, plain_what, plain_why, plain_fix, code_example,
          checklist, cwe_refs } = guide;

  const filesTabLabel = `Affected Files (${findings.length}${total > findings.length ? ` of ${total}` : ''})`;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-5 pb-10 space-y-6">

          {/* Back button */}
          <button onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
            <Icon d={IC.arrowDn} size={14} className="rotate-90" />Back to Learning Hub
          </button>

          {/* Hero */}
          <div className="rounded-2xl p-6 flex items-start gap-5"
            style={{ background: `${color}12`, border: `1.5px solid ${color}30` }}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${color}20` }}>
              <Icon d={IC.shield} size={28} color={color} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-black text-slate-900 dark:text-white mb-1">{label}</h2>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-2xl" style={{ color }}>{total}</span>
                <span className="text-sm text-slate-500 dark:text-slate-400">finding{total !== 1 ? 's' : ''} in your code</span>
                {SEV_ORDER.filter(s => (sev_counts[s] || 0) > 0).map(s => (
                  <span key={s} className="text-xs px-2 py-0.5 rounded-full font-bold"
                    style={{ background: `${SEV_COLORS[s]}20`, color: SEV_COLORS[s] }}>
                    {sev_counts[s]} {s}
                  </span>
                ))}
                {source === 'ai' && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 border border-violet-300 dark:border-violet-700/40 font-semibold flex items-center gap-1">
                    <Icon d={IC.brain} size={11} />AI personalised
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 p-1 bg-slate-100 dark:bg-white/8 rounded-xl">
            {[
              { id: 'learn', label: 'Learn & Fix', icon: IC.book },
              { id: 'files', label: filesTabLabel, icon: IC.list },
            ].map(t => (
              <button key={t.id} onClick={() => setGuideTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all flex-1 justify-center
                  ${guideTab === t.id
                    ? 'bg-white dark:bg-[#1a1d27] text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
                <Icon d={t.icon} size={14} />{t.label}
              </button>
            ))}
          </div>

          {/* Learn & Fix tab */}
          {guideTab === 'learn' && (
            <div className="space-y-6">
              {/* Findings in your code section */}
              {findings.length > 0 && (
                <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 rounded-2xl border border-orange-200 dark:border-orange-800/40 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-orange-500/10 dark:bg-orange-500/20 flex items-center justify-center">
                      <Icon d={IC.alertTriangle} size={20} color="#f97316" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-base">
                        Issues Found in Your Code
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        {findings.length} location{findings.length !== 1 ? 's' : ''} where this vulnerability was detected
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {findings.slice(0, 10).map((f, i) => {
                      const lineNum = f.line || f.line_start;
                      const endLine = f.line_end;
                      const lineDisplay = lineNum 
                        ? (endLine && endLine !== lineNum ? `Lines ${lineNum}-${endLine}` : `Line ${lineNum}`)
                        : null;
                      
                      return (
                        <div key={i} className="bg-white dark:bg-[#1a1d27] rounded-xl border border-orange-200 dark:border-white/10 p-4">
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex-1 min-w-0 space-y-2">
                              <div className="flex items-center gap-2">
                                <code className="text-sm font-mono text-indigo-600 dark:text-indigo-400 truncate">
                                  {f.file || `Finding ${i+1}`}
                                </code>
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                {f.severity && (
                                  <span className="text-xs font-bold px-2 py-0.5 rounded flex-shrink-0"
                                    style={{ background: `${SEV_COLORS[f.severity]}20`, color: SEV_COLORS[f.severity] }}>
                                    {f.severity.toUpperCase()}
                                  </span>
                                )}
                                {lineDisplay && (
                                  <span className="text-xs font-semibold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded border border-orange-200 dark:border-orange-700/40">
                                    {lineDisplay}
                                  </span>
                                )}
                              </div>
                              {f.title && (
                                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                  {f.title}
                                </p>
                              )}
                              {f.message && (
                                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                                  {f.message}
                                </p>
                              )}
                            </div>
                          </div>
                          {f.code_snippet && (
                            <div className="mt-3">
                              <pre className="text-xs p-3 rounded-lg bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 font-mono overflow-x-auto whitespace-pre-wrap">
{f.code_snippet}
                              </pre>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {findings.length > 10 && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 text-center pt-2">
                        Showing 10 of {findings.length} findings. View all in the "Affected Files" tab.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Educational content section */}
              <div className="bg-slate-50 dark:bg-[#1a1d27] rounded-2xl border border-slate-200 dark:border-white/10 p-6">
                {ai_guide?.full_guide
                  ? <div className="prose-sm text-sm text-slate-600 dark:text-slate-300 leading-relaxed space-y-1">
                      {renderMarkdown(ai_guide.full_guide)}
                    </div>
                  : <StaticGuide guide={{ plain_what, plain_why, plain_fix, code_example, checklist, cwe_refs }} />
                }
              </div>
            </div>
          )}

          {/* Affected Files tab */}
          {guideTab === 'files' && (
            <div className="space-y-2">
              {findings.length === 0
                ? <p className="text-sm text-slate-400 italic text-center py-8">No file-level data available.</p>
                : findings.map((f, i) => (
                    <FindingRow key={i} finding={f} idx={i} />
                  ))
              }
            </div>
          )}



          {/* Mark as learned */}
          <div className="flex justify-center pt-2">
            <button onClick={onMarkLearned}
              className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all
                ${isLearned
                  ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700/40'
                  : 'bg-indigo-600 text-white hover:bg-indigo-500'}`}>
              <Icon d={IC.check} size={16} color={isLearned ? '#34d399' : 'white'} />
              {isLearned ? 'Marked as Reviewed ✓' : 'Mark as Reviewed'}
            </button>
          </div>

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
      <div className="w-56 flex-shrink-0 border-r border-slate-200 dark:border-white/8 flex flex-col overflow-hidden">
        <div className="px-3 py-2.5 border-b border-slate-200 dark:border-white/8 flex-shrink-0">
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Repositories</p>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {repoNames.length === 0 && (
            <p className="text-xs text-slate-400 dark:text-slate-500 px-3 py-4 italic">No repositories found</p>
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
                className={`w-full text-left px-3 py-2.5 transition-colors group ${
                  isActive ? 'bg-indigo-600/20 border-r-2 border-indigo-500' : 'hover:bg-slate-50 dark:hover:bg-white/5 border-r-2 border-transparent'
                }`}
              >
                <p className={`text-xs font-semibold truncate leading-snug ${
                  isActive ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white'
                }`}>{name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] font-bold" style={{ color: scoreColor }}>
                    {latestScore != null ? `${latestScore}/100` : '–'}
                  </span>
                  <span className="text-[9px] text-slate-400 dark:text-slate-600">{latestVulns} issues</span>
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
            <div className="mb-5 flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-indigo-500" />
                  <h2 className="text-base font-black text-slate-900 dark:text-white">
                    {repoName || 'Security Learning Hub'}
                  </h2>
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                  {catList.length} vuln type{catList.length !== 1 ? 's' : ''}
                  {healthScore > 0 && ` · Score: `}
                  {healthScore > 0 && <span style={{ color: healthScore >= 70 ? '#34d399' : healthScore >= 40 ? '#f59e0b' : '#f87171' }}>{healthScore}/100</span>}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {learnedCount > 0 && (
                  <span className="flex items-center gap-1 text-xs font-bold text-emerald-400 px-2 py-1 bg-emerald-900/25 border border-emerald-700/30 rounded-lg">
                    <Icon d={IC.check} size={11} color="#34d399" />{learnedCount}/{catList.length}
                  </span>
                )}
                {healthScore > 0 && maturityLevel && (
                  <span className="text-xs font-bold px-2 py-1 rounded-lg border"
                    style={{ color: maturityLevel.text || '#a5b4fc', borderColor: `${maturityLevel.border || '#818cf8'}40`, background: `${maturityLevel.border || '#818cf8'}12` }}>
                    {maturityLevel.label}
                  </span>
                )}
              </div>
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
              <Icon d={IC.target} size={15} color="#6366f1" />Deep Dive Analysis
              {aiDeepDive.length > 0 && <span className="ml-auto text-xs text-slate-400 dark:text-slate-500">{aiDeepDive.length} findings</span>}
            </h3>
            <DeepDiveV3 deepDive={aiDeepDive} loading={loadingInsights} />
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
      <div className={`flex-shrink-0 flex items-center gap-3 px-4 py-2.5 border-b ${isDark ? 'border-white/8 bg-[#0d0f17]' : 'border-slate-200 bg-white shadow-sm'}`}>

        {/* Brand */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-sm">
            <Icon d={IC.shield} size={17} color="white" />
          </div>
          <div>
            <span className="font-black text-sm leading-none">Security Learning</span>
            <div className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight mt-0.5">Llama 4 Maverick · AWS Bedrock</div>
          </div>
        </div>

        {/* Active repo + score */}
        <div className="flex-1 flex items-center gap-2 min-w-0">
          {loadingJobs
            ? <Skeleton h="h-5" w="w-36" />
            : repoName
              ? <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 truncate">{repoName}</span>
              : <span className="text-xs text-slate-400 dark:text-slate-600">No scan selected</span>
          }
          {healthScore > 0 && !loadingInsights && (
            <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold"
              style={{
                background: healthScore >= 70 ? 'rgba(52,211,153,0.15)' : healthScore >= 40 ? 'rgba(245,158,11,0.15)' : 'rgba(248,113,113,0.15)',
                color:      healthScore >= 70 ? '#34d399' : healthScore >= 40 ? '#f59e0b' : '#f87171',
                border:     `1px solid ${healthScore >= 70 ? '#34d39930' : healthScore >= 40 ? '#f59e0b30' : '#f8717130'}`,
              }}>
              <Icon d={IC.shield} size={10} />{healthScore}/100
            </span>
          )}
        </div>

        {/* View toggle */}
        <div className="flex-shrink-0 flex items-center gap-1 p-1 bg-slate-100 dark:bg-white/8 rounded-xl">
          {[
            { id: 'hub',    label: 'Learn',  icon: IC.book    },
            { id: 'report', label: 'Report', icon: IC.trendUp },
          ].map(v => (
            <button key={v.id} onClick={() => setView(v.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                ${view === v.id || (view === 'detail' && v.id === 'hub')
                  ? 'bg-white dark:bg-[#1a1d27] text-indigo-600 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}>
              <Icon d={v.icon} size={13} />{v.label}
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

