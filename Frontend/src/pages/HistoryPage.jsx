import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock, CheckCircle2, XCircle, Loader2, AlertTriangle,
  Eye, Github, FileArchive, RefreshCw, Search,
  Shield,
} from 'lucide-react';
import { scanAPI } from '../services/api';
import { useScan } from '../context/ScanContext';
import { useTheme } from '../context/ThemeContext';

const STATUS_CONF = {
  completed: { icon: CheckCircle2, cls: 'text-green-600 dark:text-green-400',  bg: 'bg-green-50 dark:bg-green-500/10',  dot: 'bg-green-500',  label: 'Completed' },
  partial:   { icon: AlertTriangle, cls: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10',  dot: 'bg-amber-500',  label: 'Partial'   },
  failed:    { icon: XCircle,       cls: 'text-red-600 dark:text-red-400',   bg: 'bg-red-50 dark:bg-red-500/10',    dot: 'bg-red-500',    label: 'Failed'    },
  running:   { icon: Loader2,       cls: 'text-blue-600 dark:text-blue-400',  bg: 'bg-blue-50 dark:bg-blue-500/10',   dot: 'bg-blue-500',   label: 'Running', spin: true },
  queued:    { icon: Clock,         cls: 'text-gray-500 dark:text-gray-400',  bg: 'bg-gray-50 dark:bg-gray-500/10',   dot: 'bg-gray-400',   label: 'Queued'    },
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

  const totalVulns = filtered
    .filter(j => j.status === 'completed' || j.status === 'partial')
    .reduce((s, j) => s + (j.total_vulnerabilities || 0), 0);

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-2xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>Scan History</h1>
          <p className={`text-sm mt-1 ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
            {loading ? 'Loading…' : `${jobs.length} total scan${jobs.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={fetchJobs}
          disabled={loading}
          className={`flex items-center gap-2 px-4 py-2 text-sm border rounded-xl transition-colors
                     disabled:opacity-50 shadow-sm
                     ${isDark
                       ? 'border-white/10 text-slate-300 hover:bg-white/5 bg-[#161929]'
                       : 'border-gray-200 text-gray-600 hover:bg-gray-50 bg-white'}`}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Search + Filter bar */}
      <div className={`rounded-xl shadow-sm border px-4 py-3 flex flex-wrap items-center gap-4
        ${isDark ? 'bg-[#161929] border-white/5' : 'bg-white border-gray-100'}`}>
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={13} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-gray-400'}`} />
          <input
            type="text"
            placeholder="Search by repository name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={`w-full pl-8 pr-3 py-2 text-sm border rounded-lg
                       focus:outline-none focus:ring-2 focus:ring-blue-500
                       ${isDark
                         ? 'border-white/10 bg-white/5 text-white placeholder-slate-500'
                         : 'border-gray-200 bg-gray-50 text-gray-900 placeholder-gray-400'}`}
          />
        </div>
        <div className="flex gap-1.5">
          {FILTERS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors
                ${filter === opt.value
                  ? 'bg-blue-600 text-white'
                  : isDark
                    ? 'text-slate-400 hover:bg-white/5'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className={`rounded-xl shadow-sm border overflow-hidden
        ${isDark ? 'bg-[#161929] border-white/5' : 'bg-white border-gray-100'}`}>
        {/* Column headers */}
        <div className={`hidden sm:grid grid-cols-12 px-6 py-3 border-b
                        text-xs font-semibold uppercase tracking-wider
                        ${isDark
                          ? 'bg-white/[0.02] border-white/5 text-slate-500'
                          : 'bg-gray-50 border-gray-100 text-gray-400'}`}>
          <div className="col-span-5">Repository</div>
          <div className="col-span-2 text-center">Status</div>
          <div className="col-span-3 text-center">Findings</div>
          <div className="col-span-1 text-right">Scanned</div>
          <div className="col-span-1" />
        </div>

        {/* Body */}
        {loading ? (
          <div className={`flex items-center justify-center py-16 gap-2
            ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
            <Loader2 size={20} className="animate-spin" />
            <span className="text-sm">Loading scan history…</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 text-red-500">
            <XCircle size={28} className="mb-2" />
            <p className="text-sm font-medium">Failed to load history</p>
            <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>{error}</p>
            <button onClick={fetchJobs}
              className="mt-3 text-sm text-blue-600 hover:underline">Retry</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className={`flex flex-col items-center justify-center py-16
            ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
            <Clock size={32} className="mb-3 opacity-30" />
            <p className="text-sm font-medium">
              {search || filter !== 'all' ? 'No matching scans found' : 'No scan history yet'}
            </p>
            <p className="text-xs mt-1">
              {search || filter !== 'all'
                ? 'Try adjusting your search or filters.'
                : 'Your completed scans will appear here.'}
            </p>
            {!search && filter === 'all' && (
              <button
                onClick={() => navigate('/scan')}
                className="mt-4 text-sm text-blue-600 hover:underline"
              >Start your first scan →</button>
            )}
          </div>
        ) : (
          <div className={`divide-y ${isDark ? 'divide-white/5' : 'divide-gray-50'}`}>
            {filtered.map(job => {
              const conf       = STATUS_CONF[job.status] || STATUS_CONF.queued;
              const { icon: Icon, cls, bg, dot, label, spin } = conf;
              const isViewable = job.status === 'completed' || job.status === 'partial';
              const SrcIcon    = job.source_type === 'github' ? Github : FileArchive;

              return (
                <div
                  key={job.job_id}
                  onClick={() => isViewable && loadReport(job.job_id)}
                  className={`group grid grid-cols-12 items-center px-6 py-4 transition-colors
                    ${isViewable
                      ? isDark
                        ? 'hover:bg-white/[0.03] cursor-pointer'
                        : 'hover:bg-blue-50/40 cursor-pointer'
                      : 'opacity-80'
                    }`}
                >
                  {/* Repository */}
                  <div className="col-span-5 flex items-center gap-3 min-w-0">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
                    <SrcIcon size={13} className={`flex-shrink-0 ${isDark ? 'text-slate-600' : 'text-gray-300'}`} />
                    <div className="min-w-0">
                      <p className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-gray-800'}`}>
                        {job.repository_name || job.job_id.slice(0, 20)}
                      </p>
                      <p className={`text-xs font-mono truncate ${isDark ? 'text-slate-600' : 'text-gray-400'}`}>
                        {job.job_id.slice(0, 18)}…
                      </p>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="col-span-2 flex justify-center">
                    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1
                                     rounded-full font-medium ${bg} ${cls}`}>
                      <Icon size={11} className={spin ? 'animate-spin' : ''} />
                      {label}
                      {job.status === 'running' && job.progress != null
                        ? ` ${job.progress}%` : ''}
                    </span>
                  </div>

                  {/* Findings */}
                  <div className="col-span-3 flex justify-center items-center gap-1.5">
                    {isViewable ? (
                      <>
                        {(job.critical_count || 0) > 0 && (
                          <span className={`text-xs px-2 py-0.5 rounded font-semibold
                            ${isDark ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-700'}`}>
                            C:{job.critical_count}
                          </span>
                        )}
                        {(job.high_count || 0) > 0 && (
                          <span className={`text-xs px-2 py-0.5 rounded font-semibold
                            ${isDark ? 'bg-orange-500/10 text-orange-400' : 'bg-orange-50 text-orange-700'}`}>
                            H:{job.high_count}
                          </span>
                        )}
                        {(job.medium_count || 0) > 0 && (
                          <span className={`text-xs px-2 py-0.5 rounded font-medium
                            ${isDark ? 'bg-yellow-500/10 text-yellow-400' : 'bg-yellow-50 text-yellow-700'}`}>
                            M:{job.medium_count}
                          </span>
                        )}
                        {(job.total_vulnerabilities || 0) === 0 && (
                          <span className={`text-xs px-2 py-0.5 rounded font-medium
                            ${isDark ? 'bg-green-500/10 text-green-400' : 'bg-green-50 text-green-700'}`}>
                            Clean
                          </span>
                        )}
                      </>
                    ) : (
                      <span className={`text-xs ${isDark ? 'text-slate-600' : 'text-gray-300'}`}>—</span>
                    )}
                  </div>

                  {/* Time */}
                  <div className={`col-span-1 text-right text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                    {relativeTime(job.created_at)}
                  </div>

                  {/* View icon */}
                  <div className="col-span-1 flex justify-end">
                    {isViewable && (
                      <Eye size={14}
                        className={`transition-colors
                          ${isDark
                            ? 'text-slate-600 group-hover:text-blue-400'
                            : 'text-gray-200 group-hover:text-blue-500'}`} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        {!loading && !error && filtered.length > 0 && (
          <div className={`px-6 py-3 border-t flex items-center justify-between text-xs
            ${isDark
              ? 'bg-white/[0.02] border-white/5 text-slate-500'
              : 'bg-gray-50 border-gray-100 text-gray-400'}`}>
            <span>{filtered.length} scan{filtered.length !== 1 ? 's' : ''} shown</span>
            {totalVulns > 0 && <span>{totalVulns} vulnerabilities across completed scans</span>}
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryPage;
