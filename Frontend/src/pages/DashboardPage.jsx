import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts';
import {
  ArrowRight, Loader2, Github, FileArchive, ChevronRight, ChevronDown,
  TrendingUp, TrendingDown, Fingerprint, Crosshair, Flame,
  Sparkles, Gauge, Radar, BarChart3, Zap, Eye, Target,
  RefreshCw, Plus, Lightbulb, CheckCircle2, ArrowUpRight,
} from 'lucide-react';
import { scanAPI }  from '../services/api';
import { useAuth }  from '../context/AuthContext';
import { useScan }  from '../context/ScanContext';
import { useTheme } from '../context/ThemeContext';

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS & HELPERS
   ═══════════════════════════════════════════════════════════ */
const SEV_META = [
  { key: 'critical_count', label: 'Critical', studentLabel: 'Urgent Fixes',      color: '#DC2626' },
  { key: 'high_count',     label: 'High',     studentLabel: 'Important Issues',   color: '#EA580C' },
  { key: 'medium_count',   label: 'Medium',   studentLabel: 'Worth Reviewing',    color: '#CA8A04' },
  { key: 'low_count',      label: 'Low',      studentLabel: 'Minor Suggestions',  color: '#2563EB' },
  { key: 'info_count',     label: 'Info',     studentLabel: 'Informational',      color: '#64748b' },
];

const LEARNING_TIPS = {
  gauge:    'Your score is calculated by weighted penalties: Critical costs 20 pts, High costs 8 pts, Medium costs 3 pts, and Low costs 1 pt each. A higher score means fewer vulnerabilities.',
  critical: 'Critical means an attacker can exploit this right now using publicly available tools. Always fix these first before deploying.',
  high:     'High-severity issues could be exploited with moderate effort. Address these right after Critical ones.',
  trend:    'This chart shows how your vulnerability counts change over time. A downward trend means your code is getting more secure!',
  severity: 'Severity levels help you prioritize. Focus on the red and orange segments first — they represent the most dangerous vulnerabilities.',
  analytics:'Each bar shows the findings from one scan. Compare scans side-by-side to see if your fixes are working.',
  actions:  'Start with Critical issues — they are the most dangerous. Then move to High. Medium and Low can wait for a refactoring sprint.',
};

const relativeTime = (ts) => {
  if (!ts) return '—';
  const ms   = typeof ts === 'number' ? ts * 1000 : new Date(ts).getTime();
  const diff = Math.floor((Date.now() - ms) / 1000);
  if (diff < 60)       return `${diff}s ago`;
  if (diff < 3600)     return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)    return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800)   return `${Math.floor(diff / 86400)}d ago`;
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

/** Normalise status strings — handles "JobStatus.COMPLETED" from live jobs */
const normStatus = (s) => {
  if (!s) return '';
  const str = typeof s === 'string' ? s : String(s);
  // "JobStatus.COMPLETED" → "completed"
  const dot = str.lastIndexOf('.');
  return (dot >= 0 ? str.slice(dot + 1) : str).toLowerCase();
};

const isDone = (j) => {
  const s = normStatus(j.status);
  return s === 'completed' || s === 'partial';
};

const calcScore = (jobs) => {
  const done = jobs.filter(isDone);
  if (!done.length) return null;
  // Exponential decay — realistic scoring that doesn't collapse to 0
  const avgPenalty = done.reduce(
    (s, j) =>
      s +
      (j.critical_count || 0) * 20 +
      (j.high_count || 0) * 8 +
      (j.medium_count || 0) * 3 +
      (j.low_count || 0) * 1,
    0,
  ) / done.length;
  return Math.round(100 * Math.exp(-avgPenalty / 300));
};

/** Check prefers-reduced-motion */
const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/* ═══════════════════════════════════════════════════════════════
   ANIMATED VALUE HOOK — respects prefers-reduced-motion
   ═══════════════════════════════════════════════════════════ */
