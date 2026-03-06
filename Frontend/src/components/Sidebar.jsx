import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, History, BookOpen, Settings, LogOut,
  ShieldCheck, ScanLine, Sun, Moon, GraduationCap, Briefcase,
  Lock, ChevronRight, Sparkles, Folder, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useSidebar } from '../context/SidebarContext';

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard',        path: '/dashboard',    description: 'Overview & Stats'     },
  { icon: ScanLine,        label: 'New Scan',          path: '/scan',         description: 'Start A Security Scan' },
  { icon: Folder,          label: 'Repositories',      path: '/repositories', description: 'Manage Repos'          },
  { icon: History,         label: 'Scan History',      path: '/history',      description: 'Past Scan Results'     },
  { icon: Sparkles,        label: 'AI Coach',          path: '/coach',        description: 'Ask Me Anything'       },
  { icon: Settings,        label: 'Settings',          path: null,            description: 'Preferences'           },
];

const Toggle = ({ checked, color = 'indigo' }) => (
  <motion.span
    className="relative inline-flex w-9 h-[20px] rounded-full flex-shrink-0"
    style={{
      background: checked
        ? color === 'indigo'  ? '#6366f1'
        : color === 'emerald' ? '#10b981' : '#6366f1'
        : 'rgba(100,116,139,.3)',
    }}
    animate={{ backgroundColor: checked ? (color === 'emerald' ? '#10b981' : '#6366f1') : 'rgba(100,116,139,.3)' }}
    transition={{ duration: 0.25 }}
  >
    <motion.span
      className="absolute top-[2px] left-[2px] w-4 h-4 rounded-full bg-white shadow"
      animate={{ x: checked ? 17 : 0 }}
      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
    />
  </motion.span>
);

