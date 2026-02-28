/**
 * LearningCoachPage.jsx — SecureTrail Learning System v2
 *
 * Upgrades from v1:
 *   1. AI Mentor Voice Card — AWS Bedrock + Claude Sonnet 4.6 branding + personalised summary
 *   2. Exploit Simulation Panel — attacker POV with attack chain, impact, damage
 *   3. Behavioral Insights Strip — dev habit diagnosis + priority + effort
 *   4. Recurring Weakness Alerts — streak counters + root-cause + suggestions
 *   5. Transparent Maturity Card — reasons + to_advance checklist + score_gap
 *   6. AI Deep Dive — full fields: business_impact, secure_pattern, takeaway
 *   7. Priority Roadmap — ranked actions from AI
 *   8. Score Trend chart + classification badge
 *   9. Full dark-mode awareness via useTheme()
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { learningAPI, scanAPI } from '../services/api';
import { useTheme } from '../context/ThemeContext';

const Icon = ({ d, size = 18, className = '', color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color || 'currentColor'} strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d} />
  </svg>
);

const IC = {
  shield:  'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  brain:   'M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.44-4.14M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.44-4.14',
  trendUp: 'M22 7l-9.5 9.5-5-5L2 17',
  trendDn: 'M22 17l-9.5-9.5-5 5L2 7',
  zap:     'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  star:    'M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z',
  eye:     'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  check:   'M20 6L9 17l-5-5',
  info:    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 8h.01M12 12v4',
  refresh: 'M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15',
  skull:   'M12 2a9 9 0 0 1 9 9c0 3.18-1.66 5.98-4.16 7.61L17 20H7l.16-1.39A9 9 0 0 1 3 11a9 9 0 0 1 9-9zM9 17v2M15 17v2M9 12a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm6 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  chevDn:  'M6 9l6 6 6-6',
  chevUp:  'M18 15l-6-6-6 6',
  book:    'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15z',
  repeat:  'M17 2l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3',
  target:  'M22 12A10 10 0 1 1 12 2M22 12h-4M18 12a6 6 0 1 1-6-6M18 12h-4M14 12a2 2 0 1 1-2-2',
};

const SEV_COLORS = { critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e', info: '#6366f1' };

const Chip = ({ label, color = '#6366f1', bg }) => (
  <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold"
    style={{ color, background: bg || `${color}20` }}>{label}</span>
);

const Skeleton = ({ h = 'h-4', w = 'w-full', className = '' }) => (
  <div className={`${h} ${w} ${className} rounded animate-pulse bg-gray-200 dark:bg-gray-700`} />
);

const Card = ({ children, className = '', style }) => (
  <div className={`rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm ${className}`} style={style}>
    {children}
  </div>
);

const SevBadge = ({ sev, count }) => {
  if (!count) return null;
  const col = SEV_COLORS[sev] || '#888';
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold"
      style={{ background: `${col}18`, color: col }}>{count} {sev}</span>
  );
};

const ScoreRing = ({ score, size = 96, strokeWidth = 8 }) => {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const pct = ((score || 0) / 100) * circ;
  const color = score >= 71 ? '#22c55e' : score >= 51 ? '#eab308' : score >= 31 ? '#f97316' : '#ef4444';
  return (
    <svg width={size} height={size}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={strokeWidth} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circ} strokeDashoffset={circ - pct} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
        style={{ fill: color, fontSize: size * 0.22, fontWeight: 700 }}>{score}</text>
    </svg>
  );
};

const Accordion = ({ title, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
        <span className="font-mono text-xs text-gray-500 dark:text-gray-400 truncate">{title}</span>
        <Icon d={open ? IC.chevUp : IC.chevDn} size={14} className="text-gray-400 flex-shrink-0 ml-2" />
      </button>
      {open && <div className="px-4 py-3 bg-white dark:bg-gray-800">{children}</div>}
    </div>
  );
};

const SectionTitle = ({ icon, text, badge, subtitle }) => (
  <div className="flex items-start gap-2 mb-4">
    <div className="mt-0.5">{icon}</div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-semibold text-gray-900 dark:text-white text-base">{text}</span>
        {badge}
      </div>
      {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
  </div>
);

function classifyTrend(delta) {
  if (delta === null || delta === undefined) return { label: 'First Scan', color: '#6366f1', icon: IC.star };
  if (delta > 10)  return { label: 'Major Improvement', color: '#22c55e', icon: IC.trendUp };
  if (delta > 3)   return { label: 'Improving',         color: '#22c55e', icon: IC.trendUp };
  if (delta > -3)  return { label: 'Stable',            color: '#6366f1', icon: IC.shield };
  if (delta > -10) return { label: 'Declining',         color: '#f97316', icon: IC.trendDn };
  return             { label: 'Regressing',        color: '#ef4444', icon: IC.trendDn };
}

/* ── AI Mentor Voice Banner ─────────────────────────────────────────────────── */
const AIMentorBanner = ({ insights, loading }) => {
  const isAI = insights?.source === 'ai';
  return (
    <Card className="p-5 relative overflow-hidden">
      <div className="absolute inset-0 opacity-5 pointer-events-none"
        style={{ background: 'linear-gradient(135deg,#6366f1 0%,#8b5cf6 50%,#ec4899 100%)' }} />
      <div className="relative">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
              <Icon d={IC.brain} size={16} color="white" />
            </div>
            <div>
              <p className="font-bold text-gray-900 dark:text-white text-sm">AI Security Mentor</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {isAI ? 'Powered by AWS Bedrock — Amazon Nova Pro' : 'Knowledge-base analysis (AI offline)'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {insights?.cached && <Chip label="Cached" color="#6366f1" />}
            <Chip label={isAI ? 'Amazon Nova Pro' : 'Deterministic'} color={isAI ? '#6366f1' : '#64748b'} />
          </div>
        </div>
        {loading
          ? <div className="space-y-2"><Skeleton /><Skeleton w="w-4/5" /></div>
          : <p className="text-gray-700 dark:text-gray-200 text-sm leading-relaxed">
              {insights?.learning_summary || 'Generating your personalised security assessment…'}
            </p>
        }
      </div>
    </Card>
  );
};

/* ── Recurring Weakness Alert ───────────────────────────────────────────────── */
const RecurringWeaknessAlert = ({ recurringReport }) => {
  const cats = recurringReport?.recurring_categories || [];
  if (!cats.length) return null;
  return (
    <Card className="p-5 border-l-4" style={{ borderLeftColor: '#f59e0b' }}>
      <SectionTitle
        icon={<Icon d={IC.repeat} size={18} color="#f59e0b" />}
        text="Recurring Weakness Patterns"
        badge={<Chip label={`${cats.length} detected`} color="#f59e0b" />}
        subtitle="These issues appeared across multiple scans — a systemic fix is needed."
      />
      <div className="space-y-3">
        {cats.map((cat, i) => (
          <div key={i} className="rounded-xl p-3 border border-amber-200 dark:border-amber-800"
            style={{ background: '#fef3c710' }}>
            <div className="flex items-start justify-between gap-2 mb-1">
              <span className="font-semibold text-sm text-gray-900 dark:text-white">{cat.label || cat.category}</span>
              <div className="flex items-center gap-1.5">
                {cat.consecutive_streak >= 3 && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{ background: '#ef444420', color: '#ef4444' }}>
                    🔁 {cat.consecutive_streak} in a row
                  </span>
                )}
                <span className="text-xs text-gray-500">{cat.total_appearances} scans</span>
              </div>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">{cat.message}</p>
            {cat.suggestion && (
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400 leading-snug">
                💡 {cat.suggestion.replace(/^(⚠️ ESCALATING:|🔁 PERSISTENT:)\s*/, '').trim()}
              </p>
            )}
          </div>
        ))}
        {recurringReport?.stagnant_categories?.length > 0 && (
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Stagnant (no improvement):</p>
            <div className="flex flex-wrap gap-2">
              {recurringReport.stagnant_categories.map((s, i) => (
                <Chip key={i} label={s.label || s.category} color="#f97316" />
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

/* ── Behavioral Insights Strip ──────────────────────────────────────────────── */
const BehavioralInsightsStrip = ({ insights }) => {
  const list = insights || [];
  if (!list.length) return null;
  const PC = { high: '#ef4444', medium: '#f97316', low: '#22c55e' };
  return (
    <Card className="p-5">
      <SectionTitle
        icon={<Icon d={IC.eye} size={18} color="#8b5cf6" />}
        text="Developer Habit Analysis"
        badge={<Chip label={`${list.length} patterns`} color="#8b5cf6" />}
        subtitle="What habits are creating these vulnerabilities in your codebase?"
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {list.map((item, i) => {
          const pc = PC[item.priority] || '#6366f1';
          return (
            <div key={i} className="rounded-xl p-3.5 border border-gray-200 dark:border-gray-700">
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="font-semibold text-sm text-gray-900 dark:text-white">{item.pattern_name || item.pattern}</span>
                <div className="flex items-center gap-1">
                  {item.is_recurring && <Chip label="Recurring" color="#f59e0b" />}
                  <Chip label={item.priority || 'medium'} color={pc} />
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5 uppercase tracking-wide font-medium">Root Habit</p>
              <p className="text-xs text-gray-700 dark:text-gray-300 mb-2 leading-snug">{item.habit}</p>
              <div className="rounded-lg p-2.5" style={{ background: `${pc}12` }}>
                <p className="text-xs font-medium mb-0.5" style={{ color: pc }}>Fix Today</p>
                <p className="text-xs text-gray-700 dark:text-gray-300 leading-snug">{item.recommendation}</p>
              </div>
              {item.effort && <p className="text-xs text-gray-400 mt-1.5">⏱ {item.effort}</p>}
            </div>
          );
        })}
      </div>
    </Card>
  );
};

/* ── Exploit Simulation Panel ───────────────────────────────────────────────── */
const ExploitSimulationPanel = ({ simulations, loading }) => {
  const sims = simulations || [];
  if (loading) return <Card className="p-5"><Skeleton h="h-32" /></Card>;
  if (!sims.length) return null;
  return (
    <Card className="p-5 border-l-4" style={{ borderLeftColor: '#ef4444' }}>
      <SectionTitle
        icon={<Icon d={IC.skull} size={18} color="#ef4444" />}
        text="Attacker Perspective — Exploit Simulation"
        badge={<Chip label="Attacker POV" color="#ef4444" />}
        subtitle="How a real attacker would exploit your top vulnerabilities."
      />
      <div className="space-y-4">
        {sims.map((sim, i) => (
          <div key={i} className="rounded-xl border border-red-200 dark:border-red-900 overflow-hidden">
            <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: '#ef444410' }}>
              <Icon d={IC.target} size={14} color="#ef4444" />
              <span className="font-mono text-xs text-red-700 dark:text-red-400 font-semibold truncate flex-1">{sim.vuln_id}</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#ef444422', color: '#ef4444' }}>
                #{i + 1} Risk
              </span>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <p className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wide mb-1">Attacker Goal</p>
                <p className="text-sm text-gray-800 dark:text-gray-200">{sim.attacker_goal}</p>
              </div>
              {(sim.attack_steps || []).length > 0 && (
                <div>
                  <p className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wide mb-1.5">Attack Chain</p>
                  <ol className="space-y-1">
                    {sim.attack_steps.map((step, si) => (
                      <li key={si} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <span className="w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0"
                          style={{ background: '#ef444420', color: '#ef4444' }}>{si + 1}</span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              <div className="rounded-lg p-3 border border-red-200 dark:border-red-900" style={{ background: '#ef444408' }}>
                <p className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wide mb-1">Realistic Impact</p>
                <p className="text-sm text-gray-800 dark:text-gray-200">{sim.realistic_impact}</p>
              </div>
              {sim.estimated_damage && (
                <p className="text-xs text-red-600 dark:text-red-400 font-medium">💸 {sim.estimated_damage}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

/* ── Transparent Maturity Card ──────────────────────────────────────────────── */
const TransparentMaturityCard = ({ maturityReport, loading }) => {
  if (loading) return <Card className="p-5"><Skeleton h="h-32" /></Card>;
  if (!maturityReport) return null;
  const r   = maturityReport;
  const t   = r.transparent || {};
  const lv  = r.level || {};
  const sc  = r.score || 0;
  const gap = t.score_gap ?? Math.max(0, (r.next_level?.min_score || 100) - sc);
  return (
    <Card className="p-5">
      <SectionTitle
        icon={<Icon d={IC.shield} size={18} color={lv.color || '#6366f1'} />}
        text="Security Maturity"
        badge={<Chip label={t.level_label || lv.label || 'Beginner'} color={lv.color || '#6366f1'} />}
        subtitle="Why you're at this level and what to do to advance."
      />
      <div className="flex items-center gap-6 mb-5">
        <ScoreRing score={sc} size={88} />
        <div className="flex-1 min-w-0">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {sc}<span className="text-base font-normal text-gray-400">/100</span>
          </p>
          {gap > 0
            ? <p className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-bold" style={{ color: lv.color }}>{gap}</span> points from{' '}
                <span className="font-semibold">{t.next_label || r.next_level?.label}</span>
              </p>
            : <p className="text-sm font-semibold text-indigo-500">Top tier achieved!</p>
          }
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{lv.description}</p>
        </div>
      </div>
      {(t.reasons || []).length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">Why you're at this level</p>
          <ul className="space-y-1.5">
            {t.reasons.map((reason, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                <Icon d={IC.info} size={14} className="mt-0.5 flex-shrink-0" color="#f59e0b" />
                {reason}
              </li>
            ))}
          </ul>
        </div>
      )}
      {(t.to_advance || []).length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
            To reach {t.next_label || r.next_level?.label}
          </p>
          <ul className="space-y-1.5">
            {t.to_advance.map((action, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                <div className="mt-0.5 w-4 h-4 rounded border-2 border-indigo-400 flex items-center justify-center flex-shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                </div>
                {action}
              </li>
            ))}
          </ul>
        </div>
      )}
      {t.encouragement && (
        <div className="rounded-xl p-3 text-sm text-indigo-700 dark:text-indigo-300 font-medium" style={{ background: '#6366f112' }}>
          ✨ {t.encouragement}
        </div>
      )}
    </Card>
  );
};

/* ── AI Deep Dive ───────────────────────────────────────────────────────────── */
const AIDeepDive = ({ deepDive, loading }) => {
  const items = deepDive || [];
  if (loading) return <Card className="p-5"><Skeleton h="h-48" /></Card>;
  if (!items.length) return null;
  return (
    <Card className="p-5">
      <SectionTitle
        icon={<Icon d={IC.book} size={18} color="#6366f1" />}
        text="Deep Dive Analysis"
        subtitle="What happened, what it costs, and how to fix it."
      />
      <div className="space-y-3">
        {items.map((item, i) => (
          <Accordion key={i} defaultOpen={i === 0} title={item.vuln_id || `Finding #${i + 1}`}>
            <div className="space-y-3">
              {item.what_happened && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1">What happened</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{item.what_happened}</p>
                </div>
              )}
              {item.business_impact && (
                <div className="rounded-lg p-2.5 border border-orange-200 dark:border-orange-900" style={{ background: '#f9731610' }}>
                  <p className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wide mb-1">Business Impact</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{item.business_impact}</p>
                </div>
              )}
              {item.secure_pattern && (
                <div className="rounded-lg p-2.5 border border-green-200 dark:border-green-900" style={{ background: '#22c55e10' }}>
                  <p className="text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-wide mb-1">Secure Pattern</p>
                  <p className="text-sm font-mono text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">{item.secure_pattern}</p>
                </div>
              )}
              {item.takeaway && (
                <div className="rounded-lg p-2.5" style={{ background: '#6366f112' }}>
                  <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide mb-1">Takeaway</p>
                  <p className="text-sm text-indigo-700 dark:text-indigo-300 font-medium">{item.takeaway}</p>
                </div>
              )}
            </div>
          </Accordion>
        ))}
      </div>
    </Card>
  );
};

/* ── Priority Roadmap ───────────────────────────────────────────────────────── */
const PriorityRoadmap = ({ roadmap, loading }) => {
  const items = roadmap || [];
  if (loading) return <Card className="p-5"><Skeleton h="h-24" /></Card>;
  if (!items.length) return null;
  return (
    <Card className="p-5">
      <SectionTitle
        icon={<Icon d={IC.zap} size={18} color="#eab308" />}
        text="Priority Action Roadmap"
        subtitle="Work through these in order for the highest security ROI."
      />
      <ol className="space-y-3">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center mt-0.5"
              style={{
                background: i === 0 ? '#ef444420' : i === 1 ? '#f9731618' : '#6366f118',
                color: i === 0 ? '#ef4444' : i === 1 ? '#f97316' : '#6366f1',
              }}>{item.rank || i + 1}</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-gray-900 dark:text-white mb-0.5">{item.category}</p>
              {item.reason && <p className="text-xs text-gray-600 dark:text-gray-400 leading-snug mb-1">{item.reason}</p>}
              {item.action && <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400">→ {item.action}</p>}
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
};

/* ── Score Trend Chart ──────────────────────────────────────────────────────── */
const ScoreTrendChart = ({ progressData, delta }) => {
  const history = progressData?.score_history || [];
  const trend = classifyTrend(delta);
  if (!history.length) return null;
  const chartData = history.map((pt, i) => ({
    name: pt.date ? new Date(pt.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : `S${i + 1}`,
    score: pt.score,
  }));
  return (
    <Card className="p-5">
      <SectionTitle
        icon={<Icon d={trend.icon} size={18} color={trend.color} />}
        text="Score History"
        badge={
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
            style={{ background: `${trend.color}18`, color: trend.color }}>
            {trend.label}
            {delta != null && ` (${delta > 0 ? '+' : ''}${delta})`}
          </span>
        }
      />
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={trend.color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={trend.color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={v => [`${v}/100`, 'Score']} />
            <ReferenceLine y={70} stroke="#22c55e" strokeDasharray="4 4"
              label={{ value: 'Hardened', position: 'right', fontSize: 10 }} />
            <Area type="monotone" dataKey="score" stroke={trend.color} strokeWidth={2.5}
              fill="url(#scoreGrad)" dot={{ r: 3, fill: trend.color }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};

/* ── Badges ─────────────────────────────────────────────────────────────────── */
const BadgesSection = ({ badges }) => {
  const earned = (badges || []).filter(b => b.earned);
  const locked = (badges || []).filter(b => !b.earned);
  return (
    <Card className="p-5">
      <SectionTitle
        icon={<Icon d={IC.star} size={18} color="#eab308" />}
        text="Achievement Badges"
        badge={<Chip label={`${earned.length}/${(badges || []).length} earned`} color="#eab308" />}
      />
      {earned.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">Earned</p>
          <div className="flex flex-wrap gap-2">
            {earned.map((b, i) => (
              <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
                style={{ background: `${b.color}20`, color: b.color }}>★ {b.label}</div>
            ))}
          </div>
        </div>
      )}
      {locked.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Locked</p>
          <div className="flex flex-wrap gap-2">
            {locked.map((b, i) => (
              <div key={i} title={b.description}
                className="text-xs font-medium px-3 py-1.5 rounded-full text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700">
                🔒 {b.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};

/* ── Tab Config ─────────────────────────────────────────────────────────────── */
const TABS = [
  { id: 'coach',    label: 'AI Coach',  icon: IC.brain   },
  { id: 'summary',  label: 'Summary',   icon: IC.shield  },
  { id: 'maturity', label: 'Maturity',  icon: IC.star    },
  { id: 'trend',    label: 'Trend',     icon: IC.trendUp },
];

/* ═══════════════════════════════════════════════════════════════════════════════
   MAIN PAGE EXPORT
   ═══════════════════════════════════════════════════════════════════════════════ */
export default function LearningCoachPage({ jobId, repoName }) {
  const { isDark } = useTheme();

  const [tab, setTab]         = useState('coach');
  const [summary, setSummary] = useState(null);
  const [progress, setProgress] = useState(null);
  const [insights, setInsights] = useState(null);
  const [maturity, setMaturity] = useState(null);
  const [jobs, setJobs]       = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [loading, setLoading] = useState({ summary: false, progress: false, insights: false, maturity: false });

  const setL = (k, v) => setLoading(p => ({ ...p, [k]: v }));
  const activeJobId = jobId || selectedJob?.job_id;
  const activeRepo  = repoName || selectedJob?.repository_name;

  // Load job list if jobId not passed as prop
  useEffect(() => {
    if (jobId) return;
    (async () => {
      try {
        const res = await scanAPI.getJobs?.();
        const completed = ((res?.data?.jobs || res?.data) || []).filter(
          j => j.status === 'completed' || j.status === 'partial'
        );
        setJobs(completed);
        if (completed.length > 0) setSelectedJob(completed[0]);
      } catch (e) { console.error('Failed to load jobs', e); }
    })();
  }, [jobId]);

  const fetchAll = useCallback(async (jid, repo, force = false) => {
    if (!jid) return;
    setL('summary', true); setL('insights', true); setL('maturity', true);
    if (repo) setL('progress', true);
    const [a, b, c, d] = await Promise.allSettled([
      learningAPI.getSummary(jid),
      learningAPI.getInsights(jid, force),
      learningAPI.getMaturity(repo),
      repo ? learningAPI.getProgress(repo) : Promise.resolve(null),
    ]);
    if (a.status === 'fulfilled') setSummary(a.value?.data);
    if (b.status === 'fulfilled') setInsights(b.value?.data);
    if (c.status === 'fulfilled') setMaturity(c.value?.data);
    if (d.status === 'fulfilled' && d.value) setProgress(d.value?.data);
    setL('summary', false); setL('insights', false); setL('maturity', false); setL('progress', false);
  }, []);

  useEffect(() => { fetchAll(activeJobId, activeRepo); }, [activeJobId, activeRepo, fetchAll]);

  // Derived / normalised data
  const scoreDelta      = insights?.score_delta ?? summary?.score_delta ?? null;
  const recurringReport = insights?.recurring_report || summary?.recurring_report || {};
  const behavioralFull  = insights?.behavioral_insights_full || summary?.behavioral_insights || [];
  const aiBehav         = insights?.behavioral_insights || [];
  const exploitSims     = insights?.exploit_simulations || [];
  const deepDive        = insights?.deep_dive || [];
  const roadmap         = insights?.priority_roadmap || [];
  const displayBehav    = aiBehav.length ? aiBehav : behavioralFull.map(b => ({
    pattern_name: b.pattern_name || b.pattern,
    habit: b.habit, recommendation: b.recommendation,
    priority: b.priority, effort: b.effort, is_recurring: b.is_recurring,
  }));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">

      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 md:px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Icon d={IC.brain} size={20} color="#6366f1" />
              Learning Coach
            </h1>
            {activeRepo && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-mono truncate max-w-xs">{activeRepo}</p>}
          </div>
          {/* AWS Bedrock badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800"
            style={{ background: '#6366f108' }}>
            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
              AWS Bedrock — Amazon Nova Pro
            </span>
          </div>
        </div>

        {/* Job selector */}
        {!jobId && jobs.length > 1 && (
          <div className="max-w-5xl mx-auto mt-3">
            <select
              value={selectedJob?.job_id || ''}
              onChange={e => setSelectedJob(jobs.find(j => j.job_id === e.target.value))}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200">
              {jobs.map(j => (
                <option key={j.job_id} value={j.job_id}>{j.repository_name} — {j.job_id?.slice(0,8)}</option>
              ))}
            </select>
          </div>
        )}

        {/* Tabs */}
        <div className="max-w-5xl mx-auto flex gap-1 mt-3 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                tab === t.id ? 'bg-indigo-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}>
              <Icon d={t.icon} size={14} />
              {t.label}
            </button>
          ))}
          <button onClick={() => fetchAll(activeJobId, activeRepo, true)}
            className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
            <Icon d={IC.refresh} size={12} />
            Refresh AI
          </button>
        </div>
      </div>

      {/* Page content */}
      <div className="max-w-5xl mx-auto px-4 py-5 space-y-5">

        {/* AI COACH */}
        {tab === 'coach' && (
          <>
            <AIMentorBanner insights={insights} loading={loading.insights} />
            <RecurringWeaknessAlert recurringReport={recurringReport} />
            <BehavioralInsightsStrip insights={displayBehav} />
            <ExploitSimulationPanel simulations={exploitSims} loading={loading.insights} />
            <PriorityRoadmap roadmap={roadmap} loading={loading.insights} />
            <AIDeepDive deepDive={deepDive} loading={loading.insights} />
            {insights?.source === 'ai' && (
              <p className="text-xs text-center text-gray-400 dark:text-gray-600 pb-2">
                Analysis generated by AWS Bedrock — Amazon Nova Pro · Not a substitute for a professional security audit
              </p>
            )}
            {insights?.ai_error && (
              <div className="rounded-xl p-3 text-xs text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800"
                style={{ background: '#fef3c720' }}>
                ⚠️ AI unavailable — showing rule-based analysis. ({insights.ai_error})
              </div>
            )}
          </>
        )}

        {/* SUMMARY */}
        {tab === 'summary' && (
          <>
            {loading.summary ? <Card className="p-5"><Skeleton h="h-24" /></Card>
            : summary ? (
              <Card className="p-5">
                <SectionTitle icon={<Icon d={IC.shield} size={18} color="#6366f1" />} text="Scan Summary" />
                <div className="flex items-center gap-6 mb-4">
                  <ScoreRing score={summary.health_score || 0} size={88} />
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {summary.health_score || 0}<span className="text-base font-normal text-gray-400">/100</span>
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Security Health Score</p>
                    {summary.score_delta != null && (
                      <p className={`text-sm font-bold mt-1 ${summary.score_delta >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {summary.score_delta >= 0 ? '▲' : '▼'} {Math.abs(summary.score_delta)} pts
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {['critical','high','medium','low'].map(s => (
                    <SevBadge key={s} sev={s} count={summary[`${s}_count`] || summary.severity_counts?.[s]} />
                  ))}
                </div>
              </Card>
            ) : <Card className="p-10 text-center text-gray-400">No summary data.</Card>}

            {summary?.roadmap?.length > 0 && (
              <PriorityRoadmap roadmap={summary.roadmap.map((it, i) => ({
                rank: i+1, category: it.category||it.label, reason: it.reason||it.description,
                action: it.action||(it.checklist||[])[0],
              }))} />
            )}
            {summary?.recurring_report && <RecurringWeaknessAlert recurringReport={summary.recurring_report} />}
          </>
        )}

        {/* MATURITY */}
        {tab === 'maturity' && (
          <>
            <TransparentMaturityCard maturityReport={maturity} loading={loading.maturity} />
            <BadgesSection badges={maturity?.badges} />
          </>
        )}

        {/* TREND */}
        {tab === 'trend' && (
          <>
            <ScoreTrendChart progressData={progress} delta={scoreDelta} />
            {progress?.category_trends?.length > 0 && (
              <Card className="p-5">
                <SectionTitle icon={<Icon d={IC.trendUp} size={18} color="#22c55e" />} text="Category Trends" />
                <div className="space-y-2">
                  {progress.category_trends.map((ct, i) => {
                    const d = (ct.current||0) - (ct.previous||0);
                    const col = d < 0 ? '#22c55e' : d > 0 ? '#ef4444' : '#6366f1';
                    return (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{ct.label||ct.category}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono text-gray-500">{ct.current||0}</span>
                          <span className="text-xs font-bold" style={{ color: col }}>{d>0?`+${d}`:d<0?`${d}`:'—'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}
            {recurringReport?.has_recurring_patterns && <RecurringWeaknessAlert recurringReport={recurringReport} />}
          </>
        )}

      </div>
    </div>
  );
}
