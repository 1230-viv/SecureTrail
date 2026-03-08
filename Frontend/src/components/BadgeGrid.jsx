/**
 * BadgeGrid — displays earned and locked achievement badges for a repository.
 *
 * Props:
 *   repoName  string   repository name to load badges for
 */

import React, { useEffect, useState } from 'react';
import {
  Shield, Key, Lock, CheckCircle2, Zap, Star,
  Package, AlertOctagon, Flame, Trophy, Loader2
} from 'lucide-react';
import { learningAPI } from '../services/api';
import { useTheme } from '../context/ThemeContext';

const ICON_MAP = {
  first_verified_fix:    { Icon: CheckCircle2, color: '#10b981', bg: 'from-emerald-900/50 to-emerald-800/20' },
  five_secure_fixes:     { Icon: Zap,          color: '#f59e0b', bg: 'from-amber-900/50  to-amber-800/20'  },
  ten_secure_fixes:      { Icon: Trophy,        color: '#eab308', bg: 'from-yellow-900/50 to-yellow-800/20' },
  auth_master:           { Icon: Key,           color: '#8b5cf6', bg: 'from-violet-900/50 to-violet-800/20' },
  secrets_clean_sweep:   { Icon: Lock,          color: '#06b6d4', bg: 'from-cyan-900/50   to-cyan-800/20'   },
  input_validator:       { Icon: Shield,        color: '#3b82f6', bg: 'from-blue-900/50   to-blue-800/20'   },
  dependency_hygienist:  { Icon: Package,       color: '#22c55e', bg: 'from-green-900/50  to-green-800/20'  },
  zero_criticals:        { Icon: AlertOctagon,  color: '#ef4444', bg: 'from-red-900/50    to-red-800/20'    },
  streak_3:              { Icon: Flame,         color: '#f97316', bg: 'from-orange-900/50 to-orange-800/20' },
};

function BadgeTile({ badge, earned, isDark }) {
  const cfg = ICON_MAP[badge.badge_id] || { Icon: Star, color: '#94a3b8', bg: 'from-slate-800 to-slate-700' };
  const { Icon } = cfg;

  return (
    <div
      className={`
        relative rounded-xl border p-4 flex flex-col items-center text-center gap-2 transition-all duration-200
        ${earned
          ? `bg-gradient-to-b ${cfg.bg} ${isDark ? 'border-white/15' : 'border-neutral-300'} shadow-lg`
          : isDark ? 'bg-white/3 border-white/7' : 'bg-gray-50 border-neutral-200'
        }
      `}
    >
      {/* Earned glow */}
      {earned && (
        <div
          className="absolute inset-0 rounded-xl pointer-events-none"
          style={{ boxShadow: `inset 0 0 24px ${cfg.color}18` }}
        />
      )}

      {/* Icon container */}
      <div
        className="relative w-12 h-12 rounded-full flex items-center justify-center"
        style={{
          background: earned ? `${cfg.color}20` : isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
          border: `1.5px solid ${earned ? cfg.color + '40' : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          filter: earned ? 'none' : 'grayscale(1) opacity(0.3)',
        }}
      >
        <Icon size={22} style={{ color: earned ? cfg.color : '#64748b' }} strokeWidth={1.8} />
        {earned && (
          <span
            className="absolute -top-1 -right-1 text-[9px] leading-none font-black px-1 py-0.5 rounded-full"
            style={{ background: cfg.color, color: '#0f172a' }}
          >
            ✓
          </span>
        )}
      </div>

      <div className="space-y-0.5">
        <p
          className="text-xs font-bold leading-snug"
          style={{ color: earned ? (isDark ? '#e2e8f0' : '#1e293b') : (isDark ? '#475569' : '#94a3b8') }}
        >
          {badge.name}
        </p>
        <p
          className="text-[10px] leading-snug"
          style={{ color: earned ? (isDark ? '#94a3b8' : '#64748b') : (isDark ? '#334155' : '#cbd5e1') }}
        >
          {badge.description}
        </p>
        {earned && badge.earned_at && (
          <p className="text-[9px] mt-1" style={{ color: cfg.color + 'cc' }}>
            Earned {fmtDate(badge.earned_at)}
          </p>
        )}
      </div>
    </div>
  );
}

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
  } catch {
    return '—';
  }
}

export default function BadgeGrid({ repoName }) {
  const { isDark } = useTheme();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    if (!repoName) { setLoading(false); return; }
    learningAPI.getBadges(repoName)
      .then(r => { setData(r.data); setError(''); })
      .catch(e => { setError(e?.response?.data?.detail || 'Failed to load badges.'); })
      .finally(() => setLoading(false));
  }, [repoName]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 size={20} className={`animate-spin ${
          isDark ? 'text-white/30' : 'text-gray-400'
        }`} />
      </div>
    );
  }

  if (error) return <p className="text-sm text-red-400 py-4">{error}</p>;

  const earned  = data?.earned_badges  || [];
  const catalog = data?.catalog        || [];

  // Build full list: earned first, then unearned from catalog
  const earnedIds = new Set(earned.map(b => b.badge_id));
  const allBadges = [
    ...earned,
    ...catalog.filter(b => !earnedIds.has(b.badge_id)),
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className={`text-[15px] font-semibold ${
          isDark ? 'text-white/80' : 'text-gray-900'
        }`}>Achievements</h3>
        <span className={`text-xs ${
          isDark ? 'text-white/35' : 'text-gray-500'
        }`}>
          {earned.length}/{allBadges.length} earned
        </span>
      </div>

      {/* Progress bar */}
      <div className={`h-1.5 rounded-full overflow-hidden ${
        isDark ? 'bg-white/8' : 'bg-gray-200'
      }`}>
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all"
          style={{ width: `${allBadges.length ? (earned.length / allBadges.length) * 100 : 0}%` }}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {allBadges.map(badge => (
          <BadgeTile
            key={badge.badge_id}
            badge={badge}
            earned={earnedIds.has(badge.badge_id)}
            isDark={isDark}
          />
        ))}
      </div>

      {earned.length === 0 && (
        <p className={`text-xs text-center pt-2 ${
          isDark ? 'text-white/30' : 'text-gray-400'
        }`}>
          Submit and verify secure fixes to earn badges.
        </p>
      )}
    </div>
  );
}
