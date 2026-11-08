import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Navbar } from './Navbar';
import { AppSidebar } from './AppSidebar';
import { OnboardingTour } from '../onboarding/OnboardingTour';
import { AiChatWidget } from '../chat/AiChatWidget';
import { useAuth } from '../../context/AuthContext';

// Pages that use the full-width app sidebar layout (authenticated dashboard)
const DASHBOARD_PATHS = [
  '/dashboard',
  '/contacts',
  '/campaigns',
  '/scheduled',
  '/templates',
  '/auto-reply',
  '/analytics',
  '/activity',
  '/notifications',
  '/settings',
  '/workspace',
  '/compose',
  '/admin',
  '/help',
];

const isDashboardRoute = (pathname) =>
  DASHBOARD_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));

export const AppShell = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  const showDashboardLayout = isAuthenticated && isDashboardRoute(location.pathname);

  return (
    <div className="min-h-screen bg-canvas text-ink font-sans">
      {/* Onboarding Tour (overlay, only shown when needed) */}
      {isAuthenticated && <OnboardingTour />}

      {/* Floating AI Assistant Chatbot */}
      {isAuthenticated && <AiChatWidget />}

      {showDashboardLayout ? (
        // --- Dashboard layout: sidebar + content, no top navbar ---
        <div className="flex h-screen overflow-hidden">
          <AppSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Dashboard top bar */}
            <DashboardTopBar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
            <main className="flex-1 overflow-y-auto bg-slate-950 p-6 lg:p-8">
              <Outlet />
            </main>
          </div>
        </div>
      ) : (
        // --- Marketing/public layout: full-width with top navbar ---
        <div className="flex flex-col min-h-screen">
          <Navbar onToggleSidebar={() => setSidebarOpen(true)} />
          <main className="flex-1">
            <Outlet />
          </main>
          <footer className="border-t border-border-subtle bg-surface py-6 px-4 sm:px-8 text-center sm:flex sm:justify-between sm:items-center">
            <p className="font-mono text-xs text-ink-muted uppercase tracking-wider">
              © 2026 MailFlow — Smart Bulk Email & Campaign Automation
            </p>
            <p className="font-mono text-xs text-ink-muted mt-2 sm:mt-0 uppercase tracking-widest">
              Phase 4 & 5: Onboarding + Dashboard UI
            </p>
          </footer>
        </div>
      )}
    </div>
  );
};

// Lightweight top bar used only inside the dashboard layout
const DashboardTopBar = ({ onToggleSidebar }) => {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 lg:px-6 flex-shrink-0 z-10">
      <button
        onClick={onToggleSidebar}
        className="lg:hidden p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-800"
        aria-label="Toggle sidebar"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <div className="flex items-center gap-1 ml-auto">
        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 text-xs font-bold">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <span className="hidden md:inline font-medium">{user?.name}</span>
          </button>

          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 top-full mt-1 w-52 z-20 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-700">
                  <p className="text-xs text-slate-400">Signed in as</p>
                  <p className="text-sm font-semibold text-white truncate">{user?.email}</p>
                </div>
                <div className="p-1">
                  <button
                    onClick={() => { logout(); setMenuOpen(false); }}
                    className="w-full text-left px-3 py-2 text-sm text-rose-400 hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
