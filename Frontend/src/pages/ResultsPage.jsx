import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';
import ScanResults from '../components/ScanResults';
import { useScan } from '../context/ScanContext';
import { scanAPI } from '../services/api';

const AI_POLL_INTERVAL = 3000; // ms

const ResultsPage = () => {
  const { jobId }      = useParams();
  const navigate       = useNavigate();
  const { currentReport, setCurrentReport, clearScan } = useScan();
  const [loading, setLoading] = useState(false);
  const aiPollRef = useRef(null);

  // Hydrate from API if context is empty (e.g. direct URL access / page refresh)
  useEffect(() => {
    if (!currentReport && jobId) {
      setLoading(true);
      scanAPI.getResult(jobId)
        .then(({ data }) => setCurrentReport(data))
        .catch((err) => {
          const msg = err.response?.data?.detail || err.message;
          // Job may still be running — redirect to scanning view
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

  // Poll for AI explanation updates when ai_pending is true
  useEffect(() => {
    if (!currentReport?.ai_pending || !jobId) return;

    aiPollRef.current = setInterval(async () => {
      try {
        const { data } = await scanAPI.getResult(jobId);
        setCurrentReport(data);
        if (!data.ai_pending) {
          clearInterval(aiPollRef.current);
        }
      } catch {
        // ignore polling errors — will retry next interval
      }
    }, AI_POLL_INTERVAL);

    return () => clearInterval(aiPollRef.current);
  }, [currentReport?.ai_pending, jobId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] gap-3 text-gray-500">
        <Loader2 size={24} className="animate-spin" />
        <span>Loading report…</span>
      </div>
    );
  }

  if (!currentReport) return null;

  return (
    <ScanResults
      report={currentReport}
      onNewScan={clearScan}
    />
  );
};

export default ResultsPage;
