import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock, CheckCircle2, XCircle, Loader2, AlertTriangle,
  Eye, Github, FileArchive, RefreshCw, Search,
  Shield, ChevronRight, BarChart2, TrendingUp,
  ScanLine, Zap, ShieldAlert, Activity, Calendar,
  Filter, X, ChevronDown, ArrowUpRight, Sparkles,
  RotateCcw, ListFilter, Layers,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { scanAPI } from '../services/api';
import { useScan } from '../context/ScanContext';
import { useTheme } from '../context/ThemeContext';

/* ── Status config ─────────────────────────────────────────────────────────── */
const STATUS_CONF = {
  completed: {
    icon: CheckCircle2, label: 'Completed', spin: false,
    color: '#10b981', glow: 'rgba(16,185,129,0.25)',
    bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)',
    text: '#10b981',
  },
  partial: {
    icon: AlertTriangle, label: 'Partial', spin: false,
    color: '#f59e0b', glow: 'rgba(245,158,11,0.25)',
    bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)',
    text: '#f59e0b',
  },
  failed: {
    icon: XCircle, label: 'Failed', spin: false,
    color: '#ef4444', glow: 'rgba(239,68,68,0.25)',
    bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)',
    text: '#ef4444',
  },
  running: {
    icon: Loader2, label: 'Running', spin: true,
    color: '#3b82f6', glow: 'rgba(59,130,246,0.25)',
    bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.3)',
    text: '#3b82f6',
  },
  queued: {
    icon: Clock, label: 'Queued', spin: false,
    color: '#94a3b8', glow: 'rgba(148,163,184,0.15)',
    bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.25)',
    text: '#94a3b8',
  },
};

const ACCENT = {
  indigo:  { hex: '#6366f1', glow: 'rgba(99,102,241,0.35)',  bg: 'rgba(99,102,241,0.12)',  border: 'rgba(99,102,241,0.3)'  },
  emerald: { hex: '#10b981', glow: 'rgba(16,185,129,0.35)',  bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.3)'  },
  blue:    { hex: '#3b82f6', glow: 'rgba(59,130,246,0.35)',  bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.3)'  },
  orange:  { hex: '#f97316', glow: 'rgba(249,115,22,0.35)',  bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.3)'  },
};

