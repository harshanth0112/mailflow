import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { getContactStats } from '../../services/api';
import Card from '../../components/common/Card';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import {
  Users,
  Send,
  Calendar,
  BarChart2,
  ArrowRight,
  Building,
  Shield,
  Clock,
  Zap,
  UserPlus,
  Mail,
  FileText,
  RefreshCw,
  HelpCircle,
} from 'lucide-react';

// A single stat card with real data or placeholder
const StatCard = ({ icon: Icon, iconColor, iconBg, label, value, sublabel, loading, to }) => (
  <Card className="p-5 border-slate-800 hover:border-slate-700 transition-colors group">
    <div className="flex items-start gap-4">
      <div className={`w-11 h-11 rounded-xl ${iconBg} border border-slate-700/60 flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">{label}</p>
        {loading ? (
          <div className="h-7 w-16 bg-slate-800 rounded animate-pulse" />
        ) : (
          <p className="text-2xl font-extrabold text-white">{value}</p>
        )}
        {sublabel && (
          <p className="text-xs text-slate-500 mt-1">{sublabel}</p>
        )}
      </div>
      {to && (
        <Link to={to} className="text-slate-600 hover:text-indigo-400 transition-colors mt-1">
          <ArrowRight className="w-4 h-4" />
        </Link>
      )}
    </div>
  </Card>
);

// Quick action button card
const QuickAction = ({ icon: Icon, iconColor, iconBg, label, description, to }) => (
  <Link to={to}>
    <div className="p-4 rounded-xl border border-slate-800 hover:border-indigo-500/40 hover:bg-slate-800/50 transition-all group flex items-start gap-3">
      <div className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-4 h-4 ${iconColor}`} />
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-200 group-hover:text-white transition-colors">{label}</p>
        <p className="text-xs text-slate-500 mt-0.5">{description}</p>
      </div>
    </div>
  </Link>
);

