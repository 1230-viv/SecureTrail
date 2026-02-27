import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LandingPage   from '../pages/LandingPage';
import DashboardPage from '../pages/DashboardPage';
import ScanPage      from '../pages/ScanPage';
import ScanningPage  from '../pages/ScanningPage';
import ResultsPage   from '../pages/ResultsPage';
import HistoryPage   from '../pages/HistoryPage';
import ProtectedRoute from '../components/ProtectedRoute';

/**
 * AppRoutes — central route table for SecureTrail.
 *
 *  /                → LandingPage   (public marketing homepage)
 *  /dashboard       → DashboardPage (protected)
 *  /scanning/:jobId → ScanningPage  (protected, live progress)
 *  /results/:jobId  → ResultsPage   (protected, full report)
 *  /history         → HistoryPage   (protected, scan history)
 *  *                → redirect to /
 */
const AppRoutes = () => (
  <Routes>
    {/* Public */}
    <Route path="/" element={<LandingPage />} />

    {/* Protected — require GitHub login */}
    <Route path="/dashboard" element={
      <ProtectedRoute><DashboardPage /></ProtectedRoute>
    } />
    <Route path="/scan" element={
      <ProtectedRoute><ScanPage /></ProtectedRoute>
    } />
    <Route path="/scanning/:jobId" element={
      <ProtectedRoute><ScanningPage /></ProtectedRoute>
    } />
    <Route path="/results/:jobId" element={
      <ProtectedRoute><ResultsPage /></ProtectedRoute>
    } />
    <Route path="/history" element={
      <ProtectedRoute><HistoryPage /></ProtectedRoute>
    } />

    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

export default AppRoutes;