const Sidebar = () => {
  const navigate       = useNavigate();
  const { pathname }   = useLocation();
  const { user, logout } = useAuth();
  const { isDark, toggle, isStudentMode, toggleMode } = useTheme();
  const { collapsed, setCollapsed } = useSidebar();
  const [hovered, setHovered] = useState(null);

  const isActive = item => {
    if (!item.path) return false;
    if (item.path === '/dashboard') return pathname === '/dashboard';
    if (item.path === '/scan') return pathname === '/scan' || pathname.startsWith('/scanning') || pathname.startsWith('/results');
    return pathname.startsWith(item.path);
  };

  const handleLogout = async () => { await logout(); navigate('/'); };
  const userInitial = (user?.login || 'U')[0].toUpperCase();

  /* sidebar width */
  const W      = collapsed ? 72 : 256;
  const INNER  = collapsed ? 'items-center' : '';

  return (
    <motion.div
      animate={{ width: W }}
      transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      className="fixed left-0 top-0 h-screen flex flex-col z-40 select-none overflow-hidden"
      style={{
        background:   isDark ? '#0c0e1a' : '#fff',
        borderRight:  isDark ? '1px solid rgba(255,255,255,.06)' : '1px solid #e8edf4',
        boxShadow:    isDark ? '4px 0 28px rgba(0,0,0,.4)' : '4px 0 20px rgba(0,0,0,.05)',
      }}
    >
      {/* ── Brand ─────────────────────── */}
      <div className="flex items-center justify-between px-4 py-4 flex-shrink-0"
        style={{ borderBottom: isDark ? '1px solid rgba(255,255,255,.06)' : '1px solid #f1f5f9' }}>
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }} transition={{ duration: 0.2 }}
              className="flex items-center gap-2.5 overflow-hidden whitespace-nowrap"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 via-indigo-500 to-cyan-400
                flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-500/35 relative">
                <ShieldCheck size={15} className="text-white" strokeWidth={2.5} />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full ring-2"
                  style={{ ringColor: isDark ? '#0c0e1a' : '#fff' }} />
              </div>
              <div>
                <h1 className="text-[14px] font-extrabold tracking-tight leading-none"
                  style={{ color: isDark ? '#f1f5f9' : '#0f172a' }}>
                  Secure<span style={{
                    background: 'linear-gradient(90deg,#22d3ee,#818cf8)',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  }}>Trail</span>
                </h1>
                <p className="text-[10px] font-medium mt-0.5" style={{ color: isDark ? '#334155' : '#94a3b8' }}>
                  AI Security Platform
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {collapsed && (
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 via-indigo-500 to-cyan-400
            flex items-center justify-center shadow-lg shadow-indigo-500/35 mx-auto">
            <ShieldCheck size={15} className="text-white" strokeWidth={2.5} />
          </div>
        )}

        {!collapsed && (
          <motion.button
            whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
            onClick={() => setCollapsed(true)}
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ color: isDark ? '#334155' : '#94a3b8',
              background: isDark ? 'rgba(255,255,255,.05)' : '#f8fafc' }}
          >
            <PanelLeftClose size={14} />
          </motion.button>
        )}
      </div>

      {/* Expand button when collapsed */}
      {collapsed && (
        <motion.button
          whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
          onClick={() => setCollapsed(false)}
          className="mx-auto mt-2 w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ color: isDark ? '#334155' : '#94a3b8',
            background: isDark ? 'rgba(255,255,255,.05)' : '#f8fafc' }}
        >
          <PanelLeftOpen size={14} />
        </motion.button>
      )}

      {/* ── User profile ────────────────── */}
      <AnimatePresence initial={false}>
        {!collapsed && user && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}
            className="mx-3 mt-3 rounded-2xl p-3 flex items-center gap-2.5 flex-shrink-0"
            style={{
              background:  isDark ? 'rgba(255,255,255,.04)' : '#f8fafc',
              border:      isDark ? '1px solid rgba(255,255,255,.07)' : '1px solid #e8edf4',
              boxShadow:   '0 2px 8px rgba(0,0,0,.04)',
            }}
          >
            <div className="relative flex-shrink-0">
              {user.avatar_url
                ? <img src={user.avatar_url} alt="avatar"
                    className="w-9 h-9 rounded-full"
                    style={{ boxShadow: '0 0 0 2px #6366f155' }} />
                : <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold"
                    style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
                    {userInitial}
                  </div>
              }
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400"
                style={{ border: `2px solid ${isDark ? '#0c0e1a' : '#f8fafc'}` }} />
            </div>
            <div className="overflow-hidden flex-1 min-w-0">
              <p className="text-[13px] font-semibold truncate leading-tight"
                style={{ color: isDark ? '#f1f5f9' : '#0f172a' }}>
                {user.name || user.login}
              </p>
              <p className="text-[11px] truncate mt-0.5" style={{ color: isDark ? '#334155' : '#94a3b8' }}>
                @{user.login}
              </p>
            </div>
            <motion.span
              whileHover={{ scale: 1.06 }}
              className="flex-shrink-0 text-[10px] font-extrabold px-2 py-0.5 rounded-lg"
              style={{
                background: isStudentMode ? 'rgba(16,185,129,.12)' : 'rgba(99,102,241,.12)',
                color:      isStudentMode ? '#34d399' : '#818cf8',
                border:     isStudentMode ? '1px solid rgba(16,185,129,.2)' : '1px solid rgba(99,102,241,.2)',
              }}
            >
              {isStudentMode ? 'STU' : 'PRO'}
            </motion.span>
          </motion.div>
        )}
        {collapsed && user && (
          <div className="flex justify-center mt-3">
            {user.avatar_url
              ? <img src={user.avatar_url} alt="avatar" className="w-9 h-9 rounded-full"
                  style={{ boxShadow: '0 0 0 2px #6366f155' }} />
              : <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold"
                  style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
                  {userInitial}
                </div>
            }
          </div>
        )}
      </AnimatePresence>

      {/* ── Navigation ──────────────────── */}
      <nav className="flex-1 px-2 pb-2 overflow-y-auto overflow-x-hidden mt-3">
        {!collapsed && (
          <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest"
            style={{ color: isDark ? '#1e293b' : '#cbd5e1' }}>
            Navigation
          </p>
        )}
        <ul className="space-y-0.5">
          {NAV_ITEMS.map(item => {
            const Icon   = item.icon;
            const active = isActive(item);
            const canNav = item.path != null;

            return (
              <li key={item.label}>
                <motion.button
                  onClick={() => canNav && navigate(item.path)}
                  disabled={!canNav}
                  title={collapsed ? item.label : (!canNav ? 'Coming Soon' : undefined)}
                  whileHover={canNav ? { x: collapsed ? 0 : 3 } : {}}
                  whileTap={canNav ? { scale: 0.98 } : {}}
                  onHoverStart={() => setHovered(item.label)}
                  onHoverEnd={() => setHovered(null)}
                  className="relative w-full flex items-center gap-3 rounded-xl text-[13px] font-medium transition-colors duration-150"
                  style={{
                    padding:    collapsed ? '10px' : '10px 12px',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    color: active
                      ? '#fff'
                      : canNav
                        ? isDark ? '#64748b' : '#64748b'
                        : isDark ? '#1e293b' : '#cbd5e1',
                    background: active
                      ? undefined
                      : (hovered === item.label && canNav)
                        ? isDark ? 'rgba(255,255,255,.05)' : '#f8fafc'
                        : 'transparent',
                    cursor: canNav ? 'pointer' : 'not-allowed',
                  }}
                >
                  {/* Active background with glow */}
                  {active && (
                    <motion.div
                      layoutId="activeNav"
                      className="absolute inset-0 rounded-xl"
                      style={{
                        background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                        boxShadow:  '0 4px 20px rgba(99,102,241,.4)',
                      }}
                      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                    />
                  )}

                  {/* Left active bar (non-collapsed) */}
                  {active && !collapsed && (
                    <motion.div
                      layoutId="activeBar"
                      className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full"
                      style={{ background: 'rgba(255,255,255,.6)' }}
                    />
                  )}

                  {/* Icon */}
                  <motion.span
                    whileHover={canNav && !active ? { rotate: [0, -8, 8, 0] } : {}}
                    transition={{ duration: 0.35 }}
                    className="relative z-10 flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg"
                    style={{
                      background: active
                        ? 'rgba(255,255,255,.2)'
                        : (hovered === item.label && canNav)
                          ? isDark ? 'rgba(255,255,255,.08)' : '#f1f5f9'
                          : isDark ? 'rgba(255,255,255,.04)' : '#f8fafc',
                      color: active ? '#fff' : canNav ? (isDark ? '#94a3b8' : '#64748b') : isDark ? '#1e293b' : '#d1d5db',
                    }}
                  >
                    {!canNav
                      ? <Lock size={13} />
                      : <Icon size={14} strokeWidth={active ? 2.5 : 2} />
                    }
                  </motion.span>

                  {/* Label */}
                  <AnimatePresence initial={false}>
                    {!collapsed && (
                      <motion.span
                        initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }}
                        exit={{ opacity: 0, width: 0 }} transition={{ duration: 0.18 }}
                        className="relative z-10 flex-1 text-left whitespace-nowrap overflow-hidden"
                        style={{ color: active ? '#fff' : undefined }}
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>

                  {/* Right indicator */}
                  <AnimatePresence initial={false}>
                    {!collapsed && (
                      <motion.span
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="relative z-10 flex-shrink-0"
                      >
                        {!canNav ? (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                            style={{ background: isDark ? 'rgba(255,255,255,.05)' : '#f1f5f9',
                              color: isDark ? '#334155' : '#cbd5e1' }}>
                            Soon
                          </span>
                        ) : active ? (
                          <ChevronRight size={13} style={{ opacity: 0.7 }} />
                        ) : null}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              </li>
            );
          })}
        </ul>

        {/* AI badge */}
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 mx-1 rounded-2xl p-3 flex items-center gap-2.5 overflow-hidden"
              style={{
                background: isDark
                  ? 'linear-gradient(135deg,rgba(99,102,241,.1),rgba(139,92,246,.08))'
                  : 'linear-gradient(135deg,#eef2ff,#f5f3ff)',
                border: isDark ? '1px solid rgba(99,102,241,.2)' : '1px solid #e0e7ff',
              }}
            >
              <motion.div
                animate={{ rotate: [0, 8, -8, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(99,102,241,.2)' }}
              >
                <Sparkles size={13} style={{ color: '#818cf8' }} />
              </motion.div>
              <div>
                <p className="text-[11px] font-bold leading-tight" style={{ color: isDark ? '#818cf8' : '#6366f1' }}>
                  AI-Powered Scanning
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: isDark ? '#4338ca' : '#a5b4fc' }}>
                  Bedrock + Semgrep
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* ── Footer ──────────────────────── */}
      <div className="px-2 pb-4 pt-2 flex-shrink-0"
        style={{ borderTop: isDark ? '1px solid rgba(255,255,255,.06)' : '1px solid #f1f5f9' }}>

        {/* Theme toggle */}
        <motion.button
          whileHover={{ x: collapsed ? 0 : 3 }} whileTap={{ scale: 0.98 }}
          onClick={toggle}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-colors"
          style={{
            justifyContent: collapsed ? 'center' : 'flex-start',
            color: isDark ? '#64748b' : '#64748b',
          }}
          onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,.05)' : '#f8fafc'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <span className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0"
            style={{ background: isDark ? 'rgba(255,255,255,.05)' : '#f1f5f9',
              color: isDark ? '#94a3b8' : '#64748b' }}>
            {isDark ? <Sun size={14} /> : <Moon size={14} />}
          </span>
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }} className="flex-1 text-left whitespace-nowrap">
                {isDark ? 'Light Mode' : 'Dark Mode'}
              </motion.span>
            )}
          </AnimatePresence>
          {!collapsed && <Toggle checked={isDark} color="indigo" />}
        </motion.button>

        {/* Student/Pro toggle */}
        <motion.button
          whileHover={{ x: collapsed ? 0 : 3 }} whileTap={{ scale: 0.98 }}
          onClick={toggleMode}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-colors"
          style={{
            justifyContent: collapsed ? 'center' : 'flex-start',
            color: isDark ? '#64748b' : '#64748b',
          }}
          onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,.05)' : '#f8fafc'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <span className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0"
            style={{ background: isDark ? 'rgba(255,255,255,.05)' : '#f1f5f9',
              color: isDark ? '#94a3b8' : '#64748b' }}>
            {isStudentMode ? <GraduationCap size={14} /> : <Briefcase size={14} />}
          </span>
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }} className="flex-1 text-left whitespace-nowrap">
                {isStudentMode ? 'Student Mode' : 'Pro Mode'}
              </motion.span>
            )}
          </AnimatePresence>
          {!collapsed && <Toggle checked={isStudentMode} color="emerald" />}
        </motion.button>

        {/* Divider */}
        <div className="my-1 mx-2 h-px" style={{ background: isDark ? 'rgba(255,255,255,.06)' : '#f1f5f9' }} />

        {/* Sign out */}
        <motion.button
          whileHover={{ x: collapsed ? 0 : 3 }} whileTap={{ scale: 0.98 }}
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-colors"
          style={{ justifyContent: collapsed ? 'center' : 'flex-start', color: '#ef4444' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,.08)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <span className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0"
            style={{ background: 'rgba(239,68,68,.1)', color: '#f87171' }}>
            <LogOut size={14} />
          </span>
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }} className="whitespace-nowrap">
                Sign Out
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>

        {/* Version */}
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.p
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="text-[10px] text-center pt-2 font-medium"
              style={{ color: isDark ? '#1e293b' : '#e2e8f0' }}>
              SecureTrail v2.0.0
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default Sidebar;


