import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';

export const AppShell = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col font-sans">
      <Navbar onToggleSidebar={() => setSidebarOpen(true)} />
      <div className="flex-1 flex overflow-hidden">
        {/* Responsive Sidebar for Dashboard / Console Context */}
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      <footer className="border-t border-border-subtle bg-surface py-6 px-4 sm:px-8 text-center sm:flex sm:justify-between sm:items-center">
        <p className="font-mono text-xs text-ink-muted uppercase tracking-wider">
          © 2026 MailFlow — Smart Bulk Email & Campaign Automation Platform
        </p>
        <p className="font-mono text-xs text-ink-muted mt-2 sm:mt-0 uppercase tracking-widest">
          Phase 1: Project Foundation Complete
        </p>
      </footer>
    </div>
  );
};
