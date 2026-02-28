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
      ${isDark ? 'bg-[#0d0f17]' : 'bg-[#f8f9fb]'}`}>
      {/* Subtle radial gradient backdrop */}
      <div className="absolute inset-0 pointer-events-none">
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
          w-[600px] h-[600px] rounded-full blur-[120px] opacity-30
          ${isDark ? 'bg-blue-900/40' : 'bg-blue-200/60'}`} />
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
