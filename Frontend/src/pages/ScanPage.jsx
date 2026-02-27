import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import RepositoryUpload from '../components/RepositoryUpload';
import { useScan } from '../context/ScanContext';

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

const TAG_STYLES = {
  SAST:           'bg-violet-50 text-violet-700 border-violet-100',
  SCA:            'bg-blue-50   text-blue-700   border-blue-100',
  Secrets:        'bg-rose-50   text-rose-700   border-rose-100',
  'Access Control':'bg-amber-50  text-amber-700  border-amber-100',
};

const ScanPage = () => {
  const navigate      = useNavigate();
  const { startScan } = useScan();

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      <div className="max-w-6xl mx-auto px-2 py-8">

        {/* ── Back ─── */}
        <button
          onClick={() => navigate('/dashboard')}
          className="group inline-flex items-center gap-1.5 text-xs text-slate-400
                     hover:text-slate-700 mb-8 transition-colors font-medium"
        >
          <ChevronLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
          Dashboard
        </button>

        {/* ── Two-column layout ─── */}
        <div className="grid grid-cols-12 gap-8 items-start">

          {/* Left — upload ─────────────────────────────── */}
          <div className="col-span-7">
            <div className="mb-6">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                Security Scan
              </p>
              <h1 className="text-[1.8rem] font-black text-slate-900 tracking-tight leading-tight">
                Select your target.
              </h1>
              <p className="text-slate-500 text-sm mt-2 leading-relaxed">
                Upload a ZIP archive or connect your GitHub account. All four
                scan engines run in parallel — results are ready in under a minute.
              </p>
            </div>
            <RepositoryUpload onScanStarted={startScan} />
          </div>

          {/* Right — manifest ───────────────────────────── */}
          <div className="col-span-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">
              Scan Manifest
            </p>
            <div className="space-y-0 border border-slate-100 rounded-2xl overflow-hidden bg-white">
              {SCAN_MANIFEST.map((item, i) => (
                <div
                  key={item.id}
                  className={`px-5 py-4
                    ${i !== SCAN_MANIFEST.length - 1
                      ? 'border-b border-slate-50'
                      : ''}`}
                >
                  <div className="flex items-center gap-3 mb-1.5">
                    <span className="text-[10px] font-mono text-slate-300 w-4 flex-shrink-0">
                      {item.id}
                    </span>
                    <span className="text-sm font-bold text-slate-800">{item.engine}</span>
                    <span className={`ml-auto text-[10px] font-semibold px-2 py-0.5
                                     rounded border ${TAG_STYLES[item.tag]}`}>
                      {item.tag}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed pl-7">
                    {item.brief}
                  </p>
                </div>
              ))}
            </div>

            {/* Footnote */}
            <p className="text-[10px] text-slate-300 mt-4 leading-relaxed text-center px-2">
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