export const DashboardPage = () => {
  const { user, restartOnboarding } = useAuth();
  const { workspace, userRole, isLoading: wsLoading } = useWorkspace();
  const [totalContacts, setTotalContacts] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchStats = async () => {
      try {
        setStatsLoading(true);
        const res = await getContactStats();
        if (isMounted && res.data) {
          setTotalContacts(res.data.total ?? 0);
        }
      } catch (err) {
        console.error('Error fetching dashboard contact stats:', err);
      } finally {
        if (isMounted) setStatsLoading(false);
      }
    };

    if (workspace?._id) {
      fetchStats();
    }
    return () => {
      isMounted = false;
    };
  }, [workspace?._id]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">

      {/* Welcome Header */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-indigo-400 mb-1">
              {getGreeting()}
            </p>
            <h1 className="text-2xl font-extrabold text-white sm:text-3xl">
              {user?.name || 'User'}
            </h1>
            {wsLoading ? (
              <div className="h-4 w-48 bg-slate-800 rounded animate-pulse mt-1" />
            ) : (
              <p className="text-sm text-slate-400 mt-1">
                <span className="font-semibold text-slate-300">{workspace?.name}</span>
                {' · '}
                <span className="text-slate-500 font-mono text-xs">{userRole || 'User'}</span>
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono border ${
              workspace?.plan === 'pro' || workspace?.plan === 'enterprise'
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}>
              <Zap className="w-3 h-3" />
              {(workspace?.plan || 'free').toUpperCase()} PLAN
            </span>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Users}
          iconColor="text-violet-400"
          iconBg="bg-violet-500/10"
          label="Total Contacts"
          value={totalContacts.toLocaleString()}
          sublabel="Active workspace audience"
          loading={statsLoading}
          to="/contacts"
        />
        <StatCard
          icon={Send}
          iconColor="text-amber-400"
          iconBg="bg-amber-500/10"
          label="Campaigns"
          value="0"
          sublabel="Phase 8 — Campaign Engine"
          loading={false}
          to="/campaigns"
        />
        <StatCard
          icon={Calendar}
          iconColor="text-orange-400"
          iconBg="bg-orange-500/10"
          label="Scheduled"
          value="0"
          sublabel="Phase 9 — Queue Engine"
          loading={false}
          to="/scheduled"
        />
        <StatCard
          icon={BarChart2}
          iconColor="text-cyan-400"
          iconBg="bg-cyan-500/10"
          label="Emails Sent"
          value="0"
          sublabel="Phase 7 — Email Integration"
          loading={false}
          to="/analytics"
        />
      </div>

      {/* Workspace Summary + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Workspace Info Card */}
        <Card className="border-slate-800 p-6 lg:col-span-1">
          <div className="flex items-center gap-2 mb-4">
            <Building className="w-4 h-4 text-indigo-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Workspace</h2>
          </div>
          {wsLoading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => (
                <div key={i} className="h-4 bg-slate-800 rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Workspace Name</p>
                <p className="text-sm font-semibold text-slate-200">{workspace?.name || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Slug</p>
                <p className="text-xs font-mono text-slate-400">{workspace?.slug || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Your Role</p>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                  userRole === 'Super Admin' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                  userRole === 'Admin' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                  userRole === 'Campaign Manager' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                  'bg-slate-700 text-slate-300 border-slate-600'
                }`}>
                  <Shield className="w-3 h-3" />
                  {userRole || 'User'}
                </span>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Daily Send Limit</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-200">
                    {(workspace?.settings?.dailySendLimit || 500).toLocaleString()} emails
                  </p>
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Timezone</p>
                <p className="text-xs font-mono text-slate-400">{workspace?.settings?.timezone || 'UTC'}</p>
              </div>
            </div>
          )}
          <div className="mt-5 pt-4 border-t border-slate-800">
            <Link
              to="/workspace/settings"
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 transition-colors"
            >
              Configure workspace <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </Card>

        {/* Quick Actions */}
        <Card className="border-slate-800 p-6 lg:col-span-2">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <QuickAction
              icon={UserPlus}
              iconColor="text-indigo-400"
              iconBg="bg-indigo-500/10"
              label="Invite Team Member"
              description="Add a colleague to your workspace"
              to="/workspace/members"
            />
            <QuickAction
              icon={Users}
              iconColor="text-violet-400"
              iconBg="bg-violet-500/10"
              label="Add Contacts"
              description="Import or create your contact list"
              to="/contacts"
            />
            <QuickAction
              icon={Send}
              iconColor="text-amber-400"
              iconBg="bg-amber-500/10"
              label="Create Campaign"
              description="Draft and send an email campaign"
              to="/campaigns"
            />
            <QuickAction
              icon={Mail}
              iconColor="text-emerald-400"
              iconBg="bg-emerald-500/10"
              label="Connect Email"
              description="Link a Google account"
              to="/workspace/settings"
            />
            <QuickAction
              icon={FileText}
              iconColor="text-teal-400"
              iconBg="bg-teal-500/10"
              label="Browse Templates"
              description="Reusable email template library"
              to="/templates"
            />
            <QuickAction
              icon={HelpCircle}
              iconColor="text-pink-400"
              iconBg="bg-pink-500/10"
              label="Help & AI Assistant"
              description="Get answers and AI-assisted drafting"
              to="/help"
            />
          </div>
        </Card>
      </div>

      {/* Getting Started Banner (shown until onboarding complete) */}
      {!user?.onboardingCompleted && (
        <div className="relative overflow-hidden rounded-2xl border border-indigo-500/20 bg-gradient-to-r from-indigo-900/40 via-slate-900 to-slate-900 p-6">
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-mono uppercase tracking-widest text-indigo-400">
                  Getting Started
                </span>
              </div>
              <h3 className="text-lg font-bold text-white">
                Complete your workspace setup
              </h3>
              <p className="text-sm text-slate-400 mt-1">
                Restart the onboarding tour anytime to get a guided walkthrough of all MailFlow features.
              </p>
            </div>
            <button
              onClick={restartOnboarding}
              className="flex-shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors whitespace-nowrap"
            >
              <RefreshCw className="w-4 h-4" />
              Restart Tour
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
