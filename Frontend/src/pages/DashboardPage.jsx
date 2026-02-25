import React from 'react';
import RepositoryUpload from '../components/RepositoryUpload';
import RiskSummary from '../components/RiskSummary';
import RecentScans from '../components/RecentScans';
import { useScan } from '../context/ScanContext';

const DashboardPage = () => {
  const { currentReport, activeJob, startScan, loadReport } = useScan();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: upload (2 cols) */}
      <div className="lg:col-span-2">
        <RepositoryUpload onScanStarted={startScan} />
      </div>

      {/* Right: risk summary + recent scans */}
      <div className="space-y-6">
        <RiskSummary report={currentReport} />
        <RecentScans
          onViewReport={loadReport}
          activeJobId={activeJob?.job_id}
        />
      </div>
    </div>
  );
};

export default DashboardPage;
