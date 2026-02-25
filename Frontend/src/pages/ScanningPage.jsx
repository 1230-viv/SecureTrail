import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import ScanProgress from '../components/ScanProgress';
import { useScan } from '../context/ScanContext';
import { scanAPI } from '../services/api';

const ScanningPage = () => {
  const { jobId }      = useParams();
  const navigate       = useNavigate();
  const { activeJob, setActiveJob, setCurrentReport } = useScan();

  // If the user navigates directly to /scanning/:jobId (e.g. after a refresh),
  // we may not have activeJob in context; hydrate it from the status endpoint.
  useEffect(() => {
    if (!activeJob && jobId) {
      scanAPI.getStatus(jobId)
        .then(({ data }) => {
          setActiveJob({ job_id: jobId, repo_name: data.repository_name });
          // If already done, go straight to results
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
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <ScanProgress
        jobId={jobId}
        repoName={activeJob?.repo_name || '…'}
        onComplete={handleComplete}
        onError={handleError}
      />
    </div>
  );
};

export default ScanningPage;
