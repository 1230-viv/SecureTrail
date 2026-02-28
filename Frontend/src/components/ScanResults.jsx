import React, { useMemo, useState } from 'react';
import {
  ShieldAlert, Bug, Search, SlidersHorizontal,
  ChevronDown, Download, RotateCcw, CheckCircle2, XCircle, AlertTriangle,
  Brain, Loader2, BarChart3,
} from 'lucide-react';
import VulnerabilityCard from './VulnerabilityCard';
import { useTheme } from '../context/ThemeContext';

/* ── Severity config ───────────────────────────────────────────────────────── */
const SEV_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO', 'UNKNOWN'];

const SEV_STYLE = {
  CRITICAL: { bg: 'bg-red-500',    ring: 'ring-red-500/20',    lightBg: 'bg-red-50',    darkBg: 'bg-red-500/10',    lightText: 'text-red-700',    darkText: 'text-red-400' },
  HIGH:     { bg: 'bg-orange-500', ring: 'ring-orange-500/20', lightBg: 'bg-orange-50', darkBg: 'bg-orange-500/10', lightText: 'text-orange-700', darkText: 'text-orange-400' },
  MEDIUM:   { bg: 'bg-yellow-500', ring: 'ring-yellow-500/20', lightBg: 'bg-yellow-50', darkBg: 'bg-yellow-500/10', lightText: 'text-yellow-700', darkText: 'text-yellow-400' },
  LOW:      { bg: 'bg-blue-500',   ring: 'ring-blue-500/20',   lightBg: 'bg-blue-50',   darkBg: 'bg-blue-500/10',   lightText: 'text-blue-700',   darkText: 'text-blue-400' },
  INFO:     { bg: 'bg-slate-400',  ring: 'ring-slate-400/20',  lightBg: 'bg-slate-50',  darkBg: 'bg-slate-500/10',  lightText: 'text-slate-600',  darkText: 'text-slate-400' },
  UNKNOWN:  { bg: 'bg-slate-300',  ring: 'ring-slate-300/20',  lightBg: 'bg-slate-50',  darkBg: 'bg-slate-500/10',  lightText: 'text-slate-500',  darkText: 'text-slate-500' },
};

const SCANNER_STYLE_L = {
  semgrep:             'bg-violet-50 text-violet-700 border-violet-200',
  trivy:               'bg-blue-50   text-blue-700   border-blue-200',
  gitleaks:            'bg-rose-50   text-rose-700   border-rose-200',
  internal_auth:       'bg-teal-50   text-teal-700   border-teal-200',
  internal_cors:       'bg-teal-50   text-teal-700   border-teal-200',
  internal_jwt:        'bg-teal-50   text-teal-700   border-teal-200',
  internal_rate_limit: 'bg-teal-50   text-teal-700   border-teal-200',
  internal_file_upload:'bg-teal-50   text-teal-700   border-teal-200',
};
const SCANNER_STYLE_D = {
  semgrep:             'bg-violet-500/10 text-violet-300 border-violet-500/20',
  trivy:               'bg-blue-500/10   text-blue-300   border-blue-500/20',
  gitleaks:            'bg-rose-500/10   text-rose-300   border-rose-500/20',
  internal_auth:       'bg-teal-500/10   text-teal-300   border-teal-500/20',
  internal_cors:       'bg-teal-500/10   text-teal-300   border-teal-500/20',
  internal_jwt:        'bg-teal-500/10   text-teal-300   border-teal-500/20',
  internal_rate_limit: 'bg-teal-500/10   text-teal-300   border-teal-500/20',
  internal_file_upload:'bg-teal-500/10   text-teal-300   border-teal-500/20',
};

const SORT_OPTIONS = [
  { value: 'severity', label: 'Severity' },
  { value: 'score',    label: 'Exploit Score' },
  { value: 'source',   label: 'Scanner' },
  { value: 'file',     label: 'File Path' },
];

/* ── Severity Pill ─────────────────────────────────────────────────────────── */
const SeverityPill = ({ label, count, active, onClick, isDark }) => {
  const s = SEV_STYLE[label] || SEV_STYLE.UNKNOWN;
  return (
    <button onClick={onClick}
      className={`group flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ring-1 ring-inset
        ${active
          ? `${isDark ? s.darkBg : s.lightBg} ${isDark ? s.darkText : s.lightText} ${s.ring} ring-2`
          : isDark
            ? 'bg-white/[0.03] ring-white/[0.06] text-slate-500 hover:bg-white/[0.05]'
            : 'bg-white ring-slate-100 text-slate-400 shadow-sm hover:ring-slate-200'}`}
    >
      <span className={`w-2 h-2 rounded-full ${s.bg}`} />
      {label}
      <span className={`font-bold ${active ? '' : isDark ? 'text-slate-300' : 'text-slate-700'}`}>{count}</span>
    </button>
  );
};