const useAnimatedValue = (target, duration = 900) => {
  const [val, setVal] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    if (target == null) return;
    const from = prev.current;
    const to   = typeof target === 'number' ? target : 0;
    prev.current = to;
    if (from === to || prefersReducedMotion()) { setVal(to); return; }
    const t0 = performance.now();
    const tick = (now) => {
      const t    = Math.min((now - t0) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(from + (to - from) * ease));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return val;
};

/* ═══════════════════════════════════════════════════════════════
   LEARNING TIP — collapsible insight (P4)
   ═══════════════════════════════════════════════════════════ */
const LearningTip = ({ text, isDark }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 text-[10px] font-bold transition-colors
          ${isDark ? 'text-amber-400/70 hover:text-amber-400' : 'text-amber-600/70 hover:text-amber-600'}`}
        aria-expanded={open}
      >
        <Lightbulb size={11} />
        {open ? 'Hide tip' : 'What does this mean?'}
        <ChevronDown
          size={10}
          className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="animate-slide-down">
          <p className={`text-[11px] leading-relaxed mt-1.5 pl-4 border-l-2
            ${isDark
              ? 'text-slate-400 border-amber-500/30'
              : 'text-slate-500 border-amber-400/40'}`}>
            {text}
          </p>
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   CHART TOOLTIP
   ═══════════════════════════════════════════════════════════ */
const ChartTooltip = ({ active, payload, label, isDark }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm shadow-2xl backdrop-blur-md
        ${isDark
          ? 'bg-[#1a1d2e]/90 border-white/10 text-white'
          : 'bg-white/95 border-slate-200 text-slate-900'}`}
    >
      <p className={`text-[10px] font-bold uppercase tracking-wider mb-2
        ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 mb-0.5">
          <div className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: p.color || p.fill }} />
          <span className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{p.name}</span>
          <span className="font-bold ml-auto pl-4 tabular-nums">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   P1 — HEALTH GAUGE with trend, sparkline, guidance, CTA
   ═══════════════════════════════════════════════════════════ */
/* ── Zone segment paths (r=80, centre 120,120) ──────────────────
   t=0→(40,120)  t=0.25→(63.43,63.43)  t=0.5→(120,40)
   t=0.75→(176.57,63.43)  t=1→(200,120)
   Each 90° arc — large-arc=0, sweep=1
─────────────────────────────────────────────────────────────── */
const GAUGE_ZONES = [
  { d: 'M 40 120 A 80 80 0 0 1 63.43 63.43', color: '#ef4444' },   // 0-25  critical
  { d: 'M 63.43 63.43 A 80 80 0 0 1 120 40', color: '#f97316' },  // 25-50 at risk
  { d: 'M 120 40 A 80 80 0 0 1 176.57 63.43', color: '#eab308' }, // 50-75 moderate
  { d: 'M 176.57 63.43 A 80 80 0 0 1 200 120', color: '#22c55e' }, // 75-100 healthy
];

const HealthGauge = ({ score, previousScore, scoreHistory, topAction, isDark, isStudentMode, onNavigate }) => {
  const R   = 80;
  const arc = Math.PI * R;   // ≈ 251.3
  const fill = score !== null ? (score / 100) * arc : 0;

  const color = score === null ? '#94a3b8'
    : score >= 75 ? '#22c55e'
    : score >= 50 ? '#eab308'
    : score >= 25 ? '#f97316'
    : '#ef4444';

  const statusMeta = score === null
    ? { label: 'No data',  bg: isDark ? 'bg-slate-700/60' : 'bg-slate-100',      text: isDark ? 'text-slate-400' : 'text-slate-500' }
    : score >= 75
    ? { label: 'Healthy',  bg: isDark ? 'bg-emerald-500/15' : 'bg-emerald-50',   text: isDark ? 'text-emerald-400' : 'text-emerald-700' }
    : score >= 50
    ? { label: 'Moderate', bg: isDark ? 'bg-yellow-500/15' : 'bg-yellow-50',     text: isDark ? 'text-yellow-400' : 'text-yellow-700' }
    : score >= 25
    ? { label: 'At Risk',  bg: isDark ? 'bg-orange-500/15' : 'bg-orange-50',     text: isDark ? 'text-orange-400' : 'text-orange-700' }
    : { label: 'Critical', bg: isDark ? 'bg-red-500/15' : 'bg-red-50',           text: isDark ? 'text-red-400' : 'text-red-700' };

  const delta = (score !== null && previousScore !== null)
    ? score - previousScore
    : null;

  const guidance = score === null
    ? 'Run your first scan to begin tracking your security posture.'
    : score >= 75
      ? 'Great shape — keep scanning after each commit to stay on top.'
      : score >= 50
        ? 'Room to improve. Focus on High-severity findings next.'
        : score >= 25
          ? 'Significant vulnerabilities found. Prioritize fixes now.'
          : 'Critical exposure — address urgent findings immediately.';

  const animScore = useAnimatedValue(score ?? 0, 1100);
  const displayScore = score !== null ? animScore : null;

  // Sparkline points (last 5 scores, rendered inside SVG)
  const sparkPoints = useMemo(() => {
    if (!scoreHistory || scoreHistory.length < 2) return null;
    const pts = scoreHistory.slice(-5);
    const w = 60, h = 16;
    return pts.map((v, i) =>
      `${(i / (pts.length - 1)) * w},${h - (v / 100) * h}`
    ).join(' ');
  }, [scoreHistory]);

  const ariaLabel = score !== null
    ? `Security posture score ${score} out of 100, status: ${statusMeta.label}.`
    : 'Security posture: no data. Run your first scan.';

  return (
    <div
      role="region"
      aria-label="Security Posture"
      className={`rounded-2xl border p-6 h-full flex flex-col items-center
                  relative overflow-hidden backdrop-blur-xl
        ${isDark
          ? 'bg-surface-darkElevated/90 border-white/[0.06] shadow-dark-hero'
          : 'bg-white border-slate-200/60 shadow-hero'}`}
    >
      {/* Background radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background: `radial-gradient(ellipse 80% 60% at 50% 40%, ${color}14 0%, transparent 70%)`,
        }}
      />

      {/* Header row */}
      <div className="w-full flex items-center justify-between mb-4 z-10">
        <p className={`text-[10px] font-bold uppercase tracking-[0.2em]
          ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          Security Posture
        </p>
        {/* Trend badge */}
        {delta !== null && delta !== 0 && (
          <span
            className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg
              ${delta > 0
                ? isDark ? 'bg-emerald-500/12 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
                : isDark ? 'bg-red-500/12 text-red-400' : 'bg-red-50 text-red-600'}`}
          >
            {delta > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {delta > 0 ? '+' : ''}{delta}
          </span>
        )}
      </div>

      {/* ── Gauge SVG ─────────────────────────────── */}
      <div className="relative z-10 -mb-2">
        <svg width="240" height="148" viewBox="0 0 240 148" role="img" aria-label={ariaLabel}>
          <defs>
            {/* Fill gradient — follows the score colour */}
            <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={color} stopOpacity="1" />
              <stop offset="100%" stopColor={
                score >= 75 ? '#6366f1'
                : score >= 50 ? '#f97316'
                : score >= 25 ? '#ef4444'
                : '#be123c'
              } />
            </linearGradient>
            {/* Glow filter on fill */}
            <filter id="gaugeGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Zone tracks (dim coloured segments behind fill) */}
          {GAUGE_ZONES.map((z, i) => (
            <path
              key={i}
              d={z.d}
              fill="none"
              stroke={z.color}
              strokeWidth="14"
              strokeLinecap="butt"
              opacity={isDark ? 0.13 : 0.18}
            />
          ))}

          {/* Zone gap dots at t = 0.25, 0.5, 0.75 */}
          {[
            { cx: 63.43, cy: 63.43 },
            { cx: 120,   cy: 40    },
            { cx: 176.57,cy: 63.43 },
          ].map((pt, i) => (
            <circle
              key={i}
              cx={pt.cx} cy={pt.cy} r={3}
              fill={isDark ? '#0f1120' : '#fff'}
              opacity={0.8}
            />
          ))}

          {/* Fill arc */}
          <path
            d="M 40 120 A 80 80 0 0 1 200 120"
            fill="none"
            stroke="url(#gaugeGrad)"
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={`${fill} ${arc}`}
            filter="url(#gaugeGlow)"
            style={{ transition: 'stroke-dasharray 1.3s cubic-bezier(.4,0,.2,1)' }}
          />

          {/* End cap dot that travels with the fill */}
          {score !== null && score > 2 && (() => {
            const theta = Math.PI * (1 - score / 100);
            const ex = 120 + R * Math.cos(theta);
            const ey = 120 - R * Math.sin(theta);
            return (
              <circle cx={ex} cy={ey} r="5" fill={color}
                filter="url(#gaugeGlow)"
                style={{ transition: 'all 1.3s cubic-bezier(.4,0,.2,1)' }} />
            );
          })()}

          {/* Scale labels */}
          <text x="36"  y="136" textAnchor="middle" fontSize="9" fontWeight="700"
            fill={isDark ? '#475569' : '#94a3b8'}>0</text>
          <text x="204" y="136" textAnchor="middle" fontSize="9" fontWeight="700"
            fill={isDark ? '#475569' : '#94a3b8'}>100</text>
          <text x="120" y="28"  textAnchor="middle" fontSize="9" fontWeight="700"
            fill={isDark ? '#475569' : '#94a3b8'}>50</text>

          {/* Score — large centred number */}
          <text
            x="120" y="102"
            textAnchor="middle"
            fontSize="52" fontWeight="900"
            letterSpacing="-2"
            fill={isDark ? '#f8fafc' : '#0f172a'}
            style={{ filter: isDark ? `drop-shadow(0 0 12px ${color}55)` : 'none' }}
          >
            {displayScore ?? '—'}
          </text>
          <text x="120" y="122" textAnchor="middle" fontSize="13" fontWeight="600"
            fill={isDark ? '#475569' : '#94a3b8'}>
            / 100
          </text>

          {/* Inline sparkline */}
          {sparkPoints && (
            <g transform="translate(150, 108)">
              <polyline
                points={sparkPoints}
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.6"
              />
            </g>
          )}
        </svg>
      </div>

      {/* ── Status pill ───────────────────────────── */}
      <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full z-10
        ${statusMeta.bg}`}>
        {/* Animated pulse dot */}
        <span className="relative flex h-2.5 w-2.5">
          <span
            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
            style={{ background: color }}
          />
          <span
            className="relative inline-flex rounded-full h-2.5 w-2.5"
            style={{ background: color }}
          />
        </span>
        <span className={`text-sm font-bold ${statusMeta.text}`}>
          {statusMeta.label}
        </span>
      </div>

      {/* ── Guidance text ─────────────────────────── */}
      <p className={`text-xs text-center mt-3 leading-relaxed max-w-[230px] z-10
        ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
        {guidance}
      </p>

      {/* ── CTA ───────────────────────────────────── */}
      <div className="mt-4 z-10 w-full flex flex-col items-center gap-2">
        {score === null ? (
          <button
            onClick={() => onNavigate('/scan')}
            className="flex items-center gap-2 text-xs font-bold px-5 py-2.5 rounded-xl
                       bg-indigo-600 text-white hover:bg-indigo-500 active:scale-95
                       transition-all duration-150 shadow-lg shadow-indigo-600/30"
          >
            Run First Scan <ArrowRight size={13} />
          </button>
        ) : topAction ? (
          <button
            onClick={() => onNavigate(`/results/${topAction.jobId}`)}
            className={`group flex items-center gap-1.5 text-xs font-bold
              px-4 py-2 rounded-xl border transition-all duration-150 active:scale-95
              ${isDark
                ? 'border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10'
                : 'border-indigo-200 text-indigo-600 hover:bg-indigo-50'}`}
          >
            View {topAction.label}
            <ArrowUpRight size={12} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </button>
        ) : null}
      </div>

      {isStudentMode && (
        <div className="mt-3 z-10 w-full">
          <LearningTip text={LEARNING_TIPS.gauge} isDark={isDark} />
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   METRIC TILE — animated counter + accent stripe
   ═══════════════════════════════════════════════════════════ */
const MetricTile = ({ label, value, sub, icon: Icon, accent, trend, isDark, isStudentMode, tipKey, urgent }) => {
  const animVal = useAnimatedValue(value);
  const isUp    = trend > 0;
  const isUrgent = urgent && value > 0;

  return (
    <div
      className={`rounded-2xl border p-6 relative overflow-hidden group transition-all duration-200
        ${isUrgent
          ? isDark
            ? 'bg-red-500/[0.06] border-red-500/30 ring-2 ring-red-500/20 shadow-dark-hero'
            : 'bg-gradient-to-br from-red-50 to-red-100/50 border-red-300/60 ring-2 ring-red-400/20 shadow-alert'
          : isDark
            ? 'bg-surface-darkCard/80 backdrop-blur-xl border-white/[0.06] hover:border-white/[0.12] shadow-dark-card hover:shadow-dark-hero'
            : 'bg-white/95 backdrop-blur-xl border-slate-200/60 hover:shadow-card-hover shadow-card'}`}
    >
      <div className="absolute top-0 left-0 right-0 h-1 rounded-b-lg"
        style={{ background: accent }} aria-hidden="true" />

      <div className="flex items-start justify-between mb-4">
        <div
          className="w-14 h-14 rounded-xl flex items-center justify-center
                     transition-transform duration-300 group-hover:scale-110"
          style={{ background: `${accent}15` }}
        >
          <Icon size={24} style={{ color: accent }} strokeWidth={2.5} />
        </div>
        {trend !== undefined && trend !== 0 && (
          <div
            className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg
              ${isUp
                ? accent === '#DC2626' || accent === '#EA580C'
                  ? isDark ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600'
                  : isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
                : isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}
          >
            {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {isUp ? '+' : ''}{trend}
          </div>
        )}
      </div>

      <p className={`text-[40px] font-black tabular-nums leading-none mb-2
        ${isDark ? 'text-white' : 'text-slate-900'}`}
        style={{ letterSpacing: '-0.02em' }}
        aria-live="polite">
        {animVal}
      </p>
      <p className={`text-sm font-semibold mb-1
        ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{label}</p>
      {sub && (
        <p className={`text-xs ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{sub}</p>
      )}
      {isStudentMode && tipKey && LEARNING_TIPS[tipKey] && (
        <LearningTip text={LEARNING_TIPS[tipKey]} isDark={isDark} />
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   P3 — ACTION CARD — next best actions
   ═══════════════════════════════════════════════════════════ */
const ActionCard = ({ actions, isDark, isStudentMode, onNavigate }) => {
  const SEV_COLORS = { critical: '#ef4444', high: '#f97316', medium: '#eab308' };
  return (
    <div
      role="region"
      aria-label="Recommended actions"
      className={`rounded-2xl border p-5 flex flex-col transition-all duration-200 backdrop-blur-xl
        ${isDark
          ? 'bg-surface-darkCard/80 border-white/[0.06] shadow-dark-card hover:shadow-dark-hero'
          : 'bg-white/95 border-slate-200/60 shadow-card hover:shadow-card-hover'}`}
    >
      <div className="absolute top-0 left-5 right-5 h-[2px] rounded-b-full opacity-50 bg-cyan-400" aria-hidden="true" />

      <div className="flex items-center gap-2.5 mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center
          ${isDark ? 'bg-cyan-500/10' : 'bg-cyan-50'}`}>
          <Target size={16} className="text-cyan-400" />
        </div>
        <p className={`text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
          Next Steps
        </p>
      </div>

      {actions.length === 0 ? (
        <div className="flex-1 flex items-center gap-2 py-2">
          <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0" />
          <p className={`text-xs font-semibold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
            All clear — no urgent actions right now.
          </p>
        </div>
      ) : (
        <ul role="list" className="space-y-1.5 flex-1">
          {actions.slice(0, 4).map((a, i) => (
            <li key={i} role="listitem">
              <button
                onClick={() => onNavigate(`/results/${a.jobId}`)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left
                           transition-all duration-200 text-sm font-medium group/action
                           border
                  ${isDark 
                    ? 'bg-gradient-to-r from-slate-800/40 to-slate-800/20 border-white/[0.06] hover:border-white/[0.12] hover:bg-slate-800/60' 
                    : 'bg-gradient-to-r from-slate-50 to-white border-slate-200 hover:border-indigo-300 hover:shadow-md'}`}
                aria-label={`View ${a.count} ${a.severity} findings in ${a.repo}`}
              >
                <div className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ background: SEV_COLORS[a.severity] || '#8b5cf6' }} />
                <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>
                  {a.severity === 'medium' ? 'Review' : 'Fix'}{' '}
                  <span className="font-bold" style={{ color: SEV_COLORS[a.severity] }}>{a.count} {a.severity}</span> in {a.repo}
                </span>
                <ArrowUpRight size={14}
                  className={`ml-auto flex-shrink-0 transition-transform group-hover/action:translate-x-0.5 group-hover/action:-translate-y-0.5
                    ${isDark ? 'text-slate-500 group-hover/action:text-indigo-400' : 'text-slate-400 group-hover/action:text-indigo-600'}`} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {actions.length > 4 && (
        <button
          onClick={() => onNavigate('/history')}
          className={`text-[11px] font-bold mt-1 self-start
            ${isDark ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-500'}`}
        >
          View all actions →
        </button>
      )}

      {isStudentMode && <LearningTip text={LEARNING_TIPS.actions} isDark={isDark} />}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   P2 — GROUPED FEED — dedup + expand/collapse
   ═══════════════════════════════════════════════════════════ */
const groupFeedItems = (jobs) => {
  const groups = [];
  let current = null;
  for (const job of jobs) {
    const name = job.repository_name || 'Unnamed';
    if (current && current.name === name) {
      current.items.push(job);
    } else {
      current = { name, items: [job] };
      groups.push(current);
    }
  }
  return groups;
};

const FeedGroup = ({ group, onView, isDark, isLast }) => {
  const [expanded, setExpanded] = useState(false);
  const latest = group.items[0];
  const count  = group.items.length;
  const isViewable = normStatus(latest.status) === 'completed' || normStatus(latest.status) === 'partial';
  const SrcIcon    = latest.source_type === 'github' ? Github : FileArchive;

  // Worst severity badge
  const crit  = group.items.reduce((s, j) => s + (j.critical_count || 0), 0);
  const high  = group.items.reduce((s, j) => s + (j.high_count || 0), 0);
  const total = group.items.reduce((s, j) => s + (j.total_vulnerabilities || 0), 0);

  let badge = null;
  if (crit > 0)         badge = { label: `${crit} Critical`, color: '#ef4444' };
  else if (high > 0)    badge = { label: `${high} High`,     color: '#f97316' };
  else if (total > 0)   badge = { label: `${total} issues`,  color: '#8b5cf6' };
  else if (isViewable)  badge = { label: 'Clean',             color: '#22c55e' };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (count > 1) setExpanded(x => !x);
      else if (isViewable) onView(latest.job_id);
    }
  };

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={count > 1 ? expanded : undefined}
        aria-label={`${group.name}, ${count} scan${count > 1 ? 's' : ''}, ${badge?.label || 'in progress'}`}
        onClick={() => {
          if (count > 1) setExpanded(x => !x);
          else if (isViewable) onView(latest.job_id);
        }}
        onKeyDown={handleKeyDown}
        className={`flex items-start gap-4 px-5 py-4 transition-all duration-150 select-none relative
                    focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:outline-none rounded-xl
          ${isViewable || count > 1
            ? isDark ? 'hover:bg-white/[0.03] cursor-pointer' : 'hover:bg-slate-50 cursor-pointer'
            : ''}`}
      >
        {/* Timeline dot */}
        <div className="flex flex-col items-center flex-shrink-0 pt-1.5">
          <div
            className="w-3 h-3 rounded-full border-3 flex-shrink-0"
            style={{
              borderColor: badge?.color || (isDark ? '#334155' : '#cbd5e1'),
              background:  badge ? `${badge.color}30` : 'transparent',
            }}
          />
          {!isLast && (
            <div className={`w-0.5 flex-1 mt-2 min-h-[16px]
              ${isDark ? 'bg-white/[0.06]' : 'bg-slate-200'}`} />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pb-1">
          <div className="flex items-center gap-2 mb-0.5">
            <SrcIcon size={11} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
            <p className={`text-xs font-semibold truncate
              ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
              {group.name}
            </p>
            {count > 1 && (
              <span className={`text-[9px] font-bold px-1.5 py-px rounded
                ${isDark ? 'bg-slate-700/50 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                ×{count}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
              {relativeTime(latest.created_at)}
            </span>
            {badge && (
              <span className="text-[10px] font-bold px-1.5 py-px rounded"
                style={{ color: badge.color, background: `${badge.color}12` }}>
                {badge.label}
              </span>
            )}
          </div>
        </div>

        {count > 1 && (
          <ChevronDown size={12}
            className={`flex-shrink-0 mt-2 transition-transform duration-200
              ${isDark ? 'text-slate-600' : 'text-slate-400'}
              ${expanded ? 'rotate-180' : ''}`} />
        )}
      </div>

      {/* Expanded sub-items */}
      {expanded && count > 1 && (
        <div className="animate-slide-down pl-10" role="list">
          {group.items.map((job) => {
            const jobViewable = normStatus(job.status) === 'completed' || normStatus(job.status) === 'partial';
            const jTotal = job.total_vulnerabilities || 0;
            const jCrit  = job.critical_count || 0;
            return (
              <div
                key={job.job_id}
                role="listitem"
                tabIndex={jobViewable ? 0 : -1}
                onClick={() => jobViewable && onView(job.job_id)}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && jobViewable) {
                    e.preventDefault();
                    onView(job.job_id);
                  }
                }}
                className={`flex items-center gap-2 px-3 py-1.5 text-[10px] rounded-lg
                           transition-colors
                  ${jobViewable
                    ? isDark ? 'hover:bg-white/[0.02] cursor-pointer' : 'hover:bg-slate-50/50 cursor-pointer'
                    : ''}`}
              >
                <span className={isDark ? 'text-slate-600' : 'text-slate-400'}>
                  {relativeTime(job.created_at)}
                </span>
                <span className={`font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {jTotal} finding{jTotal !== 1 ? 's' : ''}
                </span>
                {jCrit > 0 && (
                  <span className="font-bold text-red-400">{jCrit}C</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   SEVERITY PROGRESS BAR
   ═══════════════════════════════════════════════════════════ */
const SeverityBar = ({ label, value, total, color, isDark }) => {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className={`text-[10px] font-semibold w-14 text-right
        ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</span>
      <div className={`flex-1 h-[7px] rounded-full overflow-hidden
        ${isDark ? 'bg-white/[0.04]' : 'bg-slate-100'}`}>
        <div className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className={`text-[11px] font-bold tabular-nums w-8
        ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{value}</span>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   P6 — SKELETON DASHBOARD — layout-matching loading state
   ═══════════════════════════════════════════════════════════ */
const SkeletonDashboard = ({ isDark }) => {
  const bg = isDark
    ? 'bg-white/[0.04] backdrop-blur-xl'
    : 'bg-white/40 backdrop-blur-xl';
  const shimmer = `relative overflow-hidden shimmer-sweep rounded-2xl ${bg}`;
  return (
    <div className={`min-h-screen ${isDark ? 'bg-[#0d0f17]' : 'bg-[#f4f6fb]'} transition-colors duration-300`}>
      <div className="max-w-[1440px] mx-auto px-6 py-8">
        {/* Header skeleton */}
        <div className="flex items-end justify-between mb-8">
          <div className="space-y-2">
            <div className={`h-3 w-32 rounded ${shimmer}`} />
            <div className={`h-7 w-48 rounded ${shimmer}`} />
          </div>
          <div className="flex gap-2.5">
            <div className={`h-10 w-24 ${shimmer}`} />
            <div className={`h-10 w-28 ${shimmer}`} />
          </div>
        </div>

        {/* Row 1: Gauge + 4 tiles */}
        <div className="grid grid-cols-12 gap-4 mb-4">
          <div className={`col-span-12 md:col-span-6 lg:col-span-3 h-[280px] ${shimmer}`} />
          <div className="col-span-12 md:col-span-6 lg:col-span-9 grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => (
              <div key={i} className={`h-[130px] ${shimmer}`}
                style={{ animationDelay: `${i * 100}ms` }} />
            ))}
          </div>
        </div>

        {/* Row 2: chart + sidebar */}
        <div className="grid grid-cols-12 gap-4 mb-4">
          <div className={`col-span-12 lg:col-span-7 h-[360px] ${shimmer}`} />
          <div className={`col-span-12 lg:col-span-5 h-[360px] ${shimmer}`}
            style={{ animationDelay: '100ms' }} />
        </div>

        {/* Row 3: chart + feed */}
        <div className="grid grid-cols-12 gap-4">
          <div className={`col-span-12 lg:col-span-7 h-[330px] ${shimmer}`} />
          <div className={`col-span-12 lg:col-span-5 h-[330px] ${shimmer}`}
            style={{ animationDelay: '100ms' }} />
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   DASHBOARD PAGE
   ═══════════════════════════════════════════════════════════ */
const DashboardPage = () => {
  const navigate       = useNavigate();
  const { user }       = useAuth();
  const { loadReport } = useScan();
  const { isDark, isStudentMode } = useTheme();

  const [jobs, setJobs]       = useState(() => {
    // P6: Load cached data from sessionStorage for instant render (5-min TTL)
    try {
      const raw = sessionStorage.getItem('securetrail_jobs');
      if (raw) {
        const parsed = JSON.parse(raw);
        // Support both TTL-wrapped {ts,data} and legacy plain array
        if (Array.isArray(parsed)) return parsed;
        if (parsed.ts && Date.now() - parsed.ts < 5 * 60 * 1000) return parsed.data;
      }
    } catch {}
    return [];
  });
  const [loading, setLoading] = useState(true);
  const [lastFetchTs, setLastFetchTs] = useState(null);
  const [agoLabel, setAgoLabel]       = useState('');

  const fetchJobs = useCallback(() => {
    setLoading(true);
    scanAPI.getJobs()
      .then(({ data }) => {
        const list = Array.isArray(data) ? data : (data.jobs || []);
        setJobs(list);
        setLastFetchTs(Date.now());
        try { sessionStorage.setItem('securetrail_jobs', JSON.stringify({ ts: Date.now(), data: list })); } catch {}
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  // Update "X ago" label every 15s
  useEffect(() => {
    if (!lastFetchTs) return;
    const update = () => {
      const s = Math.round((Date.now() - lastFetchTs) / 1000);
      if (s < 5) setAgoLabel('just now');
      else if (s < 60) setAgoLabel(`${s}s ago`);
      else setAgoLabel(`${Math.floor(s / 60)}m ago`);
    };
    update();
    const id = setInterval(update, 15000);
    return () => clearInterval(id);
  }, [lastFetchTs]);

  // Auto-refresh when running jobs exist (poll every 8s)
  const hasRunning = jobs.some(j => j.status === 'running' || j.status === 'pending');
  useEffect(() => {
    if (!hasRunning) return;
    const id = setInterval(fetchJobs, 8000);
    return () => clearInterval(id);
  }, [hasRunning, fetchJobs]);

  /* ── Derived data ── */
  const done  = jobs.filter(isDone);
  const score = calcScore(jobs);

  // P1: Previous score (second-latest batch) and score history
  const scoreHistory = useMemo(() => {
    if (done.length < 1) return [];
    // Compute score progressively from each scan using exponential decay
    return done.slice().reverse().map((_, i, arr) => {
      const subset = arr.slice(0, i + 1);
      const avgP = subset.reduce(
        (s, j) => s + (j.critical_count || 0) * 20 + (j.high_count || 0) * 8
                    + (j.medium_count || 0) * 3 + (j.low_count || 0) * 1, 0) / subset.length;
      return Math.round(100 * Math.exp(-avgP / 300));
    });
  }, [done]);
  const previousScore = scoreHistory.length >= 2 ? scoreHistory[scoreHistory.length - 2] : null;

  // P3: Top action (most-critical unresolved scan)
  const topAction = useMemo(() => {
    const critScan = done.find(j => (j.critical_count || 0) > 0);
    if (critScan) return {
      label: `${critScan.critical_count} critical findings`,
      jobId: critScan.job_id,
      severity: 'critical',
    };
    const highScan = done.find(j => (j.high_count || 0) > 0);
    if (highScan) return {
      label: `${highScan.high_count} high findings`,
      jobId: highScan.job_id,
      severity: 'high',
    };
    return null;
  }, [done]);

  // P3: Actions list for the action card
  const actionList = useMemo(() => {
    const actions = [];
    const seen = new Set();
    for (const j of done) {
      if (seen.size >= 4) break;
      const name = (j.repository_name || 'Unnamed').split(/[/\\]/).pop() || 'Unnamed';
      const key  = `${name}-${j.job_id}`;
      if (seen.has(key)) continue;
      if ((j.critical_count || 0) > 0) {
        actions.push({ repo: name, count: j.critical_count, severity: 'critical', jobId: j.job_id });
        seen.add(key);
      } else if ((j.high_count || 0) > 0) {
        actions.push({ repo: name, count: j.high_count, severity: 'high', jobId: j.job_id });
        seen.add(key);
      } else if ((j.medium_count || 0) > 0) {
        actions.push({ repo: name, count: j.medium_count, severity: 'medium', jobId: j.job_id });
        seen.add(key);
      }
    }
    return actions;
  }, [done]);

  // Bar chart: last 12 completed scans
  const barData = [...done].reverse().slice(-12).map((j, i) => ({
    name:     (j.repository_name || `S${i + 1}`).split(/[/\\]/).pop()?.slice(0, 9) || `S${i + 1}`,
    Critical: j.critical_count || 0,
    High:     j.high_count     || 0,
    Medium:   j.medium_count   || 0,
  }));

  // Area chart: last 10 completed scans
  const areaData = [...done].reverse().slice(-10).map((j, i) => ({
    name:     (j.repository_name || `S${i + 1}`).split(/[/\\]/).pop()?.slice(0, 7) || `S${i + 1}`,
    Total:    j.total_vulnerabilities || 0,
    Critical: j.critical_count        || 0,
    High:     j.high_count            || 0,
  }));

  // Average total for trend annotation
  const avgTotal = areaData.length > 0
    ? Math.round(areaData.reduce((a, d) => a + d.Total, 0) / areaData.length)
    : 0;

  // Severity distribution
  const pieData    = SEV_META
    .map(s => ({
      name: isStudentMode ? s.studentLabel : s.label,
      value: done.reduce((a, j) => a + (j[s.key] || 0), 0),
      color: s.color,
    }))
    .filter(d => d.value > 0);
  const grandTotal = pieData.reduce((a, d) => a + d.value, 0);

  // KPIs
  const totalCritical = done.reduce((s, j) => s + (j.critical_count || 0), 0);
  const totalHighRisk = done.reduce((s, j) => s + ((j.critical_count || 0) + (j.high_count || 0)), 0);
  const cleanCount    = done.filter(j => (j.total_vulnerabilities || 0) === 0).length;
  const trendCrit     = done.length < 2 ? 0 : (done[0].critical_count || 0) - (done[1].critical_count || 0);

  // P2: Grouped feed items
  const feedGroups = useMemo(() => groupFeedItems(jobs.slice(0, 30)), [jobs]);

  const greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  };

  /* ── Theme tokens ── */
  const tk = {
    pageBg:   isDark ? 'bg-surface-dark'  : 'bg-surface-light',
    cardBg:   isDark ? 'bg-surface-darkCard/80 backdrop-blur-xl shadow-dark-card'
                      : 'bg-white/95 backdrop-blur-xl shadow-card',
    heroBg:   isDark ? 'bg-surface-darkElevated/90 backdrop-blur-xl shadow-dark-hero'
                      : 'bg-white shadow-hero',
    border:   isDark ? 'border-white/[0.06]' : 'border-slate-200/60',
    heading:  isDark ? 'text-white'     : 'text-slate-900',
    subtext:  isDark ? 'text-slate-400' : 'text-slate-600',
    label:    isDark ? 'text-slate-500' : 'text-slate-500',
    grid:     isDark ? '#1E293B'        : '#F1F5F9',
    axisText: isDark ? '#64748B'        : '#94a3b8',
  };

  /* ── P6: Skeleton loading state ── */
  if (loading && jobs.length === 0) {
    return <SkeletonDashboard isDark={isDark} />;
  }

  /* ═══════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════ */
  return (
    <main aria-label="Security Dashboard" className={`min-h-screen ${tk.pageBg} transition-colors duration-300 relative`}>

      {/* Ambient orbs (decorative) */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">
        <div
          className="absolute -top-32 -right-32 w-[550px] h-[550px] rounded-full opacity-[0.06] animate-float blur-3xl"
          style={{ background: 'radial-gradient(circle, #6366f1, transparent 70%)' }}
        />
        <div
          className="absolute top-1/2 -left-48 w-[420px] h-[420px] rounded-full opacity-[0.04] animate-float-delayed blur-3xl"
          style={{ background: 'radial-gradient(circle, #22c55e, transparent 70%)' }}
        />
        <div
          className="absolute -bottom-20 right-1/3 w-96 h-96 rounded-full opacity-[0.035] animate-float blur-3xl"
          style={{ background: 'radial-gradient(circle, #f97316, transparent 70%)', animationDelay: '10s' }}
        />
        <div
          className="absolute top-1/4 left-1/2 w-[300px] h-[300px] rounded-full opacity-[0.025] animate-float-delayed blur-3xl"
          style={{ background: 'radial-gradient(circle, #8b5cf6, transparent 70%)', animationDelay: '5s' }}
        />
      </div>

      <div className="max-w-[1440px] mx-auto px-6 py-8 relative z-10">

        {/* ════════════════════════════════════════════════════
            HEADER
           ════════════════════════════════════════════════════ */}
        <div className="flex items-end justify-between mb-8 animate-fade-in-up">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Eye size={14} className={isDark ? 'text-indigo-400' : 'text-indigo-500'} />
              <p className={`text-[11px] font-bold uppercase tracking-[0.15em]
                ${isDark ? 'text-indigo-400/70' : 'text-indigo-500/70'}`}>
                {greeting()}{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
              </p>
            </div>
            <h1 className={`text-[32px] font-extrabold tracking-tight leading-none ${tk.heading}`}
              style={{ letterSpacing: '-0.015em' }}>
              Command Center
            </h1>
          </div>

          <div className="flex items-center gap-2.5">
            {loading && (
              <div className="flex items-center gap-1.5 mr-2" aria-live="polite">
                <Loader2 size={12} className="animate-spin text-indigo-400" />
                <span className={`text-[10px] font-medium ${tk.label}`}>Updating…</span>
              </div>
            )}
            <button
              onClick={fetchJobs}
              aria-label="Refresh dashboard data"
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px]
                         font-semibold border transition-all duration-200 backdrop-blur-md
                ${isDark
                  ? 'border-white/[0.1] text-slate-300 bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/[0.15]'
                  : 'border-white/70 text-slate-600 bg-white/50 hover:bg-white/80 hover:shadow-md'}`}
            >
              <RefreshCw size={13} />
              Refresh
            </button>
            <button
              onClick={() => navigate('/scan')}
              aria-label="Start a new security scan"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold
                         text-white transition-all duration-200 shadow-lg
                         bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600
                         hover:from-indigo-500 hover:via-violet-500 hover:to-purple-500
                         shadow-indigo-500/25 hover:shadow-indigo-500/40
                         hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus size={14} />
              New Scan
            </button>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════
            ROW 1 — Health gauge (3) + Tiles (6) + ActionCard (3)
           ════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-12 gap-4 mb-4 stagger-children">

          <div className="col-span-12 md:col-span-6 lg:col-span-3">
            <HealthGauge
              score={score}
              previousScore={previousScore}
              scoreHistory={scoreHistory}
              topAction={topAction}
              isDark={isDark}
              isStudentMode={isStudentMode}
              onNavigate={navigate}
            />
          </div>

          <div className="col-span-12 md:col-span-6 lg:col-span-6
                          grid grid-cols-2 gap-4">
            <MetricTile
              label={isStudentMode ? 'Scans Run' : 'Total Scans'}
              value={jobs.length}
              sub={`${done.length} completed`}
              icon={Fingerprint} accent="#6366f1"
              isDark={isDark} isStudentMode={isStudentMode}
            />
            <MetricTile
              label={isStudentMode ? 'Urgent Fixes' : 'Critical'}
              value={totalCritical}
              sub={isStudentMode ? 'fix these first' : 'high-impact findings'}
              icon={Crosshair} accent="#DC2626" trend={trendCrit}
              isDark={isDark} isStudentMode={isStudentMode} tipKey="critical"
              urgent
            />
            <MetricTile
              label={isStudentMode ? 'Important' : 'High Risk'}
              value={totalHighRisk}
              sub={isStudentMode ? 'critical + high' : 'critical + high combined'}
              icon={Flame} accent="#EA580C"
              isDark={isDark} isStudentMode={isStudentMode} tipKey="high"
            />
            <MetricTile
              label={isStudentMode ? 'Clean Repos' : 'Clean Scans'}
              value={cleanCount}
              sub="zero vulnerabilities"
              icon={Sparkles} accent="#22c55e"
              isDark={isDark} isStudentMode={isStudentMode}
            />
          </div>

          <div className="col-span-12 lg:col-span-3">
            <ActionCard
              actions={actionList}
              isDark={isDark}
              isStudentMode={isStudentMode}
              onNavigate={navigate}
            />
          </div>
        </div>

        {/* ════════════════════════════════════════════════════
            ROW 2 — Threat landscape (7) + Severity matrix (5)
           ════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-12 gap-4 mb-4">

          {/* ── Area chart ── */}
          <div
            role="region"
            aria-label="Vulnerability trend chart"
            className={`col-span-12 lg:col-span-7 rounded-2xl border p-6 animate-fade-in-up backdrop-blur-xl
              ${isDark
                ? 'bg-surface-darkCard/80 border-white/[0.06] shadow-dark-card'
                : 'bg-white/95 border-slate-200/60 shadow-card'}`}
            style={{ animationDelay: '0.15s' }}
          >
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center
                  ${isDark ? 'bg-indigo-500/10' : 'bg-indigo-50'}`}>
                  <Radar size={16} className="text-indigo-400" />
                </div>
                <div>
                  <p className={`text-sm font-bold ${tk.heading}`}>Threat Landscape</p>
                  <p className={`text-[11px] ${tk.label}`}>
                    {areaData.length > 0
                      ? `Last ${areaData.length} completed scans`
                      : 'No scan data yet'}
                  </p>
                </div>
              </div>
              {areaData.length > 0 && (() => {
                const latest = areaData[areaData.length - 1]?.Total ?? 0;
                const first  = areaData[0]?.Total ?? 0;
                const delta  = first > 0 ? Math.round(((latest - first) / first) * 100) : 0;
                const improving = delta <= 0;
                return (
                  <div className="flex items-center gap-2">
                    {areaData.length >= 2 && delta !== 0 && (
                      <span className={`flex items-center gap-0.5 text-[10px] font-bold px-2 py-1 rounded-lg
                        ${improving
                          ? (isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600')
                          : (isDark ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600')
                        }`}>
                        {improving ? <TrendingDown size={11} /> : <TrendingUp size={11} />}
                        {improving ? '' : '+'}{delta}%
                      </span>
                    )}
                    <div className={`text-right px-3 py-1.5 rounded-lg
                      ${isDark ? 'bg-white/[0.03]' : 'bg-slate-50'}`}>
                      <p className="text-lg font-black text-indigo-400 tabular-nums">{latest}</p>
                      <p className={`text-[9px] font-semibold uppercase tracking-wider ${tk.label}`}>latest</p>
                    </div>
                  </div>
                );
              })()}
            </div>

            {areaData.length === 0 ? (
              <div className={`flex flex-col items-center justify-center h-[260px]
                              rounded-xl border-2 border-dashed
                ${isDark ? 'border-white/5 text-slate-600' : 'border-slate-200 text-slate-300'}`}>
                <Radar size={36} className="mb-3 opacity-40" />
                <p className="text-sm font-medium">Run a scan to see trends</p>
                <button onClick={() => navigate('/scan')}
                  className="mt-3 text-xs font-bold text-indigo-400 hover:underline">
                  Start scanning →
                </button>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={areaData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gAreaTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={isDark ? 0.3 : 0.18} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gAreaCrit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={isDark ? 0.25 : 0.12} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gAreaHigh" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={isDark ? 0.2 : 0.1} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={tk.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name"
                    tick={{ fill: tk.axisText, fontSize: 10, fontWeight: 600 }}
                    axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: tk.axisText, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip isDark={isDark} />} />
                  <Legend iconType="circle" iconSize={6}
                    wrapperStyle={{ fontSize: '10px', paddingTop: '10px', color: tk.axisText }} />
                  {avgTotal > 0 && (
                    <ReferenceLine y={avgTotal} stroke={isDark ? '#6366f180' : '#6366f160'}
                      strokeDasharray="6 4" strokeWidth={1}
                      label={{ value: `avg ${avgTotal}`, position: 'insideTopRight',
                        fill: isDark ? '#a5b4fc' : '#6366f1', fontSize: 9, fontWeight: 600 }} />
                  )}
                  <Area type="monotone" dataKey="Total" stroke="#6366f1" strokeWidth={2}
                    fill="url(#gAreaTotal)" dot={false}
                    activeDot={{ r: 4, fill: '#6366f1', stroke: '#6366f120', strokeWidth: 8 }} />
                  <Area type="monotone" dataKey="Critical" stroke="#ef4444" strokeWidth={2}
                    fill="url(#gAreaCrit)" dot={false}
                    activeDot={{ r: 4, fill: '#ef4444' }} />
                  <Area type="monotone" dataKey="High" stroke="#f97316" strokeWidth={2}
                    fill="url(#gAreaHigh)" dot={false}
                    activeDot={{ r: 4, fill: '#f97316' }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
            {isStudentMode && <LearningTip text={LEARNING_TIPS.trend} isDark={isDark} />}
          </div>

          {/* ── Severity matrix ── */}
          <div
            role="region"
            aria-label="Severity distribution"
            className={`col-span-12 lg:col-span-5 rounded-2xl border p-6 flex flex-col
                        animate-fade-in-up backdrop-blur-xl
                        ${isDark
                          ? 'bg-surface-darkCard/80 border-white/[0.06] shadow-dark-card'
                          : 'bg-white/95 border-slate-200/60 shadow-card'}`}
            style={{ animationDelay: '0.2s' }}
          >
            <div className="flex items-center gap-3 mb-5">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center
                ${isDark ? 'bg-violet-500/10' : 'bg-violet-50'}`}>
                <Gauge size={16} className="text-violet-400" />
              </div>
              <div>
                <p className={`text-sm font-bold ${tk.heading}`}>Severity Matrix</p>
                <p className={`text-[11px] ${tk.label}`}>Distribution across all scans</p>
              </div>
            </div>

            {pieData.length === 0 ? (
              <div className={`flex-1 flex flex-col items-center justify-center rounded-xl
                              border-2 border-dashed
                ${isDark ? 'border-white/5 text-slate-600' : 'border-slate-200 text-slate-300'}`}>
                <Gauge size={32} className="mb-2 opacity-40" />
                <p className="text-xs font-medium">No findings recorded</p>
                <button onClick={() => navigate('/scan')}
                  className="mt-2 text-xs font-bold text-indigo-400 hover:underline">
                  Run your first scan →
                </button>
              </div>
            ) : (
              <div className="flex-1 flex flex-col">
                <div className="flex justify-center mb-3">
                  <div className="relative" style={{ width: 200, height: 200, color: isDark ? '#fff' : '#0f172a' }}>
                    <ResponsiveContainer width={200} height={200}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%"
                          innerRadius={60} outerRadius={90}
                          dataKey="value" strokeWidth={0} label={false}>
                          {pieData.map((entry, idx) => (
                            <Cell key={idx} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<ChartTooltip isDark={isDark} />} />
                      </PieChart>
                    </ResponsiveContainer>
                    {/* Center label */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {grandTotal}
                      </span>
                      <span className={`text-[10px] font-medium tracking-wide uppercase ${isDark ? 'text-white/50' : 'text-slate-400'}`}>
                        {grandTotal === 1 ? 'finding' : 'findings'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="space-y-2.5 mt-auto">
                  {SEV_META.map((s) => {
                    const val = done.reduce((a, j) => a + (j[s.key] || 0), 0);
                    if (val === 0 && grandTotal > 0) return null;
                    return (
                      <SeverityBar key={s.key}
                        label={isStudentMode ? s.studentLabel : s.label}
                        value={val} total={grandTotal} color={s.color} isDark={isDark} />
                    );
                  })}
                </div>
              </div>
            )}
            {isStudentMode && <LearningTip text={LEARNING_TIPS.severity} isDark={isDark} />}
          </div>
        </div>

        {/* ════════════════════════════════════════════════════
            ROW 3 — Scan analytics (7) + Smart feed (5)
           ════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-12 gap-4">

          {/* ── Bar chart ── */}
          <div
            role="region"
            aria-label="Scan analytics chart"
            className={`col-span-12 lg:col-span-7 rounded-2xl border p-6 animate-fade-in-up backdrop-blur-xl
              ${isDark
                ? 'bg-surface-darkCard/80 border-white/[0.06] shadow-dark-card'
                : 'bg-white/95 border-slate-200/60 shadow-card'}`}
            style={{ animationDelay: '0.25s' }}
          >
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center
                  ${isDark ? 'bg-amber-500/10' : 'bg-amber-50'}`}>
                  <BarChart3 size={16} className="text-amber-400" />
                </div>
                <div>
                  <p className={`text-sm font-bold ${tk.heading}`}>Scan Analytics</p>
                  <p className={`text-[11px] ${tk.label}`}>
                    {barData.length > 0
                      ? `Findings across ${barData.length} scans`
                      : 'No scan data available'}
                  </p>
                </div>
              </div>
              <button onClick={() => navigate('/history')}
                className={`flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg
                           transition-colors
                  ${isDark ? 'text-indigo-400 hover:bg-indigo-500/10'
                           : 'text-indigo-600 hover:bg-indigo-50'}`}>
                History <ChevronRight size={12} />
              </button>
            </div>

            {barData.length === 0 ? (
              <div className={`flex flex-col items-center justify-center h-[240px]
                              rounded-xl border-2 border-dashed
                ${isDark ? 'border-white/5 text-slate-600' : 'border-slate-200 text-slate-300'}`}>
                <BarChart3 size={32} className="mb-3 opacity-40" />
                <p className="text-sm font-medium">No analysis available</p>
                <button onClick={() => navigate('/scan')}
                  className="mt-3 text-xs font-bold text-indigo-400 hover:underline">
                  Run your first scan →
                </button>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={barData}
                  margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                  barSize={16} barCategoryGap="25%">
                  <CartesianGrid stroke={tk.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name"
                    tick={{ fill: tk.axisText, fontSize: 10, fontWeight: 600 }}
                    axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: tk.axisText, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip isDark={isDark} />}
                    cursor={{ fill: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', radius: 4 }} />
                  <Legend iconType="circle" iconSize={6}
                    wrapperStyle={{ fontSize: '10px', paddingTop: '10px', color: tk.axisText }} />
                  <Bar dataKey="Critical" fill="#ef4444" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="High"     fill="#f97316" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Medium"   fill="#eab308" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
            {isStudentMode && <LearningTip text={LEARNING_TIPS.analytics} isDark={isDark} />}
          </div>

          {/* ── P2: Smart feed (grouped + accessible) ── */}
          <div
            role="feed"
            aria-label="Recent scan activity"
            aria-live="polite"
            className={`col-span-12 lg:col-span-5 rounded-2xl border overflow-hidden
                        flex flex-col animate-fade-in-up backdrop-blur-xl
                        ${isDark
                          ? 'bg-surface-darkCard/80 border-white/[0.06] shadow-dark-card'
                          : 'bg-white/95 border-slate-200/60 shadow-card'}`}
            style={{ animationDelay: '0.3s' }}
          >
            <div className={`px-5 py-4 border-b flex items-center justify-between ${tk.border}`}>
              <div className="flex items-center gap-2.5">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center
                  ${isDark ? 'bg-cyan-500/10' : 'bg-cyan-50'}`}>
                  <Zap size={13} className="text-cyan-400" />
                </div>
                <p className={`text-sm font-bold ${tk.heading}`}>Live Feed</p>
                {hasRunning && (
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                )}
                {jobs.length > 0 && (
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded
                    ${isDark ? 'bg-white/[0.04] text-slate-500' : 'bg-slate-50 text-slate-400'}`}>
                    {feedGroups.length} {feedGroups.length === 1 ? 'repo' : 'repos'}
                  </span>
                )}
                {agoLabel && (
                  <span className={`text-[9px] font-medium ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                    · {agoLabel}
                  </span>
                )}
              </div>
              <button onClick={() => navigate('/history')}
                className={`text-[10px] font-bold flex items-center gap-0.5 px-2 py-1 rounded-lg
                           transition-colors
                  ${isDark ? 'text-indigo-400 hover:bg-indigo-500/10'
                           : 'text-indigo-600 hover:bg-indigo-50'}`}>
                View all <ChevronRight size={10} />
              </button>
            </div>

            {jobs.length === 0 ? (
              <div className={`flex-1 flex flex-col items-center justify-center py-12 gap-3 ${tk.label}`}>
                <Zap size={28} className="opacity-40" />
                <p className="text-xs font-medium">No scan activity yet.</p>
                <p className={`text-[10px] max-w-[180px] text-center ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                  Start your first scan to see results here.
                </p>
                <button onClick={() => navigate('/scan')}
                  className="text-xs font-bold text-indigo-400 hover:underline">
                  Start Scanning →
                </button>
              </div>
            ) : (
              <div className="overflow-y-auto max-h-[340px] flex-1 py-2">
                {feedGroups.slice(0, 15).map((group, i, arr) => (
                  <FeedGroup
                    key={`${group.name}-${i}`}
                    group={group}
                    onView={loadReport}
                    isDark={isDark}
                    isLast={i === Math.min(arr.length, 15) - 1}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </main>
  );
};

export default DashboardPage;
