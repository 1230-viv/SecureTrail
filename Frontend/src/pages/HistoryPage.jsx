import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock, CheckCircle2, XCircle, Loader2, AlertTriangle,
  Eye, Github, FileArchive, RefreshCw, Search,
  Shield, ChevronRight, BarChart2, Zap, TrendingUp,
} from 'lucide-react';
import { scanAPI } from '../services/api';
import { useScan } from '../context/ScanContext';
import { useTheme } from '../context/ThemeContext';

const STATUS_CONF = {
  completed: { icon: CheckCircle2,  cls: 'text-green-600 dark:text-green-400',  bg: 'bg-green-50 dark:bg-green-500/10',  dot: 'bg-green-500',  color: '#10b981', label: 'Completed' },
  partial:   { icon: AlertTriangle, cls: 'text-amber-600 dark:text-amber-400',  bg: 'bg-amber-50 dark:bg-amber-500/10',  dot: 'bg-amber-500',  color: '#f59e0b', label: 'Partial'   },
  failed:    { icon: XCircle,       cls: 'text-red-600 dark:text-red-400',      bg: 'bg-red-50 dark:bg-red-500/10',      dot: 'bg-red-500',    color: '#ef4444', label: 'Failed'    },
  running:   { icon: Loader2,       cls: 'text-blue-600 dark:text-blue-400',    bg: 'bg-blue-50 dark:bg-blue-500/10',    dot: 'bg-blue-500',   color: '#3b82f6', label: 'Running', spin: true },
  queued:    { icon: Clock,         cls: 'text-gray-500 dark:text-gray-400',    bg: 'bg-gray-50 dark:bg-gray-500/10',    dot: 'bg-gray-400',   color: '#94a3b8', label: 'Queued'    },
};

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

