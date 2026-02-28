import React, { useEffect, useRef, useState } from 'react';
import {
  Shield, Loader2, CheckCircle2, XCircle, AlertTriangle,
  Clock, Fingerprint, Eye,
} from 'lucide-react';
import { scanAPI } from '../services/api';
import { useTheme } from '../context/ThemeContext';

/* ── Stage labels ──────────────────────────────────────────────────────────── */
const STAGE_LABELS = {
  queued:            'Queued — waiting to start',
  running:           'Initialising scan pipeline',
  running_scanners:  'Running scanners',
  normalizing:       'Normalising findings',
  scoring:           'Scoring exploitability',
  correlating:       'Correlating vulnerabilities',
  config_analysis:   'Analysing security config',
  business_impact:   'Assessing business impact',
  ai_analysis:       'Generating AI insights',
  building_report:   'Building final report',
  completed:         'Scan complete',
  partial:           'Complete (with warnings)',
  failed:            'Scan failed',
};

/* ── Milestones shown on the track ─────────────────────────────────────────── */
const MILESTONES = [
  { pct: 5,   label: 'Scan',      icon: Shield },
  { pct: 30,  label: 'Normalise', icon: Fingerprint },
  { pct: 55,  label: 'Correlate', icon: Eye },
  { pct: 75,  label: 'Impact',    icon: AlertTriangle },
  { pct: 85,  label: 'AI',        icon: Loader2 },
  { pct: 100, label: 'Done',      icon: CheckCircle2 },
];

const SCANNERS = [
  { name: 'Semgrep',  light: 'bg-violet-50 text-violet-700 border-violet-200', dark: 'bg-violet-500/10 text-violet-300 border-violet-500/20' },
  { name: 'Trivy',    light: 'bg-blue-50 text-blue-700 border-blue-200',       dark: 'bg-blue-500/10 text-blue-300 border-blue-500/20' },
  { name: 'Gitleaks', light: 'bg-rose-50 text-rose-700 border-rose-200',       dark: 'bg-rose-500/10 text-rose-300 border-rose-500/20' },
];

const POLL_INTERVAL = 2000;

