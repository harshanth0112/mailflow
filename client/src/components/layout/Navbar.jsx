import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Mail, Menu, X, Activity, User, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const Navbar = ({ onToggleSidebar }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-canvas/90 backdrop-blur-md border-b border-border-subtle">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand identity */}
        <div className="flex items-center gap-4">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="p-2 text-ink-muted hover:text-ink lg:hidden focus:outline-none"
              aria-label="Toggle navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-subtle bg-brand-red flex items-center justify-center text-white shadow-sm transition-transform group-hover:scale-105">
              <Mail className="w-4 h-4" />
            </div>
            <span className="font-display text-2xl tracking-wider text-ink uppercase">
              Mail<span className="text-brand-red">Flow</span>
            </span>
          </Link>
          <span className="hidden sm:inline-block font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border border-border-subtle bg-surface text-ink-muted">
            Phase 3
          </span>
        </div>

        {/* Center / Navigation Links */}
        <nav className="hidden md:flex items-center gap-8 text-xs font-mono uppercase tracking-wider text-ink-muted">
          <Link
            to="/"
            className={`transition-colors hover:text-ink ${location.pathname === '/' ? 'text-brand-red font-semibold' : ''}`}
          >
            Overview
          </Link>
          <Link
            to="/architecture"
            className={`transition-colors hover:text-ink ${location.pathname === '/architecture' ? 'text-brand-red font-semibold' : ''}`}
          >
            Architecture
          </Link>
          {isAuthenticated && (
            <Link
              to="/dashboard"
              className={`transition-colors hover:text-ink ${location.pathname === '/dashboard' ? 'text-brand-red font-semibold' : ''}`}
            >
              Dashboard
            </Link>
          )}
        </nav>

        {/* Right side CTA & User Status */}
        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <Link
                to="/dashboard"
                className="hidden sm:inline-flex items-center gap-2 text-xs font-medium text-slate-200 hover:text-white bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg"
              >
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>{user?.name || user?.email}</span>
              </Link>
              <button
                onClick={logout}
                className="inline-flex items-center justify-center p-2 text-slate-400 hover:text-red-400 transition-colors"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="font-mono uppercase tracking-wider text-xs px-3.5 py-1.5 text-slate-300 hover:text-white transition-colors"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="font-mono uppercase tracking-wider text-xs px-3.5 py-1.5 bg-brand-red text-white hover:bg-red-600 transition-colors rounded-subtle shadow-sm"
              >
                Get Started
              </Link>
            </div>
          )}

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-ink md:hidden focus:outline-none"
            aria-label="Open menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-border-subtle bg-surface px-4 py-4 space-y-3">
          <Link
            to="/"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-xs font-mono uppercase tracking-wider text-ink py-1"
          >
            Overview
          </Link>
          <Link
            to="/architecture"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-xs font-mono uppercase tracking-wider text-ink py-1"
          >
            Architecture
          </Link>
          {isAuthenticated ? (
            <>
              <Link
                to="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="block text-xs font-mono uppercase tracking-wider text-brand-red py-1"
              >
                Dashboard
              </Link>
              <button
                onClick={() => {
                  logout();
                  setMobileMenuOpen(false);
                }}
                className="block w-full text-left text-xs font-mono uppercase tracking-wider text-red-400 py-1"
              >
                Sign Out
              </button>
            </>
          ) : (
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="block text-xs font-mono uppercase tracking-wider text-slate-300 py-1"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                onClick={() => setMobileMenuOpen(false)}
                className="block text-xs font-mono uppercase tracking-wider text-brand-red py-1"
              >
                Create Account
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
};

export default Navbar;