/* ── Scanner Badge ─────────────────────────────────────────────────────────── */
const ScannerBadge = ({ name, findings, status, isDark }) => {
  const styles = isDark ? SCANNER_STYLE_D : SCANNER_STYLE_L;
  const cls = styles[name] || (isDark ? 'bg-white/5 text-slate-400 border-white/10' : 'bg-gray-50 text-gray-600 border-gray-200');
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium ${cls}`}>
      {status === 'ok' ? <CheckCircle2 size={13} /> : status === 'error' ? <XCircle size={13} /> :
       status === 'warning' ? <AlertTriangle size={13} /> : <ShieldAlert size={13} />}
      <span className="capitalize">{name.replace('_', ' ')}</span>
      {findings != null && <span className="font-bold ml-0.5">{findings}</span>}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════ */
const ScanResults = ({ report, onNewScan }) => {
  const [search,      setSearch]      = useState('');
  const [filterSev,   setFilterSev]   = useState('ALL');
  const [filterSrc,   setFilterSrc]   = useState('ALL');
  const [sortBy,      setSortBy]      = useState('severity');
  const [showFilters, setShowFilters] = useState(false);
  const { isDark }                    = useTheme();

  const vulns = report?.vulnerabilities || [];

  const sources = useMemo(() =>
    ['ALL', ...new Set(vulns.map(v => v.source).filter(Boolean))], [vulns]);

  const filtered = useMemo(() => {
    let list = vulns;
    if (filterSev !== 'ALL') list = list.filter(v => (v.severity || 'UNKNOWN').toUpperCase() === filterSev);
    if (filterSrc !== 'ALL') list = list.filter(v => v.source === filterSrc);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(v =>
        (v.title || '').toLowerCase().includes(q) ||
        (v.type  || '').toLowerCase().includes(q) ||
        (v.file  || '').toLowerCase().includes(q) ||
        (v.description || '').toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      switch (sortBy) {
        case 'severity':
          return SEV_ORDER.indexOf((a.severity || 'UNKNOWN').toUpperCase()) - SEV_ORDER.indexOf((b.severity || 'UNKNOWN').toUpperCase());
        case 'score':
          return (b.exploitability?.score ?? 0) - (a.exploitability?.score ?? 0);
        case 'source':
          return (a.source || '').localeCompare(b.source || '');
        case 'file':
          return (a.file || '').localeCompare(b.file || '');
        default: return 0;
      }
    });
  }, [vulns, filterSev, filterSrc, search, sortBy]);

  const scannerMeta = useMemo(() => {
    const meta = report?.scanner_results || {};
    return ['semgrep', 'trivy', 'gitleaks'].map(name => {
      const m = meta[name] || {};
      return { name, findings: vulns.filter(v => v.source === name).length, status: m.error ? 'error' : m.warnings?.length ? 'warning' : 'ok' };
    });
  }, [report, vulns]);

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
  const aiPending = !!report.ai_pending;

  return (
    <div className="space-y-5 animate-fade-in-up">

      {/* ── AI Analysis banner ─────────────────────────────────────────── */}
      {aiPending && (
        <div className={`rounded-2xl px-5 py-3.5 flex items-center gap-3 border backdrop-blur-xl
          ${isDark
            ? 'bg-indigo-500/[0.06] border-indigo-500/20 shadow-[0_4px_24px_rgba(99,102,241,0.08)]'
            : 'bg-indigo-50/60 border-indigo-200/60 shadow-[0_4px_24px_rgba(99,102,241,0.06)]'}`}>
          <div className="relative flex-shrink-0">
            <Brain size={18} className={isDark ? 'text-indigo-400' : 'text-indigo-600'} />
            <Loader2 size={10} className={`absolute -bottom-0.5 -right-0.5 animate-spin ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
          </div>
          <span className={`text-sm font-medium ${isDark ? 'text-indigo-300' : 'text-indigo-700'}`}>
            AI analysis in progress — explanations will appear on each card as they complete
          </span>
        </div>
      )}

      {/* ── Header Card ────────────────────────────────────────────────── */}
      <div className={`rounded-2xl overflow-hidden border backdrop-blur-xl
        ${isDark
          ? 'bg-white/[0.03] border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.3)]'
          : 'bg-white/70 border-white/60 shadow-[0_8px_32px_rgba(99,102,241,0.08)]'}`}>

        {/* Gradient accent stripe */}
        <div className="h-1 bg-gradient-to-r from-blue-500 via-violet-500 to-rose-500" />

        <div className="p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center
                  ${isDark ? 'bg-blue-500/15' : 'bg-blue-50'}`}>
                  <BarChart3 size={16} className={isDark ? 'text-blue-400' : 'text-blue-600'} />
                </div>
                <h2 className={`text-xl font-bold tracking-tight
                  ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {report.repository_name}
                </h2>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ring-1 ring-inset
                  ${report.status === 'completed'
                    ? isDark ? 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20' : 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                    : report.status === 'partial'
                      ? isDark ? 'bg-amber-500/10 text-amber-400 ring-amber-500/20' : 'bg-amber-50 text-amber-700 ring-amber-200'
                      : isDark ? 'bg-red-500/10 text-red-400 ring-red-500/20' : 'bg-red-50 text-red-700 ring-red-200'}`}>
                  {report.status}
                </span>
              </div>
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Scanned {new Date(report.scan_timestamp).toLocaleString()} · Job <span className="font-mono">{report.job_id.slice(0, 8)}</span>
              </p>
            </div>

            <div className="flex gap-2">
              <button onClick={handleExport}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium transition-all backdrop-blur-md
                  ${isDark
                    ? 'bg-white/[0.04] text-slate-300 hover:bg-white/[0.07] ring-1 ring-white/[0.08]'
                    : 'bg-white/60 text-slate-600 hover:bg-white/80 ring-1 ring-white/60'}`}>
                <Download size={14} /> Export
              </button>
              <button onClick={onNewScan}
                className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-xs font-semibold
                  hover:from-blue-500 hover:to-indigo-500 transition-all shadow-lg shadow-blue-500/20">
                <RotateCcw size={14} /> New Scan
              </button>
            </div>
          </div>

          {/* Severity pills */}
          <div className="mt-5 flex flex-wrap gap-2">
            <button onClick={() => setFilterSev('ALL')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ring-1 ring-inset
                ${filterSev === 'ALL'
                  ? isDark ? 'bg-white text-slate-900 ring-white' : 'bg-slate-900 text-white ring-slate-900'
                  : isDark ? 'bg-white/[0.03] ring-white/[0.06] text-slate-500 hover:bg-white/[0.05]' : 'bg-white ring-slate-100 text-slate-400 shadow-sm hover:ring-slate-200'}`}>
              All <span className="font-bold">{report.total_vulnerabilities}</span>
            </button>
            {[
              { key: 'CRITICAL', count: report.critical_count },
              { key: 'HIGH',     count: report.high_count },
              { key: 'MEDIUM',   count: report.medium_count },
              { key: 'LOW',      count: report.low_count },
              { key: 'INFO',     count: report.info_count },
            ].filter(x => x.count > 0).map(({ key, count }) => (
              <SeverityPill key={key} label={key} count={count}
                active={filterSev === key} isDark={isDark}
                onClick={() => setFilterSev(filterSev === key ? 'ALL' : key)} />
            ))}
          </div>

          {/* Scanner badges */}
          <div className="mt-4 flex flex-wrap gap-2">
            {scannerMeta.map(m => <ScannerBadge key={m.name} {...m} isDark={isDark} />)}
          </div>

          {/* Scan errors */}
          {report.scan_errors?.length > 0 && (
            <div className={`mt-4 rounded-xl p-3
              ${isDark ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-amber-50 border border-amber-200'}`}>
              <p className={`text-xs font-semibold flex items-center gap-1 mb-1
                ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
                <AlertTriangle size={13} /> Scanner Warnings
              </p>
              <ul className={`text-xs space-y-0.5 list-disc list-inside ${isDark ? 'text-amber-400/80' : 'text-amber-700/80'}`}>
                {report.scan_errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* ── Filter Bar ─────────────────────────────────────────────────── */}
      <div className={`rounded-2xl p-4 border backdrop-blur-xl
        ${isDark
          ? 'bg-white/[0.03] border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.3)]'
          : 'bg-white/70 border-white/60 shadow-[0_8px_32px_rgba(99,102,241,0.08)]'}`}>
        <div className="flex gap-3 items-center flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className={`absolute left-3 top-1/2 -translate-y-1/2
              ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
            <input type="text" placeholder="Search findings…" value={search}
              onChange={e => setSearch(e.target.value)}
              className={`w-full pl-9 pr-4 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all backdrop-blur-md
                ${isDark
                  ? 'bg-white/[0.04] text-white placeholder-slate-600 ring-1 ring-white/[0.08]'
                  : 'bg-white/50 text-slate-900 placeholder-slate-300 ring-1 ring-white/60'}`} />
          </div>

          {/* Filter toggle */}
          <button onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium transition-colors ring-1 ring-inset
              ${showFilters
                ? isDark ? 'bg-blue-500/10 ring-blue-500/20 text-blue-400' : 'bg-blue-50 ring-blue-200 text-blue-700'
                : isDark ? 'bg-white/[0.03] ring-white/[0.06] text-slate-400 hover:bg-white/[0.05]' : 'bg-white ring-slate-200 text-slate-500 hover:ring-slate-300'}`}>
            <SlidersHorizontal size={14} /> Filters
            {(filterSev !== 'ALL' || filterSrc !== 'ALL') && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
          </button>

          {/* Sort */}
          <div className="relative">
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
              className={`appearance-none pl-3 pr-8 py-2 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/40 ring-1 ring-inset backdrop-blur-md
                ${isDark
                  ? 'bg-white/[0.04] ring-white/[0.08] text-white'
                  : 'bg-white/60 ring-white/60 text-slate-700'}`}>
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <ChevronDown size={13} className={`absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none
              ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
          </div>

          <span className={`text-xs ml-auto tabular-nums ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
            {filtered.length}/{vulns.length}
          </span>
        </div>

        {/* Extended filters */}
        {showFilters && (
          <div className={`mt-3 pt-3 border-t flex gap-2 flex-wrap items-center animate-slide-down
            ${isDark ? 'border-white/[0.04]' : 'border-slate-50'}`}>
            <span className={`text-[10px] font-bold uppercase tracking-[0.12em] mr-1
              ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>Scanner</span>
            {sources.map(src => (
              <button key={src} onClick={() => setFilterSrc(src)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ring-1 ring-inset capitalize
                  ${filterSrc === src
                    ? 'bg-blue-600 text-white ring-blue-600'
                    : isDark ? 'ring-white/[0.06] text-slate-400 hover:bg-white/[0.04]' : 'ring-slate-200 text-slate-500 hover:ring-slate-300'}`}>
                {src === 'ALL' ? 'All' : src.replace('_', ' ')}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Vulnerability list ─────────────────────────────────────────── */}
      <div className="space-y-3 stagger-children">
        {filtered.length === 0 ? (
          <div className={`rounded-2xl border border-dashed py-16 text-center backdrop-blur-xl
            ${isDark ? 'bg-white/[0.02] border-white/[0.08]' : 'bg-white/50 border-slate-200/60'}`}>
            <Search size={32} className={`mx-auto mb-3 ${isDark ? 'text-slate-600' : 'text-slate-200'}`} />
            <p className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>No findings match your filters</p>
            <button onClick={() => { setSearch(''); setFilterSev('ALL'); setFilterSrc('ALL'); }}
              className="mt-3 text-xs text-blue-600 hover:underline">Clear filters</button>
          </div>
        ) : filtered.map(vuln => (
          <VulnerabilityCard key={vuln.id} vuln={vuln} aiPending={aiPending} />
        ))}
      </div>

      {/* ── Configuration Analysis ─────────────────────────────────────── */}
      {report.configuration_analysis && Object.keys(report.configuration_analysis).length > 0 && (
        <div className={`rounded-2xl p-6 border backdrop-blur-xl
          ${isDark
            ? 'bg-white/[0.03] border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.3)]'
            : 'bg-white/70 border-white/60 shadow-[0_8px_32px_rgba(99,102,241,0.08)]'}`}>
          <h3 className={`text-sm font-bold flex items-center gap-2 mb-4
            ${isDark ? 'text-white' : 'text-slate-800'}`}>
            <ShieldAlert size={16} className="text-teal-500" /> Configuration Analysis
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(report.configuration_analysis).map(([key, val]) => (
                <div key={key} className={`rounded-xl p-4 border backdrop-blur-md
                  ${isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white/50 border-white/60'}`}>
                <p className={`text-[10px] font-bold uppercase tracking-[0.1em] mb-1.5 capitalize
                  ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{key.replace(/_/g, ' ')}</p>
                {typeof val === 'object' ? (
                  <pre className={`text-xs overflow-x-auto whitespace-pre-wrap ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    {JSON.stringify(val, null, 2)}
                  </pre>
                ) : (
                  <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{String(val)}</p>
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
