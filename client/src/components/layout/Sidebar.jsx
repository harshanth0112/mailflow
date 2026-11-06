import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Layers, Activity, ShieldCheck, Settings, Users, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';

export const Sidebar = ({ isOpen, onClose }) => {
  const { isAuthenticated } = useAuth();
  const { workspace, userRole } = useWorkspace();

  const navItems = [
    { label: 'Overview', to: '/', icon: Home, public: true },
    { label: 'Architecture', to: '/architecture', icon: Layers, public: true },
    { label: 'Dashboard', to: '/dashboard', icon: Activity, protected: true },
    { label: 'Team Members', to: '/workspace/members', icon: Users, protected: true },
    { label: 'Settings', to: '/workspace/settings', icon: Settings, protected: true },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-brand-dark/40 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar aside */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-surface border-r border-border-subtle flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 px-6 border-b border-border-subtle flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="font-display text-sm tracking-wider uppercase text-ink truncate">
              {workspace?.name || 'MailFlow Workspace'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-ink-muted hover:text-ink lg:hidden focus:outline-none"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 flex-1 space-y-1">
          {navItems
            .filter((item) => !item.protected || isAuthenticated)
            .map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.label}
                  to={item.to}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3.5 py-2.5 rounded-subtle text-xs font-mono uppercase tracking-wider transition-colors ${
                      isActive && item.to === '/'
                        ? 'bg-canvas text-brand-red font-semibold'
                        : isActive
                        ? 'bg-canvas text-brand-red font-semibold'
                        : 'text-ink-muted hover:text-ink hover:bg-canvas'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
        </div>

        {/* Phase 3 Workspace Badge Footer */}
        <div className="p-4 border-t border-border-subtle bg-canvas/40">
          <div className="flex items-center justify-between text-ink-muted">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-status-success" />
              <span className="text-[11px] font-mono uppercase tracking-wider">
                {userRole || 'Isolated'}
              </span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface border border-border-subtle text-ink-muted">
              Phase 3
            </span>
          </div>
        </div>
      </aside>
    </>
  );
};

