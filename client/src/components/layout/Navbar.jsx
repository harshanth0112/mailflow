import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Mail, Menu, X, Activity } from 'lucide-react';

export const Navbar = ({ onToggleSidebar }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

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
            Phase 1
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
          <a
            href="#system-status"
            className="transition-colors hover:text-ink flex items-center gap-1.5"
          >
            <Activity className="w-3.5 h-3.5 text-status-success" />
            API Health
          </a>
        </nav>

        {/* Right side CTA */}
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="hidden sm:inline-flex items-center justify-center font-mono uppercase tracking-wider text-xs px-4 py-2 bg-ink text-surface hover:bg-brand-red transition-colors rounded-subtle"
          >
            Phase 1 Foundation
          </Link>
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
          <a
            href="#system-status"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-xs font-mono uppercase tracking-wider text-ink py-1"
          >
            API Health
          </a>
        </div>
      )}
    </header>
  );
};
