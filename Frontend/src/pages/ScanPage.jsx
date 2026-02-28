import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Shield, Fingerprint, Eye, Lock, Zap,
  Sparkles, CheckCircle2, TrendingUp, Clock, Layers,
} from 'lucide-react';
import RepositoryUpload from '../components/RepositoryUpload';
import { useScan } from '../context/ScanContext';
import { useTheme } from '../context/ThemeContext';

/* ═══════════════════════════════════════════════════════
   ENGINE MANIFEST
   ═══════════════════════════════════════════════════════ */
const ENGINES = [
  {
    icon: Shield,
    engine: 'Semgrep',
    tag: 'SAST',
    color: '#8b5cf6',
    brief: 'Static analysis across 20+ languages — SQL injection, XSS, insecure deserialization, and 1 000+ patterns.',
  },
  {
    icon: Fingerprint,
    engine: 'Trivy',
    tag: 'SCA',
    color: '#3b82f6',
    brief: 'Dependency audit against NVD · OSV · GitHub Advisory databases for known CVEs in third-party libraries.',
  },
  {
    icon: Eye,
    engine: 'Gitleaks',
    tag: 'Secrets',
    color: '#f43f5e',
    brief: 'Entropy-based and pattern-matched detection of credentials, API tokens, private keys, and connection strings.',
  },
  {
    icon: Lock,
    engine: 'AC Analyzer',
    tag: 'Access',
    color: '#f59e0b',
    brief: 'Structural analysis for broken authentication, IDOR, privilege escalation, and missing route-level middleware.',
  },
];

/* ═══════════════════════════════════════════════════════
   SCAN PAGE
   ═══════════════════════════════════════════════════════ */
