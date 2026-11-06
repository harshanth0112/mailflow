import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import {
  Settings,
  Building,
  Mail,
  Clock,
  Shield,
  CheckCircle,
  AlertCircle,
  Layers,
} from 'lucide-react';

export const WorkspaceSettingsPage = () => {
  const { workspace, userRole, updateWorkspace, isAdmin } = useWorkspace();

  const [name, setName] = useState('');
  const [defaultFromName, setDefaultFromName] = useState('');
  const [defaultFromEmail, setDefaultFromEmail] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [dailySendLimit, setDailySendLimit] = useState(500);
  const [enableTracking, setEnableTracking] = useState(true);

  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (workspace) {
      setName(workspace.name || '');
      setDefaultFromName(workspace.settings?.defaultFromName || '');
      setDefaultFromEmail(workspace.settings?.defaultFromEmail || '');
      setTimezone(workspace.settings?.timezone || 'UTC');
      setDailySendLimit(workspace.settings?.dailySendLimit || 500);
      setEnableTracking(workspace.settings?.enableTracking ?? true);
    }
  }, [workspace]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;

    setSaving(true);
    setSuccessMessage('');
    setErrorMessage('');

    const res = await updateWorkspace({
      name,
      settings: {
        defaultFromName,
        defaultFromEmail,
        timezone,
        dailySendLimit: Number(dailySendLimit),
        enableTracking,
      },
    });

    setSaving(false);
    if (res.success) {
      setSuccessMessage('Workspace settings updated successfully.');
    } else {
      setErrorMessage(res.error);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-extrabold text-white sm:text-3xl flex items-center gap-2.5">
          <Settings className="w-7 h-7 text-indigo-400" /> Workspace Settings
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Configure default sending parameters, identity, and sending controls for{' '}
          <span className="font-semibold text-slate-200">{workspace?.name}</span>.
        </p>
      </div>

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-3">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* General Info */}
        <Card className="p-6 border-slate-800 space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Building className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-bold text-white">General Information</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Workspace Name
              </label>
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!isAdmin}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Workspace Slug (Unique identifier)
              </label>
              <Input
                type="text"
                value={workspace?.slug || ''}
                disabled
                className="bg-slate-950 text-slate-500 cursor-not-allowed"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Current Plan
              </label>
              <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm font-semibold capitalize">
                <Layers className="w-4 h-4" /> {workspace?.plan || 'Free'} Tier
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Your Workspace Role
              </label>
              <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 text-sm font-semibold">
                <Shield className="w-4 h-4" /> {userRole || 'User'}
              </div>
            </div>
          </div>
        </Card>

        {/* Sending Defaults */}
        <Card className="p-6 border-slate-800 space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Mail className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-bold text-white">Campaign & Dispatch Defaults</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Default Sender Name
              </label>
              <Input
                type="text"
                placeholder="e.g. Acme Marketing"
                value={defaultFromName}
                onChange={(e) => setDefaultFromName(e.target.value)}
                disabled={!isAdmin}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Default Sender Email
              </label>
              <Input
                type="email"
                placeholder="e.g. newsletter@acme.com"
                value={defaultFromEmail}
                onChange={(e) => setDefaultFromEmail(e.target.value)}
                disabled={!isAdmin}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Default Timezone
              </label>
              <Input
                type="text"
                placeholder="UTC or America/New_York"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                disabled={!isAdmin}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Daily Send Limit
              </label>
              <Input
                type="number"
                min="10"
                max="50000"
                value={dailySendLimit}
                onChange={(e) => setDailySendLimit(e.target.value)}
                disabled={!isAdmin}
              />
            </div>
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={enableTracking}
                onChange={(e) => setEnableTracking(e.target.checked)}
                disabled={!isAdmin}
                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm font-medium text-slate-300">
                Enable open and link click tracking on sent campaigns by default
              </span>
            </label>
          </div>
        </Card>

        {isAdmin && (
          <div className="flex justify-end">
            <Button type="submit" variant="primary" size="md" disabled={saving}>
              {saving ? 'Saving changes...' : 'Save Settings'}
            </Button>
          </div>
        )}
      </form>
    </div>
  );
};

