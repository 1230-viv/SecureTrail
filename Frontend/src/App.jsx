import React from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Sidebar from './components/Sidebar';
import RepositoryUpload from './components/RepositoryUpload';
import RiskSummary from './components/RiskSummary';
import RecentScans from './components/RecentScans';

function App() {
  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="ml-64 flex-1 p-8">
        <div className="max-w-7xl mx-auto">
          {/* Main Grid Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Repository Upload (Takes 2 columns) */}
            <div className="lg:col-span-2">
              <RepositoryUpload />
            </div>

            {/* Right Column - Risk Summary and Recent Scans */}
            <div className="space-y-6">
              <RiskSummary />
              <RecentScans />
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notifications */}
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
    </div>
  );
}

export default App;
