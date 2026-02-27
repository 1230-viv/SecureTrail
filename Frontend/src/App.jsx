import React from 'react';
import { useLocation } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Sidebar from './components/Sidebar';
import Navbar  from './components/Navbar';
import AppRoutes from './routes/AppRoutes';
import { ScanProvider } from './context/ScanContext';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';

/**
 * AppShell — chooses layout based on the current route.
 *   /             → Public layout  (Navbar only)
 *   /dashboard/*  → Protected layout (Sidebar + main content)
 */
const AppShell = () => {
  const { pathname } = useLocation();
  const { isDark }   = useTheme();
  const isPublic     = pathname === '/';

  if (isPublic) {
    return (
      <>
        <Navbar />
        <AppRoutes />
      </>
    );
  }

  return (
    <div className={`flex min-h-screen transition-colors duration-300
      ${isDark ? 'bg-[#0d0f17]' : 'bg-[#f0f2f8]'}`}>
      <Sidebar />
      <main className="ml-64 flex-1 overflow-x-hidden">
        <AppRoutes />
      </main>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
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
            theme="colored"
          />
        </ScanProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;

