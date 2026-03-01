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

function DomainCard({ domain, compact }) {
  const Icon      = DOMAIN_ICONS[domain.id] || Shield;
  const pct       = domain.progress_pct ?? 0;
  const xpToNext  = domain.xp_to_next ?? 0;

  return (
    <div className={`rounded-xl border border-white/10 bg-white/4 hover:bg-white/6 transition-all ${compact ? 'p-3' : 'p-4'}`}>
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
            <p className={`font-semibold text-white/90 truncate ${compact ? 'text-xs' : 'text-sm'}`}>
              {domain.label}
            </p>
            {!compact && (
              <p className="text-[11px] text-white/40 mt-0.5">
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
          <p className="text-[10px] text-white/40">
            {LEVEL_LABELS[domain.level] || 'Expert'}
          </p>
        </div>
      </div>

      {/* XP bar */}
      <div className="space-y-1">
        <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${pct}%`,
              background: `linear-gradient(90deg, ${domain.color}60, ${domain.color})`,
            }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-white/35">
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
        <Loader2 size={20} className="animate-spin text-white/30" />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-red-400 py-4">{error}</p>;
  }

  if (!data?.domains) {
    return <p className="text-sm text-white/40 py-4">No skill data yet. Complete a scan to start leveling.</p>;
  }

  const { domains, total_xp } = data;

  return (
    <div className="space-y-3">
      {!compact && (
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-bold text-white/80">Skill Tree</h3>
          <div className="text-xs text-white/40">
            Total: <span className="text-white/70 font-bold">{total_xp} XP</span>
          </div>
        </div>
      )}
      <div className={`grid gap-3 ${compact ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
        {domains.map(d => (
          <DomainCard key={d.id} domain={d} compact={compact} />
        ))}
      </div>
    </div>
  );
}
