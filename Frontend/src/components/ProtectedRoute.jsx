import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * ProtectedRoute — gate that redirects unauthenticated users to the landing page.
 * Stores the attempted URL so we can redirect back after login.
 */
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/" state={{ from: location, authRequired: true }} replace />;
  }

  return children;
};

export default ProtectedRoute;
