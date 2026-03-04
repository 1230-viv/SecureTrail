import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { repositoryAPI } from '../services/api';
import {
  Search, Filter, ChevronDown, GitBranch, Clock,
  TrendingUp, TrendingDown, Activity, CheckCircle2,
  Folder, RefreshCw, Eye, LayoutGrid, List, Plus, X,
  ShieldAlert, ShieldCheck, ShieldOff, Shield, ScanLine, Zap,
  MoreHorizontal, Star, AlertTriangle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/* ─────────────────────────────────────────────────────────────────────────────
   DESIGN TOKENS
───────────────────────────────────────────────────────────────────────────── */
const RISK_CFG = {
  Critical: {
    bg: 'rgba(239,68,68,.14)', text: '#f87171',
    border: 'rgba(239,68,68,.35)', dot: '#ef4444',
    glow: '0 0 20px rgba(239,68,68,.55)',
    Icon: ShieldOff, label: 'Vulnerable',
    pulse: true,
  },
  High: {
    bg: 'rgba(239,68,68,.12)', text: '#f87171',
    border: 'rgba(239,68,68,.28)', dot: '#ef4444',
    glow: '0 0 18px rgba(239,68,68,.4)',
    Icon: ShieldOff, label: 'Vulnerable',
    pulse: true,
  },
  Medium: {
    bg: 'rgba(234,179,8,.13)', text: '#facc15',
    border: 'rgba(234,179,8,.28)', dot: '#eab308',
    glow: '0 0 14px rgba(234,179,8,.3)',
    Icon: ShieldAlert, label: 'Warnings',
    pulse: false,
  },
  Low: {
    bg: 'rgba(34,197,94,.12)', text: '#4ade80',
    border: 'rgba(34,197,94,.25)', dot: '#22c55e',
    glow: '0 0 14px rgba(34,197,94,.3)',
    Icon: ShieldCheck, label: 'Secure',
    pulse: false,
  },
};

const GRADIENTS = [
  ['#6366f1', '#8b5cf6'],
  ['#3b82f6', '#06b6d4'],
  ['#10b981', '#14b8a6'],
  ['#f43f5e', '#ec4899'],
  ['#f59e0b', '#f97316'],
  ['#a855f7', '#d946ef'],
];

const SCORE_BAR_COLORS = [
  { min: 0,  max: 40, from: '#ef4444', to: '#f97316' },
  { min: 40, max: 70, from: '#f59e0b', to: '#eab308' },
  { min: 70, max: 101, from: '#10b981', to: '#22c55e' },
];

const scoreColor = (n) =>
  n >= 70 ? '#10b981' : n >= 40 ? '#f59e0b' : '#ef4444';

const scoreBarGradient = (n) => {
  const cfg = SCORE_BAR_COLORS.find(c => n >= c.min && n < c.max) || SCORE_BAR_COLORS[2];
  return `linear-gradient(90deg, ${cfg.from}, ${cfg.to})`;
};

/* ─────────────────────────────────────────────────────────────────────────────
   ANIMATED COUNTER
─────────────────────────────────────────────────────────────────────────────── */

/* Simple animated count — avoids hook-in-render issues */
const Counter = ({ to, suffix = '' }) => {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0;
    const end = parseFloat(to) || 0;
    if (end === 0) { setDisplay(0); return; }
    const step = Math.ceil(end / 30);
    const timer = setInterval(() => {
      start += step;
      if (start >= end) { setDisplay(end); clearInterval(timer); }
      else setDisplay(start);
    }, 18);
    return () => clearInterval(timer);
  }, [to]);
  return <>{display}{suffix}</>;
};

/* ─────────────────────────────────────────────────────────────────────────────
   SCORE RING (SVG)
───────────────────────────────────────────────────────────────────────────── */
const ScoreRing = ({ score, size = 56 }) => {
  const r    = 20;
  const circ = 2 * Math.PI * r;
  const pct  = Math.max(0, Math.min(100, score));
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(pct), 80);
    return () => clearTimeout(t);
  }, [pct]);

  const dash = (animated / 100) * circ;
  const col  = scoreColor(pct);

  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <circle cx="24" cy="24" r={r} fill="none"
        stroke="rgba(255,255,255,.07)" strokeWidth="5" />
      <circle cx="24" cy="24" r={r} fill="none"
        stroke={col} strokeWidth="5"
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round" transform="rotate(-90 24 24)"
        style={{
          transition: 'stroke-dasharray 1.2s cubic-bezier(.22,1,.36,1)',
          filter: `drop-shadow(0 0 5px ${col}80)`,
        }}
      />
      <text x="24" y="24" textAnchor="middle" dominantBaseline="central"
        fontSize="11" fontWeight="800" fill={col}>{pct}</text>
    </svg>
  );
};

