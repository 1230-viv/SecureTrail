import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, History, BookOpen, Settings, LogOut,
  ShieldCheck, ScanLine, Sun, Moon, GraduationCap, Briefcase,
  Lock, ChevronRight, Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard',        path: '/dashboard', description: 'Overview & stats'     },
  { icon: ScanLine,        label: 'New Scan',          path: '/scan',      description: 'Start a security scan' },
  { icon: History,         label: 'Scan History',      path: '/history',   description: 'Past scan results'     },
  { icon: BookOpen,        label: 'Learning Insights', path: null,         description: 'AI-powered tips'       },
  { icon: Settings,        label: 'Settings',          path: null,         description: 'Preferences'           },
];

/** Pill toggle used in the footer */
const Toggle = ({ checked, color = 'indigo' }) => (
  <span
    className={`relative inline-flex w-10 h-[22px] rounded-full flex-shrink-0 transition-all duration-300
      ${checked ? `bg-${color}-500` : 'bg-slate-300 dark:bg-slate-700'}`}
  >
    <span
      className={`absolute top-[3px] left-[3px] w-4 h-4 rounded-full bg-white shadow
        transition-transform duration-300 ${checked ? 'translate-x-[18px]' : 'translate-x-0'}`}
    />
  </span>
);

/**
 * Sidebar — protected-area navigation with user profile at the top.
 */
