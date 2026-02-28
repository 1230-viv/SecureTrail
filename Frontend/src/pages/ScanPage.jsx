import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Shield, Fingerprint, Eye, Lock, Zap, ArrowRight } from 'lucide-react';
import RepositoryUpload from '../components/RepositoryUpload';
import { useScan } from '../context/ScanContext';
import { useTheme } from '../context/ThemeContext';

const ENGINES = [
  {
    icon: Shield,
    engine: 'Semgrep',
    tag: 'SAST',
    color: 'violet',
    brief: 'Static analysis across 20+ languages — SQL injection, XSS, insecure deserialization, and 1 000+ patterns.',
  },
  {
    icon: Fingerprint,
    engine: 'Trivy',
    tag: 'SCA',
    color: 'blue',
    brief: 'Dependency audit against NVD · OSV · GitHub Advisory databases for known CVEs in third-party libraries.',
  },
  {
    icon: Eye,
    engine: 'Gitleaks',
    tag: 'Secrets',
    color: 'rose',
    brief: 'Entropy-based and pattern-matched detection of credentials, API tokens, private keys, and connection strings.',
  },
  {
    icon: Lock,
    engine: 'AC Analyzer',
    tag: 'Access',
    color: 'amber',
    brief: 'Structural analysis for broken authentication, IDOR, privilege escalation, and missing route-level middleware.',
  },
];

const TAG_CLS = {
  light: {
    violet: 'bg-violet-50 text-violet-600 ring-violet-500/20',
    blue:   'bg-blue-50   text-blue-600   ring-blue-500/20',
    rose:   'bg-rose-50   text-rose-600   ring-rose-500/20',
    amber:  'bg-amber-50  text-amber-600  ring-amber-500/20',
  },
  dark: {
    violet: 'bg-violet-500/10 text-violet-300 ring-violet-500/20',
    blue:   'bg-blue-500/10   text-blue-300   ring-blue-500/20',
    rose:   'bg-rose-500/10   text-rose-300   ring-rose-500/20',
    amber:  'bg-amber-500/10  text-amber-300  ring-amber-500/20',
  },
};

const ICON_CLS = {
  light: {
    violet: 'bg-violet-100 text-violet-600',
    blue:   'bg-blue-100   text-blue-600',
    rose:   'bg-rose-100   text-rose-600',
    amber:  'bg-amber-100  text-amber-600',
  },
  dark: {
    violet: 'bg-violet-500/15 text-violet-400',
    blue:   'bg-blue-500/15   text-blue-400',
    rose:   'bg-rose-500/15   text-rose-400',
    amber:  'bg-amber-500/15  text-amber-400',
  },
};

const ScanPage = () => {
  const navigate      = useNavigate();
  const { startScan } = useScan();
  const { isDark }    = useTheme();
  const mode = isDark ? 'dark' : 'light';

  return (
    <div className={`min-h-screen ${isDark ? 'bg-[#0d0f17]' : 'bg-[#f8f9fb]'}`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">

        {/* ── Back ─── */}
        <button
          onClick={() => navigate('/dashboard')}
          className={`group inline-flex items-center gap-1.5 text-xs font-medium mb-10
                     transition-colors
                     ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-700'}`}
        >
          <ChevronLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
          Dashboard
        </button>

        {/* ── Two-column layout ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start animate-fade-in-up">

          {/* ──────────── Left — upload ──────────────────────────────── */}
          <div className="lg:col-span-7">
            {/* Hero heading */}
            <div className="mb-8">
              <div className="flex items-center gap-2.5 mb-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center
                  ${isDark ? 'bg-blue-500/15' : 'bg-blue-100'}`}>
                  <Zap size={16} className={isDark ? 'text-blue-400' : 'text-blue-600'} />
                </div>
                <p className={`text-[10px] font-bold uppercase tracking-[0.15em]
                  ${isDark ? 'text-blue-400/70' : 'text-blue-600/70'}`}>
                  New Security Scan
                </p>
              </div>
              <h1 className={`text-3xl sm:text-[2rem] font-extrabold tracking-tight leading-tight
                ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Analyze your codebase
              </h1>
              <p className={`text-sm mt-3 leading-relaxed max-w-lg
                ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Upload a ZIP archive or connect your GitHub account. All four
                scan engines run in parallel — results are ready in under a minute.
              </p>
            </div>

            {/* Upload card */}
            <RepositoryUpload onScanStarted={startScan} />
          </div>

          {/* ──────────── Right — engine manifest ───────────────────── */}
          <div className="lg:col-span-5">
            <p className={`text-[10px] font-bold uppercase tracking-[0.15em] mb-4
              ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Scan Engines
            </p>
            <div className={`rounded-2xl overflow-hidden border
              ${isDark ? 'border-white/[0.06] bg-[#161929]' : 'border-slate-100 bg-white shadow-sm'}`}>
              <div className="stagger-children">
                {ENGINES.map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.engine}
                      className={`px-5 py-[18px] flex items-start gap-4 group transition-colors
                        ${isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50/70'}
                        ${i !== ENGINES.length - 1
                          ? isDark ? 'border-b border-white/[0.04]' : 'border-b border-slate-50'
                          : ''}`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5
                        ${ICON_CLS[mode][item.color]}`}>
                        <Icon size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                            {item.engine}
                          </span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ring-1 ring-inset
                            ${TAG_CLS[mode][item.color]}`}>
                            {item.tag}
                          </span>
                        </div>
                        <p className={`text-xs leading-relaxed
                          ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                          {item.brief}
                        </p>
                      </div>
                      <ArrowRight size={14}
                        className={`mt-3 flex-shrink-0 opacity-0 -translate-x-1
                          group-hover:opacity-40 group-hover:translate-x-0
                          transition-all duration-200
                          ${isDark ? 'text-slate-400' : 'text-slate-300'}`} />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Trust / security note */}
            <div className={`mt-5 rounded-xl px-4 py-3 flex items-start gap-3
              ${isDark ? 'bg-white/[0.02] border border-white/[0.04]' : 'bg-slate-50 border border-slate-100'}`}>
              <Shield size={14} className={`mt-0.5 flex-shrink-0 ${isDark ? 'text-emerald-500/60' : 'text-emerald-600/60'}`} />
              <p className={`text-[11px] leading-relaxed
                ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Scans run server-side in an isolated environment.
                ZIP files are archived to S3 after processing.
                No source code is stored long-term.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScanPage;