const ScanPage = () => {
  const navigate      = useNavigate();
  const { startScan } = useScan();
  const { isDark }    = useTheme();

  return (
    <div className={`min-h-screen relative overflow-hidden
      ${isDark ? 'bg-[#0d0f17]' : 'bg-[#f4f6fb]'}`}>

      {/* ── Ambient orbs ── */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">
        <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full opacity-[0.06] animate-float blur-3xl"
          style={{ background: 'radial-gradient(circle, #6366f1, transparent 70%)' }} />
        <div className="absolute top-1/2 -left-48 w-[400px] h-[400px] rounded-full opacity-[0.04] animate-float-delayed blur-3xl"
          style={{ background: 'radial-gradient(circle, #3b82f6, transparent 70%)' }} />
        <div className="absolute -bottom-20 right-1/4 w-80 h-80 rounded-full opacity-[0.03] animate-float blur-3xl"
          style={{ background: 'radial-gradient(circle, #8b5cf6, transparent 70%)', animationDelay: '8s' }} />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 relative z-10">

        {/* ── Back ── */}
        <button
          onClick={() => navigate('/dashboard')}
          className={`group inline-flex items-center gap-1.5 text-xs font-medium mb-10
                     transition-colors
                     ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-700'}`}
        >
          <ChevronLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
          Dashboard
        </button>

        {/* ── Two-column layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start animate-fade-in-up">

          {/* ──────── Left — upload ──────── */}
          <div className="lg:col-span-7">
            {/* Hero heading */}
            <div className="mb-8">
              {/* Badge row */}
              <div className="flex items-center gap-2.5 mb-5">
                <div
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full"
                  style={{
                    background: isDark ? 'rgba(99,102,241,0.14)' : 'rgba(99,102,241,0.09)',
                    border: isDark ? '1px solid rgba(99,102,241,0.32)' : '1px solid rgba(99,102,241,0.25)',
                    backdropFilter: 'blur(10px)',
                    boxShadow: isDark ? '0 0 16px rgba(99,102,241,0.18)' : 'none',
                  }}
                >
                  <Zap size={11} className={isDark ? 'text-indigo-400' : 'text-indigo-600'} fill="currentColor" />
                  <p className={`text-[10px] font-bold uppercase tracking-[0.15em]
                    ${isDark ? 'text-indigo-400' : 'text-indigo-700'}`}>
                    New Security Scan
                  </p>
                </div>
              </div>

              {/* Headline */}
              <h1 className={`text-[2.4rem] sm:text-[2.7rem] font-black tracking-[-0.03em] leading-[1.1] mb-4
                ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Find vulnerabilities<br />
                <span
                  className="bg-clip-text text-transparent"
                  style={{ backgroundImage: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a78bfa 100%)' }}
                >
                  before attackers do.
                </span>
              </h1>
              <p className={`text-[13.5px] leading-[1.7] max-w-[440px]
                ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Upload a ZIP archive or connect your GitHub account. Four parallel
                scan engines process your code and deliver actionable results in under a minute.
              </p>

              {/* Stats strip */}
              <div className="flex flex-wrap items-center gap-5 mt-6">
                {[
                  { icon: Layers,     value: '1,200+',  label: 'detection rules' },
                  { icon: TrendingUp, value: '4',       label: 'parallel engines' },
                  { icon: Clock,      value: '< 60s',   label: 'avg. scan time'  },
                ].map(({ icon: Icon, value, label }) => (
                  <div key={label} className="flex items-center gap-2">
                    <Icon size={13} className={isDark ? 'text-indigo-400' : 'text-indigo-500'} />
                    <span className={`text-[13px] font-bold tabular-nums ${isDark ? 'text-white' : 'text-slate-800'}`}>{value}</span>
                    <span className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</span>
                  </div>
                ))}
              </div>

              {/* Parallel-pipeline visual strip */}
              <div className="flex items-center gap-2 mt-6">
                {ENGINES.map((e, i) => (
                  <React.Fragment key={e.engine}>
                    <div
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold"
                      style={{
                        background: `${e.color}14`,
                        border: `1px solid ${e.color}30`,
                        color: e.color,
                        boxShadow: `0 0 10px ${e.color}18`,
                      }}
                    >
                      <e.icon size={9} />
                      {e.tag}
                    </div>
                    {i < ENGINES.length - 1 && (
                      <div className={`h-px flex-1 ${isDark ? 'bg-white/[0.07]' : 'bg-slate-200/80'}`} />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Upload card */}
            <RepositoryUpload onScanStarted={startScan} />
          </div>

          {/* ──────── Right — engine manifest ──────── */}
          <div className="lg:col-span-5">
            <div className="flex items-center justify-between mb-4">
              <p className={`text-[10px] font-bold uppercase tracking-[0.15em]
                ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Scan Engines
              </p>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className={`text-[10px] font-semibold ${isDark ? 'text-emerald-400/70' : 'text-emerald-600/80'}`}>All online</span>
              </div>
            </div>

            {/* Glass card */}
            <div
              className="rounded-2xl overflow-hidden relative"
              style={{
                background: isDark
                  ? 'linear-gradient(135deg, rgba(15,17,32,0.92) 0%, rgba(20,22,45,0.84) 100%)'
                  : 'linear-gradient(135deg, rgba(255,255,255,0.97) 0%, rgba(248,250,255,0.92) 100%)',
                backdropFilter: 'blur(20px)',
                border: isDark ? '1px solid rgba(255,255,255,0.09)' : '1px solid rgba(139,92,246,0.18)',
                boxShadow: isDark
                  ? '0 8px 32px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.07)'
                  : '0 6px 24px rgba(99,102,241,0.10), inset 0 1px 0 rgba(255,255,255,0.9)',
              }}
            >
              {/* Violet top accent */}
              <div className="absolute top-0 left-0 right-0 h-px z-10"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.5), rgba(99,102,241,0.9), rgba(139,92,246,0.5), transparent)' }} />
              {/* Noise overlay */}
              <div className="absolute inset-0 opacity-[0.018] pointer-events-none"
                style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'1\'/%3E%3C/svg%3E")', backgroundSize: '128px 128px' }} />

              <div className="relative z-10 stagger-children">
                {ENGINES.map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.engine}
                      className={`px-5 py-4 flex items-start gap-4 group transition-all duration-200
                        ${isDark ? 'hover:bg-white/[0.04]' : 'hover:bg-white/60'}
                        ${i !== ENGINES.length - 1
                          ? isDark ? 'border-b border-white/[0.05]' : 'border-b border-white/50'
                          : ''}`}
                    >
                      {/* Glow icon */}
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5
                                   transition-transform duration-300 group-hover:scale-110"
                        style={{
                          background: `${item.color}14`,
                          border:     `1px solid ${item.color}28`,
                          boxShadow:  `0 0 12px ${item.color}1a`,
                        }}
                      >
                        <Icon size={15} style={{ color: item.color }} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[13px] font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                            {item.engine}
                          </span>
                          <span
                            className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                            style={{
                              color:      item.color,
                              background: `${item.color}14`,
                              boxShadow:  `inset 0 0 0 1px ${item.color}30`,
                            }}
                          >
                            {item.tag}
                          </span>
                          <CheckCircle2 size={11} className="ml-auto opacity-40 flex-shrink-0"
                            style={{ color: item.color }} />
                        </div>
                        <p className={`text-[11px] leading-relaxed
                          ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                          {item.brief}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Trust note */}
            <div
              className="mt-4 rounded-xl px-4 py-3 flex items-start gap-3 relative overflow-hidden"
              style={{
                background: isDark ? 'rgba(34,197,94,0.06)' : 'rgba(34,197,94,0.06)',
                border: isDark ? '1px solid rgba(34,197,94,0.18)' : '1px solid rgba(34,197,94,0.22)',
                backdropFilter: 'blur(12px)',
              }}
            >
              <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0 text-emerald-500" />
              <p className={`text-[11px] leading-relaxed
                ${isDark ? 'text-emerald-400/70' : 'text-emerald-700/70'}`}>
                Scans run server-side in an isolated environment.
                ZIP files are archived to S3 after processing.
                No source code is stored long-term.
              </p>
            </div>

            {/* Pro tip */}
            <div
              className="mt-3 rounded-xl px-4 py-3 flex items-start gap-3 relative overflow-hidden"
              style={{
                background: isDark ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.06)',
                border: isDark ? '1px solid rgba(99,102,241,0.22)' : '1px solid rgba(99,102,241,0.18)',
                backdropFilter: 'blur(12px)',
              }}
            >
              <Sparkles size={14} className={`mt-0.5 flex-shrink-0 ${isDark ? 'text-indigo-400' : 'text-indigo-500'}`} />
              <p className={`text-[11px] leading-relaxed
                ${isDark ? 'text-indigo-300/70' : 'text-indigo-700/70'}`}>
                <span className="font-bold">Pro tip:</span> Each finding gets an AI-generated
                explanation with recommended fixes — powered by Amazon Bedrock.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScanPage;
