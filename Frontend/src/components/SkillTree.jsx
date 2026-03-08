/**
 * SkillTree — Six-domain skill tree display component.
 *
 * Props:
 *   repoName  string   repository name (used to fetch data)
 *   compact   boolean  compact layout for sidebar / overview (default false)
 */

import React, { useEffect, useState } from 'react';
import {
  Shield, Key, Globe, AlertTriangle, Package, Layers, TrendingUp, Loader2
} from 'lucide-react';
import { learningAPI } from '../services/api';
import { useTheme } from '../context/ThemeContext';

const DOMAIN_ICONS = {
  auth_authz:       Shield,
  secrets:          Key,
  api_protection:   Globe,
  input_validation: AlertTriangle,
  dependency:       Package,
  secure_arch:      Layers,
};

const LEVEL_LABELS = {
  1: 'Beginner',
  2: 'Practitioner',
  3: 'Intermediate',
  4: 'Advanced',
  5: 'Expert',
};

function DomainCard({ domain, compact, isDark }) {
  const Icon      = DOMAIN_ICONS[domain.id] || Shield;
  const pct       = domain.progress_pct ?? 0;
  const xpToNext  = domain.xp_to_next ?? 0;

  return (
    <div className={`rounded-xl border transition-all ${compact ? 'p-3' : 'p-5'} ${
      isDark ? 'border-white/10 bg-white/4 hover:bg-white/6' : 'border-neutral-200 bg-white hover:shadow-sm'
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="p-1.5 rounded-lg shrink-0"
            style={{ background: `${domain.color}20`, border: `1px solid ${domain.color}40` }}
          >
            <Icon size={compact ? 13 : 15} style={{ color: domain.color }} />
          </div>
          <div className="min-w-0">
            <p className={`font-semibold truncate ${compact ? 'text-xs' : 'text-sm'} ${
              isDark ? 'text-white/90' : 'text-gray-900'
            }`}>
              {domain.label}
            </p>
            {!compact && (
              <p className={`text-[11px] mt-0.5 ${
                isDark ? 'text-white/40' : 'text-gray-500'
              }`}>
                {domain.description}
              </p>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p
            className={`font-black ${compact ? 'text-sm' : 'text-base'}`}
            style={{ color: domain.color }}
          >
            Lv.{domain.level}
          </p>
          <p className={`text-[10px] ${
            isDark ? 'text-white/40' : 'text-gray-500'
          }`}>
            {LEVEL_LABELS[domain.level] || 'Expert'}
          </p>
        </div>
      </div>

      {/* XP bar */}
      <div className="space-y-1">
        <div className={`h-1.5 rounded-full overflow-hidden ${
          isDark ? 'bg-white/8' : 'bg-gray-200'
        }`}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${pct}%`,
              background: `linear-gradient(90deg, ${domain.color}60, ${domain.color})`,
            }}
          />
        </div>
        <div className={`flex justify-between text-[10px] ${
          isDark ? 'text-white/35' : 'text-gray-400'
        }`}>
          <span>{domain.xp} XP</span>
          {xpToNext > 0 ? (
            <span>{xpToNext} XP to next level</span>
          ) : (
            <span className="text-yellow-400">Max Level</span>
          )}
        </div>
      </div>

      {/* XP gained this scan */}
      {domain.xp_gained > 0 && (
        <div className="mt-1.5 text-[11px] font-semibold" style={{ color: domain.color }}>
          <TrendingUp size={10} className="inline mr-1" />
          +{domain.xp_gained} XP this scan
        </div>
      )}
    </div>
  );
}

export default function SkillTree({ repoName, compact = false }) {
  const { isDark } = useTheme();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    if (!repoName) { setLoading(false); return; }
    setLoading(true);

    learningAPI.getSkillTree(repoName)
      .then(r => { setData(r.data); setError(''); })
      .catch(e => { setError(e?.response?.data?.detail || 'Failed to load skill tree'); })
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

  if (error) {
    return <p className="text-sm text-red-400 py-4">{error}</p>;
  }

  if (!data?.domains) {
    return <p className={`text-sm py-4 ${
      isDark ? 'text-white/40' : 'text-gray-500'
    }`}>No skill data yet. Complete a scan to start leveling.</p>;
  }

  const { domains, total_xp } = data;

  return (
    <div className="space-y-3">
      {!compact && (
        <div className="flex items-center justify-between mb-1">
          <h3 className={`text-[15px] font-semibold ${
            isDark ? 'text-white/80' : 'text-gray-900'
          }`}>Skill Tree</h3>
          <div className={`text-xs ${
            isDark ? 'text-white/40' : 'text-gray-500'
          }`}>
            Total: <span className={`font-bold ${
              isDark ? 'text-white/70' : 'text-gray-700'
            }`}>{total_xp} XP</span>
          </div>
        </div>
      )}
      <div className={`grid gap-3 ${compact ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
        {domains.map(d => (
          <DomainCard key={d.id} domain={d} compact={compact} isDark={isDark} />
        ))}
      </div>
    </div>
  );
}
