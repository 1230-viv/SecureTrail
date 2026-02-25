import React, { createContext, useContext, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { scanAPI } from '../services/api';

const ScanContext = createContext(null);

/**
 * ScanProvider — wraps the app and exposes scan state + actions to all pages.
 *
 * State
 *   currentReport   : ScanReport | null  — the last completed report
 *   activeJob       : { job_id, repo_name } | null  — job currently running
 *
 * Actions
 *   startScan({ job_id, repository_name })  — called when a scan is queued
 *   loadReport(jobId)                       — load a historical report by id
 *   clearScan()                             — reset back to dashboard
 */
export const ScanProvider = ({ children }) => {
  const navigate = useNavigate();
  const [currentReport, setCurrentReport] = useState(null);
  const [activeJob,     setActiveJob]     = useState(null);

  const startScan = useCallback(({ job_id, repository_name }) => {
    setActiveJob({ job_id, repo_name: repository_name });
    setCurrentReport(null);
    navigate(`/scanning/${job_id}`);
  }, [navigate]);

  const loadReport = useCallback(async (jobId) => {
    try {
      const { data } = await scanAPI.getResult(jobId);
      setCurrentReport(data);
      navigate(`/results/${jobId}`);
    } catch (err) {
      toast.error('Could not load report: ' + (err.response?.data?.detail || err.message));
    }
  }, [navigate]);

  const clearScan = useCallback(() => {
    setActiveJob(null);
    setCurrentReport(null);
    navigate('/dashboard');
  }, [navigate]);

  return (
    <ScanContext.Provider value={{ currentReport, setCurrentReport, activeJob, setActiveJob, startScan, loadReport, clearScan }}>
      {children}
    </ScanContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useScan = () => {
  const ctx = useContext(ScanContext);
  if (!ctx) throw new Error('useScan must be used inside <ScanProvider>');
  return ctx;
};