const Sidebar = () => {
  const navigate     = useNavigate();
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const { isDark, toggle, isStudentMode, toggleMode } = useTheme();

  const isActive = (item) => {
    if (!item.path) return false;
    if (item.path === '/dashboard') return pathname === '/dashboard';
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

  const userInitial = (user?.login || 'U')[0].toUpperCase();

  return (
    <div
      className={`w-64 h-screen fixed left-0 top-0 flex flex-col transition-colors duration-300 select-none
        ${isDark
          ? 'bg-[#0f1120] text-white border-r border-white/[0.06]'
          : 'bg-white text-slate-900 border-r border-slate-200'}`}
    >
      {/* ── Brand ─────────────────────────────── */}
      <div className={`px-5 py-4 flex items-center gap-3 border-b
        ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
        <div className="relative flex-shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 via-indigo-500 to-cyan-500
                          flex items-center justify-center shadow-lg shadow-blue-500/30">
            <ShieldCheck size={17} className="text-white" strokeWidth={2.2} />
          </div>
          {/* Live pulse dot */}
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full
                           ring-2 ring-[#0f1120] animate-pulse" />
        </div>
        <div>
          <h1 className="text-[15px] font-extrabold tracking-tight leading-none">
            Secure<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">Trail</span>
          </h1>
          <p className={`text-[11px] mt-0.5 font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            AI Security Platform
          </p>
        </div>
      </div>

      {/* ── User profile card ─────────────────── */}
      {user && (
        <div className={`mx-3 my-3 rounded-xl p-3 flex items-center gap-3
          ${isDark ? 'bg-white/[0.04] ring-1 ring-white/[0.07]' : 'bg-slate-50 ring-1 ring-slate-200'}`}>
          <div className="relative flex-shrink-0">
            {user.avatar_url
              ? <img
                  src={user.avatar_url}
                  alt="avatar"
                  className="w-9 h-9 rounded-full ring-2 ring-blue-500/40"
                />
              : <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600
                                flex items-center justify-center text-white text-sm font-bold">
                  {userInitial}
                </div>
            }
            {/* Online indicator */}
            <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400
              ${isDark ? 'ring-[#0f1120]' : 'ring-slate-50'} ring-2`} />
          </div>
          <div className="overflow-hidden flex-1">
            <p className={`text-sm font-semibold truncate leading-tight
              ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {user.name || user.login}
            </p>
            <p className={`text-xs truncate mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              @{user.login}
            </p>
          </div>
          {/* Mode badge */}
          <span className={`flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-md
            ${isStudentMode
              ? 'bg-emerald-500/15 text-emerald-400'
              : 'bg-blue-500/15 text-blue-400'}`}>
            {isStudentMode ? 'STU' : 'PRO'}
          </span>
        </div>
      )}

      {/* ── Navigation ────────────────────────── */}
      <nav className="flex-1 px-3 pb-2 overflow-y-auto">
        <p className={`text-[10px] font-semibold uppercase tracking-widest px-3 mb-2 mt-1
          ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
          Navigation
        </p>

        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const Icon   = item.icon;
            const active = isActive(item);
            const canNav = item.path != null;

            return (
              <li key={item.label}>
                <button
                  onClick={() => canNav && navigate(item.path)}
                  disabled={!canNav}
                  title={!canNav ? 'Coming soon' : undefined}
                  className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
                    text-sm font-medium transition-all duration-200
                    ${active
                      ? isDark
                        ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-700/30'
                        : 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25'
                      : canNav
                        ? isDark
                          ? 'text-slate-400 hover:text-white hover:bg-white/[0.07]'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        : isDark
                          ? 'text-slate-700 cursor-not-allowed'
                          : 'text-slate-300 cursor-not-allowed'
                    }`}
                >
                  {/* Icon container */}
                  <span className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200
                    ${active
                      ? 'bg-white/20'
                      : canNav
                        ? isDark
                          ? 'bg-white/[0.05] group-hover:bg-white/10'
                          : 'bg-slate-100 group-hover:bg-slate-200'
                        : 'bg-transparent'
                    }`}>
                    {!canNav
                      ? <Lock size={14} className={isDark ? 'text-slate-700' : 'text-slate-300'} />
                      : <Icon size={15} strokeWidth={active ? 2.5 : 2} />
                    }
                  </span>

                  <span className="flex-1 text-left">{item.label}</span>

                  {/* Right indicator */}
                  {!canNav ? (
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md
                      ${isDark ? 'bg-slate-800 text-slate-600' : 'bg-slate-100 text-slate-400'}`}>
                      Soon
                    </span>
                  ) : active ? (
                    <ChevronRight size={14} className="opacity-70" />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>

        {/* Decorative AI badge */}
        <div className={`mt-4 mx-1 rounded-xl p-3 flex items-center gap-2.5
          ${isDark
            ? 'bg-gradient-to-br from-indigo-900/40 to-blue-900/20 ring-1 ring-indigo-700/30'
            : 'bg-gradient-to-br from-indigo-50 to-blue-50 ring-1 ring-indigo-100'}`}>
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0
            ${isDark ? 'bg-indigo-500/20' : 'bg-indigo-100'}`}>
            <Sparkles size={13} className={isDark ? 'text-indigo-400' : 'text-indigo-500'} />
          </div>
          <div>
            <p className={`text-[11px] font-semibold leading-tight ${isDark ? 'text-indigo-300' : 'text-indigo-700'}`}>
              AI-Powered Scanning
            </p>
            <p className={`text-[10px] mt-0.5 ${isDark ? 'text-indigo-500' : 'text-indigo-400'}`}>
              Bedrock + Semgrep
            </p>
          </div>
        </div>
      </nav>

      {/* ── Footer ────────────────────────────── */}
      <div className={`px-3 pb-4 pt-3 border-t space-y-0.5
        ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>

        {/* Theme toggle */}
        <button
          onClick={toggle}
          className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
            transition-all duration-200
            ${isDark
              ? 'text-slate-400 hover:text-white hover:bg-white/[0.07]'
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
        >
          <span className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200
            ${isDark ? 'bg-white/[0.05] group-hover:bg-white/10' : 'bg-slate-100 group-hover:bg-slate-200'}`}>
            {isDark ? <Sun size={14} /> : <Moon size={14} />}
          </span>
          <span className="flex-1 text-left">{isDark ? 'Light Mode' : 'Dark Mode'}</span>
          <Toggle checked={isDark} color="indigo" />
        </button>

        {/* Student / Pro mode toggle */}
        <button
          onClick={toggleMode}
          className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
            transition-all duration-200
            ${isDark
              ? 'text-slate-400 hover:text-white hover:bg-white/[0.07]'
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
        >
          <span className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200
            ${isDark ? 'bg-white/[0.05] group-hover:bg-white/10' : 'bg-slate-100 group-hover:bg-slate-200'}`}>
            {isStudentMode ? <GraduationCap size={14} /> : <Briefcase size={14} />}
          </span>
          <span className="flex-1 text-left">{isStudentMode ? 'Student Mode' : 'Pro Mode'}</span>
          <Toggle checked={isStudentMode} color="emerald" />
        </button>

        {/* Divider */}
        <div className={`my-1 mx-3 h-px ${isDark ? 'bg-white/[0.06]' : 'bg-slate-100'}`} />

        {/* Sign out */}
        <button
          onClick={handleLogout}
          className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
            transition-all duration-200
            ${isDark
              ? 'text-slate-400 hover:text-red-400 hover:bg-red-500/[0.08]'
              : 'text-slate-500 hover:text-red-600 hover:bg-red-50'}`}
        >
          <span className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200
            ${isDark
              ? 'bg-white/[0.05] group-hover:bg-red-500/10'
              : 'bg-slate-100 group-hover:bg-red-50'}`}>
            <LogOut size={14} />
          </span>
          <span>Sign Out</span>
        </button>

        {/* Version */}
        <p className={`text-[10px] text-center pt-1 font-medium
          ${isDark ? 'text-slate-700' : 'text-slate-300'}`}>
          SecureTrail v2.0.0
        </p>
      </div>
    </div>
  );
};

export default Sidebar;


