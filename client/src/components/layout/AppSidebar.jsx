import React, { useState } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import {
  LayoutDashboard,
  Users,
  Send,
  Calendar,
  Reply,
  FileText,
  BarChart2,
  Activity,
  Bell,
  Settings,
  HelpCircle,
  Mail,
  ChevronDown,
  X,
  Building,
  UserCog,
  RefreshCw,
  LogOut,
  Shield,
  Zap,
} from 'lucide-react';

const NAV_SECTIONS = [
  {
    label: null, // no section header
    items: [
      { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Work',
    items: [
      { label: 'Contacts', to: '/contacts', icon: Users },
      { label: 'Campaigns', to: '/campaigns', icon: Send },
      { label: 'Scheduled', to: '/scheduled', icon: Calendar },
      { label: 'Auto Reply', to: '/auto-reply', icon: Reply },
      { label: 'Templates', to: '/templates', icon: FileText },
    ],
  },
  {
    label: 'Insights',
    items: [
      { label: 'Analytics', to: '/analytics', icon: BarChart2 },
      { label: 'Activity Logs', to: '/activity', icon: Activity },
      { label: 'Notifications', to: '/notifications', icon: Bell },
    ],
  },
  {
    label: 'Administration',
    items: [
      { label: 'Email Accounts', to: '/workspace/email-accounts', icon: Mail },
      { label: 'Team Members', to: '/workspace/members', icon: UserCog },
      { label: 'Settings', to: '/workspace/settings', icon: Settings },
      { label: 'Platform Admin', to: '/admin', icon: Shield, adminOnly: true },
    ],
  },
  {
    label: 'Support',
    items: [
      { label: 'Help & AI Assistant', to: '/help', icon: HelpCircle },
    ],
  },
];

export const AppSidebar = ({ isOpen, onClose }) => {
  const { user, logout, restartOnboarding } = useAuth();
  const { workspace, userRole } = useWorkspace();
  const navigate = useNavigate();
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleRestartOnboarding = async () => {
    if (restartOnboarding) {
      await restartOnboarding();
    }
    setWorkspaceMenuOpen(false);
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'Super Admin': return 'bg-purple-500/15 text-purple-400 border-purple-500/25';
      case 'Admin': return 'bg-indigo-500/15 text-indigo-400 border-indigo-500/25';
      case 'Campaign Manager': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25';
      default: return 'bg-slate-500/15 text-slate-400 border-slate-500/25';
    }
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full z-50 w-64 bg-slate-900 border-r border-slate-800 flex flex-col transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo / Brand */}
        <div className="h-14 px-4 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
          <Link to="/dashboard" className="flex items-center gap-2 group" onClick={onClose}>
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shadow-sm">
              <Mail className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-base font-extrabold tracking-tight text-white">
              Mail<span className="text-indigo-400">Flow</span>
            </span>
          </Link>
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 text-slate-500 hover:text-white transition-colors rounded-lg hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Workspace Switcher */}
        <div className="px-3 py-2 border-b border-slate-800 flex-shrink-0">
          <button
            onClick={() => setWorkspaceMenuOpen(!workspaceMenuOpen)}
            className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-slate-800 transition-colors text-left"
          >
            <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center text-indigo-400 text-xs font-bold flex-shrink-0">
              {workspace?.name?.charAt(0)?.toUpperCase() || 'W'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-200 truncate">
                {workspace?.name || 'My Workspace'}
              </p>
              <p className="text-[10px] text-slate-500 font-mono capitalize">
                {workspace?.plan || 'free'} plan
              </p>
            </div>
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-500 flex-shrink-0 transition-transform ${
                workspaceMenuOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* Workspace dropdown */}
          {workspaceMenuOpen && (
            <div className="mt-1 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-xl">
              <div className="px-3 py-2 border-b border-slate-700">
                <div className="flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-slate-400" />
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${getRoleBadgeColor(userRole)}`}>
                    {userRole || 'User'}
                  </span>
                </div>
              </div>
              <div className="p-1">
                <button
                  onClick={handleRestartOnboarding}
                  className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                  Restart onboarding tour
                </button>
                <Link
                  to="/workspace/settings"
                  onClick={() => { setWorkspaceMenuOpen(false); onClose(); }}
                  className="flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <Building className="w-3.5 h-3.5 text-slate-400" />
                  Workspace settings
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs text-rose-400 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-5">
          {NAV_SECTIONS.map((section, si) => (
            <div key={si}>
              {section.label && (
                <p className="px-2 mb-1.5 text-[10px] font-mono uppercase tracking-widest text-slate-600">
                  {section.label}
                </p>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  if (item.adminOnly && user?.role !== 'admin') return null;
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={onClose}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors ${
                          isActive
                            ? 'bg-indigo-600/20 text-indigo-300 font-semibold'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                        }`
                      }
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User profile footer */}
        <div className="p-3 border-t border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-2 px-2 py-2 rounded-xl hover:bg-slate-800 transition-colors">
            <div className="w-8 h-8 rounded-full bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center text-indigo-400 text-sm font-bold flex-shrink-0">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-200 truncate">{user?.name}</p>
              <p className="text-[10px] text-slate-500 truncate">{user?.email}</p>
            </div>
            <Zap className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" title="Verified" />
          </div>
        </div>
      </aside>
    </>
  );
};

