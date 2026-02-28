import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'react-toastify';
import ScanResults from '../components/ScanResults';
import { useScan } from '../context/ScanContext';
import { scanAPI } from '../services/api';
import { useTheme } from '../context/ThemeContext';

const AI_POLL_INTERVAL = 3000;

const ResultsPage = () => {
  const { jobId }      = useParams();
  const navigate       = useNavigate();
  const { currentReport, setCurrentReport, clearScan } = useScan();
  const [loading, setLoading] = useState(false);
  const aiPollRef = useRef(null);
  const { isDark } = useTheme();

  /* ── fetch report when landing directly ── */
  useEffect(() => {
    if (!currentReport && jobId) {
      setLoading(true);
      scanAPI.getResult(jobId)
        .then(({ data }) => setCurrentReport(data))
        .catch((err) => {
          const msg = err.response?.data?.detail || err.message;
          if (err.response?.status === 409) {
            toast.info('Scan still in progress, redirecting…');
            navigate(`/scanning/${jobId}`, { replace: true });
          } else {
            toast.error('Could not load report: ' + msg);
            navigate('/dashboard', { replace: true });
          }
        })
        .finally(() => setLoading(false));
    }
  }, [jobId]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── poll for AI enrichment ── */
  useEffect(() => {
    if (!currentReport?.ai_pending || !jobId) return;
    aiPollRef.current = setInterval(async () => {
      try {
        const { data } = await scanAPI.getResult(jobId);
        setCurrentReport(data);
        if (!data.ai_pending) clearInterval(aiPollRef.current);
      } catch { /* retry next interval */ }
    }, AI_POLL_INTERVAL);
    return () => clearInterval(aiPollRef.current);
  }, [currentReport?.ai_pending, jobId]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Loading state (glassmorphism) ── */
  if (loading) {
    return (
      <div className={`min-h-[80vh] flex items-center justify-center relative overflow-hidden
        ${isDark ? 'bg-[#0d0f17]' : 'bg-[#f4f6fb]'}`}>

        {/* ambient orbs */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">
          <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full opacity-[0.06] animate-float blur-3xl"
               style={{ background: 'radial-gradient(circle, #3b82f6, transparent 70%)' }} />
          <div className="absolute top-1/2 -left-48 w-[400px] h-[400px] rounded-full opacity-[0.04] animate-float-delayed blur-3xl"
               style={{ background: 'radial-gradient(circle, #6366f1, transparent 70%)' }} />
        </div>

        <div className={`relative z-10 flex flex-col items-center gap-4 px-10 py-10 rounded-2xl border backdrop-blur-xl
          ${isDark
            ? 'bg-white/[0.03] border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.3)]'
            : 'bg-white/70 border-white/60 shadow-[0_8px_32px_rgba(99,102,241,0.08)]'}`}>
          <div className={`w-14 h-14 rounded-xl flex items-center justify-center
            ${isDark ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
            <Loader2 size={26} className={`animate-spin ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
          </div>
          <p className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Loading report…
          </p>
        </div>
      </div>
    );
  }

  if (!currentReport) return null;

  /* ── Results layout ── */
  return (
    <div className={`min-h-screen relative overflow-hidden
      ${isDark ? 'bg-[#0d0f17]' : 'bg-[#f4f6fb]'}`}>

      {/* ── Ambient orbs ── */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">
        <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full opacity-[0.06] animate-float blur-3xl"
             style={{ background: 'radial-gradient(circle, #3b82f6, transparent 70%)' }} />
        <div className="absolute top-1/2 -left-48 w-[400px] h-[400px] rounded-full opacity-[0.04] animate-float-delayed blur-3xl"
             style={{ background: 'radial-gradient(circle, #6366f1, transparent 70%)' }} />
        <div className="absolute -bottom-24 right-1/3 w-72 h-72 rounded-full opacity-[0.035] animate-float blur-3xl"
             style={{ background: 'radial-gradient(circle, #8b5cf6, transparent 70%)', animationDelay: '6s' }} />
        <div className="absolute top-20 left-1/4 w-64 h-64 rounded-full opacity-[0.04] animate-float-delayed blur-3xl"
             style={{ background: 'radial-gradient(circle, #22d3ee, transparent 70%)', animationDelay: '3s' }} />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <ScanResults report={currentReport} onNewScan={clearScan} />
      </div>
    </div>
  );
};

export default ResultsPage;
