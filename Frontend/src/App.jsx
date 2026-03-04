import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { motion } from 'framer-motion';
import Sidebar from './components/Sidebar';
import Navbar  from './components/Navbar';
import AppRoutes from './routes/AppRoutes';
import { ScanProvider } from './context/ScanContext';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { SidebarProvider, useSidebar } from './context/SidebarContext';

/** Scroll to top on every route change — prevents "blank page" after long pages */
const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);
  return null;
};

/** Catch render crashes so the whole app doesn't go blank */
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { crashed: false, error: null }; }
  static getDerivedStateFromError(error) { return { crashed: true, error }; }
  componentDidCatch(err, info) { console.error('[SecureTrail] Render error:', err, info); }
  render() {
    if (!this.state.crashed) return this.props.children;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#0d0f17] text-white p-8 text-center">
        <div className="text-4xl">⚠️</div>
        <h2 className="text-xl font-semibold">Something went wrong</h2>
        <p className="text-slate-400 text-sm max-w-sm">{this.state.error?.message || 'An unexpected error occurred.'}</p>
        <button
          onClick={() => { this.setState({ crashed: false, error: null }); window.location.href = '/dashboard'; }}
          className="mt-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition-colors"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }
}

/**
 * AppShell — chooses layout based on the current route.
 *   /             → Public layout  (Navbar only)
 *   /dashboard/*  → Protected layout (Sidebar + main content)
 */
const AppShell = () => {
  const { pathname }  = useLocation();
  const { isDark }    = useTheme();
  const { collapsed } = useSidebar();
  const isPublic      = pathname === '/';

  if (isPublic) {
    return (
      <>
        <ScrollToTop />
        <Navbar />
        <AppRoutes />
      </>
    );
  }

  return (
    <div className={`flex min-h-screen transition-colors duration-300
      ${isDark ? 'bg-[#0d0f17]' : 'bg-[#f0f2f8]'}`}>
      <ScrollToTop />
      <Sidebar />
      <motion.main
        animate={{ marginLeft: collapsed ? 72 : 256 }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        className="flex-1 overflow-x-hidden"
      >
        <AppRoutes />
      </motion.main>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <SidebarProvider>
        <ScanProvider>
          <ErrorBoundary>
            <AppShell />
          </ErrorBoundary>
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
        </SidebarProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;

