import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck, Zap, Lock, Eye, GitBranch, Package,
  CheckCircle, ArrowRight, Terminal, AlertTriangle, ChevronRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/* ── Sub-components ─────────────────────────────────────────────────── */

const GradientText = ({ children, className = '' }) => (
  <span className={`bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400
                    bg-clip-text text-transparent ${className}`}>
    {children}
  </span>
);

const FeatureCard = ({ icon: Icon, title, desc, accent = 'blue' }) => {
  const colors = {
    blue:   'from-blue-500/10 to-blue-500/5   border-blue-500/20  text-blue-400',
    cyan:   'from-cyan-500/10 to-cyan-500/5   border-cyan-500/20  text-cyan-400',
    purple: 'from-purple-500/10 to-purple-500/5 border-purple-500/20 text-purple-400',
    green:  'from-green-500/10 to-green-500/5 border-green-500/20 text-green-400',
    orange: 'from-orange-500/10 to-orange-500/5 border-orange-500/20 text-orange-400',
    rose:   'from-rose-500/10 to-rose-500/5   border-rose-500/20  text-rose-400',
  };
  const c = colors[accent];
  return (
    <div className={`relative p-6 rounded-2xl border bg-gradient-to-br ${c}
                     hover:scale-[1.02] transition-transform duration-200 group`}>
      <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${c} mb-4`}>
        <Icon size={22} className={c.split(' ')[3]} />
      </div>
      <h3 className="text-white font-semibold text-lg mb-2">{title}</h3>
      <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
    </div>
  );
};

const StepCard = ({ num, title, desc }) => (
  <div className="flex gap-5">
    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-600 flex items-center
                    justify-center text-white font-bold text-sm shadow-lg shadow-blue-600/30">
      {num}
    </div>
    <div>
      <h3 className="text-white font-semibold mb-1">{title}</h3>
      <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
    </div>
  </div>
);

const ScannerBadge = ({ name, tag, color }) => (
  <div className={`flex flex-col items-center gap-2 px-6 py-4 rounded-2xl
                   border ${color} bg-slate-800/50 hover:bg-slate-800 transition-colors`}>
    <span className="text-white font-semibold">{name}</span>
    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">{tag}</span>
  </div>
);

/* ── Terminal preview component ─────────────────────────────────────── */
const TerminalPreview = () => (
  <div className="rounded-2xl overflow-hidden border border-slate-700/60
                  shadow-2xl shadow-black/40 bg-slate-900">
    {/* Title bar */}
    <div className="flex items-center gap-2 px-4 py-3 bg-slate-800/80 border-b border-slate-700/60">
      <div className="w-3 h-3 rounded-full bg-red-500/80" />
      <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
      <div className="w-3 h-3 rounded-full bg-green-500/80" />
      <span className="ml-2 text-slate-400 text-xs font-mono">securetrail — scan output</span>
    </div>
    {/* Content */}
    <div className="p-5 font-mono text-sm space-y-1.5">
      <p><span className="text-cyan-400">$</span><span className="text-slate-300"> securetrail scan ./my-app</span></p>
      <p className="text-slate-500">—————————————————————————————</p>
      <p><span className="text-blue-400">▶ SAST</span>     <span className="text-slate-400">Semgrep  </span><span className="text-yellow-400">3 findings</span></p>
      <p><span className="text-purple-400">▶ Secrets</span>  <span className="text-slate-400">Gitleaks </span><span className="text-red-400">2 findings</span></p>
      <p><span className="text-green-400">▶ Deps</span>     <span className="text-slate-400">Trivy    </span><span className="text-green-400">0 findings</span></p>
      <p className="text-slate-500">—————————————————————————————</p>
      <p>
        <span className="text-white font-semibold">Critical: </span>
        <span className="text-red-400 font-bold">2</span>
        <span className="text-slate-500">  High: </span>
        <span className="text-orange-400 font-bold">1</span>
        <span className="text-slate-500">  Medium: </span>
        <span className="text-yellow-400 font-bold">2</span>
      </p>
      <p className="mt-2">
        <span className="text-green-400">✔</span>
        <span className="text-slate-300"> Report ready → </span>
        <span className="text-cyan-400 underline underline-offset-2">View full report</span>
      </p>
    </div>
  </div>
);

/* ── Main page ──────────────────────────────────────────────────────── */
const LandingPage = () => {
  const { isAuthenticated, loginWithGitHub } = useAuth();
  const navigate = useNavigate();

  const handleCTA = () => {
    if (isAuthenticated) navigate('/dashboard');
    else loginWithGitHub();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* ── Hero ── */}
      <section className="relative pt-32 pb-24 px-6 overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[600px]
                          bg-blue-600/10 rounded-full blur-3xl" />
          <div className="absolute top-60 -right-20 w-[400px] h-[400px]
                          bg-cyan-500/8 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left copy */}
            <div>
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full
                              bg-blue-500/10 border border-blue-500/25 text-blue-400
                              text-sm font-medium mb-8">
                <Zap size={14} />
                AI-Powered DevSecOps Platform
              </div>

              <h1 className="text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight mb-6">
                Secure Your Code<br />
                <GradientText>Before It Ships</GradientText>
              </h1>

              <p className="text-lg text-slate-400 leading-relaxed mb-10 max-w-xl">
                Real-time static analysis, secret detection, and dependency scanning
                combined in one platform — built for developers who ship fast.
              </p>

              <div className="flex flex-wrap gap-4">
                <button
                  onClick={handleCTA}
                  className="flex items-center gap-2 px-7 py-3.5 text-base font-semibold
                             bg-gradient-to-r from-blue-600 to-cyan-600
                             hover:from-blue-500 hover:to-cyan-500
                             text-white rounded-xl shadow-lg shadow-blue-600/30
                             hover:shadow-blue-500/40 transition-all"
                >
                  {isAuthenticated ? 'Open Dashboard' : 'Start Scanning Free'}
                  <ArrowRight size={18} />
                </button>

                {!isAuthenticated && (
                  <button
                    onClick={loginWithGitHub}
                    className="flex items-center gap-2 px-7 py-3.5 text-base font-medium
                               text-slate-300 hover:text-white border border-slate-600
                               hover:border-slate-500 rounded-xl hover:bg-slate-800
                               transition-all"
                  >
                    <svg viewBox="0 0 16 16" className="w-5 h-5 fill-current" aria-hidden>
                      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38
                               0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13
                               -.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66
                               .07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15
                               -.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0
                               1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56
                               .82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07
                               -.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                    </svg>
                    Login with GitHub
                  </button>
                )}
              </div>

              {/* Trust bullets */}
              <div className="flex flex-wrap gap-x-6 gap-y-2 mt-8">
                {['No credit card', 'GitHub OAuth only', 'Open source scanners'].map(t => (
                  <span key={t} className="flex items-center gap-1.5 text-sm text-slate-500">
                    <CheckCircle size={14} className="text-green-500" />
                    {t}
                  </span>
                ))}
              </div>
            </div>

            {/* Right terminal */}
            <div className="hidden lg:block">
              <TerminalPreview />
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats strip ── */}
      <section className="border-y border-slate-800 bg-slate-900/40">
        <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { val: '3',    label: 'Integrated scanners'     },
            { val: '25+',  label: 'Vulnerability categories' },
            { val: '100%', label: 'Offline capable'          },
            { val: '< 60s',label: 'Average scan time'        },
          ].map(({ val, label }) => (
            <div key={label} className="text-center">
              <div className="text-3xl font-bold text-white mb-1">{val}</div>
              <div className="text-sm text-slate-500">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">
              Everything you need for <GradientText>secure development</GradientText>
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              A unified platform that integrates multiple security scanners
              to catch vulnerabilities at every layer of your codebase.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard accent="blue"   icon={ShieldCheck}    title="Static Code Analysis"
              desc="SAST powered by Semgrep with 1000+ security rules. Detects XSS, SQL injection, path traversal, and more across 30+ languages." />
            <FeatureCard accent="rose"   icon={Lock}           title="Secret Detection"
              desc="Gitleaks scans every file and git history for API keys, tokens, passwords, and credentials before they leave your repo." />
            <FeatureCard accent="green"  icon={Package}        title="Dependency Scanning"
              desc="Trivy checks npm, pip, Ruby, Go, Maven, and OS packages against CVE databases for known vulnerabilities." />
            <FeatureCard accent="cyan"   icon={GitBranch}      title="GitHub Integration"
              desc="Connect your GitHub account and scan any repository in two clicks. Supports all branches and private repos with OAuth." />
            <FeatureCard accent="purple" icon={Eye}            title="Risk Scoring"
              desc="Every finding is scored by exploitability and business impact. Focus on what actually matters, not noise." />
            <FeatureCard accent="orange" icon={AlertTriangle}  title="Configuration Analysis"
              desc="Detects missing rate limiting, insecure CORS, weak JWT settings, and exposed file upload endpoints." />
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" className="py-24 px-6 bg-slate-900/40">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl font-bold mb-4">
                Scan in <GradientText>three steps</GradientText>
              </h2>
              <p className="text-slate-400 mb-12">
                From login to a full security report in under a minute.
                No configuration, no agents, no setup.
              </p>
              <div className="space-y-8">
                <StepCard num="1" title="Login with GitHub"
                  desc="OAuth login gives SecureTrail read access to your repositories. No password, no setup." />
                <StepCard num="2" title="Pick a repo or upload a ZIP"
                  desc="Select any GitHub repository or upload a ZIP archive directly. We extract and prepare the code automatically." />
                <StepCard num="3" title="Get your full security report"
                  desc="SAST, secret scanning, and dependency analysis run in parallel. Results are ready in seconds with severity scoring." />
              </div>
              <button
                onClick={handleCTA}
                className="mt-10 flex items-center gap-2 px-6 py-3 text-sm font-semibold
                           text-blue-400 border border-blue-500/40 hover:border-blue-400
                           hover:bg-blue-500/10 rounded-xl transition-all"
              >
                Try it now <ChevronRight size={16} />
              </button>
            </div>

            {/* Visual steps */}
            <div className="space-y-4">
              {[
                { label: 'Authenticate',  sub: 'OAuth 2.0 — GitHub only',   pct: 100, color: 'bg-green-500' },
                { label: 'SAST scan',     sub: 'Semgrep p/default rules',   pct: 75,  color: 'bg-blue-500'  },
                { label: 'Secret scan',   sub: 'Gitleaks — all file types', pct: 60,  color: 'bg-rose-500'  },
                { label: 'Deps scan',     sub: 'Trivy CVE database',        pct: 45,  color: 'bg-green-500' },
                { label: 'Risk scoring',  sub: 'Exploitability + impact',   pct: 88,  color: 'bg-purple-500'},
              ].map(({ label, sub, pct, color }) => (
                <div key={label} className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60">
                  <div className="flex justify-between mb-2">
                    <span className="text-white text-sm font-medium">{label}</span>
                    <span className="text-slate-400 text-xs">{sub}</span>
                  </div>
                  <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div className={`h-full ${color} rounded-full transition-all`}
                         style={{ width: `${pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Scanners ── */}
      <section id="scanners" className="py-24 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-4">
            Powered by <GradientText>industry-leading</GradientText> scanners
          </h2>
          <p className="text-slate-400 mb-12 max-w-2xl mx-auto">
            SecureTrail orchestrates best-in-class open-source security tools
            inside isolated Docker containers so your code never leaves your machine.
          </p>
          <div className="flex flex-wrap justify-center gap-6">
            <ScannerBadge name="Semgrep"   tag="SAST"         color="border-blue-500/30"   />
            <ScannerBadge name="Gitleaks"  tag="Secrets"      color="border-rose-500/30"   />
            <ScannerBadge name="Trivy"     tag="Dependencies" color="border-green-500/30"  />
          </div>
          <div className="mt-10 inline-flex items-center gap-2 text-sm text-slate-500">
            <Terminal size={15} />
            All scanners run in isolated Docker containers — your code stays on your server
          </div>
        </div>
      </section>

      {/* ── CTA banner ── */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center relative">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-cyan-600/10
                          to-purple-600/20 rounded-3xl blur-2xl pointer-events-none" />
          <div className="relative p-12 rounded-3xl border border-slate-700/60 bg-slate-900/80">
            <h2 className="text-4xl font-bold mb-4">
              Ready to <GradientText>secure your codebase?</GradientText>
            </h2>
            <p className="text-slate-400 mb-8 text-lg">
              Login with GitHub and run your first scan in under a minute — completely free.
            </p>
            <button
              onClick={handleCTA}
              className="inline-flex items-center gap-2 px-8 py-4 text-base font-semibold
                         bg-gradient-to-r from-blue-600 to-cyan-600
                         hover:from-blue-500 hover:to-cyan-500
                         text-white rounded-xl shadow-xl shadow-blue-600/30
                         hover:shadow-blue-500/50 transition-all"
            >
              {isAuthenticated ? 'Open Dashboard' : 'Start for free — Login with GitHub'}
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-800 py-10 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between
                        items-center gap-4 text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-cyan-400" />
            <span><span className="text-white font-semibold">SecureTrail</span> — AI DevSecOps Platform</span>
          </div>
          <span>Built with Semgrep · Trivy · Gitleaks · FastAPI · PostgreSQL</span>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