const HistoryPage = () => {
  const navigate        = useNavigate();
  const { loadReport }  = useScan();
  const { isDark }      = useTheme();
  const [jobs, setJobs]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState('all');

  const fetchJobs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await scanAPI.getJobs();
      const list = Array.isArray(data) ? data : (data.jobs || []);
      setJobs(list);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to load scan history.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const filtered = jobs.filter(j => {
    const matchSearch = !search ||
      (j.repository_name || '').toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === 'all' ||
      j.status === filter ||
      (filter === 'completed' && j.status === 'partial');
    return matchSearch && matchFilter;
  });

  /* ── Derived stats ─────────────────────────────────────────────── */
  const completedJobs = jobs.filter(j => j.status === 'completed' || j.status === 'partial');
  const totalVulns    = completedJobs.reduce((s, j) => s + (j.total_vulnerabilities || 0), 0);
  const critHighCount = completedJobs.reduce((s, j) => s + (j.critical_count || 0) + (j.high_count || 0), 0);

  return (
    <div className={`min-h-screen ${isDark ? 'bg-[#0B1220]' : 'bg-[#F8FAFC]'}`}>

      {/* ── Ambient orbs ── */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">
        <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full opacity-[0.05] blur-3xl"
          style={{ background: 'radial-gradient(circle, #6366f1, transparent 70%)' }} />
        <div className="absolute top-1/2 -left-48 w-[400px] h-[400px] rounded-full opacity-[0.04] blur-3xl"
          style={{ background: 'radial-gradient(circle, #3b82f6, transparent 70%)' }} />
      </div>

      {/* ── Centered Container ── */}
      <div className={`max-w-[1280px] mx-auto px-6 py-12 my-8 relative z-10 rounded-2xl
        ${isDark 
          ? 'bg-[#111827] border-l border-r border-white/[0.06]' 
          : 'bg-white border-l border-r border-black/[0.06] shadow-[0_20px_60px_rgba(0,0,0,0.05)]'}`}>
        
        <div className="space-y-6 animate-fade-in-up">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className={`text-[1.75rem] font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Scan History
            </h1>
            <p className={`text-sm mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              {loading ? 'Loading…' : `${jobs.length} total scan${jobs.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button
            onClick={fetchJobs}
            disabled={loading}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl border
                       transition-all disabled:opacity-50 backdrop-blur-md
                       ${isDark
                         ? 'border-white/[0.08] text-slate-300 hover:bg-white/[0.06] bg-white/[0.03]'
                         : 'border-white/60 text-slate-600 hover:bg-white/80 bg-white/60 shadow-sm'}`}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* ── Stats strip ────────────────────────────────────────────── */}
        {!loading && jobs.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: BarChart2,   label: 'Total Scans',    value: jobs.length,           color: '#6366f1' },
              { icon: CheckCircle2,label: 'Completed',      value: completedJobs.length,  color: '#10b981' },
              { icon: TrendingUp,  label: 'Total Findings', value: totalVulns,            color: '#3b82f6' },
              { icon: AlertTriangle,label:'Crit + High',    value: critHighCount,         color: '#f97316' },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label}
                className={`rounded-xl px-4 py-3.5 border backdrop-blur-md flex items-center gap-3
                  ${isDark ? 'bg-white/[0.03] border-white/[0.07]' : 'bg-white/70 border-white/60 shadow-sm'}`}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
                  <Icon size={14} style={{ color }} />
                </div>
                <div className="min-w-0">
                  <p className={`text-xl font-black tabular-nums leading-none ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {value}
                  </p>
                  <p className={`text-[10px] font-medium mt-0.5 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Search + Filter bar ────────────────────────────────────── */}
        <div className={`rounded-2xl border backdrop-blur-xl px-4 py-3 flex flex-wrap items-center gap-3
          ${isDark
            ? 'bg-white/[0.03] border-white/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.25)]'
            : 'bg-white/70 border-white/60 shadow-[0_4px_24px_rgba(99,102,241,0.07)]'}`}>
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search size={13} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
            <input
              type="text"
              placeholder="Search by repository name…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className={`w-full pl-8 pr-3 py-2 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all
                ${isDark
                  ? 'bg-white/[0.04] border border-white/[0.08] text-white placeholder-slate-600'
                  : 'bg-white/50 border border-slate-100 text-slate-900 placeholder-slate-300'}`}
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {FILTERS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setFilter(opt.value)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all
                  ${filter === opt.value
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20'
                    : isDark
                      ? 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.05]'
                      : 'text-slate-400 hover:text-slate-700 hover:bg-white/80'}`}
              >
                {opt.label}
                {opt.value !== 'all' && !loading && (
                  <span className="ml-1.5 opacity-60">
                    {jobs.filter(j =>
                      opt.value === 'completed'
                        ? j.status === 'completed' || j.status === 'partial'
                        : j.status === opt.value
                    ).length}
                  </span>
                )}
              </button>
            ))}
          </div>
          {(search || filter !== 'all') && (
            <button
              onClick={() => { setSearch(''); setFilter('all'); }}
              className={`ml-auto text-xs font-medium px-3 py-1.5 rounded-xl ring-1 ring-inset transition-colors
                ${isDark ? 'ring-white/[0.08] text-slate-500 hover:text-slate-300' : 'ring-slate-200 text-slate-400 hover:text-slate-600'}`}>
              Clear
            </button>
          )}
        </div>

        {/* ── Table card ─────────────────────────────────────────────── */}
        <div className={`rounded-2xl border overflow-hidden backdrop-blur-xl
          ${isDark
            ? 'bg-white/[0.03] border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.3)]'
            : 'bg-white/70 border-white/60 shadow-[0_8px_32px_rgba(99,102,241,0.08)]'}`}>

          {/* Gradient top accent */}
          <div className="h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />

          {/* Column headers */}
          <div className={`hidden sm:grid grid-cols-12 px-6 py-3 border-b text-[10px] font-bold uppercase tracking-widest
            ${isDark ? 'border-white/[0.05] text-slate-600' : 'border-slate-100/80 text-slate-400'}`}>
            <div className="col-span-5">Repository</div>
            <div className="col-span-2 text-center">Status</div>
            <div className="col-span-3 text-center">Findings</div>
            <div className="col-span-1 text-right">Scanned</div>
            <div className="col-span-1" />
          </div>

          {/* Body */}
          {loading ? (
            /* Skeleton rows */
            <div className={`divide-y ${isDark ? 'divide-white/[0.04]' : 'divide-slate-50'}`}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="grid grid-cols-12 items-center px-6 py-4 gap-3 animate-pulse"
                  style={{ animationDelay: `${i * 0.07}s` }}>
                  <div className="col-span-5 flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isDark ? 'bg-white/10' : 'bg-slate-100'}`} />
                    <div className={`w-3 h-3 rounded flex-shrink-0 ${isDark ? 'bg-white/[0.06]' : 'bg-slate-100'}`} />
                    <div className="flex-1 space-y-1.5">
                      <div className={`h-3.5 rounded-lg w-1/2 ${isDark ? 'bg-white/[0.07]' : 'bg-slate-100'}`} />
                      <div className={`h-2.5 rounded-md w-2/3 ${isDark ? 'bg-white/[0.04]' : 'bg-slate-50'}`} />
                    </div>
                  </div>
                  <div className="col-span-2 flex justify-center">
                    <div className={`h-6 w-20 rounded-full ${isDark ? 'bg-white/[0.06]' : 'bg-slate-100'}`} />
                  </div>
                  <div className="col-span-3 flex justify-center gap-2">
                    <div className={`h-5 w-12 rounded ${isDark ? 'bg-white/[0.06]' : 'bg-slate-100'}`} />
                    <div className={`h-5 w-12 rounded ${isDark ? 'bg-white/[0.04]' : 'bg-slate-50'}`} />
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <div className={`h-3 w-12 rounded ${isDark ? 'bg-white/[0.04]' : 'bg-slate-50'}`} />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center
                ${isDark ? 'bg-red-500/10' : 'bg-red-50'}`}>
                <XCircle size={22} className={isDark ? 'text-red-400' : 'text-red-500'} />
              </div>
              <div className="text-center">
                <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>Failed to load history</p>
                <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{error}</p>
              </div>
              <button onClick={fetchJobs}
                className="text-sm text-blue-500 hover:text-blue-400 font-medium">Retry</button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center
                ${isDark ? 'bg-white/[0.04]' : 'bg-slate-50'}`}>
                <Clock size={24} className={`${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
              </div>
              <div className="text-center">
                <p className={`text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  {search || filter !== 'all' ? 'No matching scans' : 'No scan history yet'}
                </p>
                <p className={`text-xs mt-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                  {search || filter !== 'all'
                    ? 'Try adjusting your search or filter.'
                    : 'Your completed scans will appear here.'}
                </p>
              </div>
              {!search && filter === 'all' && (
                <button
                  onClick={() => navigate('/scan')}
                  className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-blue-500 hover:text-blue-400 transition-colors">
                  Start your first scan <ChevronRight size={14} />
                </button>
              )}
            </div>
          ) : (
            <div className={`divide-y ${isDark ? 'divide-white/[0.04]' : 'divide-slate-50/80'}`}>
              {filtered.map((job, idx) => {
                const conf       = STATUS_CONF[job.status] || STATUS_CONF.queued;
                const { icon: Icon, cls, bg, dot, label, spin } = conf;
                const isViewable = job.status === 'completed' || job.status === 'partial';
                const SrcIcon    = job.source_type === 'github' ? Github : FileArchive;
                const total      = job.total_vulnerabilities || 0;
                const crit  = job.critical_count  || 0;
                const high  = job.high_count       || 0;
                const med   = job.medium_count     || 0;
                const low   = job.low_count        || 0;
                const hasFindings = total > 0;

                return (
                  <div
                    key={job.job_id}
                    onClick={() => isViewable && loadReport(job.job_id)}
                    style={{
                      animationDelay: `${idx * 0.04}s`,
                      borderLeft: `3px solid ${conf.color}${isViewable ? (isDark ? '99' : 'b3') : '40'}`,
                    }}
                    className={`group transition-all duration-150 animate-fade-in-up
                      ${isViewable
                        ? isDark
                          ? 'hover:bg-white/[0.04] cursor-pointer'
                          : 'hover:bg-indigo-50/40 cursor-pointer'
                        : 'opacity-75'
                      }`}
                  >
                    {/* Row content */}
                    <div className="grid grid-cols-12 items-center px-6 py-5">

                    {/* Repository */}
                    <div className="col-span-5 flex items-center gap-3 min-w-0">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0
                        ${isDark ? 'bg-white/[0.04]' : 'bg-slate-50'}`}>
                        <SrcIcon size={12} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
                      </div>
                      <div className="min-w-0">
                        <p className={`text-sm font-semibold truncate transition-colors
                          ${isDark
                            ? 'text-slate-200 group-hover:text-white'
                            : 'text-slate-700 group-hover:text-slate-900'}`}>
                          {job.repository_name || job.job_id.slice(0, 20)}
                        </p>
                        <p className={`text-[10px] font-mono truncate ${isDark ? 'text-slate-700' : 'text-slate-300'}`}>
                          {job.job_id.slice(0, 20)}…
                        </p>
                      </div>
                    </div>

                    {/* Status */}
                    <div className="col-span-2 flex justify-center">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1
                                       rounded-full font-semibold border ${bg} ${cls}
                                       ${isDark ? 'border-current/20' : 'border-current/15'}`}
                        style={{ borderColor: 'currentColor', borderOpacity: 0.2 }}>
                        <Icon size={10} className={spin ? 'animate-spin' : ''} />
                        {label}{job.status === 'running' && job.progress != null ? ` ${job.progress}%` : ''}
                      </span>
                    </div>

                    {/* Findings */}
                    <div className="col-span-3 flex flex-col items-center gap-1.5">
                      {isViewable ? (
                        hasFindings ? (
                          <>
                            <div className="flex items-center gap-1">
                              {crit > 0 && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold
                                  ${isDark ? 'bg-red-500/15 text-red-400' : 'bg-red-50 text-red-700'}`}>C:{crit}</span>
                              )}
                              {high > 0 && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold
                                  ${isDark ? 'bg-orange-500/15 text-orange-400' : 'bg-orange-50 text-orange-700'}`}>H:{high}</span>
                              )}
                              {med > 0 && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold
                                  ${isDark ? 'bg-yellow-500/15 text-yellow-400' : 'bg-yellow-50 text-yellow-700'}`}>M:{med}</span>
                              )}
                              {low > 0 && !crit && !high && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold
                                  ${isDark ? 'bg-blue-500/15 text-blue-400' : 'bg-blue-50 text-blue-700'}`}>L:{low}</span>
                              )}
                              <span className={`text-[10px] ml-0.5 font-medium ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                                /{total}
                              </span>
                            </div>
                            {/* Mini proportional bar */}
                            <div className="flex w-20 h-1 rounded-full overflow-hidden gap-px">
                              {crit > 0 && <div className="bg-red-500 h-full rounded-l-full" style={{ width: `${(crit/total)*100}%` }} />}
                              {high > 0 && <div className="bg-orange-400 h-full" style={{ width: `${(high/total)*100}%` }} />}
                              {med  > 0 && <div className="bg-yellow-400 h-full" style={{ width: `${(med/total)*100}%` }} />}
                              {low  > 0 && <div className="bg-blue-400 h-full rounded-r-full" style={{ width: `${(low/total)*100}%` }} />}
                            </div>
                          </>
                        ) : (
                          <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold
                            ${isDark ? 'bg-emerald-500/12 text-emerald-400' : 'bg-emerald-50 text-emerald-700'}`}>
                            ✓ Clean
                          </span>
                        )
                      ) : (
                        <span className={`text-xs ${isDark ? 'text-slate-700' : 'text-slate-200'}`}>—</span>
                      )}
                    </div>

                    {/* Time */}
                    <div className={`col-span-1 text-right text-[11px] font-medium
                      ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                      {relativeTime(job.created_at)}
                    </div>

                    {/* Arrow */}
                    <div className="col-span-1 flex justify-end">
                      {isViewable && (
                        <ChevronRight size={15}
                          className={`transition-all duration-150
                            ${isDark
                              ? 'text-slate-700 group-hover:text-blue-400 group-hover:translate-x-0.5'
                              : 'text-slate-200 group-hover:text-blue-500 group-hover:translate-x-0.5'}`} />
                      )}
                    </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer */}
          {!loading && !error && filtered.length > 0 && (
            <div className={`px-6 py-3 border-t flex items-center justify-between text-[11px] font-medium
              ${isDark ? 'border-white/[0.04] text-slate-600 bg-white/[0.015]' : 'border-slate-50 text-slate-400 bg-slate-50/40'}`}>
              <span>{filtered.length} scan{filtered.length !== 1 ? 's' : ''} shown</span>
              {totalVulns > 0 && (
                <span className="flex items-center gap-1">
                  <Shield size={11} />
                  {totalVulns.toLocaleString()} total findings
                  {critHighCount > 0 && (
                    <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold
                      ${isDark ? 'bg-orange-500/15 text-orange-400' : 'bg-orange-50 text-orange-600'}`}>
                      {critHighCount} crit+high
                    </span>
                  )}
                </span>
              )}
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
};

export default HistoryPage;
