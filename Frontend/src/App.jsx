import React from 'react';
import { useLocation } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Sidebar from './components/Sidebar';
import Navbar  from './components/Navbar';
import AppRoutes from './routes/AppRoutes';
import { ScanProvider } from './context/ScanContext';
import { AuthProvider } from './context/AuthContext';

/**
 * AppShell — chooses layout based on the current route.
 *   /             → Public layout  (Navbar only)
 *   /dashboard/*  → Protected layout (Sidebar + main content)
 */
const AppShell = () => {
  const { pathname } = useLocation();
  const isPublic = pathname === '/';

  if (isPublic) {
    return (
      <>
        <Navbar />
        <AppRoutes />
      </>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar />
      <main className="ml-64 flex-1 p-8">
        <div className="max-w-7xl mx-auto">
          <AppRoutes />
        </div>
      </main>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <ScanProvider>
        <AppShell />
        <ToastContainer
          position="top-right"
          autoClose={4000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="light"
        />
      </ScanProvider>
    </AuthProvider>
  );
}

export default App;

