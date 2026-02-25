import React, { useMemo, useState } from 'react';
import {
  ShieldAlert, Bug, Search, SlidersHorizontal,
  ChevronDown, Download, RotateCcw, CheckCircle2, XCircle, AlertTriangle,
} from 'lucide-react';
import VulnerabilityCard from './VulnerabilityCard';

// ── Severity config ───────────────────────────────────────────────────────────
const SEV_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO', 'UNKNOWN'];

const SEV_STYLE = {
  CRITICAL: { bg: 'bg-red-600',    light: 'bg-red-50    border-red-200',    text: 'text-red-700'    },
  HIGH:     { bg: 'bg-orange-500', light: 'bg-orange-50 border-orange-200', text: 'text-orange-700' },
  MEDIUM:   { bg: 'bg-yellow-400', light: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-700' },
  LOW:      { bg: 'bg-blue-400',   light: 'bg-blue-50   border-blue-200',   text: 'text-blue-700'   },
  INFO:     { bg: 'bg-gray-400',   light: 'bg-gray-50   border-gray-200',   text: 'text-gray-600'   },
  UNKNOWN:  { bg: 'bg-gray-300',   light: 'bg-gray-50   border-gray-200',   text: 'text-gray-500'   },
};

const SCANNER_STYLE = {
  semgrep:          'bg-purple-100 text-purple-700 border-purple-200',
  trivy:            'bg-orange-100 text-orange-700 border-orange-200',
  gitleaks:         'bg-red-100    text-red-700    border-red-200',
  internal_auth:    'bg-teal-100   text-teal-700   border-teal-200',
  internal_cors:    'bg-teal-100   text-teal-700   border-teal-200',
  internal_jwt:     'bg-teal-100   text-teal-700   border-teal-200',
  internal_rate_limit: 'bg-teal-100 text-teal-700 border-teal-200',
  internal_file_upload:'bg-teal-100 text-teal-700 border-teal-200',
};

const SORT_OPTIONS = [
  { value: 'severity',   label: 'Severity (worst first)' },
  { value: 'score',      label: 'Exploitability Score (highest first)' },
  { value: 'source',     label: 'Scanner' },
  { value: 'file',       label: 'File Path' },
];

// ── Sub-components ────────────────────────────────────────────────────────────
const SeverityPill = ({ label, count, active, onClick }) => {
  const s = SEV_STYLE[label] || SEV_STYLE.UNKNOWN;
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all
        ${active ? `${s.light} ${s.text} border-2` : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}
    >
      <span className={`w-2.5 h-2.5 rounded-full ${s.bg}`} />
      {label} <span className={`font-bold ${active ? s.text : 'text-gray-700'}`}>{count}</span>
    </button>
  );
};

