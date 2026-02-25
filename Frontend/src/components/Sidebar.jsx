import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, History, BookOpen, Settings, LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard',         path: '/dashboard' },
  { icon: History,         label: 'Scan History',      path: '/history'   },
  { icon: BookOpen,        label: 'Learning Insights',  path: null         },
  { icon: Settings,        label: 'Settings',           path: null         },
];

/**
 * Sidebar — protected-area navigation with user profile at the top.
 */
const Sidebar = () => {
  const navigate     = useNavigate();
  const { pathname } = useLocation();
  const { user, logout } = useAuth();

  const isActive = (item) => {
    if (!item.path) return false;
    if (item.path === '/dashboard') {
      return (
        pathname === '/dashboard' ||
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
    <div className="w-64 bg-[#1E293B] text-white h-screen fixed left-0 top-0 flex flex-col">
      {/* Brand */}
      <div className="p-5 border-b border-slate-700/60 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500
                        flex items-center justify-center shadow-lg shadow-blue-500/30 flex-shrink-0">
          <ShieldCheck size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-base font-bold leading-tight">
            Secure<span className="text-cyan-400">Trail</span>
          </h1>
          <p className="text-xs text-slate-400">AI Security Platform</p>
        </div>
      </div>

      {/* User profile */}
      {user && (
        <div className="px-4 py-3 border-b border-slate-700/60 flex items-center gap-3">
          {user.avatar_url
            ? <img src={user.avatar_url} alt="avatar"
                   className="w-8 h-8 rounded-full ring-2 ring-blue-500/40 flex-shrink-0" />
            : <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center
                              text-white text-xs font-bold flex-shrink-0">
                {(user.login || 'U')[0].toUpperCase()}
              </div>
          }
          <div className="overflow-hidden">
            <p className="text-sm font-medium text-white truncate">{user.name || user.login}</p>
            <p className="text-xs text-slate-400 truncate">@{user.login}</p>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wider px-3 mb-3">Menu</p>
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
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                      : canNav
                        ? 'text-slate-300 hover:bg-slate-700/60 hover:text-white'
                        : 'text-slate-600 cursor-not-allowed'}`}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                  {!canNav && (
                    <span className="ml-auto text-xs bg-slate-700 text-slate-400
                                     px-1.5 py-0.5 rounded">
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
      <div className="p-4 border-t border-slate-700/60 space-y-2">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm
                     text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors"
        >
          <LogOut size={18} />
          <span>Sign out</span>
        </button>
        <p className="text-xs text-slate-600 text-center">v2.0.0</p>
      </div>
    </div>
  );
};

export default Sidebar;


