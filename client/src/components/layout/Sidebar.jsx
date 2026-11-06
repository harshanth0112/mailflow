import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Layers, Activity, ShieldCheck, Database, X } from 'lucide-react';

export const Sidebar = ({ isOpen, onClose }) => {
  const navItems = [
    { label: 'Overview', to: '/', icon: Home },
    { label: 'Architecture', to: '/architecture', icon: Layers },
    { label: 'System Health', to: '/#system-status', icon: Activity },
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
          <div className="flex items-center gap-2">
            <span className="font-display text-xl tracking-wider uppercase text-ink">
              Navigation
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
          {navItems.map((item) => {
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

        {/* Phase 1 Badge Footer */}
        <div className="p-4 border-t border-border-subtle bg-canvas/40">
          <div className="flex items-center gap-2 text-ink-muted">
            <ShieldCheck className="w-4 h-4 text-status-success" />
            <span className="text-[11px] font-mono uppercase tracking-wider">MERN Foundation</span>
          </div>
          <p className="text-[11px] text-ink-muted mt-1 leading-normal">
            Ready for Phase 2 authentication and campaign modules.
          </p>
        </div>
      </aside>
    </>
  );
};
