import React from 'react';

const RecentScans = () => {
  const scans = [
    {
      name: 'auth-service',
      time: '2h ago',
      risk: 'High',
      riskColor: 'text-red-500',
      bgColor: 'bg-red-50'
    },
    {
      name: 'payment-api',
      time: '5h ago',
      risk: 'Medium',
      riskColor: 'text-yellow-600',
      bgColor: 'bg-yellow-50'
    },
    {
      name: 'user-portal',
      time: '1d ago',
      risk: 'Low',
      riskColor: 'text-green-600',
      bgColor: 'bg-green-50'
    }
  ];

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-4">Recent Scans</h2>
      
      <div className="space-y-3">
        {scans.map((scan, index) => (
          <div
            key={index}
            className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <div>
              <h3 className="font-medium text-gray-800">{scan.name}</h3>
              <p className="text-sm text-gray-500">{scan.time}</p>
            </div>
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${scan.bgColor} ${scan.riskColor}`}>
              Risk: {scan.risk}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecentScans;