/* ── Helpers ────────────────────────────────────────────────────────────────── */
const relativeTime = (ts) => {
  if (!ts) return '—';
  const ms   = typeof ts === 'number' ? ts * 1000 : new Date(ts).getTime();
  const diff = Math.floor((Date.now() - ms) / 1000);
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(ms).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const FILTERS = [
  { label: 'All',       value: 'all'       },
  { label: 'Completed', value: 'completed' },
  { label: 'Running',   value: 'running'   },
  { label: 'Failed',    value: 'failed'    },
];

/* ── Counter (animated number) ──────────────────────────────────────────────── */
const Counter = ({ to, duration = 1600 }) => {
  const [val, setVal] = useState(0);
  const rafRef = useRef(null);
  useEffect(() => {
    if (!to) { setVal(0); return; }
    const start  = performance.now();
    const step   = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 4);
      setVal(Math.round(ease * to));
      if (p < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [to, duration]);
  return <>{typeof to === 'string' ? to : val.toLocaleString()}</>;
};

/* ── StatCard ────────────────────────────────────────────────────────────────── */
const StatCard = ({ label, value, sub, Icon, color = 'indigo', delay = 0, trend }) => {
  const { isDark } = useTheme();
  const acc = ACCENT[color] || ACCENT.indigo;
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      style={{
        background: isDark ? 'rgba(20,23,42,0.85)' : 'rgba(255,255,255,0.9)',
        border: `1px solid ${hovered ? acc.border : isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}`,
        boxShadow: hovered
          ? `0 0 0 1px ${acc.border}, 0 8px 32px ${acc.glow}`
          : isDark ? '0 2px 16px rgba(0,0,0,0.3)' : '0 2px 12px rgba(0,0,0,0.06)',
        transition: 'border 0.25s, box-shadow 0.25s',
        borderRadius: 16,
        overflow: 'hidden',
        position: 'relative',
        backdropFilter: 'blur(16px)',
      }}
    >
      {/* Colored top stripe */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: `linear-gradient(90deg, ${acc.hex}, ${acc.hex}99)`,
        opacity: hovered ? 1 : 0.7, transition: 'opacity 0.25s',
      }} />

      {/* Ambient glow orb */}
      <div style={{
        position: 'absolute', top: -40, right: -20, width: 100, height: 100,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${acc.glow}, transparent 70%)`,
        opacity: hovered ? 1 : 0.4, transition: 'opacity 0.35s', pointerEvents: 'none',
      }} />

      <div style={{ padding: '20px 20px 18px', position: 'relative', zIndex: 1 }}>
        {/* Label + Icon row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <span style={{
            fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase',
            color: acc.hex,
          }}>
            {label}
          </span>
          <div style={{
            width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: acc.bg, border: `1px solid ${acc.border}`,
            flexShrink: 0,
          }}>
            <Icon size={15} style={{ color: acc.hex }} />
          </div>
        </div>

        {/* Value */}
        <div style={{
          fontSize: 36, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.02em',
          color: isDark ? '#f1f5f9' : '#0f172a',
          marginBottom: 12,
        }}>
          {typeof value === 'string' ? value : <Counter to={value || 0} />}
        </div>

        {/* Divider + sub */}
        <div style={{
          height: 1,
          background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
          marginBottom: 10,
        }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{
            fontSize: 11, color: isDark ? '#64748b' : '#94a3b8', fontWeight: 500,
          }}>
            {sub}
          </span>
          {trend === 'up' && (
            <span style={{
              fontSize: 10, fontWeight: 700, color: '#ef4444',
              display: 'flex', alignItems: 'center', gap: 2,
            }}>
              <ArrowUpRight size={11} /> Risk
            </span>
          )}
          {trend === 'good' && (
            <span style={{
              fontSize: 10, fontWeight: 700, color: '#10b981',
              display: 'flex', alignItems: 'center', gap: 2,
            }}>
              <CheckCircle2 size={11} /> Clean
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
};

/* ── SkeletonRow ─────────────────────────────────────────────────────────────── */
const SkeletonRow = ({ idx, isDark }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ delay: idx * 0.05 }}
    className="grid grid-cols-12 items-center px-6 py-5 gap-3"
    style={{
      borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
    }}
  >
    <div className="col-span-5 flex items-center gap-3">
      <div className="w-3 h-3 rounded-full flex-shrink-0 animate-pulse"
        style={{ background: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0' }} />
      <div className="w-8 h-8 rounded-xl flex-shrink-0 animate-pulse"
        style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0' }} />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 rounded-lg w-2/3 animate-pulse"
          style={{ background: isDark ? 'rgba(255,255,255,0.07)' : '#e2e8f0' }} />
        <div className="h-2.5 rounded w-1/2 animate-pulse"
          style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#f1f5f9' }} />
      </div>
    </div>
    <div className="col-span-2 flex justify-center">
      <div className="h-6 w-24 rounded-full animate-pulse"
        style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0' }} />
    </div>
    <div className="col-span-3 flex justify-center gap-2">
      <div className="h-5 w-10 rounded animate-pulse"
        style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0' }} />
      <div className="h-5 w-10 rounded animate-pulse"
        style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#f1f5f9' }} />
    </div>
    <div className="col-span-2 flex justify-end">
      <div className="h-3 w-14 rounded animate-pulse"
        style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#f1f5f9' }} />
    </div>
  </motion.div>
);

/* ── ScanRow ─────────────────────────────────────────────────────────────────── */
const ScanRow = ({ job, idx, isDark, onView }) => {
  const conf = STATUS_CONF[job.status] || STATUS_CONF.queued;
  const { icon: StatusIcon, label, spin } = conf;
  const isViewable = job.status === 'completed' || job.status === 'partial';
  const SrcIcon = job.source_type === 'github' ? Github : FileArchive;
  const total = job.total_vulnerabilities || 0;
  const crit  = job.critical_count  || 0;
  const high  = job.high_count      || 0;
  const med   = job.medium_count    || 0;
  const low   = job.low_count       || 0;
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: idx * 0.04, ease: [0.22, 1, 0.36, 1] }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      onClick={() => isViewable && onView(job.job_id)}
      style={{
        borderLeft: `3px solid ${conf.color}${isViewable ? 'cc' : '40'}`,
        background: hovered && isViewable
          ? isDark ? 'rgba(99,102,241,0.06)' : 'rgba(99,102,241,0.04)'
          : 'transparent',
        cursor: isViewable ? 'pointer' : 'default',
        transition: 'background 0.2s',
        opacity: isViewable ? 1 : 0.7,
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
      }}
    >
      <div className="grid grid-cols-12 items-center px-6 py-5 gap-2">

        {/* Repository */}
        <div className="col-span-5 flex items-center gap-3 min-w-0">
          {/* Status dot */}
          <div style={{
            width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
            background: conf.color,
            boxShadow: `0 0 6px ${conf.color}80`,
          }} />
          {/* Source icon */}
          <div style={{
            width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
            flexShrink: 0,
          }}>
            <SrcIcon size={14} style={{ color: isDark ? '#94a3b8' : '#64748b' }} />
          </div>
          <div className="min-w-0">
            <p style={{
              fontSize: 13, fontWeight: 600,
              color: hovered && isViewable
                ? '#6366f1'
                : isDark ? '#e2e8f0' : '#1e293b',
              transition: 'color 0.2s',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {job.repository_name || job.job_id.slice(0, 24)}
            </p>
            <p style={{
              fontSize: 10, fontFamily: 'monospace',
              color: isDark ? '#475569' : '#94a3b8',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {job.job_id.slice(0, 20)}…
            </p>
          </div>
        </div>

        {/* Status badge */}
        <div className="col-span-2 flex justify-center">
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 11, fontWeight: 700,
            padding: '4px 10px', borderRadius: 100,
            background: conf.bg, color: conf.text, border: `1px solid ${conf.border}`,
            boxShadow: hovered ? `0 0 8px ${conf.glow}` : 'none',
            transition: 'box-shadow 0.2s',
          }}>
            <StatusIcon size={10} style={{ flexShrink: 0 }}
              className={spin ? 'animate-spin' : ''} />
            {label}
            {job.status === 'running' && job.progress != null ? ` ${job.progress}%` : ''}
          </span>
        </div>

        {/* Findings */}
        <div className="col-span-3 flex flex-col items-center gap-1.5">
          {isViewable ? (
            total > 0 ? (
              <>
                <div className="flex items-center gap-1 flex-wrap justify-center">
                  {crit > 0 && (
                    <span style={{
                      fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 5,
                      background: 'rgba(239,68,68,0.15)', color: '#ef4444',
                      border: '1px solid rgba(239,68,68,0.4)',
                      boxShadow: '0 0 10px rgba(239,68,68,0.5)',
                    }}>C:{crit}</span>
                  )}
                  {high > 0 && (
                    <span style={{
                      fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 5,
                      background: 'rgba(249,115,22,0.15)', color: '#f97316',
                      border: '1px solid rgba(249,115,22,0.4)',
                      animation: 'pulseBadgeOrange 2s ease-in-out infinite',
                    }}>H:{high}</span>
                  )}
                  {med > 0 && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 5,
                      background: 'rgba(234,179,8,0.12)', color: '#eab308',
                      border: '1px solid rgba(234,179,8,0.28)',
                    }}>M:{med}</span>
                  )}
                  {low > 0 && !crit && !high && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 5,
                      background: 'rgba(34,197,94,0.12)', color: '#22c55e',
                      border: '1px solid rgba(34,197,94,0.25)',
                    }}>L:{low}</span>
                  )}
                  <span style={{ fontSize: 10, color: isDark ? '#475569' : '#94a3b8', fontWeight: 500 }}>
                    /{total}
                  </span>
                </div>
                {/* Severity bar */}
                <div style={{
                  display: 'flex', width: 80, height: 4, borderRadius: 4, overflow: 'hidden', gap: 1,
                }}>
                  {crit > 0 && <div style={{ background: '#ef4444', height: '100%', width: `${(crit/total)*100}%`, borderRadius: 2, boxShadow: '0 0 4px rgba(239,68,68,0.7)' }} />}
                  {high > 0 && <div style={{ background: '#f97316', height: '100%', width: `${(high/total)*100}%` }} />}
                  {med  > 0 && <div style={{ background: '#eab308', height: '100%', width: `${(med/total)*100}%`  }} />}
                  {low  > 0 && <div style={{ background: '#22c55e', height: '100%', width: `${(low/total)*100}%`, borderRadius: 2 }} />}
                </div>
              </>
            ) : (
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 100,
                background: 'rgba(16,185,129,0.12)', color: '#10b981',
                border: '1px solid rgba(16,185,129,0.25)',
              }}>✓ Clean</span>
            )
          ) : (
            <span style={{ fontSize: 12, color: isDark ? '#334155' : '#cbd5e1' }}>—</span>
          )}
        </div>

        {/* Time */}
        <div style={{ textAlign: 'right', fontSize: 11, fontWeight: 500, color: isDark ? '#475569' : '#94a3b8' }}
          className="col-span-1">
          {relativeTime(job.created_at)}
        </div>

        {/* Arrow */}
        <div className="col-span-1 flex justify-end">
          {isViewable && (
            <motion.div animate={{ x: hovered ? 3 : 0 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }}>
              <ChevronRight size={15} style={{ color: hovered ? '#6366f1' : isDark ? '#334155' : '#cbd5e1' }} />
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

/* ── Main HistoryPage ────────────────────────────────────────────────────────── */
const HistoryPage = () => {
  const navigate        = useNavigate();
  const { loadReport }  = useScan();
  const { isDark }      = useTheme();

  const [jobs,       setJobs]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState(null);
  const [search,     setSearch]     = useState('');
  const [filter,     setFilter]     = useState('all');
  const [showSearch, setShowSearch] = useState(false);

  const fetchJobs = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const { data } = await scanAPI.getJobs();
      const list = Array.isArray(data) ? data : (data.jobs || []);
      setJobs(list);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to load scan history.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const filtered = jobs.filter(j => {
    const matchSearch = !search ||
      (j.repository_name || '').toLowerCase().includes(search.toLowerCase()) ||
      j.job_id.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === 'all' ||
      j.status === filter ||
      (filter === 'completed' && j.status === 'partial');
    return matchSearch && matchFilter;
  });

  /* Derived stats */
  const completedJobs  = jobs.filter(j => j.status === 'completed' || j.status === 'partial');
  const totalVulns     = completedJobs.reduce((s, j) => s + (j.total_vulnerabilities || 0), 0);
  const critHighCount  = completedJobs.reduce((s, j) => s + (j.critical_count || 0) + (j.high_count || 0), 0);
  const runningCount   = jobs.filter(j => j.status === 'running').length;

  const cardBg  = isDark ? 'rgba(17,24,39,0.95)' : 'rgba(255,255,255,0.98)';
  const borderC = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';

  return (
    <div style={{
      minHeight: '100vh',
      background: isDark ? '#0d0f17' : '#f4f6fb',
      position: 'relative',
    }}>

      {/* ── Ambient orbs ─────────────────────────────────────────────── */}
      <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }} aria-hidden>
        <div style={{
          position: 'absolute', top: -80, right: -80, width: 500, height: 500, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.07), transparent 70%)',
        }} />
        <div style={{
          position: 'absolute', bottom: 100, left: -120, width: 400, height: 400, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(16,185,129,0.05), transparent 70%)',
        }} />
        <div style={{
          position: 'absolute', top: '40%', right: '20%', width: 300, height: 300, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(59,130,246,0.04), transparent 70%)',
        }} />
      </div>

      {/* ── Main container ───────────────────────────────────────────── */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 28px', position: 'relative', zIndex: 1 }}>

        {/* ── Header ───────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32, gap: 16, flexWrap: 'wrap' }}
        >
          <div>
            {/* Badge */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 10,
              background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)',
              borderRadius: 100, padding: '4px 12px',
            }}>
              <ScanLine size={11} style={{ color: '#6366f1' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Scan History
              </span>
            </div>
            <h1 style={{
              fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em',
              color: isDark ? '#f8fafc' : '#0f172a', margin: 0,
              lineHeight: 1.15,
            }}>
              Security Scan History
            </h1>
            <p style={{ fontSize: 13, color: isDark ? '#64748b' : '#94a3b8', marginTop: 6, fontWeight: 500 }}>
              {loading ? 'Loading scan records…' : `${jobs.length} total scan${jobs.length !== 1 ? 's' : ''} · ${completedJobs.length} completed`}
            </p>
          </div>

          {/* Refresh button */}
          <motion.button
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={() => fetchJobs(true)}
            disabled={loading || refreshing}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 18px', borderRadius: 12, fontSize: 13, fontWeight: 600,
              background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.9)',
              border: `1px solid ${borderC}`,
              color: isDark ? '#e2e8f0' : '#475569',
              cursor: loading || refreshing ? 'not-allowed' : 'pointer',
              opacity: loading || refreshing ? 0.5 : 1,
              boxShadow: isDark ? 'none' : '0 2px 8px rgba(0,0,0,0.06)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <RefreshCw size={13} style={{ animation: (loading || refreshing) ? 'spin 1s linear infinite' : 'none' }} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </motion.button>
        </motion.div>

        {/* ── Stat Cards ───────────────────────────────────────────────── */}
        <AnimatePresence>
          {!loading && jobs.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
              <StatCard
                label="Total Scans"
                value={jobs.length}
                sub="All Time Scans"
                Icon={Layers}
                color="indigo"
                delay={0.05}
              />
              <StatCard
                label="Completed"
                value={completedJobs.length}
                sub="Successful Scans"
                Icon={CheckCircle2}
                color="emerald"
                delay={0.1}
                trend={completedJobs.length === jobs.length ? 'good' : null}
              />
              <StatCard
                label="Total Findings"
                value={totalVulns}
                sub="Vulnerabilities Found"
                Icon={ShieldAlert}
                color="blue"
                delay={0.15}
              />
              <StatCard
                label="Crit + High"
                value={critHighCount}
                sub="Priority Vulnerabilities"
                Icon={AlertTriangle}
                color="orange"
                delay={0.2}
                trend={critHighCount > 0 ? 'up' : null}
              />
            </div>
          )}
        </AnimatePresence>

        {/* ── Search + Filter toolbar ───────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
          style={{
            background: isDark ? 'rgba(20,23,42,0.85)' : 'rgba(255,255,255,0.92)',
            border: `1px solid ${borderC}`,
            borderRadius: 16, padding: '14px 16px', marginBottom: 20,
            backdropFilter: 'blur(16px)',
            boxShadow: isDark ? '0 4px 24px rgba(0,0,0,0.25)' : '0 4px 24px rgba(99,102,241,0.07)',
          }}
        >
          {/* Row 1: Search */}
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <Search size={14} style={{
              position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
              color: isDark ? '#475569' : '#cbd5e1', pointerEvents: 'none',
            }} />
            <input
              type="text"
              placeholder="Search by repository name or scan ID…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', paddingLeft: 36, paddingRight: search ? 36 : 12,
                paddingTop: 9, paddingBottom: 9,
                background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                borderRadius: 10, fontSize: 13, fontWeight: 400,
                color: isDark ? '#f1f5f9' : '#1e293b',
                outline: 'none', boxSizing: 'border-box',
              }}
              onFocus={e => { e.target.style.borderColor = '#6366f1'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.15)'; }}
              onBlur={e => { e.target.style.borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'; e.target.style.boxShadow = 'none'; }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', padding: 2,
                color: isDark ? '#475569' : '#94a3b8',
              }}>
                <X size={13} />
              </button>
            )}
          </div>

          {/* Row 2: Filters + count */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <ListFilter size={13} style={{ color: isDark ? '#475569' : '#94a3b8', flexShrink: 0 }} />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1 }}>
              {FILTERS.map(opt => {
                const isActive = filter === opt.value;
                const count = opt.value === 'all'
                  ? jobs.length
                  : jobs.filter(j =>
                      opt.value === 'completed'
                        ? j.status === 'completed' || j.status === 'partial'
                        : j.status === opt.value
                    ).length;
                return (
                  <motion.button
                    key={opt.value}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setFilter(opt.value)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                      cursor: 'pointer', border: 'none',
                      background: isActive
                        ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                        : isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                      color: isActive ? '#fff' : isDark ? '#64748b' : '#64748b',
                      boxShadow: isActive ? '0 2px 12px rgba(99,102,241,0.35)' : 'none',
                      transition: 'all 0.2s',
                    }}
                  >
                    {opt.label}
                    {!loading && (
                      <span style={{
                        fontSize: 10, fontWeight: 800,
                        background: isActive ? 'rgba(255,255,255,0.2)' : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                        padding: '1px 5px', borderRadius: 5,
                        color: isActive ? '#fff' : isDark ? '#94a3b8' : '#94a3b8',
                      }}>
                        {count}
                      </span>
                    )}
                  </motion.button>
                );
              })}
            </div>
            {!loading && (
              <span style={{
                marginLeft: 'auto', fontSize: 11, fontWeight: 600,
                color: isDark ? '#475569' : '#94a3b8',
                flexShrink: 0,
              }}>
                {filtered.length} result{filtered.length !== 1 ? 's' : ''}
              </span>
            )}
            {(search || filter !== 'all') && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => { setSearch(''); setFilter('all'); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                  background: 'rgba(239,68,68,0.1)', color: '#ef4444',
                  border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer',
                }}
              >
                <RotateCcw size={10} /> Clear
              </motion.button>
            )}
          </div>
        </motion.div>

        {/* ── Scan table card ───────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          style={{
            background: cardBg,
            border: `1px solid ${borderC}`,
            borderRadius: 20,
            overflow: 'hidden',
            backdropFilter: 'blur(16px)',
            boxShadow: isDark ? '0 8px 40px rgba(0,0,0,0.35)' : '0 8px 40px rgba(99,102,241,0.08)',
          }}
        >
          {/* Gradient top accent */}
          <div style={{
            height: 3,
            background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.6) 40%, rgba(139,92,246,0.5) 70%, transparent)',
          }} />

          {/* Column headers */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)',
            padding: '10px 24px', gap: 8,
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
          }}>
            {[
              { label: 'Repository',  span: 5, align: 'left'   },
              { label: 'Status',      span: 2, align: 'center' },
              { label: 'Findings',    span: 3, align: 'center' },
              { label: 'Scanned',     span: 1, align: 'right'  },
              { label: '',            span: 1, align: 'right'  },
            ].map(col => (
              <div key={col.label}
                style={{
                  gridColumn: `span ${col.span}`, textAlign: col.align,
                  fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase',
                  color: isDark ? '#334155' : '#94a3b8',
                }}
              >
                {col.label}
              </div>
            ))}
          </div>

          {/* Body */}
          {loading ? (
            <div>
              {Array.from({ length: 7 }).map((_, i) => (
                <SkeletonRow key={i} idx={i} isDark={isDark} />
              ))}
            </div>
          ) : error ? (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 24px', gap: 12 }}
            >
              <div style={{
                width: 52, height: 52, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
              }}>
                <XCircle size={24} style={{ color: '#ef4444' }} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: isDark ? '#f1f5f9' : '#1e293b', marginBottom: 4 }}>
                  Failed to load history
                </p>
                <p style={{ fontSize: 12, color: isDark ? '#64748b' : '#94a3b8' }}>{error}</p>
              </div>
              <motion.button
                whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                onClick={() => fetchJobs()}
                style={{
                  padding: '8px 20px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', border: 'none', cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(99,102,241,0.4)',
                }}
              >
                Retry
              </motion.button>
            </motion.div>
          ) : filtered.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', gap: 14 }}
            >
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                style={{
                  width: 64, height: 64, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(99,102,241,0.06)',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(99,102,241,0.15)'}`,
                }}
              >
                <Clock size={28} style={{ color: isDark ? '#334155' : '#94a3b8' }} />
              </motion.div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b', marginBottom: 6 }}>
                  {search || filter !== 'all' ? 'No matching scans' : 'No scan history yet'}
                </p>
                <p style={{ fontSize: 13, color: isDark ? '#64748b' : '#94a3b8' }}>
                  {search || filter !== 'all'
                    ? 'Try adjusting your search or filter criteria.'
                    : 'Your completed scans will appear here once you run your first scan.'}
                </p>
              </div>
              {!search && filter === 'all' && (
                <motion.button
                  whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                  onClick={() => navigate('/scan')}
                  style={{
                    marginTop: 6, display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 24px', borderRadius: 12, fontSize: 13, fontWeight: 700,
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', border: 'none', cursor: 'pointer',
                    boxShadow: '0 4px 18px rgba(99,102,241,0.45)',
                  }}
                >
                  <Zap size={14} /> Start Your First Scan <ChevronRight size={14} />
                </motion.button>
              )}
            </motion.div>
          ) : (
            <div>
              <AnimatePresence>
                {filtered.map((job, idx) => (
                  <ScanRow
                    key={job.job_id}
                    job={job}
                    idx={idx}
                    isDark={isDark}
                    onView={loadReport}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* Footer */}
          {!loading && !error && filtered.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
              style={{
                padding: '12px 24px',
                borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
                background: isDark ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.015)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                fontSize: 11, fontWeight: 600, color: isDark ? '#475569' : '#94a3b8',
              }}
            >
              <span>
                Showing {filtered.length} of {jobs.length} scan{jobs.length !== 1 ? 's' : ''}
              </span>
              {totalVulns > 0 && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Shield size={11} style={{ color: '#6366f1' }} />
                  {totalVulns.toLocaleString()} total findings
                  {critHighCount > 0 && (
                    <span style={{
                      fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 5,
                      background: 'rgba(249,115,22,0.12)', color: '#f97316',
                      border: '1px solid rgba(249,115,22,0.2)', marginLeft: 4,
                    }}>
                      {critHighCount} crit+high
                    </span>
                  )}
                </span>
              )}
            </motion.div>
          )}
        </motion.div>

        {/* ── Running scans live indicator ─────────────────────────────── */}
        <AnimatePresence>
          {runningCount > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
              style={{
                marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '10px 20px', borderRadius: 12, width: 'fit-content', margin: '16px auto 0',
                background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)',
              }}
            >
              <Loader2 size={13} style={{ color: '#3b82f6', animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#3b82f6' }}>
                {runningCount} scan{runningCount !== 1 ? 's' : ''} currently running — page will show latest results on refresh
              </span>
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulseBadgeOrange {
          0%, 100% { box-shadow: 0 0 0 0 rgba(249,115,22,0.0); }
          50%       { box-shadow: 0 0 10px 2px rgba(249,115,22,0.6); }
        }
      `}</style>
    </div>
  );
};

export default HistoryPage;
