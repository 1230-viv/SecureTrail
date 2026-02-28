import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
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

  if (loading) {
    return (
      <div className={`flex items-center justify-center min-h-[60vh] gap-3
        ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
        <Loader2 size={22} className="animate-spin" />
        <span className="text-sm">Loading report…</span>
      </div>
    );
  }

  if (!currentReport) return null;

  return (
    <div className={`min-h-screen ${isDark ? 'bg-[#0d0f17]' : 'bg-[#f8f9fb]'}`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <ScanResults report={currentReport} onNewScan={clearScan} />
      </div>
    </div>
  );
};

export default ResultsPage;