/* ─────────────────────────────────────────────────────────────────────────────
   SEVERITY BAR
───────────────────────────────────────────────────────────────────────────── */
const SeverityBar = ({ critical = 0, high = 0, medium = 0, low = 0 }) => {
  const total = critical + high + medium + low;
  if (total === 0) return (
    <div className="h-1.5 rounded-full w-full" style={{ background: 'rgba(255,255,255,.06)' }} />
  );
  const pct = n => `${Math.max(3, (n / total) * 100)}%`;
  return (
    <div className="flex h-1.5 rounded-full overflow-hidden w-full gap-px">
      {critical > 0 && <div style={{ width: pct(critical), background: '#ef4444', boxShadow: '0 0 4px rgba(239,68,68,0.7)' }} />}
      {high     > 0 && <div style={{ width: pct(high),     background: '#f97316' }} />}
      {medium   > 0 && <div style={{ width: pct(medium),   background: '#eab308' }} />}
      {low      > 0 && <div style={{ width: pct(low),      background: '#22c55e' }} />}
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────────────────────
   SKELETON CARD
───────────────────────────────────────────────────────────────────────────── */
const SkeletonCard = ({ isDark, i }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
    transition={{ delay: i * 0.05, duration: 0.35 }}
    className="rounded-2xl p-5 space-y-4"
    style={{
      background:   isDark ? 'rgba(26,29,46,.6)' : '#fff',
      border:       isDark ? '1px solid rgba(255,255,255,.06)' : '1px solid #e2e8f0',
      boxShadow:    isDark ? '0 4px 20px rgba(0,0,0,.25)' : '0 4px 14px rgba(0,0,0,.05)',
    }}
  >
    {[
      { w: '40%', h: 14 }, { w: '60%', h: 11 }, { w: '100%', h: 6 }, { w: '30%', h: 10 },
    ].map((s, si) => (
      <motion.div key={si}
        style={{ width: s.w, height: s.h, borderRadius: 6,
          background: isDark ? 'rgba(255,255,255,.07)' : '#e8edf4' }}
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.5, repeat: Infinity, delay: si * 0.15 }}
      />
    ))}
  </motion.div>
);

/* ─────────────────────────────────────────────────────────────────────────────
   STAT CARD
───────────────────────────────────────────────────────────────────────────── */
const StatCard = ({ label, value, sub, Icon, color, trend, loading, isDark, delay }) => {
  const colors = {
    indigo:  { icon: '#818cf8', bg: 'rgba(99,102,241,.13)',  glow: 'rgba(99,102,241,.25)', stripe: 'linear-gradient(90deg,#6366f1,#8b5cf6)', bar: '#6366f1' },
    cyan:    { icon: '#22d3ee', bg: 'rgba(6,182,212,.13)',   glow: 'rgba(6,182,212,.25)',  stripe: 'linear-gradient(90deg,#06b6d4,#22d3ee)', bar: '#06b6d4' },
    red:     { icon: '#f87171', bg: 'rgba(239,68,68,.13)',   glow: 'rgba(239,68,68,.25)',  stripe: 'linear-gradient(90deg,#ef4444,#f87171)', bar: '#ef4444' },
    emerald: { icon: '#34d399', bg: 'rgba(16,185,129,.13)',  glow: 'rgba(16,185,129,.25)', stripe: 'linear-gradient(90deg,#10b981,#34d399)', bar: '#10b981' },
  };
  const c = colors[color];
  const [hov, setHov] = React.useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      onHoverStart={() => setHov(true)}
      onHoverEnd={() => setHov(false)}
      className="rounded-2xl relative overflow-hidden cursor-default flex flex-col"
      style={{
        background:     isDark ? 'rgba(20,23,42,.85)' : '#fff',
        border:         isDark
          ? hov ? '1px solid rgba(255,255,255,.14)' : '1px solid rgba(255,255,255,.07)'
          : hov ? '1px solid #c7d2fe' : '1px solid #e2e8f0',
        boxShadow: hov
          ? (isDark ? `0 16px 48px rgba(0,0,0,.5), 0 0 0 1px ${c.glow}` : `0 12px 40px rgba(0,0,0,.1), 0 0 0 1px ${c.glow}`)
          : (isDark ? '0 4px 24px rgba(0,0,0,.3)' : '0 4px 20px rgba(0,0,0,.06)'),
        backdropFilter: 'blur(14px)',
        transition: 'border .2s, box-shadow .2s',
      }}
    >
      {/* Colored top stripe */}
      <div style={{ height: 3, background: c.stripe, flexShrink: 0 }} />

      {/* Ambient glow orb */}
      <div style={{
        position: 'absolute', top: -30, right: -30, width: 130, height: 130,
        borderRadius: '50%', background: c.bg, filter: 'blur(36px)', pointerEvents: 'none',
        opacity: hov ? 1 : 0.7, transition: 'opacity .3s',
      }} />

      <div className="p-5 flex flex-col flex-1 relative">
        {/* Top row: label + trend badge */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <motion.div
              whileHover={{ rotate: [0, -10, 10, 0], transition: { duration: 0.4 } }}
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: c.bg,
                boxShadow: hov ? `0 0 14px ${c.glow}` : `0 0 0 1px ${c.glow}`,
                transition: 'box-shadow .2s',
              }}
            >
              <Icon size={16} style={{ color: c.icon }} />
            </motion.div>
            <p className="text-[12px] font-extrabold uppercase tracking-wider"
              style={{ color: c.icon, letterSpacing: '0.06em' }}>
              {label}
            </p>
          </div>
          {trend && (
            <motion.span
              initial={{ scale: 0.8 }} animate={{ scale: 1 }}
              className="flex items-center gap-0.5 text-[11px] font-bold px-2 py-1 rounded-lg"
              style={{
                background: trend === 'up' ? 'rgba(239,68,68,.12)' : 'rgba(16,185,129,.12)',
                color:      trend === 'up' ? '#f87171' : '#34d399',
                border:     trend === 'up' ? '1px solid rgba(239,68,68,.2)' : '1px solid rgba(16,185,129,.2)',
              }}
            >
              {trend === 'up' ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            </motion.span>
          )}
        </div>

        {/* Big value */}
        <div className="mb-1">
          <p className="text-[36px] font-black leading-none tabular-nums"
            style={{ color: isDark ? '#f8fafc' : '#0f172a', letterSpacing: '-0.02em' }}>
            {loading
              ? <motion.span className="inline-block rounded-xl"
                  style={{ width: 72, height: 36, background: isDark ? 'rgba(255,255,255,.07)' : '#e2e8f0', display: 'inline-block' }}
                  animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.4, repeat: Infinity }} />
              : typeof value === 'string' ? value : <Counter to={value} />}
          </p>
        </div>

        {/* Sub label */}
        <p className="text-[12px] font-medium mt-auto pt-3"
          style={{
            color: isDark ? '#64748b' : '#94a3b8',
            borderTop: isDark ? '1px solid rgba(255,255,255,.05)' : '1px solid #f1f5f9',
          }}>
          {sub}
        </p>
      </div>
    </motion.div>
  );
};

