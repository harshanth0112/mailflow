import React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CalendarClock, CheckCircle2, Clock3, RefreshCw, Send, XCircle } from 'lucide-react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useWorkspace } from '../../context/WorkspaceContext';
import { cancelCampaign, getCampaigns, rescheduleCampaign } from '../../services/api';

const toLocalInput = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

export const ScheduledPage = () => {
  const { isCampaignManager, isAdmin, isSuperAdmin } = useWorkspace();
  const canManage = isCampaignManager || isAdmin || isSuperAdmin;
  const [campaigns, setCampaigns] = useState([]);
  const [dates, setDates] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadScheduled = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await getCampaigns({ status: 'scheduled', sortBy: 'scheduledAt', sortOrder: 'asc', limit: 100 });
      setCampaigns(response.data || []);
    } catch (loadError) {
      setError(loadError.message || 'Could not load scheduled campaigns.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadScheduled();
  }, [loadScheduled]);

  const handleReschedule = async (campaign) => {
    const scheduledAt = dates[campaign._id];
    if (!scheduledAt || new Date(scheduledAt) <= new Date()) {
      setError('Choose a date and time in the future.');
      return;
    }
    setBusyId(campaign._id);
    setError('');
    setSuccess('');
    try {
      await rescheduleCampaign(campaign._id, {
        scheduledAt: new Date(scheduledAt).toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      });
      setDates((current) => {
        const next = { ...current };
        delete next[campaign._id];
        return next;
      });
      setSuccess(`“${campaign.name}” rescheduled.`);
      await loadScheduled();
    } catch (actionError) {
      setError(actionError.message || 'Could not reschedule this campaign.');
    } finally {
      setBusyId('');
    }
  };

  const handleCancel = async (campaign) => {
    if (!window.confirm(`Cancel the scheduled campaign "${campaign.name}"?`)) return;
    setBusyId(campaign._id);
    setError('');
    setSuccess('');
    try {
      await cancelCampaign(campaign._id);
      setSuccess(`“${campaign.name}” was cancelled.`);
      await loadScheduled();
    } catch (actionError) {
      setError(actionError.message || 'Could not cancel this campaign.');
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.2em] text-orange-300"><CalendarClock className="h-4 w-4" /> Delivery operations <span className="text-slate-600">/</span> Phase 09</div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Scheduled campaigns</h1>
          <p className="mt-1 text-sm text-slate-400">Review upcoming sends and adjust delivery times before sending begins.</p>
        </div>
        <Button variant="outline" onClick={loadScheduled} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh queue</Button>
      </header>

      {(error || success) && <div className={`flex items-center gap-2 rounded-xl border p-3 text-sm ${error ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'}`}>{error ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}{error || success}</div>}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-slate-800 bg-slate-900/80 p-4"><span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Upcoming</span><div className="mt-2 text-2xl font-bold text-white">{loading ? '—' : campaigns.length}</div><span className="text-xs text-slate-500">scheduled campaigns</span></Card>
        <Card className="border-slate-800 bg-slate-900/80 p-4"><span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Next send</span><div className="mt-2 text-sm font-semibold text-white">{campaigns[0]?.scheduledAt ? new Date(campaigns[0].scheduledAt).toLocaleString() : 'No upcoming sends'}</div><span className="text-xs text-slate-500">displayed in your local time</span></Card>
        <Card className="border-orange-500/20 bg-orange-500/[0.04] p-4"><span className="text-[10px] font-mono uppercase tracking-widest text-orange-300">Queue status</span><div className="mt-2 flex items-center gap-2 text-sm font-semibold text-white"><span className="h-2 w-2 rounded-full bg-orange-400" /> Managed by the campaign worker</div><span className="text-xs text-slate-500">Delivery requires the production queue worker to be ready.</span></Card>
      </div>

      <Card className="overflow-hidden border-slate-800 bg-slate-900/80 p-0">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div><h2 className="font-semibold text-white">Upcoming sends</h2><p className="mt-0.5 text-xs text-slate-500">Queue times are shown in your browser’s local timezone.</p></div>
          <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-orange-300">{campaigns.length} queued</span>
        </div>
        {loading ? <div className="p-12 text-center"><LoadingSpinner /><p className="mt-3 text-xs text-slate-500">Loading scheduled campaigns…</p></div> : campaigns.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <Clock3 className="mx-auto mb-3 h-9 w-9 text-slate-600" />
            <h3 className="font-semibold text-white">Nothing on the calendar</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-400">Schedule a campaign from its composer and it will appear here for monitoring and rescheduling.</p>
            <Link to="/campaigns" className="mt-5 inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-orange-400"><Send className="h-4 w-4" /> Go to campaigns</Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {campaigns.map((campaign) => (
              <article key={campaign._id} className="grid gap-4 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="mt-0.5 rounded-lg border border-orange-500/20 bg-orange-500/10 p-2 text-orange-300"><CalendarClock className="h-4 w-4" /></div>
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-white">{campaign.name}</h3>
                    <p className="mt-0.5 truncate text-xs text-slate-400">{campaign.subject}</p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                      <span>{campaign.statistics?.totalRecipients || campaign.recipientConfiguration?.estimatedCount || 0} recipients</span>
                      <span>{campaign.senderEmailAccountId?.emailAddress || 'Sender account'}</span>
                      <span className="inline-flex items-center gap-1 text-orange-300"><Clock3 className="h-3 w-3" />{campaign.scheduledAt ? new Date(campaign.scheduledAt).toLocaleString() : 'Time not set'}</span>
                    </div>
                  </div>
                </div>
                {canManage ? <div className="flex flex-col gap-2 sm:flex-row">
                  <input aria-label={`New send time for ${campaign.name}`} type="datetime-local" min={toLocalInput(new Date(Date.now() + 60000))} value={dates[campaign._id] ?? toLocalInput(campaign.scheduledAt)} onChange={(event) => setDates({ ...dates, [campaign._id]: event.target.value })} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 outline-none focus:border-orange-400" />
                  <Button size="sm" isLoading={busyId === campaign._id} onClick={() => handleReschedule(campaign)} className="bg-orange-500 text-slate-950 hover:bg-orange-400"><RefreshCw className="h-3.5 w-3.5" />Reschedule</Button>
                  <Button size="sm" variant="outline" disabled={busyId === campaign._id} onClick={() => handleCancel(campaign)} className="border-red-500/30 text-red-300 hover:bg-red-500/10"><XCircle className="h-3.5 w-3.5" />Cancel</Button>
                </div> : <span className="text-xs text-slate-500">Read-only access</span>}
              </article>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
