/**
 * FixSubmitter — Interactive code fix submission and evaluation panel.
 *
 * Props:
 *   jobId        string     scan job ID
 *   category     string     vulnerability category slug
 *   ruleId       string     specific rule/check ID
 *   filePath     string     file path of the vulnerability
 *   severity     string     critical | high | medium | low | info
 *   label        string     human-readable category name
 *   originalIssue string    the finding description
 *   onVerified   function   called when a fix is verified (xpAwarded, newBadges)
 */

import React, { useState, useRef } from 'react';
import {
  Code, Send, CheckCircle, XCircle, AlertTriangle,
  Loader2, ChevronDown, ChevronUp, Trophy, Zap
} from 'lucide-react';
import { learningAPI } from '../services/api';
import { LifecycleProgress } from './LifecycleBadge';

const SEV_COLOR = {
  critical: 'text-red-400',
  high:     'text-orange-400',
  medium:   'text-amber-400',
  low:      'text-blue-400',
  info:     'text-slate-400',
};

const SCORE_COLOR = (score) => {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-amber-400';
  return 'text-red-400';
};

const SCORE_BG = (score) => {
  if (score >= 80) return 'bg-emerald-500/15 border-emerald-500/30';
  if (score >= 60) return 'bg-amber-500/15 border-amber-500/30';
  return 'bg-red-500/15 border-red-500/30';
};

export default function FixSubmitter({
  jobId,
  category,
  ruleId,
  filePath,
  severity = 'medium',
  label,
  originalIssue = '',
  onVerified,
}) {
  const [open, setOpen]         = useState(false);
  const [code, setCode]         = useState('');
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState(null);
  const [error, setError]       = useState('');
  const textareaRef             = useRef(null);

  const handleSubmit = async () => {
    if (!code.trim() || code.trim().length < 5) {
      setError('Please paste at least a few lines of code to evaluate.');
      return;
    }
    setError('');
    setLoading(true);
    setResult(null);

    try {
      const resp = await learningAPI.verifyFix(jobId, category, {
        rule_id:        ruleId || category,
        file_path:      filePath || null,
        severity:       severity,
        code:           code,
        original_issue: originalIssue,
        label:          label || category,
      });
      const data = resp.data;
      setResult(data);

      if (data.lifecycle_state === 'verified' && onVerified) {
        onVerified(data.xp_awarded, data.new_badges || []);
      }
    } catch (err) {
      setError(err?.response?.data?.detail || 'Evaluation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isVerified = result?.lifecycle_state === 'verified';
  const score      = result?.improvement_score ?? null;

  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-white/3 overflow-hidden">
      {/* ── Header toggle ── */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Code size={15} className="text-indigo-400" />
          <span className="text-sm font-medium text-white/85">Submit Fix for Verification</span>
          {result && (
            <span className={`text-xs font-semibold ml-2 ${isVerified ? 'text-emerald-400' : 'text-amber-400'}`}>
              {isVerified ? '✓ Verified' : `Score: ${score}/100`}
            </span>
          )}
        </div>
        {open ? <ChevronUp size={14} className="text-white/40" /> : <ChevronDown size={14} className="text-white/40" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-white/8">
          {/* ── Severity + context ── */}
          <div className="pt-3 flex flex-wrap items-center gap-3 text-xs text-white/50">
            <span className={`font-semibold uppercase ${SEV_COLOR[severity] || 'text-slate-400'}`}>
              {severity}
            </span>
            <span>•</span>
            <span className="font-mono truncate max-w-xs">{filePath || 'multiple files'}</span>
            {ruleId && (
              <>
                <span>•</span>
                <span className="font-mono text-white/35 truncate max-w-xs">{ruleId}</span>
              </>
            )}
          </div>

          {/* ── Code textarea ── */}
          <div>
            <label className="block text-xs font-medium text-white/60 mb-1.5">
              Paste your fixed code below:
            </label>
            <textarea
              ref={textareaRef}
              value={code}
              onChange={e => setCode(e.target.value)}
              rows={10}
              placeholder={`// Paste the fixed version of the vulnerable code here\n// Focus on the function or block that addresses "${label || category}"`}
              className="w-full bg-[#0d1117] border border-white/12 rounded-lg p-3 text-sm text-white/90 font-mono placeholder:text-white/20 resize-y focus:outline-none focus:border-indigo-500/50 transition-colors"
              spellCheck={false}
            />
            <div className="flex items-center justify-between mt-1">
              <span className="text-[11px] text-white/30">{code.length} chars</span>
              <button
                onClick={() => setCode('')}
                className="text-[11px] text-white/30 hover:text-white/60 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              <AlertTriangle size={13} />
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || !code.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
          >
            {loading ? (
              <><Loader2 size={14} className="animate-spin" /> Evaluating…</>
            ) : (
              <><Send size={14} /> Submit for Evaluation</>
            )}
          </button>

          {/* ── Result ── */}
          {result && (
            <div className={`rounded-xl border p-4 space-y-3 ${SCORE_BG(score)}`}>
              {/* Score row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isVerified
                    ? <CheckCircle size={18} className="text-emerald-400" />
                    : <XCircle size={18} className="text-amber-400" />
                  }
                  <span className="text-sm font-bold text-white">
                    {isVerified ? 'Fix Verified ✓' : 'Fix Attempted'}
                  </span>
                </div>
                <div className={`text-2xl font-black ${SCORE_COLOR(score)}`}>
                  {score}<span className="text-sm font-normal">/100</span>
                </div>
              </div>

              {/* XP badge */}
              {result.xp_awarded > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-amber-400 font-semibold">
                  <Zap size={13} />
                  +{result.xp_awarded} XP awarded
                </div>
              )}

              {/* New badges */}
              {result.new_badges?.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {result.new_badges.map(b => (
                    <div key={b.id} className="flex items-center gap-1.5 text-xs bg-amber-500/15 border border-amber-500/30 text-amber-300 px-2.5 py-1 rounded-full">
                      <Trophy size={11} />
                      {b.name}
                    </div>
                  ))}
                </div>
              )}

              {/* Lifecycle progress */}
              <div className="pt-1">
                <LifecycleProgress state={result.lifecycle_state} />
              </div>

              {/* Explanation */}
              {result.explanation && (
                <p className="text-sm text-white/75">{result.explanation}</p>
              )}

              {/* Static flags */}
              {result.static_flags?.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-white/50 uppercase tracking-wide">Issues Found:</p>
                  {result.static_flags.map((f, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-red-300">
                      <XCircle size={11} className="mt-0.5 shrink-0" />
                      {f}
                    </div>
                  ))}
                </div>
              )}

              {/* Missing checks */}
              {result.missing_checks?.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-white/50 uppercase tracking-wide">Missing Checks:</p>
                  {result.missing_checks.map((c, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-amber-300">
                      <AlertTriangle size={11} className="mt-0.5 shrink-0" />
                      {c}
                    </div>
                  ))}
                </div>
              )}

              {/* Next step */}
              {result.next_step && (
                <div className="bg-white/5 rounded-lg px-3 py-2 text-xs text-white/70">
                  <span className="font-semibold text-white/90">Next: </span>
                  {result.next_step}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