/* ─────────────────────────────────────────────────────────────────────────────
   REPO CARD (grid)
───────────────────────────────────────────────────────────────────────────── */
const RepoCard = ({ repo, isDark, onView, onRescan, getTimeAgo, getRiskLevel, getSecurityScore, index }) => {
  const risk   = getRiskLevel(repo);
  const score  = getSecurityScore(repo);
  const cfg    = RISK_CFG[risk.level] || RISK_CFG.Low;
  const RiskIcon = cfg.Icon;
  const [g1, g2] = GRADIENTS[repo.repository_name.charCodeAt(0) % GRADIENTS.length];
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.055, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      whileHover={{ y: -4 }}
      className="relative flex flex-col overflow-hidden rounded-2xl"
      style={{
        background:     isDark ? 'rgba(20,23,42,.8)' : '#fff',
        border:         isDark
          ? hovered ? '1px solid rgba(255,255,255,.14)' : '1px solid rgba(255,255,255,.07)'
          : hovered ? '1px solid #c7d2fe' : '1px solid #e2e8f0',
        boxShadow: hovered
          ? (isDark ? `0 16px 48px rgba(0,0,0,.55), 0 2px 8px rgba(0,0,0,.3), ${cfg.glow}` : `0 16px 48px rgba(0,0,0,.12), 0 3px 12px rgba(0,0,0,.07)`)
          : (isDark ? '0 4px 24px rgba(0,0,0,.3)' : '0 4px 18px rgba(0,0,0,.05)'),
        backdropFilter: 'blur(16px)',
        transition:     'border 0.2s, box-shadow 0.2s',
      }}
    >
      {/* Accent stripe */}
      <div style={{ height: 2, background: `linear-gradient(90deg,${g1},${g2})` }} />

      <div className="p-5 flex flex-col flex-1 gap-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <motion.div
              whileHover={{ scale: 1.08, rotate: 3 }}
              className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `linear-gradient(135deg,${g1},${g2})`,
                boxShadow: `0 4px 16px ${g1}55` }}
            >
              <span className="text-white font-extrabold text-[15px]">
                {repo.repository_name.charAt(0).toUpperCase()}
              </span>
            </motion.div>
            <div className="min-w-0">
              <p className="text-[14px] font-bold truncate"
                style={{ color: isDark ? '#f1f5f9' : '#0f172a' }}>
                {repo.repository_name}
              </p>
              <p className="text-[11px] mt-0.5"
                style={{ color: isDark ? '#475569' : '#94a3b8' }}>
                {repo.scan_count ?? 0} Scan{(repo.scan_count ?? 0) !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Risk badge */}
            <motion.span
              initial={{ scale: 0.8 }} animate={{ scale: 1 }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold"
              style={{
                background: cfg.bg, color: cfg.text,
                border: `1px solid ${cfg.border}`,
                boxShadow: hovered ? cfg.glow : 'none',
                animation: cfg.pulse ? 'pulseRiskBadge 2s ease-in-out infinite' : 'none',
              }}
            >
              <RiskIcon size={11} />
              {cfg.label}
            </motion.span>

            {/* More menu */}
            <div className="relative">
              <motion.button
                whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                onClick={() => setMenuOpen(m => !m)}
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: isDark ? 'rgba(255,255,255,.06)' : '#f1f5f9',
                  color: isDark ? '#64748b' : '#94a3b8' }}
              >
                <MoreHorizontal size={14} />
              </motion.button>
              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.92, y: 4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.92, y: 4 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-1 w-36 rounded-xl py-1 z-30"
                    style={{ background: isDark ? '#1a1d2e' : '#fff',
                      border: isDark ? '1px solid rgba(255,255,255,.1)' : '1px solid #e2e8f0',
                      boxShadow: isDark ? '0 16px 40px rgba(0,0,0,.6)' : '0 8px 30px rgba(0,0,0,.12)' }}
                  >
                    {[
                      { label: 'View Results', action: () => { onView(repo); setMenuOpen(false); } },
                      { label: 'Re-Scan',      action: () => { onRescan(repo); setMenuOpen(false); } },
                    ].map(item => (
                      <button key={item.label} onClick={item.action}
                        className="w-full text-left px-3 py-2 text-[12px] font-medium transition-colors"
                        style={{ color: isDark ? '#cbd5e1' : '#475569' }}
                        onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,.06)' : '#f8fafc'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        {item.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-4 text-[12px]" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>
          <span className="flex items-center gap-1.5">
            <GitBranch size={13} />
            <span className="truncate max-w-[80px]">{repo.branch || 'Main'}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Clock size={13} />
            {getTimeAgo(repo.last_scan_date)}
          </span>
          {(repo.total_vulnerabilities > 0) && (
            <span className="flex items-center gap-1" style={{ color: '#818cf8' }}>
              <Zap size={12} />
              {repo.total_vulnerabilities}
            </span>
          )}
        </div>

        {/* Severity breakdown */}
        <div className="space-y-2">
          <SeverityBar
            critical={repo.critical_count || 0} high={repo.high_count || 0}
            medium={repo.medium_count || 0}    low={repo.low_count || 0}
          />
          <div className="flex flex-wrap gap-2 text-[11px]">
            {repo.critical_count > 0 && (
              <span className="flex items-center gap-1 font-bold" style={{
                color: '#ef4444',
                background: 'rgba(239,68,68,0.13)', padding: '2px 8px', borderRadius: 6,
                border: '1px solid rgba(239,68,68,0.35)',
                boxShadow: '0 0 10px rgba(239,68,68,0.5)',
              }}>
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#ef4444', boxShadow: '0 0 6px #ef4444' }} />
                {repo.critical_count} Critical
              </span>
            )}
            {repo.high_count > 0 && (
              <span className="flex items-center gap-1 font-bold" style={{
                color: '#f97316',
                background: 'rgba(249,115,22,0.13)', padding: '2px 8px', borderRadius: 6,
                border: '1px solid rgba(249,115,22,0.35)',
                animation: 'pulseBadgeOrange 2s ease-in-out infinite',
              }}>
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#f97316', boxShadow: '0 0 5px #f97316' }} />
                {repo.high_count} High
              </span>
            )}
            {repo.medium_count > 0 && (
              <span className="flex items-center gap-1 font-semibold" style={{
                color: '#eab308',
                background: 'rgba(234,179,8,0.1)', padding: '2px 8px', borderRadius: 6,
                border: '1px solid rgba(234,179,8,0.25)',
              }}>
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#eab308' }} />
                {repo.medium_count} Medium
              </span>
            )}
            {repo.low_count > 0 && (
              <span className="flex items-center gap-1 font-semibold" style={{
                color: '#22c55e',
                background: 'rgba(34,197,94,0.1)', padding: '2px 8px', borderRadius: 6,
                border: '1px solid rgba(34,197,94,0.22)',
              }}>
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#22c55e' }} />
                {repo.low_count} Low
              </span>
            )}
            {!repo.critical_count && !repo.high_count && !repo.medium_count && !repo.low_count && (
              <span className="flex items-center gap-1.5 font-semibold" style={{ color: '#34d399' }}>
                <CheckCircle2 size={12} /> No Issues Found
              </span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-auto pt-4"
          style={{ borderTop: isDark ? '1px solid rgba(255,255,255,.06)' : '1px solid #f1f5f9' }}>
          <div className="flex flex-col items-center gap-1">
            <ScoreRing score={score} size={52} />
            <span className="text-[10px] font-bold uppercase tracking-wide"
              style={{ color: isDark ? '#334155' : '#cbd5e1' }}>
              Security Score
            </span>
          </div>

          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
              onClick={() => onView(repo)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold"
              style={{
                background:  isDark ? 'rgba(255,255,255,.07)' : '#f1f5f9',
                color:       isDark ? '#cbd5e1' : '#475569',
                border:      isDark ? '1px solid rgba(255,255,255,.1)' : '1px solid #e2e8f0',
                boxShadow:   hovered ? '0 4px 10px rgba(0,0,0,.15)' : '0 2px 6px rgba(0,0,0,.08)',
              }}
            >
              <Eye size={13} /> View Results
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.04, boxShadow: '0 6px 18px rgba(99,102,241,.4)' }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onRescan(repo)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold"
              style={{
                background: 'rgba(99,102,241,.15)',
                color:      '#818cf8',
                border:     '1px solid rgba(99,102,241,.25)',
                boxShadow:  '0 2px 8px rgba(99,102,241,.15)',
              }}
            >
              <ScanLine size={13} /> Re-Scan
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

/* ─────────────────────────────────────────────────────────────────────────────
   FILTER DROPDOWN
───────────────────────────────────────────────────────────────────────────── */
const FILTER_OPTIONS = [
  { key: 'all',      label: 'All Risks',    dot: '#94a3b8' },
  { key: 'critical', label: 'Critical',     dot: '#ef4444' },
  { key: 'high',     label: 'High Risk',    dot: '#f97316' },
  { key: 'medium',   label: 'Medium Risk',  dot: '#eab308' },
  { key: 'low',      label: 'Low Risk',     dot: '#22c55e' },
];

/* ─────────────────────────────────────────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────────────────────────────────────────── */
const RepositoriesPage = () => {
  const navigate  = useNavigate();
  const { isDark } = useTheme();
  const filterRef = useRef(null);

  const [repositories, setRepositories] = useState([]);
  const [loading,      setLoading]       = useState(true);
  const [refreshing,   setRefreshing]    = useState(false);
  const [searchQuery,  setSearchQuery]   = useState('');
  const [filterRisk,   setFilterRisk]    = useState('all');
  const [showFilter,   setShowFilter]    = useState(false);
  const [viewMode,     setViewMode]      = useState('grid');
  const [stats, setStats] = useState({ total: 0, activeScans: 0, highRisk: 0, lastScanTime: '-' });

  /* Close filter on outside click */
  useEffect(() => {
    const h = e => filterRef.current && !filterRef.current.contains(e.target) && setShowFilter(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  useEffect(() => { fetchRepositories(); }, []);

  /* ── API ── */
  const fetchRepositories = async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      const { data } = await repositoryAPI.getRepositoryStats();
      setRepositories(data.repositories || []);
      setStats({
        total:        data.stats.total_repositories,
        activeScans:  data.stats.active_scans,
        highRisk:     data.stats.high_risk_repos,
        lastScanTime: data.stats.last_scan_hours < 1 ? 'Just now' : `${data.stats.last_scan_hours}h ago`,
      });
    } catch {
      setRepositories([]);
      setStats({ total: 0, activeScans: 0, highRisk: 0, lastScanTime: '-' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  /* ── Helpers ── */
  const getRiskLevel    = repo => ({ level: repo.risk_level || 'Low' });
  const getSecurityScore = repo => repo.security_score || 0;
  const getTimeAgo      = dateString => {
    if (!dateString) return '—';
    const diff = Date.now() - new Date(dateString).getTime();
    const mins = Math.floor(diff / 60000);
    const hrs  = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1)  return 'Just Now';
    if (mins < 60) return `${mins}m Ago`;
    if (hrs  < 24) return `${hrs}h Ago`;
    return `${days}d Ago`;
  };

  const filteredRepos = repositories.filter(repo => {
    const matchSearch = repo.repository_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchFilter = filterRisk === 'all' || (repo.risk_level || 'low').toLowerCase() === filterRisk;
    return matchSearch && matchFilter;
  });

  const handleViewResults = repo => { if (repo.job_id) navigate(`/results/${repo.job_id}`); };
  const handleRescan       = repo => { console.log('Rescan:', repo.repository_name); };

  /* ── Stat cards config ── */
  const statCards = [
    { label: 'Total Repositories', value: stats.total,        sub: 'Connected Repos',       Icon: Folder,      color: 'indigo',  trend: null,    delay: 0.05 },
    { label: 'Active Scans',        value: stats.activeScans, sub: stats.activeScans > 0 ? 'Running Now' : 'All Idle', Icon: Activity,    color: 'cyan',    trend: null,    delay: 0.10 },
    { label: 'High Risk Repos',     value: stats.highRisk,    sub: 'Critical + High Risk',  Icon: ShieldAlert, color: 'red',     trend: stats.highRisk > 0 ? 'up' : 'down', delay: 0.15 },
    { label: 'Last Scan',           value: stats.lastScanTime, sub: 'Most Recent Activity',  Icon: Clock,       color: 'emerald', trend: null,    delay: 0.20 },
  ];

  /* ── Shared surfaces ── */
  const surface = isDark
    ? { background: 'rgba(26,29,46,.7)', border: '1px solid rgba(255,255,255,.07)' }
    : { background: '#fff', border: '1px solid #e2e8f0' };

  const inputStyle = isDark
    ? { background: 'rgba(20,23,42,.8)', border: '1px solid rgba(255,255,255,.09)', color: '#f1f5f9' }
    : { background: '#fff', border: '1px solid #e2e8f0', color: '#0f172a' };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
      className="min-h-screen"
      style={{ background: isDark ? '#0d0f17' : '#f4f6fb' }}
    >
      <div className="max-w-[1600px] mx-auto px-6 py-8 space-y-8">

        {/* ══════════════════════════════════════════════
            PAGE HEADER
        ══════════════════════════════════════════════ */}
        <motion.div
          initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-start justify-between gap-6"
        >
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(99,102,241,.15)', border: '1px solid rgba(99,102,241,.25)' }}>
                <Folder size={16} style={{ color: '#818cf8' }} />
              </div>
              <h1 className="text-[26px] font-extrabold tracking-tight leading-none"
                style={{ color: isDark ? '#f8fafc' : '#0f172a' }}>
                Repositories
              </h1>
            </div>
            <p className="text-[14px] pl-11"
              style={{ color: isDark ? '#475569' : '#94a3b8' }}>
              Monitor Security Posture Across All Scanned Repositories
            </p>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <motion.button
              whileHover={{ scale: 1.03, boxShadow: '0 8px 25px rgba(99,102,241,.45)' }}
              whileTap={{ scale: 0.97 }}
              onClick={() => fetchRepositories(true)}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold"
              style={{
                ...surface,
                color:      isDark ? '#94a3b8' : '#64748b',
                boxShadow:  '0 2px 8px rgba(0,0,0,.08)',
                transition: 'all 0.2s',
              }}
            >
              <motion.span animate={refreshing ? { rotate: 360 } : {}}
                transition={{ duration: 0.8, repeat: refreshing ? Infinity : 0, ease: 'linear' }}>
                <RefreshCw size={14} />
              </motion.span>
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.03, boxShadow: '0 8px 28px rgba(99,102,241,.5)' }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/scan')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-white"
              style={{
                background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                boxShadow:  '0 4px 18px rgba(99,102,241,.35)',
                transition: 'all 0.2s',
              }}
            >
              <Plus size={15} /> Scan New Repo
            </motion.button>
          </div>
        </motion.div>

        {/* ══════════════════════════════════════════════
            STATS ROW
        ══════════════════════════════════════════════ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map(card => (
            <StatCard key={card.label} {...card} loading={loading} isDark={isDark} />
          ))}
        </div>

        {/* ══════════════════════════════════════════════
            TOOLBAR
        ══════════════════════════════════════════════ */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.35 }}
          className="flex flex-col gap-3"
        >
          {/* Search — full width */}
          <div className="w-full relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: isDark ? '#475569' : '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search Repositories…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full outline-none transition-all duration-200"
              style={{
                ...inputStyle,
                paddingLeft: 40, paddingRight: searchQuery ? 36 : 14,
                paddingTop: 10, paddingBottom: 10,
                borderRadius: 12, fontSize: 13,
                boxShadow: '0 2px 8px rgba(0,0,0,.06)',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,.15)'; }}
              onBlur={e => {
                e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,.09)' : '#e2e8f0';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,.06)';
              }}
            />
            <AnimatePresence>
              {searchQuery && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5"
                  style={{ color: isDark ? '#475569' : '#94a3b8', background: isDark ? 'rgba(255,255,255,.07)' : '#f1f5f9' }}
                >
                  <X size={12} />
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          {/* Controls row — filter · view toggle · count */}
          <div className="flex items-center gap-3 flex-wrap">

          {/* Filter */}
          <div className="relative" ref={filterRef}>
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => setShowFilter(s => !s)}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-[13px] font-medium"
              style={{
                ...(filterRisk !== 'all'
                  ? { background: 'rgba(99,102,241,.12)', border: '1px solid rgba(99,102,241,.3)', color: '#818cf8' }
                  : { ...surface, color: isDark ? '#94a3b8' : '#64748b' }),
                boxShadow: '0 2px 8px rgba(0,0,0,.06)',
              }}
            >
              <Filter size={14} />
              {filterRisk === 'all' ? 'Filter' : FILTER_OPTIONS.find(f => f.key === filterRisk)?.label}
              <motion.span animate={{ rotate: showFilter ? 180 : 0 }} transition={{ duration: 0.2 }}>
                <ChevronDown size={13} />
              </motion.span>
            </motion.button>

            <AnimatePresence>
              {showFilter && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.95 }}
                  transition={{ duration: 0.18 }}
                  className="absolute top-full right-0 mt-2 w-52 rounded-2xl py-1.5 z-30"
                  style={{
                    background: isDark ? '#111827' : '#fff',
                    border:     isDark ? '1px solid rgba(255,255,255,.1)' : '1px solid #e2e8f0',
                    boxShadow:  isDark ? '0 20px 60px rgba(0,0,0,.7)' : '0 10px 40px rgba(0,0,0,.14)',
                  }}
                >
                  <p className="px-3 pt-1 pb-2 text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: isDark ? '#334155' : '#94a3b8' }}>
                    Filter By Risk
                  </p>
                  {FILTER_OPTIONS.map(({ key, label, dot }) => (
                    <motion.button
                      key={key} whileHover={{ x: 3 }}
                      onClick={() => { setFilterRisk(key); setShowFilter(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] transition-colors"
                      style={{
                        color: filterRisk === key
                          ? (isDark ? '#f1f5f9' : '#0f172a')
                          : (isDark ? '#64748b' : '#64748b'),
                        background: filterRisk === key
                          ? (isDark ? 'rgba(255,255,255,.06)' : '#f8fafc')
                          : 'transparent',
                        borderLeft: filterRisk === key ? '2px solid #6366f1' : '2px solid transparent',
                        fontWeight: filterRisk === key ? 600 : 400,
                      }}
                    >
                      <span className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: dot, boxShadow: filterRisk === key ? `0 0 6px ${dot}` : 'none' }} />
                      {label}
                      {filterRisk === key && <CheckCircle2 size={13} className="ml-auto" style={{ color: '#6366f1' }} />}
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* View toggle */}
          <div className="flex rounded-xl overflow-hidden" style={{ ...surface, boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
            {[{ mode: 'grid', Icon: LayoutGrid }, { mode: 'list', Icon: List }].map(({ mode, Icon }) => (
              <motion.button
                key={mode} whileTap={{ scale: 0.93 }}
                onClick={() => setViewMode(mode)}
                className="relative px-3 py-2.5 transition-all duration-150"
                style={{
                  color: viewMode === mode
                    ? (isDark ? '#fff' : '#0f172a')
                    : (isDark ? '#475569' : '#94a3b8'),
                }}
              >
                {viewMode === mode && (
                  <motion.div layoutId="viewActive"
                    className="absolute inset-0 rounded-xl"
                    style={{ background: isDark ? 'rgba(255,255,255,.1)' : '#f1f5f9' }}
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
                <span className="relative"><Icon size={15} /></span>
              </motion.button>
            ))}
          </div>

          {/* Count pill */}
          <AnimatePresence>
            {!loading && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                className="text-[12px] font-semibold px-3 py-1.5 rounded-full"
                style={{
                  background: isDark ? 'rgba(255,255,255,.06)' : '#f1f5f9',
                  color:      isDark ? '#475569' : '#94a3b8',
                  border:     isDark ? '1px solid rgba(255,255,255,.08)' : '1px solid #e2e8f0',
                }}
              >
                {filteredRepos.length} of {repositories.length} Repos
              </motion.span>
            )}
          </AnimatePresence>

          </div>{/* end controls row */}
        </motion.div>

        {/* ══════════════════════════════════════════════
            CONTENT
        ══════════════════════════════════════════════ */}
        <AnimatePresence mode="wait">
          {loading ? (
            /* Skeleton grid */
            <motion.div key="skeletons"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} isDark={isDark} i={i} />
              ))}
            </motion.div>

          ) : filteredRepos.length === 0 ? (
            /* Empty state */
            <motion.div key="empty"
              initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }} transition={{ duration: 0.35 }}
              className="flex flex-col items-center justify-center py-24 px-6 rounded-2xl"
              style={{ ...surface, boxShadow: isDark ? '0 4px 24px rgba(0,0,0,.25)' : '0 4px 18px rgba(0,0,0,.05)' }}
            >
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6"
                style={{ background: isDark ? 'rgba(99,102,241,.1)' : '#eef2ff',
                  border: '1px solid rgba(99,102,241,.2)',
                  boxShadow: '0 8px 30px rgba(99,102,241,.15)' }}
              >
                <Folder size={34} style={{ color: '#6366f1' }} />
              </motion.div>
              <h3 className="text-[20px] font-bold mb-2"
                style={{ color: isDark ? '#f1f5f9' : '#0f172a' }}>
                {searchQuery || filterRisk !== 'all' ? 'No Matching Repositories' : 'No Repositories Yet'}
              </h3>
              <p className="text-[13px] text-center max-w-xs mb-7"
                style={{ color: isDark ? '#475569' : '#94a3b8' }}>
                {searchQuery || filterRisk !== 'all'
                  ? 'Try Adjusting Your Search Or Clearing The Filter.'
                  : 'Scan A GitHub Repository Or Upload A ZIP To See It Here.'}
              </p>
              {searchQuery || filterRisk !== 'all' ? (
                <motion.button
                  whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                  onClick={() => { setSearchQuery(''); setFilterRisk('all'); }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold"
                  style={{ ...surface, color: isDark ? '#94a3b8' : '#64748b' }}
                >
                  <X size={14} /> Clear Filters
                </motion.button>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.04, boxShadow: '0 10px 30px rgba(99,102,241,.5)' }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => navigate('/scan')}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold text-white"
                  style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', boxShadow: '0 4px 20px rgba(99,102,241,.35)' }}
                >
                  <Plus size={14} /> Start First Scan
                </motion.button>
              )}
            </motion.div>

          ) : viewMode === 'grid' ? (
            /* Grid */
            <motion.div key="grid" layout
              className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
            >
              {filteredRepos.map((repo, i) => (
                <RepoCard key={repo.repository_name + i} repo={repo} isDark={isDark}
                  onView={handleViewResults} onRescan={handleRescan}
                  getTimeAgo={getTimeAgo} getRiskLevel={getRiskLevel}
                  getSecurityScore={getSecurityScore} index={i}
                />
              ))}
            </motion.div>

          ) : (
            /* List view */
            <motion.div key="list"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="rounded-2xl overflow-hidden"
              style={{ ...surface, boxShadow: isDark ? '0 4px 24px rgba(0,0,0,.25)' : '0 4px 18px rgba(0,0,0,.05)' }}
            >
              {/* List header */}
              <div className="px-5 py-3.5"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2.4fr 1fr 1.1fr 1fr 1.6fr 80px',
                  gap: 16,
                  borderBottom: isDark ? '1px solid rgba(255,255,255,.06)' : '1px solid #f1f5f9',
                  fontSize: 11, fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.07em',
                  color: isDark ? '#334155' : '#94a3b8',
                }}
              >
                <span>Repository</span>
                <span>Branch</span>
                <span>Last Scan</span>
                <span>Risk Level</span>
                <span>Security Score</span>
                <span style={{ textAlign: 'right' }}>Actions</span>
              </div>

              {/* Rows */}
              <div>
                {filteredRepos.map((repo, i) => {
                  const risk  = getRiskLevel(repo);
                  const score = getSecurityScore(repo);
                  const cfg   = RISK_CFG[risk.level] || RISK_CFG.Low;
                  const RiskIcon = cfg.Icon;
                  const [g1, g2] = GRADIENTS[repo.repository_name.charCodeAt(0) % GRADIENTS.length];

                  return (
                    <motion.div
                      key={repo.repository_name + i}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.3 }}
                      className="px-5 py-4 items-center"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '2.4fr 1fr 1.1fr 1fr 1.6fr 80px',
                        gap: 16,
                        borderBottom: i < filteredRepos.length - 1
                          ? (isDark ? '1px solid rgba(255,255,255,.04)' : '1px solid #f8fafc')
                          : 'none',
                        transition: 'background 0.15s',
                        cursor: 'default',
                      }}
                      whileHover={{ backgroundColor: isDark ? 'rgba(255,255,255,.025)' : 'rgba(248,250,252,1)' }}
                    >
                      {/* Repo name */}
                      <div className="flex items-center gap-3 min-w-0">
                        <motion.div
                          whileHover={{ scale: 1.08 }}
                          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-[13px] text-white"
                          style={{ background: `linear-gradient(135deg,${g1},${g2})`,
                            boxShadow: `0 3px 10px ${g1}55` }}
                        >
                          {repo.repository_name.charAt(0).toUpperCase()}
                        </motion.div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold truncate"
                            style={{ color: isDark ? '#f1f5f9' : '#0f172a' }}>
                            {repo.repository_name}
                          </p>
                          <p className="text-[11px]" style={{ color: isDark ? '#334155' : '#94a3b8' }}>
                            {repo.scan_count ?? 0} Scan{(repo.scan_count ?? 0) !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>

                      {/* Branch */}
                      <div className="flex items-center gap-1.5 text-[12px]"
                        style={{ color: isDark ? '#475569' : '#94a3b8' }}>
                        <GitBranch size={12} />
                        <span className="truncate">{repo.branch || 'Main'}</span>
                      </div>

                      {/* Last scan */}
                      <div className="flex items-center gap-1.5 text-[12px]"
                        style={{ color: isDark ? '#475569' : '#94a3b8' }}>
                        <Clock size={12} />
                        {getTimeAgo(repo.last_scan_date)}
                      </div>

                      {/* Risk badge */}
                      <div>
                        <motion.span
                          whileHover={{ scale: 1.06 }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold"
                          style={{
                            background: cfg.bg, color: cfg.text,
                            border: `1px solid ${cfg.border}`,
                            animation: cfg.pulse ? 'pulseRiskBadge 2s ease-in-out infinite' : 'none',
                          }}
                        >
                          <RiskIcon size={11} />
                          {cfg.label}
                        </motion.span>
                      </div>

                      {/* Score bar */}
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden"
                          style={{ background: isDark ? 'rgba(255,255,255,.07)' : '#f1f5f9' }}>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${score}%` }}
                            transition={{ delay: i * 0.04 + 0.3, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                            style={{ height: '100%', borderRadius: 999,
                              background: scoreBarGradient(score),
                              boxShadow: `0 0 8px ${scoreColor(score)}60` }}
                          />
                        </div>
                        <span className="text-[12px] font-bold tabular-nums w-10 text-right"
                          style={{ color: scoreColor(score) }}>
                          {score}%
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-end gap-1">
                        <motion.button
                          whileHover={{ scale: 1.12, backgroundColor: isDark ? 'rgba(255,255,255,.09)' : '#f1f5f9' }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleViewResults(repo)}
                          className="w-8 h-8 rounded-xl flex items-center justify-center"
                          style={{ color: isDark ? '#475569' : '#94a3b8' }}
                          title="View Results"
                        >
                          <Eye size={15} />
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.12, backgroundColor: 'rgba(99,102,241,.12)' }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleRescan(repo)}
                          className="w-8 h-8 rounded-xl flex items-center justify-center"
                          style={{ color: isDark ? '#6366f1' : '#6366f1' }}
                          title="Re-Scan"
                        >
                          <ScanLine size={15} />
                        </motion.button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </motion.div>
  );
};

<style>{`
  @keyframes pulseBadgeOrange {
    0%, 100% { box-shadow: 0 0 0 0 rgba(249,115,22,0.0); }
    50%       { box-shadow: 0 0 10px 2px rgba(249,115,22,0.55); }
  }
  @keyframes pulseRiskBadge {
    0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.0); }
    50%       { box-shadow: 0 0 12px 3px rgba(239,68,68,0.6); }
  }
`}</style>

export default RepositoriesPage;
