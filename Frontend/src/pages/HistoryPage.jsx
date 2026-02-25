import React from 'react';
import RecentScans from '../components/RecentScans';
import { useScan } from '../context/ScanContext';

const HistoryPage = () => {
  const { loadReport } = useScan();

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Scan History</h2>
      <RecentScans onViewReport={loadReport} fullPage />
    </div>
  );
};

export default HistoryPage;
