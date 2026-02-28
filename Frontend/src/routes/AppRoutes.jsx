import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';

/* ── Lazy-loaded page chunks (Recharts etc. split out) ── */
const LandingPage   = lazy(() => import('../pages/LandingPage'));
const DashboardPage = lazy(() => import('../pages/DashboardPage'));
const ScanPage      = lazy(() => import('../pages/ScanPage'));
const ScanningPage  = lazy(() => import('../pages/ScanningPage'));
const ResultsPage   = lazy(() => import('../pages/ResultsPage'));
const HistoryPage   = lazy(() => import('../pages/HistoryPage'));

/* Minimal full-screen loader for chunk downloads */
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#0d0f17]">
    <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

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
  <Suspense fallback={<PageLoader />}>
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
  </Suspense>
);

export default AppRoutes;
