import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import ScanProgress from '../components/ScanProgress';
import { useScan } from '../context/ScanContext';
import { scanAPI } from '../services/api';
import { useTheme } from '../context/ThemeContext';

const ScanningPage = () => {
  const { jobId }      = useParams();
  const navigate       = useNavigate();
  const { activeJob, setActiveJob, setCurrentReport } = useScan();
  const { isDark }     = useTheme();

  // Hydrate from API if user navigated directly (refresh / bookmark)
  useEffect(() => {
    if (!activeJob && jobId) {
      scanAPI.getStatus(jobId)
        .then(({ data }) => {
          setActiveJob({ job_id: jobId, repo_name: data.repository_name });
          if (data.status === 'completed' || data.status === 'partial') {
            scanAPI.getResult(jobId).then(({ data: report }) => {
              setCurrentReport(report);
              navigate(`/results/${jobId}`, { replace: true });
            });
          } else if (data.status === 'failed') {
            toast.error('Scan failed: ' + (data.error || 'unknown error'));
            navigate('/', { replace: true });
          }
        })
        .catch(() => {
          toast.error('Job not found');
          navigate('/', { replace: true });
        });
    }
  }, [jobId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleComplete = async (completedJobId) => {
    try {
      const { data } = await scanAPI.getResult(completedJobId);
      setCurrentReport(data);
      navigate(`/results/${completedJobId}`);
    } catch (err) {
      toast.error('Failed to load scan results: ' + (err.response?.data?.detail || err.message));
      navigate('/dashboard');
    }
  };

  const handleError = (msg) => {
    toast.error(`Scan failed: ${msg}`);
    navigate('/dashboard');
  };

  return (
    <div className={`min-h-[80vh] flex flex-col items-center justify-center px-4 relative overflow-hidden
      ${isDark ? 'bg-[#0d0f17]' : 'bg-[#f4f6fb]'}`}>

      {/* ── Ambient orbs (matches Dashboard) ── */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">
        <div
          className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full opacity-[0.06] animate-float blur-3xl"
          style={{ background: 'radial-gradient(circle, #3b82f6, transparent 70%)' }}
        />
        <div
          className="absolute top-1/2 -left-48 w-[400px] h-[400px] rounded-full opacity-[0.04] animate-float-delayed blur-3xl"
          style={{ background: 'radial-gradient(circle, #6366f1, transparent 70%)' }}
        />
        <div
          className="absolute -bottom-24 right-1/3 w-72 h-72 rounded-full opacity-[0.035] animate-float blur-3xl"
          style={{ background: 'radial-gradient(circle, #8b5cf6, transparent 70%)', animationDelay: '6s' }}
        />
        {/* Scanning-specific pulsing orb */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                     w-[600px] h-[600px] rounded-full blur-[100px] animate-pulse"
          style={{
            background: isDark
              ? 'radial-gradient(circle, rgba(59,130,246,0.08), transparent 60%)'
              : 'radial-gradient(circle, rgba(59,130,246,0.12), transparent 60%)',
          }}
        />
      </div>

      <div className="relative z-10 w-full">
        <ScanProgress
          jobId={jobId}
          repoName={activeJob?.repo_name || '…'}
          onComplete={handleComplete}
          onError={handleError}
        />
      </div>
    </div>
  );
};

export default ScanningPage;
