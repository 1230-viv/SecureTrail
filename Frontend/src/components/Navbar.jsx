import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const NAV_LINKS = [
  { label: 'Features',     href: '#features'    },
  { label: 'How it Works', href: '#how-it-works' },
  { label: 'Scanners',     href: '#scanners'     },
];

const Navbar = () => {
  const { isAuthenticated, user, loginWithGitHub, logout } = useAuth();
  const navigate = useNavigate();
  const [scrolled,    setScrolled]    = useState(false);
  const [menuOpen,    setMenuOpen]    = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = (href) => {
    setMenuOpen(false);
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300
        ${scrolled ? 'bg-slate-900/95 backdrop-blur-md shadow-lg shadow-black/20' : 'bg-transparent'}`}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">

        {/* Logo */}
        <button
          onClick={() => { setMenuOpen(false); navigate('/'); }}
          className="flex items-center gap-2.5 group"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400
                          flex items-center justify-center shadow-lg shadow-blue-500/30
                          group-hover:shadow-blue-400/50 transition-shadow">
            <ShieldCheck size={18} className="text-white" />
          </div>
          <span className="text-white font-bold text-lg tracking-tight">
            Secure<span className="text-cyan-400">Trail</span>
          </span>
        </button>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(({ label, href }) => (
            <button
              key={label}
              onClick={() => scrollTo(href)}
              className="px-4 py-2 text-sm text-slate-300 hover:text-white
                         rounded-lg hover:bg-white/5 transition-colors"
            >
              {label}
            </button>
          ))}
        </nav>

        {/* Desktop auth */}
        <div className="hidden md:flex items-center gap-3">
          {isAuthenticated ? (
            <>
              <button
                onClick={() => navigate('/dashboard')}
                className="px-4 py-2 text-sm font-medium text-white
                           bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
              >
                Dashboard
              </button>
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(v => !v)}
                  className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full
                             hover:bg-white/10 transition-colors"
                >
                  {user?.avatar_url
                    ? <img src={user.avatar_url} alt="avatar"
                           className="w-7 h-7 rounded-full ring-2 ring-blue-500/50" />
                    : <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center
                                      justify-center text-white text-xs font-bold">
                        {(user?.login || 'U')[0].toUpperCase()}
                      </div>
                  }
                  <span className="text-sm text-slate-300">{user?.login}</span>
                </button>
                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-44 py-1
                                  bg-slate-800 border border-slate-700 rounded-xl shadow-xl">
                    <button
                      onClick={() => { setUserMenuOpen(false); navigate('/dashboard'); }}
                      className="w-full text-left px-4 py-2 text-sm text-slate-200
                                 hover:bg-slate-700 transition-colors"
                    >
                      Dashboard
                    </button>
                    <button
                      onClick={() => { setUserMenuOpen(false); navigate('/history'); }}
                      className="w-full text-left px-4 py-2 text-sm text-slate-200
                                 hover:bg-slate-700 transition-colors"
                    >
                      Scan History
                    </button>
                    <div className="border-t border-slate-700 my-1" />
                    <button
                      onClick={() => { setUserMenuOpen(false); logout(); navigate('/'); }}
                      className="w-full text-left px-4 py-2 text-sm text-red-400
                                 hover:bg-slate-700 transition-colors"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <button
              onClick={loginWithGitHub}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold
                         bg-gradient-to-r from-blue-600 to-cyan-600
                         hover:from-blue-500 hover:to-cyan-500
                         text-white rounded-lg shadow-lg shadow-blue-600/30
                         hover:shadow-blue-500/40 transition-all"
            >
              <svg viewBox="0 0 16 16" className="w-4 h-4 fill-current" aria-hidden>
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38
                         0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13
                         -.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66
                         .07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15
                         -.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0
                         1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56
                         .82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07
                         -.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
              </svg>
              Login with GitHub
            </button>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMenuOpen(v => !v)}
          className="md:hidden text-slate-300 hover:text-white"
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-slate-900/98 backdrop-blur-md border-t border-slate-800 px-6 pb-6 pt-4 space-y-2">
          {NAV_LINKS.map(({ label, href }) => (
            <button
              key={label}
              onClick={() => scrollTo(href)}
              className="w-full text-left px-4 py-3 text-slate-300 hover:text-white
                         hover:bg-white/5 rounded-lg text-sm transition-colors"
            >
              {label}
            </button>
          ))}
          <div className="pt-2">
            {isAuthenticated ? (
              <button
                onClick={() => { setMenuOpen(false); navigate('/dashboard'); }}
                className="w-full py-3 text-sm font-semibold text-white
                           bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
              >
                Go to Dashboard
              </button>
            ) : (
              <button
                onClick={() => { setMenuOpen(false); loginWithGitHub(); }}
                className="w-full py-3 text-sm font-semibold text-white
                           bg-gradient-to-r from-blue-600 to-cyan-600 rounded-lg"
              >
                Login with GitHub
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