/* ── Component ─────────────────────────────────────────────────────────────── */
const ScanProgress = ({ jobId, repoName, onComplete, onError }) => {
  const [progress, setProgress] = useState(0);
  const [stage, setStage]       = useState('queued');
  const [status, setStatus]     = useState('running');
  const [elapsed, setElapsed]   = useState(0);
  const timerRef  = useRef(null);
  const pollRef   = useRef(null);
  const startedAt = useRef(Date.now());
  const { isDark } = useTheme();

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt.current) / 1000));
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  useEffect(() => {
    if (!jobId) return;
    const poll = async () => {
      try {
        const { data } = await scanAPI.getStatus(jobId);
        setProgress(data.progress ?? 0);
        setStage(data.stage ?? 'running');
        setStatus(data.status);
        if (data.status === 'completed' || data.status === 'partial') {
          clearInterval(pollRef.current);
          clearInterval(timerRef.current);
          onComplete?.(jobId);
        } else if (data.status === 'failed') {
          clearInterval(pollRef.current);
          clearInterval(timerRef.current);
          onError?.(data.error || 'Scan failed');
        }
      } catch (err) {
        console.warn('Status poll error:', err.message);
      }
    };
    poll();
    pollRef.current = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(pollRef.current);
  }, [jobId, onComplete, onError]);

  const isFailed = status === 'failed';
  const isDone   = status === 'completed' || status === 'partial';

  const fmtTime = (s) => (s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`);

  /* Colour helpers */
  const accentColor = isFailed ? 'red' : isDone ? 'emerald' : 'blue';

  const ringBg = {
    blue:    isDark ? 'bg-blue-500/10'    : 'bg-blue-50',
    emerald: isDark ? 'bg-emerald-500/10' : 'bg-emerald-50',
    red:     isDark ? 'bg-red-500/10'     : 'bg-red-50',
  }[accentColor];

  const iconCls = {
    blue:    isDark ? 'text-blue-400'    : 'text-blue-600',
    emerald: isDark ? 'text-emerald-400' : 'text-emerald-600',
    red:     isDark ? 'text-red-400'     : 'text-red-600',
  }[accentColor];

  const barCls = {
    blue: 'bg-gradient-to-r from-blue-500 to-blue-400',
    emerald: 'bg-gradient-to-r from-emerald-500 to-emerald-400',
    red: 'bg-gradient-to-r from-red-500 to-red-400',
  }[accentColor];

  return (
    <div className="w-full max-w-2xl mx-auto animate-fade-in-up">
      {/* ── Card ──────────────────────────────────────────────────────── */}
      <div className={`rounded-2xl p-8 relative overflow-hidden
        ${isDark ? 'bg-[#161929] border border-white/[0.06]' : 'bg-white border border-slate-100 shadow-lg shadow-slate-200/50'}`}>

        {/* Decorative gradient orb behind icon */}
        {!isFailed && !isDone && (
          <div className="absolute -top-10 -left-10 w-40 h-40 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
        )}

        {/* ── Top row: icon + heading + elapsed ──────── */}
        <div className="flex items-center gap-4 mb-8 relative">
          {/* Animated icon cluster */}
          <div className="relative flex-shrink-0">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${ringBg}`}>
              {isFailed ? (
                <XCircle className={iconCls} size={28} />
              ) : isDone ? (
                <CheckCircle2 className={iconCls} size={28} />
              ) : (
                <Loader2 className={`animate-spin ${iconCls}`} size={28} />
              )}
            </div>
            {/* Pulse ring for active scanning */}
            {!isFailed && !isDone && (
              <div className="absolute inset-0 rounded-2xl border-2 border-blue-500/30 animate-pulse-ring" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h2 className={`text-xl font-bold tracking-tight
              ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {isFailed ? 'Scan Failed' : isDone ? 'Scan Complete' : 'Scanning Repository'}
            </h2>
            <p className={`text-sm truncate max-w-md mt-0.5
              ${isDark ? 'text-slate-500' : 'text-slate-400'}`} title={repoName}>
              {repoName || jobId}
            </p>
          </div>

          {/* Elapsed chip */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl flex-shrink-0
            ${isDark ? 'bg-white/[0.04]' : 'bg-slate-50'}`}>
            <Clock size={13} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
            <span className={`text-sm font-mono font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              {fmtTime(elapsed)}
            </span>
          </div>
        </div>

        {/* ── Stage label + percentage ────────────────── */}
        <div className="flex items-baseline justify-between mb-2">
          <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {STAGE_LABELS[stage] ?? stage}
          </span>
          <span className={`text-lg font-bold tabular-nums ${isDark ? 'text-white' : 'text-slate-800'}`}>
            {progress}<span className={`text-xs font-normal ml-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>%</span>
          </span>
        </div>

        {/* ── Progress bar ────────────────────────────── */}
        <div className={`w-full rounded-full h-2.5 overflow-hidden mb-6
          ${isDark ? 'bg-white/[0.06]' : 'bg-slate-100'}`}>
          <div className={`h-2.5 rounded-full transition-all duration-700 ease-out relative ${barCls}`}
               style={{ width: `${progress}%` }}>
            {!isFailed && !isDone && <div className="absolute inset-0 rounded-full progress-shimmer" />}
          </div>
        </div>

        {/* ── Milestone track ─────────────────────────── */}
        <div className="relative mb-8">
          {/* Connecting line */}
          <div className={`absolute top-4 left-4 right-4 h-px
            ${isDark ? 'bg-white/[0.06]' : 'bg-slate-100'}`} />

          <div className="relative flex justify-between">
            {MILESTONES.map((m) => {
              const reached = progress >= m.pct;
              const Icon = m.icon;
              return (
                <div key={m.pct} className="flex flex-col items-center relative z-10">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-500
                    ${reached
                      ? isFailed
                        ? isDark ? 'bg-red-500/15 text-red-400' : 'bg-red-50 text-red-500'
                        : isDark ? 'bg-blue-500/15 text-blue-400' : 'bg-blue-50 text-blue-600'
                      : isDark ? 'bg-white/[0.04] text-slate-600' : 'bg-slate-50 text-slate-300'}`}>
                    <Icon size={14} className={reached && !isFailed && m.pct > progress - 15 && !isDone ? 'animate-pulse' : ''} />
                  </div>
                  <span className={`text-[10px] mt-1.5 font-medium
                    ${reached
                      ? isDark ? 'text-slate-300' : 'text-slate-600'
                      : isDark ? 'text-slate-600' : 'text-slate-300'}`}>
                    {m.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Scanner badges ──────────────────────────── */}
        <div className={`flex gap-2 flex-wrap pt-5 border-t
          ${isDark ? 'border-white/[0.04]' : 'border-slate-50'}`}>
          <span className={`text-[10px] font-bold uppercase tracking-[0.12em] self-center mr-1
            ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>Engines</span>
          {SCANNERS.map(({ name, light, dark }) => {
            const active   = progress >= 5 && progress < 30;
            const finished = progress >= 30;
            return (
              <div key={name}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-300
                  ${finished
                    ? isDark ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : active
                      ? isDark ? dark : light
                      : isDark ? 'bg-white/[0.03] border-white/[0.06] text-slate-600' : 'bg-slate-50 border-slate-100 text-slate-300'}`}
              >
                {active ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : finished ? (
                  <CheckCircle2 size={12} />
                ) : (
                  <Shield size={12} />
                )}
                {name}
              </div>
            );
          })}
        </div>

        {/* Partial warning */}
        {status === 'partial' && (
          <div className={`mt-5 flex items-center gap-2 text-sm rounded-xl px-4 py-3
            ${isDark
              ? 'text-amber-300 bg-amber-500/10 border border-amber-500/20'
              : 'text-amber-700 bg-amber-50 border border-amber-200'}`}>
            <AlertTriangle size={15} />
            Some scanners had warnings. Results may be incomplete.
          </div>
        )}

        {/* Job ID */}
        <div className="mt-5 text-right">
          <span className={`text-[10px] font-mono ${isDark ? 'text-slate-700' : 'text-slate-300'}`}>
            {jobId}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ScanProgress;
