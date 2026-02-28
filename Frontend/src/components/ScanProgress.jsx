import React, { useEffect, useRef, useState } from 'react';
import { Shield, Loader2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { scanAPI } from '../services/api';
import { useTheme } from '../context/ThemeContext';

// Human-readable labels for each backend stage
const STAGE_LABELS = {
  queued: 'Queued — waiting to start',
  running: 'Initialising scan pipeline',
  running_scanners: 'Running scanners (Semgrep · Trivy · Gitleaks)',
  normalizing: 'Normalising findings',
  scoring: 'Scoring exploitability',
  correlating: 'Correlating vulnerabilities',
  config_analysis: 'Analysing security configuration',
  business_impact: 'Assessing business impact',
  ai_analysis: 'Generating AI insights',
  building_report: 'Building final report',
  completed: 'Scan complete',
  partial: 'Scan complete (with warnings)',
  failed: 'Scan failed',
};

// Progress milestone decorations shown in the progress track
const MILESTONES = [
  { pct: 5,  label: 'Scanners' },
  { pct: 30, label: 'Normalise' },
  { pct: 55, label: 'Correlate' },
  { pct: 75, label: 'Impact' },
  { pct: 85, label: 'AI' },
  { pct: 100, label: 'Done' },
];

const POLL_INTERVAL = 2000; // ms

/**
 * ScanProgress
 *
 * Props
 *   jobId       : string  — job id to poll
 *   repoName    : string  — shown as scan target label
 *   onComplete  : (jobId) => void  — called when status is completed/partial
 *   onError     : (msg) => void    — called when status is failed
 */
const ScanProgress = ({ jobId, repoName, onComplete, onError }) => {
  const [progress, setProgress] = useState(0);
  const [stage, setStage]       = useState('queued');
  const [status, setStatus]     = useState('running');
  const [elapsed, setElapsed]   = useState(0);
  const timerRef  = useRef(null);
  const pollRef   = useRef(null);
  const startedAt = useRef(Date.now());
  const { isDark } = useTheme();

  // Elapsed-time ticker
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt.current) / 1000));
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  // Polling loop
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
        // network blip — keep polling
        console.warn('Status poll error:', err.message);
      }
    };

    poll(); // immediate first call
    pollRef.current = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(pollRef.current);
  }, [jobId, onComplete, onError]);

  const isFailed = status === 'failed';
  const isDone   = status === 'completed' || status === 'partial';

  const formatElapsed = (s) => {
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  return (
    <div className={`rounded-xl shadow-md p-8 max-w-2xl mx-auto
      ${isDark ? 'bg-[#161929] border border-white/5' : 'bg-white'}`}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0
          ${isFailed
            ? isDark ? 'bg-red-500/10' : 'bg-red-100'
            : isDone
              ? isDark ? 'bg-green-500/10' : 'bg-green-100'
              : isDark ? 'bg-blue-500/10' : 'bg-blue-100'}`}>
          {isFailed ? (
            <XCircle className={isDark ? 'text-red-400' : 'text-red-600'} size={28} />
          ) : isDone ? (
            <CheckCircle2 className={isDark ? 'text-green-400' : 'text-green-600'} size={28} />
          ) : (
            <Loader2 className={`animate-spin ${isDark ? 'text-blue-400' : 'text-blue-600'}`} size={28} />
          )}
        </div>
        <div>
          <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>
            {isFailed ? 'Scan Failed' : isDone ? 'Scan Complete' : 'Scanning Repository'}
          </h2>
          <p className={`text-sm truncate max-w-xs ${isDark ? 'text-slate-500' : 'text-gray-500'}`} title={repoName}>
            {repoName || jobId}
          </p>
        </div>
        <div className="ml-auto text-right">
          <p className={`text-xs ${isDark ? 'text-slate-600' : 'text-gray-400'}`}>Elapsed</p>
          <p className={`text-sm font-mono ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>{formatElapsed(elapsed)}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-2">
        <div className={`flex justify-between text-sm mb-1 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
          <span>{STAGE_LABELS[stage] ?? stage}</span>
          <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-700'}`}>{progress}%</span>
        </div>
        <div className={`w-full rounded-full h-4 overflow-hidden ${isDark ? 'bg-white/5' : 'bg-gray-100'}`}>
          <div
            className={`h-4 rounded-full transition-all duration-700 ease-out
              ${isFailed ? 'bg-red-500' : isDone ? 'bg-green-500' : 'bg-blue-500'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Milestone markers */}
      <div className="relative flex justify-between mt-1 mb-6 px-0">
        {MILESTONES.map((m) => {
          const reached = progress >= m.pct;
          return (
            <div key={m.pct} className="flex flex-col items-center">
              <div className={`w-2.5 h-2.5 rounded-full border-2
                ${reached
                  ? isFailed ? 'bg-red-400 border-red-400' : 'bg-blue-500 border-blue-500'
                  : isDark ? 'bg-[#161929] border-white/20' : 'bg-white border-gray-300'
                }`}
              />
              <span className={`text-[10px] mt-1 ${reached
                ? isDark ? 'text-blue-400 font-medium' : 'text-blue-600 font-medium'
                : isDark ? 'text-slate-600' : 'text-gray-400'}`}>
                {m.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Scanner badges */}
      <div className="flex gap-3 flex-wrap">
        {[
          { name: 'Semgrep', color: 'purple' },
          { name: 'Trivy',   color: 'orange' },
          { name: 'Gitleaks', color: 'red' },
        ].map(({ name, color }) => {
          const active = progress >= 5 && progress < 30;
          return (
            <div key={name}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border
                ${active
                  ? `bg-${color}-50 border-${color}-200 text-${color}-700`
                  : progress >= 30
                    ? isDark ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-green-50 border-green-200 text-green-700'
                    : isDark ? 'bg-white/5 border-white/10 text-slate-500' : 'bg-gray-50 border-gray-200 text-gray-400'}`}
            >
              {active ? (
                <Loader2 size={12} className="animate-spin" />
              ) : progress >= 30 ? (
                <CheckCircle2 size={12} />
              ) : (
                <Shield size={12} />
              )}
              {name}
            </div>
          );
        })}
      </div>

      {/* Status indicator for partial / warning */}
      {status === 'partial' && (
        <div className={`mt-4 flex items-center gap-2 text-sm border rounded-lg px-4 py-2
          ${isDark
            ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
            : 'text-amber-700 bg-amber-50 border-amber-200'}`}>
          <AlertTriangle size={16} />
          Some scanners encountered errors. Results may be incomplete.
        </div>
      )}

      {/* Job ID chip */}
      <div className="mt-4 text-right">
        <span className={`text-xs font-mono ${isDark ? 'text-slate-600' : 'text-gray-400'}`}>Job: {jobId}</span>
      </div>
    </div>
  );
};

export default ScanProgress;
