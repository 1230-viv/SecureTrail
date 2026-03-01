/**
 * LifecycleBadge — small pill showing a finding's current lifecycle state.
 *
 * States:  detected | learning | fix_attempted | verified | mastered
 */

import React from 'react';
import { CheckCircle, BookOpen, Wrench, Star, Zap } from 'lucide-react';

const STATE_CONFIG = {
  detected: {
    label: 'Detected',
    bg: 'bg-red-500/15',
    text: 'text-red-400',
    border: 'border-red-500/30',
    Icon: Zap,
  },
  learning: {
    label: 'Learning',
    bg: 'bg-blue-500/15',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
    Icon: BookOpen,
  },
  fix_attempted: {
    label: 'Fix Attempted',
    bg: 'bg-amber-500/15',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
    Icon: Wrench,
  },
  verified: {
    label: 'Verified ✓',
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
    Icon: CheckCircle,
  },
  mastered: {
    label: 'Mastered',
    bg: 'bg-purple-500/15',
    text: 'text-purple-400',
    border: 'border-purple-500/30',
    Icon: Star,
  },
};

const LIFECYCLE_ORDER = ['detected', 'learning', 'fix_attempted', 'verified', 'mastered'];
const LIFECYCLE_LABELS = {
  detected: 'Detected',
  learning: 'Learning',
  fix_attempted: 'Fix Attempted',
  verified: 'Verified',
  mastered: 'Mastered',
};

export function LifecycleBadge({ state = 'detected', size = 'sm' }) {
  const cfg = STATE_CONFIG[state] || STATE_CONFIG.detected;
  const { Icon } = cfg;
  const iconSize = size === 'sm' ? 10 : 12;

  return (
    <span
      className={`
        inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium
        ${cfg.bg} ${cfg.text} ${cfg.border}
      `}
    >
      <Icon size={iconSize} />
      {cfg.label}
    </span>
  );
}

/** Horizontal lifecycle progress steps */
export function LifecycleProgress({ state = 'detected' }) {
  const currentIdx = LIFECYCLE_ORDER.indexOf(state);

  return (
    <div className="flex items-center gap-0 w-full">
      {LIFECYCLE_ORDER.map((s, i) => {
        const done    = i < currentIdx;
        const current = i === currentIdx;
        const cfg     = STATE_CONFIG[s];
        const { Icon } = cfg;

        return (
          <React.Fragment key={s}>
            <div className="flex flex-col items-center min-w-0">
              <div
                className={`
                  w-7 h-7 rounded-full flex items-center justify-center border-2
                  ${done    ? 'bg-emerald-500/30 border-emerald-500 text-emerald-400' : ''}
                  ${current ? `${cfg.bg} border-current ${cfg.text}` : ''}
                  ${!done && !current ? 'bg-white/5 border-white/15 text-white/30' : ''}
                `}
              >
                <Icon size={13} />
              </div>
              <span className={`text-[9px] mt-0.5 font-medium whitespace-nowrap ${
                current ? cfg.text : done ? 'text-emerald-400/70' : 'text-white/25'
              }`}>
                {LIFECYCLE_LABELS[s]}
              </span>
            </div>
            {i < LIFECYCLE_ORDER.length - 1 && (
              <div className={`flex-1 h-0.5 mb-3 ${i < currentIdx ? 'bg-emerald-500/50' : 'bg-white/10'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default LifecycleBadge;
