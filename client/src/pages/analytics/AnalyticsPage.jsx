import React, { useState, useEffect } from 'react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import {
  BarChart2,
  TrendingUp,
  Send,
  CheckCircle2,
  AlertCircle,
  Clock,
  Download,
  Users,
  Reply,
  ShieldCheck,
  Server,
  Zap,
  Activity,
  Layers,
  ArrowUpRight,
} from 'lucide-react';
import {
  getAnalyticsOverview,
  getAutoReplyAnalytics,
  getAdminSystemHealth,
  exportCampaignsAnalyticsUrl,
} from '../../services/api';

export const AnalyticsPage = () => {
  const [timeframe, setTimeframe] = useState('30d');
  const [activeTab, setActiveTab] = useState('campaigns'); // 'campaigns' | 'autoreply' | 'admin'
  const [data, setData] = useState(null);
  const [autoReplyData, setAutoReplyData] = useState(null);
  const [adminData, setAdminData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAnalytics = async () => {
    setLoading(true);
    setError('');
    try {
      if (activeTab === 'campaigns') {
        const res = await getAnalyticsOverview({ timeframe });
        setData(res.data?.data);
      } else if (activeTab === 'autoreply') {
        const res = await getAutoReplyAnalytics();
        setAutoReplyData(res.data?.data);
      } else if (activeTab === 'admin') {
        const res = await getAdminSystemHealth();
        setAdminData(res.data?.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [timeframe, activeTab]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-cyan-400" /> Analytics & Health
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Aggregated delivery metrics, auto-reply triggers, and system health.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {activeTab === 'campaigns' && (
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs">
              {['today', '7d', '30d', 'all'].map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-2.5 py-1 rounded-lg uppercase font-mono text-[10px] transition-colors ${
                    timeframe === tf
                      ? 'bg-cyan-500/10 text-cyan-400 font-bold border border-cyan-500/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          )}

          {activeTab === 'campaigns' && (
            <a
              href={exportCampaignsAnalyticsUrl()}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 text-xs font-medium transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </a>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        {[
          { id: 'campaigns', label: 'Campaign Delivery', icon: Send },
          { id: 'autoreply', label: 'Auto-Reply Insights', icon: Reply },
          { id: 'admin', label: 'System & Worker Health', icon: Server },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {loading ? (
        <div className="py-16 flex justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <>
          {/* TAB 1: CAMPAIGN DELIVERY */}
          {activeTab === 'campaigns' && data && (
            <div className="space-y-6">
              {/* Primary Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="p-5 border-slate-800">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-mono uppercase text-slate-500 block mb-1">
                        Total Sent
                      </span>
                      <p className="text-2xl font-black text-white">
                        {data.campaigns?.sent?.toLocaleString() || 0}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1">Across {data.campaigns?.total} campaigns</p>
                    </div>
                    <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
                      <Send className="w-4 h-4" />
                    </div>
                  </div>
                </Card>

                <Card className="p-5 border-slate-800">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-mono uppercase text-slate-500 block mb-1">
                        Delivery Rate
                      </span>
                      <p className="text-2xl font-black text-emerald-400">
                        {data.campaigns?.rates?.deliveryRate || 0}%
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        {data.campaigns?.delivered?.toLocaleString() || 0} delivered
                      </p>
                    </div>
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  </div>
                </Card>

                <Card className="p-5 border-slate-800">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-mono uppercase text-slate-500 block mb-1">
                        Failed / Bounced
                      </span>
                      <p className="text-2xl font-black text-rose-400">
                        {((data.campaigns?.failed || 0) + (data.campaigns?.bounced || 0)).toLocaleString()}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1">Delivery issues detected</p>
                    </div>
                    <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center">
                      <AlertCircle className="w-4 h-4" />
                    </div>
                  </div>
                </Card>

                <Card className="p-5 border-slate-800">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-mono uppercase text-slate-500 block mb-1">
                        Scheduled Queue
                      </span>
                      <p className="text-2xl font-black text-amber-400">
                        {data.campaigns?.scheduled || 0}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1">Pending background workers</p>
                    </div>
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                      <Clock className="w-4 h-4" />
                    </div>
                  </div>
                </Card>
              </div>

              {/* Engagement Rates Banner */}
              <Card className="p-6 border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/20">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-cyan-400" /> Engagement Transparency Disclosure
                    </h3>
                    <p className="text-xs text-slate-400 max-w-2xl">
                      MailFlow utilizes native provider connections (Gmail API & Microsoft Graph). Open rates and click tracking reflect verified provider webhook events. MailFlow prioritizes deliverability and does not inject tracking pixels that trigger spam filters.
                    </p>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <span className="text-[10px] font-mono uppercase text-slate-500 block">Open Rate</span>
                      <span className="text-xl font-bold text-white">
                        {data.campaigns?.rates?.openRate ?? 0}%
                      </span>
                    </div>
                    <div className="text-center">
                      <span className="text-[10px] font-mono uppercase text-slate-500 block">Click Rate</span>
                      <span className="text-xl font-bold text-white">
                        {data.campaigns?.rates?.clickRate ?? 0}%
                      </span>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Audience Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-5 border-slate-800">
                  <span className="text-xs font-mono uppercase text-slate-500 block mb-1">
                    Total Contacts
                  </span>
                  <p className="text-xl font-bold text-white">
                    {data.contacts?.total?.toLocaleString() || 0}
                  </p>
                </Card>
                <Card className="p-5 border-slate-800">
                  <span className="text-xs font-mono uppercase text-slate-500 block mb-1">
                    Active Subscribed
                  </span>
                  <p className="text-xl font-bold text-emerald-400">
                    {data.contacts?.subscribed?.toLocaleString() || 0}
                  </p>
                </Card>
                <Card className="p-5 border-slate-800">
                  <span className="text-xs font-mono uppercase text-slate-500 block mb-1">
                    Unsubscribed / Suppressed
                  </span>
                  <p className="text-xl font-bold text-slate-400">
                    {data.contacts?.unsubscribed?.toLocaleString() || 0}
                  </p>
                </Card>
              </div>
            </div>
          )}

          {/* TAB 2: AUTO-REPLY INSIGHTS */}
          {activeTab === 'autoreply' && autoReplyData && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="p-5 border-slate-800">
                  <span className="text-xs font-mono uppercase text-slate-500 block mb-1">
                    Messages Processed
                  </span>
                  <p className="text-2xl font-black text-white">
                    {autoReplyData.totalProcessed?.toLocaleString() || 0}
                  </p>
                </Card>
                <Card className="p-5 border-slate-800">
                  <span className="text-xs font-mono uppercase text-slate-500 block mb-1">
                    Replies Sent
                  </span>
                  <p className="text-2xl font-black text-teal-400">
                    {autoReplyData.replied?.toLocaleString() || 0}
                  </p>
                </Card>
                <Card className="p-5 border-slate-800">
                  <span className="text-xs font-mono uppercase text-slate-500 block mb-1">
                    Skipped (Cooldown/Loops)
                  </span>
                  <p className="text-2xl font-black text-slate-400">
                    {autoReplyData.skipped?.toLocaleString() || 0}
                  </p>
                </Card>
                <Card className="p-5 border-slate-800">
                  <span className="text-xs font-mono uppercase text-slate-500 block mb-1">
                    Success Rate
                  </span>
                  <p className="text-2xl font-black text-emerald-400">
                    {autoReplyData.successRate || 0}%
                  </p>
                </Card>
              </div>

              {/* Top triggered rules */}
              <Card className="p-6 border-slate-800">
                <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-teal-400" /> Most Frequently Triggered Auto-Reply Rules
                </h3>
                {autoReplyData.topTriggeredRules?.length === 0 ? (
                  <p className="text-xs text-slate-500">No rule triggers recorded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {autoReplyData.topTriggeredRules?.map((r, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs"
                      >
                        <span className="text-white font-medium">{r.ruleName || 'Unnamed Rule'}</span>
                        <span className="px-2 py-0.5 rounded font-mono text-[11px] bg-teal-500/10 text-teal-300 border border-teal-500/20">
                          {r.count} matches
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* TAB 3: ADMIN & WORKER HEALTH */}
          {activeTab === 'admin' && adminData && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Redis status card */}
                <Card className="p-5 border-slate-800">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Server className="w-4 h-4 text-indigo-400" /> Redis Queue Status
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase flex items-center gap-1 ${
                        adminData.redis?.connected
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}
                    >
                      {adminData.redis?.connected ? 'Online' : 'Degraded Mode'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mb-2">
                    Operating mode: <strong className="text-slate-200">{adminData.redis?.mode}</strong>
                  </p>
                  <p className="text-[11px] text-slate-500">
                    When Redis is offline, workers safely degrade and queue operations reject gracefully rather than crashing or faking dispatch.
                  </p>
                </Card>

                {/* Workspace stats */}
                <Card className="p-5 border-slate-800">
                  <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" /> Workspace Inventory
                  </h3>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                      <span className="text-slate-500 block text-[10px] uppercase font-mono">Mailboxes</span>
                      <span className="text-base font-bold text-white">
                        {adminData.workspaceSummary?.connectedMailboxes || 0}
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                      <span className="text-slate-500 block text-[10px] uppercase font-mono">Campaigns</span>
                      <span className="text-base font-bold text-white">
                        {adminData.workspaceSummary?.totalCampaigns || 0}
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                      <span className="text-slate-500 block text-[10px] uppercase font-mono">Members</span>
                      <span className="text-base font-bold text-white">
                        {adminData.workspaceSummary?.teamMembers || 0}
                      </span>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Workers status */}
              <Card className="p-6 border-slate-800">
                <h3 className="text-sm font-bold text-white mb-2">Background Worker Processes</h3>
                <p className="text-xs text-slate-400 mb-4">
                  Workers are executable independently in production via <code className="text-indigo-300 font-mono">npm run worker</code>.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-white block">Campaign Worker</span>
                      <span className="text-slate-500 text-[11px]">Dispatch & Delayed Scheduling</span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      READY
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-white block">Auto-Reply Worker</span>
                      <span className="text-slate-500 text-[11px]">Inbox Polling & Reply Dispatch</span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      READY
                    </span>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AnalyticsPage;
