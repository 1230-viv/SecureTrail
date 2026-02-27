import React, { useEffect, useRef, useState } from 'react';
import { Clock, CheckCircle2, XCircle, Loader2, AlertTriangle, Eye, Github, FileArchive } from 'lucide-react';
import { scanAPI } from '../services/api';

const POLL_INTERVAL = 10_000; // ms

// Status → display config
const STATUS_CONF = {
  completed: { icon: CheckCircle2, cls: 'text-green-600', bg: 'bg-green-100', label: 'Completed' },
  partial:   { icon: AlertTriangle, cls: 'text-amber-600', bg: 'bg-amber-100', label: 'Partial'   },
  failed:    { icon: XCircle,      cls: 'text-red-600',   bg: 'bg-red-100',   label: 'Failed'    },
  running:   { icon: Loader2,      cls: 'text-blue-600',  bg: 'bg-blue-100',  label: 'Running',  spin: true },
  queued:    { icon: Clock,        cls: 'text-gray-500',  bg: 'bg-gray-100',  label: 'Queued'    },
};

// The severity with the highest count drives the badge colour.
// Counts are exposed directly on the job object from the /jobs endpoint.
const dominantSeverity = (job) => {
  // Support both flat job fields (from /jobs list) and nested job.result (legacy)
  const src = (job.critical_count != null) ? job : (job.result || null);
  if (!src) return null;
  const { critical_count = 0, high_count = 0, medium_count = 0, low_count = 0 } = src;
  if (critical_count > 0) return { label: `${critical_count} Critical`, cls: 'bg-red-100 text-red-700' };
  if (high_count     > 0) return { label: `${high_count} High`,         cls: 'bg-orange-100 text-orange-700' };
  if (medium_count   > 0) return { label: `${medium_count} Medium`,     cls: 'bg-yellow-100 text-yellow-700' };
  if (low_count      > 0) return { label: `${low_count} Low`,           cls: 'bg-blue-100 text-blue-700' };
  return { label: 'Clean', cls: 'bg-green-100 text-green-700' };
};

const relativeTime = (ts) => {
  if (!ts) return '';
  // ts may be a Unix float (seconds) or ISO string
  const ms   = typeof ts === 'number' ? ts * 1000 : new Date(ts).getTime();
  const diff = Math.floor((Date.now() - ms) / 1000);
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

/**
 * RecentScans
 *
 * Props
 *   onViewReport(jobId)  — load and display results for a completed job
 *   activeJobId          — job currently running (highlight it)
 *   fullPage             — if true, show all jobs (no 5-item cap) and larger layout
 */
const RecentScans = ({ onViewReport, activeJobId, fullPage = false }) => {
  const [jobs,    setJobs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const pollRef = useRef(null);

  const fetchJobs = async (quiet = false) => {
    try {
      if (!quiet) setLoading(true);
      const { data } = await scanAPI.getJobs();
      // Backend may return array or { jobs: [] }
      const list = Array.isArray(data) ? data : (data.jobs || []);
      setJobs(list);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    pollRef.current = setInterval(() => fetchJobs(true), POLL_INTERVAL);
    return () => clearInterval(pollRef.current);
  }, []);

  // Re-fetch whenever activeJobId changes (new scan just started)
  useEffect(() => {
    if (activeJobId) fetchJobs(true);
  }, [activeJobId]);

  const displayed = fullPage ? jobs : jobs.slice(0, 5);

  return (
    <div className={`bg-white rounded-lg shadow-md p-6 ${fullPage ? '' : ''}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-800">
          {fullPage ? 'All Scan Jobs' : 'Recent Scans'}
        </h2>
        <button
          onClick={() => fetchJobs()}
          className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded px-2 py-0.5 hover:bg-gray-50 transition-colors"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 gap-2 text-gray-400">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-sm">Loading jobs…</span>
        </div>
      ) : error ? (
        <div className="text-center py-8 text-sm text-red-500">
          <XCircle size={24} className="mx-auto mb-2" />
          {error}
        </div>
      ) : displayed.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <Clock size={28} className="mx-auto mb-2" />
          <p className="text-sm">No scan jobs yet</p>
          <p className="text-xs mt-1">Upload a repository to start scanning</p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayed.map(job => {
            const conf = STATUS_CONF[job.status] || STATUS_CONF.queued;
            const { icon: Icon, cls, bg, label, spin } = conf;
            const isActive   = job.job_id === activeJobId;
            const isViewable = job.status === 'completed' || job.status === 'partial';
            const sev        = isViewable ? dominantSeverity(job) : null;
            const sourceIcon = job.source_type === 'github' ? Github : FileArchive;
            const SourceIcon = sourceIcon;

            return (
              <div
                key={job.job_id}
                onClick={() => isViewable && onViewReport?.(job.job_id)}
                className={`group px-4 py-3 rounded-lg border transition-all
                  ${isActive
                    ? 'border-blue-300 bg-blue-50'
                    : isViewable
                      ? 'border-gray-200 hover:border-blue-300 hover:bg-blue-50 cursor-pointer'
                      : 'border-gray-200 bg-gray-50'}`}
              >
                <div className="flex items-center gap-3">
                  {/* Status icon */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${bg}`}>
                    <Icon size={16} className={`${cls} ${spin ? 'animate-spin' : ''}`} />
                  </div>

                  {/* Name + meta */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <SourceIcon size={13} className="text-gray-400 flex-shrink-0" />
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {job.repository_name || job.job_id.slice(0, 16)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-400">{relativeTime(job.created_at)}</span>
                      {job.status === 'running' && (
                        <span className="text-xs text-blue-600 font-medium">{job.progress ?? 0}%</span>
                      )}
                    </div>
                  </div>

                  {/* Right badges */}
                  <div className="flex flex-col items-end gap-1">
                    {sev && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sev.cls}`}>
                        {sev.label}
                      </span>
                    )}
                    {!sev && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${bg} ${cls} font-medium`}>
                        {label}
                      </span>
                    )}
                    {isViewable && (
                      <span className="text-xs text-blue-500 opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
                        <Eye size={11} /> View
                      </span>
                    )}
                  </div>
                </div>

                {/* Running progress bar */}
                {job.status === 'running' && (
                  <div className="mt-2 w-full bg-gray-200 rounded-full h-1 overflow-hidden">
                    <div
                      className="h-1 bg-blue-500 rounded-full transition-all duration-700"
                      style={{ width: `${job.progress ?? 0}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}

          {/* "See all" link on dashboard sidebar */}
          {!fullPage && jobs.length > 5 && (
            <p className="text-xs text-center text-blue-500 hover:underline cursor-pointer pt-1">
              +{jobs.length - 5} more jobs
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default RecentScans;

