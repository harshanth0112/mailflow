import React, { useState, useEffect } from 'react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import {
  Reply,
  Plus,
  Trash2,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
  Settings,
  Shield,
  Mail,
  Zap,
  Play,
  Pause,
  Sliders,
  Send,
  HelpCircle,
  FileText,
} from 'lucide-react';
import {
  getConnectedEmailAccounts,
  getAutoReplyRules,
  createAutoReplyRule,
  updateAutoReplyRule,
  deleteAutoReplyRule,
  updateAutoReplySettings,
  getAutoReplyLogs,
  simulateIncomingMessage,
  getEmailTemplates,
} from '../../services/api';

export const AutoReplyPage = () => {
  const [activeTab, setActiveTab] = useState('rules'); // 'rules' | 'settings' | 'logs' | 'tester'
  const [accounts, setAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [rules, setRules] = useState([]);
  const [logs, setLogs] = useState([]);
  const [emailTemplates, setEmailTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Rule Modal state
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [ruleFormData, setRuleFormData] = useState({
    name: '',
    priority: 0,
    keywords: '',
    matchType: 'contains',
    checkSubject: true,
    checkBody: true,
    senderWhitelist: '',
    senderBlacklist: '',
    replySubject: 'Re: {{subject}}',
    replyBody: '',
    replyHtmlBody: '',
  });

  // Settings State for selected account
  const [settingsFormData, setSettingsFormData] = useState({
    enabled: false,
    cooldownMinutes: 60,
    defaultReplySubject: 'Re: {{subject}}',
    defaultReplyBody: '',
    ignoreNoReply: true,
    ignoreOwnMessages: true,
  });

  // Simulation Tester State
  const [testFrom, setTestFrom] = useState('customer@example.com');
  const [testSubject, setTestSubject] = useState('Question regarding pricing and plans');
  const [testBody, setTestBody] = useState('Hi there, can you send over the current pricing details for teams?');
  const [simResult, setSimResult] = useState(null);

  const loadAccounts = async () => {
    try {
      const [res, templatesRes] = await Promise.all([
        getConnectedEmailAccounts(),
        getEmailTemplates({ limit: 100 }),
      ]);
      const accs = res.data || [];
      setAccounts(accs);
      setEmailTemplates(templatesRes.data || []);
      if (accs.length > 0 && !selectedAccountId) {
        setSelectedAccountId(accs[0]._id);
      }
    } catch (err) {
      setError(err.message || 'Failed to load email accounts');
    }
  };

  const loadTabData = async () => {
    if (!selectedAccountId) return;
    setLoading(true);
    setError('');
    try {
      if (activeTab === 'rules') {
        const res = await getAutoReplyRules({ emailAccountId: selectedAccountId });
        setRules(res.data?.data || []);
      } else if (activeTab === 'settings') {
        const acc = accounts.find((a) => a._id === selectedAccountId);
        if (acc && acc.autoReplySettings) {
          setSettingsFormData({
            enabled: Boolean(acc.autoReplySettings.enabled),
            cooldownMinutes: acc.autoReplySettings.cooldownMinutes || 60,
            defaultReplySubject: acc.autoReplySettings.defaultReplySubject || 'Re: {{subject}}',
            defaultReplyBody: acc.autoReplySettings.defaultReplyBody || '',
            ignoreNoReply: acc.autoReplySettings.ignoreNoReply !== false,
            ignoreOwnMessages: acc.autoReplySettings.ignoreOwnMessages !== false,
          });
        }
      } else if (activeTab === 'logs') {
        const res = await getAutoReplyLogs({ emailAccountId: selectedAccountId });
        setLogs(res.data?.data || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to load tab data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  useEffect(() => {
    if (selectedAccountId) {
      loadTabData();
    }
  }, [selectedAccountId, activeTab]);

  const handleOpenRuleModal = (rule = null) => {
    setEditingRule(rule);
    if (rule) {
      setRuleFormData({
        name: rule.name || '',
        priority: rule.priority || 0,
        keywords: (rule.conditions?.keywords || []).join(', '),
        matchType: rule.conditions?.matchType || 'contains',
        checkSubject: rule.conditions?.checkSubject !== false,
        checkBody: rule.conditions?.checkBody !== false,
        senderWhitelist: (rule.conditions?.senderWhitelist || []).join(', '),
        senderBlacklist: (rule.conditions?.senderBlacklist || []).join(', '),
        replySubject: rule.replyTemplate?.subject || 'Re: {{subject}}',
        replyBody: rule.replyTemplate?.body || '',
        replyHtmlBody: rule.replyTemplate?.htmlBody || '',
      });
    } else {
      setRuleFormData({
        name: '',
        priority: 0,
        keywords: '',
        matchType: 'contains',
        checkSubject: true,
        checkBody: true,
        senderWhitelist: '',
        senderBlacklist: '',
        replySubject: 'Re: {{subject}}',
        replyBody: '',
        replyHtmlBody: '',
      });
    }
    setShowRuleModal(true);
  };

  const handleSaveRule = async (e) => {
    e.preventDefault();
    if (!ruleFormData.name.trim() || !ruleFormData.replyBody.trim()) {
      alert('Please fill in rule name and reply body');
      return;
    }

    setActionLoading(true);
    try {
      const payload = {
        emailAccountId: selectedAccountId,
        name: ruleFormData.name.trim(),
        priority: parseInt(ruleFormData.priority, 10) || 0,
        conditions: {
          keywords: ruleFormData.keywords.split(',').map((k) => k.trim().toLowerCase()).filter(Boolean),
          matchType: ruleFormData.matchType,
          checkSubject: ruleFormData.checkSubject,
          checkBody: ruleFormData.checkBody,
          senderWhitelist: ruleFormData.senderWhitelist.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
          senderBlacklist: ruleFormData.senderBlacklist.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
        },
        replyTemplate: {
          subject: ruleFormData.replySubject.trim(),
          body: ruleFormData.replyBody.trim(),
          htmlBody: ruleFormData.replyHtmlBody,
        },
      };

      if (editingRule) {
        await updateAutoReplyRule(editingRule._id, payload);
      } else {
        await createAutoReplyRule(payload);
      }

      setShowRuleModal(false);
      await loadTabData();
    } catch (err) {
      alert(err.message || 'Failed to save rule');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteRule = async (id, name) => {
    if (!window.confirm(`Delete rule "${name}"?`)) return;
    setActionLoading(true);
    try {
      await deleteAutoReplyRule(id);
      await loadTabData();
    } catch (err) {
      alert(err.message || 'Failed to delete rule');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleRule = async (rule) => {
    setActionLoading(true);
    try {
      await updateAutoReplyRule(rule._id, { isActive: !rule.isActive });
      await loadTabData();
    } catch (err) {
      alert(err.message || 'Failed to toggle rule');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setSuccess('');
    setError('');
    try {
      await updateAutoReplySettings(selectedAccountId, settingsFormData);
      setSuccess('Mailbox auto-reply settings updated successfully');
      await loadAccounts();
    } catch (err) {
      setError(err.message || 'Failed to update settings');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRunSimulation = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setSimResult(null);
    try {
      const res = await simulateIncomingMessage({
        emailAccountId: selectedAccountId,
        message: {
          from: testFrom,
          subject: testSubject,
          body: testBody,
        },
      });
      setSimResult(res.data?.data);
    } catch (err) {
      alert(err.message || 'Failed to simulate incoming message');
    } finally {
      setActionLoading(false);
    }
  };

  const activeAccount = accounts.find((a) => a._id === selectedAccountId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Reply className="w-6 h-6 text-teal-400" /> Automatic Replies
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Configure intelligent auto-reply rules, sender cooldowns, loop prevention, and message triggers.
          </p>
        </div>

        {/* Mailbox Selector */}
        {accounts.length > 0 && (
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-1.5 rounded-xl">
            <Mail className="w-4 h-4 text-slate-400 ml-2" />
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="bg-transparent text-xs text-slate-200 focus:outline-none pr-3 py-1 cursor-pointer"
            >
              {accounts.map((a) => (
                <option key={a._id} value={a._id} className="bg-slate-900">
                  {a.emailAddress} ({a.provider.toUpperCase()})
                </option>
              ))}
            </select>
            {activeAccount?.autoReplySettings?.enabled ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mr-1">
                Active
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase bg-slate-800 text-slate-400 border border-slate-700 mr-1">
                Disabled
              </span>
            )}
          </div>
        )}
      </div>

      {accounts.length === 0 ? (
        <Card className="p-12 text-center border-dashed border-slate-800">
          <Mail className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-white mb-1">No email accounts connected</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
            Connect a Google mailbox first in Email Accounts to configure automatic replies.
          </p>
          <Button
            variant="primary"
            size="sm"
            to="/workspace/email-accounts"
            className="text-xs bg-indigo-600 hover:bg-indigo-500"
          >
            Go to Connected Accounts
          </Button>
        </Card>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
            {[
              { id: 'rules', label: 'Reply Rules', icon: Sliders },
              { id: 'settings', label: 'Mailbox Settings', icon: Settings },
              { id: 'logs', label: 'Activity & History', icon: Clock },
              { id: 'tester', label: 'Rule Simulator', icon: Play },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Alert */}
          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}
          {success && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> {success}
            </div>
          )}

          {/* TAB 1: RULES */}
          {activeTab === 'rules' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400">
                  Rules evaluate in order of priority (highest priority first). If no rule matches, the mailbox's default reply will be used.
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleOpenRuleModal()}
                  className="text-xs bg-teal-600 hover:bg-teal-500 text-white"
                >
                  <Plus className="w-4 h-4 mr-1.5" /> Add Rule
                </Button>
              </div>

              {loading ? (
                <div className="py-12 flex justify-center">
                  <LoadingSpinner size="md" />
                </div>
              ) : rules.length === 0 ? (
                <Card className="p-8 text-center border-dashed border-slate-800">
                  <Reply className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">No custom auto-reply rules configured for this mailbox.</p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {rules.map((rule) => (
                    <Card key={rule._id} className="p-5 border-slate-800 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase flex items-center gap-1 ${
                              rule.isActive
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}
                          >
                            {rule.isActive ? 'Active' : 'Paused'}
                          </span>
                          <span className="text-[11px] font-mono text-slate-500">
                            Priority: {rule.priority}
                          </span>
                        </div>

                        <h3 className="text-sm font-bold text-white mb-1 truncate">{rule.name}</h3>

                        <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1.5 mb-3 text-xs">
                          <div className="text-slate-400">
                            <span className="text-slate-500">Keywords:</span>{' '}
                            <span className="font-mono text-teal-300">
                              {rule.conditions?.keywords?.length > 0
                                ? rule.conditions.keywords.join(', ')
                                : 'Any (Universal)'}
                            </span>
                          </div>
                          <div className="text-slate-400 truncate">
                            <span className="text-slate-500">Reply Subject:</span>{' '}
                            <span className="text-white">{rule.replyTemplate?.subject}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-slate-800/80">
                        <span className="text-[10px] font-mono text-slate-500">
                          Matched: {rule.statistics?.matchedCount || 0} times
                        </span>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleRule(rule)}
                            disabled={actionLoading}
                            className="text-xs"
                          >
                            {rule.isActive ? 'Pause' : 'Activate'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenRuleModal(rule)}
                            className="text-xs border-slate-700"
                          >
                            Edit
                          </Button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRule(rule._id, rule.name)}
                            disabled={actionLoading}
                            className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-slate-800"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SETTINGS */}
          {activeTab === 'settings' && (
            <Card className="p-6 border-slate-800 max-w-2xl">
              <form onSubmit={handleSaveSettings} className="space-y-5">
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                  <div>
                    <h3 className="text-sm font-bold text-white">Enable Auto-Reply Engine</h3>
                    <p className="text-xs text-slate-400">Turn on automated responses for incoming emails to this mailbox.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settingsFormData.enabled}
                    onChange={(e) => setSettingsFormData({ ...settingsFormData, enabled: e.target.checked })}
                    className="w-4 h-4 accent-teal-500 cursor-pointer"
                  />
                </div>

                {/* Cooldown */}
                <div>
                  <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
                    Sender Cooldown Limit (Minutes)
                  </label>
                  <p className="text-[11px] text-slate-500 mb-2">
                    Prevents reply loops. A sender will not receive more than 1 auto-reply within this window.
                  </p>
                  <Input
                    type="number"
                    min="1"
                    max="10080"
                    value={settingsFormData.cooldownMinutes}
                    onChange={(e) => setSettingsFormData({ ...settingsFormData, cooldownMinutes: parseInt(e.target.value, 10) || 60 })}
                  />
                </div>

                {/* Loop Prevention Safeguards */}
                <div className="space-y-3 pt-2">
                  <span className="block text-xs font-mono uppercase text-slate-400">Safety Safeguards</span>
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settingsFormData.ignoreNoReply}
                      onChange={(e) => setSettingsFormData({ ...settingsFormData, ignoreNoReply: e.target.checked })}
                      className="w-4 h-4 accent-teal-500"
                    />
                    Ignore automated and no-reply email addresses (noreply@, bounce@, etc.)
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settingsFormData.ignoreOwnMessages}
                      onChange={(e) => setSettingsFormData({ ...settingsFormData, ignoreOwnMessages: e.target.checked })}
                      className="w-4 h-4 accent-teal-500"
                    />
                    Never reply to the mailbox's own messages
                  </label>
                </div>

                {/* Default Reply */}
                <div className="pt-4 border-t border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Default Fallback Response</h4>
                  <p className="text-[11px] text-slate-500">
                    Sent when an incoming message doesn't match any of your custom keyword rules.
                  </p>
                  <div>
                    <label className="block text-[11px] font-mono text-slate-400 mb-1">Default Subject</label>
                    <Input
                      value={settingsFormData.defaultReplySubject}
                      onChange={(e) => setSettingsFormData({ ...settingsFormData, defaultReplySubject: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono text-slate-400 mb-1">Default Body</label>
                    <textarea
                      rows={4}
                      value={settingsFormData.defaultReplyBody}
                      onChange={(e) => setSettingsFormData({ ...settingsFormData, defaultReplyBody: e.target.value })}
                      className="w-full text-xs p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-teal-500"
                      placeholder="Enter default reply message..."
                    />
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    isLoading={actionLoading}
                    className="text-xs bg-teal-600 hover:bg-teal-500"
                  >
                    Save Settings
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {/* TAB 3: ACTIVITY LOGS */}
          {activeTab === 'logs' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400">
                  Real-time audit trail of incoming emails, matched rules, duplicate preventions, and sent replies.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadTabData}
                  className="text-xs border-slate-700"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh Logs
                </Button>
              </div>

              {loading ? (
                <div className="py-12 flex justify-center">
                  <LoadingSpinner size="md" />
                </div>
              ) : logs.length === 0 ? (
                <Card className="p-8 text-center border-dashed border-slate-800">
                  <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">No activity logs recorded yet for this mailbox.</p>
                </Card>
              ) : (
                <div className="space-y-2">
                  {logs.map((log) => (
                    <Card key={log._id} className="p-4 border-slate-800 flex items-start justify-between text-xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase ${
                              log.status === 'replied'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : log.status === 'skipped'
                                ? 'bg-slate-800 text-slate-400 border border-slate-700'
                                : 'bg-red-500/10 text-red-400 border border-red-500/20'
                            }`}
                          >
                            {log.status}
                          </span>
                          <span className="text-slate-300 font-semibold">{log.from}</span>
                          <span className="text-slate-500">→</span>
                          <span className="text-slate-400">{log.subject}</span>
                        </div>
                        {log.skipReason && (
                          <p className="text-[11px] text-slate-500 italic">Skipped: {log.skipReason}</p>
                        )}
                        {log.replyDetails?.replySubject && (
                          <p className="text-[11px] text-teal-400">
                            Sent: {log.replyDetails.replySubject}
                          </p>
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 whitespace-nowrap ml-4">
                        {new Date(log.receivedAt || log.createdAt).toLocaleTimeString()}
                      </span>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: RULE SIMULATOR */}
          {activeTab === 'tester' && (
            <Card className="p-6 border-slate-800 max-w-2xl space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Play className="w-4 h-4 text-teal-400" /> Incoming Message Simulator
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Test your active rules against sample incoming messages safely without modifying live mailboxes.
                </p>
              </div>

              <form onSubmit={handleRunSimulation} className="space-y-3">
                <div>
                  <label className="block text-xs font-mono uppercase text-slate-400 mb-1">From Sender</label>
                  <Input value={testFrom} onChange={(e) => setTestFrom(e.target.value)} required />
                </div>
                <div>
                  <label className="block text-xs font-mono uppercase text-slate-400 mb-1">Subject</label>
                  <Input value={testSubject} onChange={(e) => setTestSubject(e.target.value)} required />
                </div>
                <div>
                  <label className="block text-xs font-mono uppercase text-slate-400 mb-1">Message Body</label>
                  <textarea
                    rows={3}
                    value={testBody}
                    onChange={(e) => setTestBody(e.target.value)}
                    className="w-full text-xs p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-teal-500"
                    required
                  />
                </div>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={actionLoading}
                  className="text-xs bg-teal-600 hover:bg-teal-500"
                >
                  Simulate & Process
                </Button>
              </form>

              {simResult && (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2 mt-4">
                  <span className="text-xs font-bold text-white block">Simulation Result</span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">Status:</span>
                    <span className="font-mono text-teal-400 uppercase">{simResult.status}</span>
                  </div>
                  {simResult.ruleName && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500">Matched:</span>
                      <span className="text-white">{simResult.ruleName}</span>
                    </div>
                  )}
                  {simResult.replySubject && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500">Reply Subject:</span>
                      <span className="text-teal-300 font-mono">{simResult.replySubject}</span>
                    </div>
                  )}
                  {simResult.reason && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500">Reason:</span>
                      <span className="text-amber-400">{simResult.reason}</span>
                    </div>
                  )}
                </div>
              )}
            </Card>
          )}

          {/* RULE CREATE / EDIT MODAL */}
          {showRuleModal && (
            <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <h4 className="text-base font-bold text-white">
                    {editingRule ? 'Edit Auto-Reply Rule' : 'New Auto-Reply Rule'}
                  </h4>
                  <button type="button" onClick={() => setShowRuleModal(false)} className="text-slate-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveRule} className="space-y-4">
                  <div>
                    <label className="block text-xs font-mono uppercase text-slate-400 mb-1">Rule Name</label>
                    <Input
                      placeholder="e.g. Pricing Inquiry Response"
                      value={ruleFormData.name}
                      onChange={(e) => setRuleFormData({ ...ruleFormData, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-mono uppercase text-slate-400 mb-1">Priority</label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={ruleFormData.priority}
                        onChange={(e) => setRuleFormData({ ...ruleFormData, priority: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono uppercase text-slate-400 mb-1">Match Type</label>
                      <select
                        value={ruleFormData.matchType}
                        onChange={(e) => setRuleFormData({ ...ruleFormData, matchType: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"
                      >
                        <option value="contains">Contains Keyword</option>
                        <option value="exact">Exact Match</option>
                        <option value="starts_with">Starts With</option>
                        <option value="ends_with">Ends With</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
                      Keywords (comma separated)
                    </label>
                    <Input
                      placeholder="pricing, cost, quote, enterprise plan"
                      value={ruleFormData.keywords}
                      onChange={(e) => setRuleFormData({ ...ruleFormData, keywords: e.target.value })}
                    />
                  </div>

                  <div className="space-y-3 pt-2 border-t border-slate-800">
                    <span className="block text-xs font-mono uppercase text-teal-400 font-bold">Reply Template</span>
                    <div>
                      <label className="block text-[11px] font-mono text-slate-400 mb-1">Reply Subject</label>
                      <Input
                        value={ruleFormData.replySubject}
                        onChange={(e) => setRuleFormData({ ...ruleFormData, replySubject: e.target.value })}
                      />
                    </div>
                    {emailTemplates.length > 0 && (
                      <div>
                        <label className="block text-[11px] font-mono text-slate-400 mb-1">Use saved email template</label>
                        <select
                          defaultValue=""
                          onChange={(event) => {
                            const template = emailTemplates.find((item) => item._id === event.target.value);
                            if (template) {
                              setRuleFormData((current) => ({
                                ...current,
                                replySubject: template.subject || current.replySubject,
                                replyBody: template.textContent || template.htmlContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() || current.replyBody,
                                replyHtmlBody: template.htmlContent || current.replyHtmlBody,
                              }));
                            }
                          }}
                          className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200"
                        >
                          <option value="">Choose a template…</option>
                          {emailTemplates.map((template) => <option key={template._id} value={template._id}>{template.name}</option>)}
                        </select>
                      </div>
                    )}
                    <div>
                      <label className="block text-[11px] font-mono text-slate-400 mb-1">Reply Message</label>
                      <textarea
                        rows={5}
                        value={ruleFormData.replyBody}
                        onChange={(e) => setRuleFormData({ ...ruleFormData, replyBody: e.target.value })}
                        className="w-full text-xs p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-teal-500"
                        placeholder="Enter template message..."
                        required
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setShowRuleModal(false)} className="text-xs">
                      Cancel
                    </Button>
                    <Button type="submit" variant="primary" size="sm" isLoading={actionLoading} className="text-xs bg-teal-600 hover:bg-teal-500">
                      Save Rule
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AutoReplyPage;
