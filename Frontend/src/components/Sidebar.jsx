import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, History, BookOpen, Settings, LogOut, ShieldCheck, ScanLine, Sun, Moon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard',        path: '/dashboard' },
  { icon: ScanLine,        label: 'New Scan',          path: '/scan'      },
  { icon: History,         label: 'Scan History',      path: '/history'   },
  { icon: BookOpen,        label: 'Learning Insights', path: null         },
  { icon: Settings,        label: 'Settings',          path: null         },
];

/**
 * Sidebar — protected-area navigation with user profile at the top.
 */
const Sidebar = () => {
  const navigate     = useNavigate();
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const { isDark, toggle } = useTheme();

  const isActive = (item) => {
    if (!item.path) return false;
    if (item.path === '/dashboard') {
      return pathname === '/dashboard';
    }
    if (item.path === '/scan') {
      return (
        pathname === '/scan' ||
        pathname.startsWith('/scanning') ||
        pathname.startsWith('/results')
      );
    }
    return pathname.startsWith(item.path);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className={`w-64 h-screen fixed left-0 top-0 flex flex-col transition-colors duration-300
      ${isDark ? 'bg-[#131525] text-white' : 'bg-white text-slate-900 border-r border-slate-200'}`}>
      {/* Brand */}
      <div className={`p-5 border-b flex items-center gap-3
        ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500
                        flex items-center justify-center shadow-lg shadow-blue-500/30 flex-shrink-0">
          <ShieldCheck size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-base font-bold leading-tight">
            Secure<span className="text-cyan-400">Trail</span>
          </h1>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>AI Security Platform</p>
        </div>
      </div>

      {/* User profile */}
      {user && (
        <div className={`px-4 py-3 border-b flex items-center gap-3
          ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
          {user.avatar_url
            ? <img src={user.avatar_url} alt="avatar"
                   className="w-8 h-8 rounded-full ring-2 ring-blue-500/40 flex-shrink-0" />
            : <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center
                              text-white text-xs font-bold flex-shrink-0">
                {(user.login || 'U')[0].toUpperCase()}
              </div>
          }
          <div className="overflow-hidden">
            <p className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{user.name || user.login}</p>
            <p className={`text-xs truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>@{user.login}</p>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <p className={`text-xs font-medium uppercase tracking-wider px-3 mb-3
          ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Menu</p>
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon   = item.icon;
            const active = isActive(item);
            const canNav = item.path != null;
            return (
              <li key={item.label}>
                <button
                  onClick={() => canNav && navigate(item.path)}
                  disabled={!canNav}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-sm
                    ${active
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                      : canNav
                        ? isDark
                          ? 'text-slate-300 hover:bg-white/5 hover:text-white'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        : isDark ? 'text-slate-600 cursor-not-allowed' : 'text-slate-300 cursor-not-allowed'}`}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                  {!canNav && (
                    <span className={`ml-auto text-xs px-1.5 py-0.5 rounded
                      ${isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-400'}`}>
                      Soon
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className={`p-4 border-t space-y-1
        ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
        {/* Theme toggle */}
        <button
          onClick={toggle}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm
                     transition-colors mb-1
                     ${isDark
                       ? 'text-slate-400 hover:bg-white/5 hover:text-white'
                       : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
          <span>{isDark ? 'Light mode' : 'Dark mode'}</span>
          <span className={`ml-auto w-9 h-5 rounded-full flex items-center px-0.5 transition-colors
            ${isDark ? 'bg-indigo-600' : 'bg-slate-200'}`}>
            <span className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform
              ${isDark ? 'translate-x-4' : 'translate-x-0'}`} />
          </span>
        </button>
        <button
          onClick={handleLogout}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm
                     transition-colors
                     ${isDark
                       ? 'text-slate-400 hover:bg-red-500/10 hover:text-red-400'
                       : 'text-slate-500 hover:bg-red-50 hover:text-red-500'}`}
        >
          <LogOut size={18} />
          <span>Sign out</span>
        </button>
        <p className={`text-xs text-center pt-1 ${isDark ? 'text-slate-700' : 'text-slate-300'}`}>v2.0.0</p>
      </div>
    </div>
  );
};

export default Sidebar;


