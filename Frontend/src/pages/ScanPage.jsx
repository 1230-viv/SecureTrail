import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import RepositoryUpload from '../components/RepositoryUpload';
import { useScan } from '../context/ScanContext';
import { useTheme } from '../context/ThemeContext';

const SCAN_MANIFEST = [
  {
    id: '01',
    engine: 'Semgrep',
    tag: 'SAST',
    brief: 'Static analysis across 20+ languages — SQL injection, XSS, insecure deserialization, and 1 000+ additional patterns.',
  },
  {
    id: '02',
    engine: 'Trivy',
    tag: 'SCA',
    brief: 'Dependency audit against the NVD · OSV · GitHub Advisory databases for known CVEs in third-party libraries.',
  },
  {
    id: '03',
    engine: 'Gitleaks',
    tag: 'Secrets',
    brief: 'Entropy-based and pattern-matched detection of credentials, API tokens, private keys, and connection strings.',
  },
  {
    id: '04',
    engine: 'AC Analyzer',
    tag: 'Access Control',
    brief: 'Structural analysis for broken authentication, IDOR, privilege escalation, and missing route-level middleware.',
  },
];

const TAG_STYLES_LIGHT = {
  SAST:           'bg-violet-50 text-violet-700 border-violet-100',
  SCA:            'bg-blue-50   text-blue-700   border-blue-100',
  Secrets:        'bg-rose-50   text-rose-700   border-rose-100',
  'Access Control':'bg-amber-50  text-amber-700  border-amber-100',
};

const TAG_STYLES_DARK = {
  SAST:           'bg-violet-500/10 text-violet-300 border-violet-500/20',
  SCA:            'bg-blue-500/10   text-blue-300   border-blue-500/20',
  Secrets:        'bg-rose-500/10   text-rose-300   border-rose-500/20',
  'Access Control':'bg-amber-500/10  text-amber-300  border-amber-500/20',
};

const ScanPage = () => {
  const navigate      = useNavigate();
  const { startScan } = useScan();
  const { isDark }    = useTheme();

  const TAG_STYLES = isDark ? TAG_STYLES_DARK : TAG_STYLES_LIGHT;

  return (
    <div className={`min-h-screen ${isDark ? 'bg-[#0d0f17]' : 'bg-[#f8f9fb]'}`}>
      <div className="max-w-6xl mx-auto px-2 py-8">

        {/* ── Back ─── */}
        <button
          onClick={() => navigate('/dashboard')}
          className={`group inline-flex items-center gap-1.5 text-xs
                     ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-700'}
                     mb-8 transition-colors font-medium`}
        >
          <ChevronLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
          Dashboard
        </button>

        {/* ── Two-column layout ─── */}
        <div className="grid grid-cols-12 gap-8 items-start">

          {/* Left — upload ─────────────────────────────── */}
          <div className="col-span-7">
            <div className="mb-6">
              <p className={`text-[10px] font-bold uppercase tracking-widest mb-2
                ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Security Scan
              </p>
              <h1 className={`text-[1.8rem] font-black tracking-tight leading-tight
                ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Select your target.
              </h1>
              <p className={`text-sm mt-2 leading-relaxed
                ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Upload a ZIP archive or connect your GitHub account. All four
                scan engines run in parallel — results are ready in under a minute.
              </p>
            </div>
            <RepositoryUpload onScanStarted={startScan} />
          </div>

          {/* Right — manifest ───────────────────────────── */}
          <div className="col-span-5">
            <p className={`text-[10px] font-bold uppercase tracking-widest mb-4
              ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Scan Manifest
            </p>
            <div className={`space-y-0 border rounded-2xl overflow-hidden
              ${isDark ? 'border-white/5 bg-[#161929]' : 'border-slate-100 bg-white'}`}>
              {SCAN_MANIFEST.map((item, i) => (
                <div
                  key={item.id}
                  className={`px-5 py-4
                    ${i !== SCAN_MANIFEST.length - 1
                      ? isDark ? 'border-b border-white/5' : 'border-b border-slate-50'
                      : ''}`}
                >
                  <div className="flex items-center gap-3 mb-1.5">
                    <span className={`text-[10px] font-mono w-4 flex-shrink-0
                      ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>
                      {item.id}
                    </span>
                    <span className={`text-sm font-bold
                      ${isDark ? 'text-white' : 'text-slate-800'}`}>{item.engine}</span>
                    <span className={`ml-auto text-[10px] font-semibold px-2 py-0.5
                                     rounded border ${TAG_STYLES[item.tag]}`}>
                      {item.tag}
                    </span>
                  </div>
                  <p className={`text-xs leading-relaxed pl-7
                    ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    {item.brief}
                  </p>
                </div>
              ))}
            </div>

            {/* Footnote */}
            <p className={`text-[10px] mt-4 leading-relaxed text-center px-2
              ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>
              Scans run server-side in an isolated environment. ZIP files are
              archived to S3 after processing. No code is stored long-term.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScanPage;
