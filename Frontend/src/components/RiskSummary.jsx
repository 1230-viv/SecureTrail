import React from 'react';
import { AlertTriangle } from 'lucide-react';

const RiskSummary = () => {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-4">Risk Summary</h2>
      
      <div className="space-y-4">
        {/* Total Vulnerabilities */}
        <div className="flex items-center justify-between py-3 border-b border-gray-200">
          <span className="text-gray-600">Total Vulnerabilities</span>
          <span className="text-2xl font-bold text-gray-800">24</span>
        </div>

        {/* High Risk Count */}
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <span className="text-gray-600">High Risk Count</span>
          </div>
          <span className="text-2xl font-bold text-red-500">8</span>
        </div>
      </div>
    </div>
  );
};

export default RiskSummary;