const ScannerBadge = ({ name, findings, status }) => {
  const cls = SCANNER_STYLE[name] || 'bg-gray-100 text-gray-600 border-gray-200';
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium ${cls}`}>
      {status === 'ok'      ? <CheckCircle2 size={14} /> :
       status === 'error'   ? <XCircle size={14} /> :
       status === 'warning' ? <AlertTriangle size={14} /> : <ShieldAlert size={14} />}
      <span className="capitalize">{name.replace('_', ' ')}</span>
      {findings != null && <span className="font-bold">{findings}</span>}
    </div>
  );
};

// ── Main ──────────────────────────────────────────────────────────────────────
/**
 * ScanResults
 *
 * Props
 *   report    : ScanReport — the completed scan report
 *   onNewScan : () => void  — callback to start a new scan
 */
const ScanResults = ({ report, onNewScan }) => {
  const [search,      setSearch]      = useState('');
  const [filterSev,   setFilterSev]   = useState('ALL');
  const [filterSrc,   setFilterSrc]   = useState('ALL');
  const [sortBy,      setSortBy]      = useState('severity');
  const [showFilters, setShowFilters] = useState(false);

  const vulns = report?.vulnerabilities || [];

  // Unique sources present in this report
  const sources = useMemo(() =>
    ['ALL', ...new Set(vulns.map(v => v.source).filter(Boolean))],
    [vulns]
  );

  // Filtered + sorted list
  const filtered = useMemo(() => {
    let list = vulns;

    if (filterSev !== 'ALL') {
      list = list.filter(v => (v.severity || 'UNKNOWN').toUpperCase() === filterSev);
    }
    if (filterSrc !== 'ALL') {
      list = list.filter(v => v.source === filterSrc);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(v =>
        (v.title || '').toLowerCase().includes(q) ||
        (v.type  || '').toLowerCase().includes(q) ||
        (v.file  || '').toLowerCase().includes(q) ||
        (v.description || '').toLowerCase().includes(q)
      );
    }

    return [...list].sort((a, b) => {
      switch (sortBy) {
        case 'severity':
          return SEV_ORDER.indexOf((a.severity || 'UNKNOWN').toUpperCase())
               - SEV_ORDER.indexOf((b.severity || 'UNKNOWN').toUpperCase());
        case 'score':
          return (b.exploitability?.score ?? 0) - (a.exploitability?.score ?? 0);
        case 'source':
          return (a.source || '').localeCompare(b.source || '');
        case 'file':
          return (a.file || '').localeCompare(b.file || '');
        default:
          return 0;
      }
    });
  }, [vulns, filterSev, filterSrc, search, sortBy]);

  // Scanner-level status badges
  const scannerMeta = useMemo(() => {
    const meta = report?.scanner_results || {};
    const knownScanners = ['semgrep', 'trivy', 'gitleaks'];
    return knownScanners.map(name => {
      const m = meta[name] || {};
      const count = vulns.filter(v => v.source === name).length;
      const status = m.error ? 'error' : m.warnings?.length ? 'warning' : 'ok';
      return { name, findings: count, status };
    });
  }, [report, vulns]);

  // Export JSON
  const handleExport = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `securetrail-${report.repository_name}-${report.job_id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!report) return null;

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Bug size={22} className="text-blue-600" />
              {report.repository_name}
              <span className={`ml-2 text-sm px-2.5 py-0.5 rounded-full font-medium
                ${report.status === 'completed' ? 'bg-green-100 text-green-700'
                : report.status === 'partial'   ? 'bg-amber-100 text-amber-700'
                :                                  'bg-red-100   text-red-700'}`}>
                {report.status}
              </span>
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Scanned {new Date(report.scan_timestamp).toLocaleString()} ·
              Job <span className="font-mono">{report.job_id.slice(0, 8)}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              <Download size={16} /> Export JSON
            </button>
            <button onClick={onNewScan}
              className="flex items-center gap-2 px-4 py-2 bg-[#2D3748] text-white rounded-lg text-sm hover:bg-[#1A202C] transition-colors">
              <RotateCcw size={16} /> New Scan
            </button>
          </div>
        </div>

        {/* Severity summary pills */}
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            onClick={() => setFilterSev('ALL')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all
              ${filterSev === 'ALL' ? 'bg-gray-800 text-white border-gray-800' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}
          >
            All&nbsp;<span className="font-bold">{report.total_vulnerabilities}</span>
          </button>
          {[
            { key: 'CRITICAL', count: report.critical_count },
            { key: 'HIGH',     count: report.high_count     },
            { key: 'MEDIUM',   count: report.medium_count   },
            { key: 'LOW',      count: report.low_count      },
            { key: 'INFO',     count: report.info_count     },
          ].filter(x => x.count > 0).map(({ key, count }) => (
            <SeverityPill key={key} label={key} count={count}
              active={filterSev === key}
              onClick={() => setFilterSev(filterSev === key ? 'ALL' : key)} />
          ))}
        </div>

        {/* Scanner badges */}
        <div className="mt-4 flex flex-wrap gap-2">
          {scannerMeta.map(m => (
            <ScannerBadge key={m.name} {...m} />
          ))}
        </div>

        {/* Scan errors (if any) */}
        {report.scan_errors?.length > 0 && (
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-amber-700 mb-1 flex items-center gap-1">
              <AlertTriangle size={13} /> Scanner Warnings
            </p>
            <ul className="text-xs text-amber-700 space-y-0.5 list-disc list-inside">
              {report.scan_errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        )}
      </div>

      {/* ── Filters & sort bar ──────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex gap-3 items-center flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search findings…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm transition-colors
              ${showFilters ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
          >
            <SlidersHorizontal size={15} /> Filters
            {(filterSev !== 'ALL' || filterSrc !== 'ALL') && (
              <span className="w-2 h-2 rounded-full bg-blue-500" />
            )}
          </button>

          {/* Sort */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>

          <span className="text-sm text-gray-500 ml-auto">
            {filtered.length} of {vulns.length} findings
          </span>
        </div>

        {/* Extended filter row */}
        {showFilters && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex gap-3 flex-wrap items-center">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Scanner</span>
            {sources.map(src => (
              <button key={src}
                onClick={() => setFilterSrc(src)}
                className={`px-3 py-1 rounded-full text-xs border transition-colors capitalize
                  ${filterSrc === src
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-300 text-gray-600 hover:border-gray-400'}`}
              >
                {src === 'ALL' ? 'All Scanners' : src.replace('_', ' ')}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Vulnerability list ─────────────────────────────────────────── */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 py-16 text-center">
            <Search size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No findings match your filters</p>
            <button
              onClick={() => { setSearch(''); setFilterSev('ALL'); setFilterSrc('ALL'); }}
              className="mt-3 text-sm text-blue-600 hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          filtered.map(vuln => (
            <VulnerabilityCard key={vuln.id} vuln={vuln} />
          ))
        )}
      </div>

      {/* Configuration analysis */}
      {report.configuration_analysis && Object.keys(report.configuration_analysis).length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <ShieldAlert size={18} className="text-teal-600" />
            Configuration Analysis
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(report.configuration_analysis).map(([key, val]) => (
              <div key={key} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1 capitalize">
                  {key.replace(/_/g, ' ')}
                </p>
                {typeof val === 'object' ? (
                  <pre className="text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(val, null, 2)}
                  </pre>
                ) : (
                  <p className="text-sm text-gray-700">{String(val)}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ScanResults;
