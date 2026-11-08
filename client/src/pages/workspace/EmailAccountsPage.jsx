import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useSearchParams } from 'react-router-dom';
import {
  getEmailProviders,
  getConnectedEmailAccounts,
  initiateEmailOAuth,
  callbackEmailOAuth,
  disconnectEmailAccount,
  sendTestEmail,
} from '../../services/api';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import {
  Mail,
  CheckCircle2,
  AlertCircle,
  Link2,
  Trash2,
  Send,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  HelpCircle,
  ExternalLink,
  Zap,
} from 'lucide-react';

export const EmailAccountsPage = () => {
  const { workspace, isAdmin, isSuperAdmin } = useWorkspace();
  const canManage = isAdmin || isSuperAdmin;
  const [searchParams, setSearchParams] = useSearchParams();

  const [providers, setProviders] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Test Email state
  const [testingAccountId, setTestingAccountId] = useState(null);
  const [testRecipient, setTestRecipient] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Manual OAuth code exchange (for dev or manual callback handling)
  const [manualCodeModal, setManualCodeModal] = useState(false);
  const [oauthCode, setOauthCode] = useState('');
  const [oauthState, setOauthState] = useState('');
  const [exchanging, setExchanging] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [provRes, accRes] = await Promise.all([
        getEmailProviders().catch(() => ({ data: [] })),
        getConnectedEmailAccounts().catch(() => ({ data: [] })),
      ]);
      setProviders(provRes.data || []);
      setAccounts(accRes.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load email account configurations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handle redirect params from server-side OAuth callback
  useEffect(() => {
    const connected = searchParams.get('connected');
    const oauthError = searchParams.get('error');
    if (connected === '1') {
      setSuccessMessage('Email account connected successfully!');
      loadData();
      setSearchParams({}, { replace: true });
    } else if (oauthError) {
      setError(decodeURIComponent(oauthError));
      setSearchParams({}, { replace: true });
    }
  }, []);

  const handleConnectProvider = async (providerId) => {
    setError('');
    try {
      const res = await initiateEmailOAuth({ provider: providerId });
      const { url, state } = res.data;
      // In production, open redirect directly
      window.location.href = url;
    } catch (err) {
      setError(
        err.message ||
          'Failed to start OAuth authorization. Verify that OAuth Client ID and Secret are configured.'
      );
    }
  };

  const handleManualExchange = async (e) => {
    e.preventDefault();
    if (!oauthCode.trim() || !oauthState.trim()) {
      setError('Please provide both the authorization code and state parameter.');
      return;
    }
    setExchanging(true);
    setError('');
    try {
      await callbackEmailOAuth({ code: oauthCode.trim(), state: oauthState.trim() });
      setSuccessMessage('Email account successfully connected to workspace!');
      setManualCodeModal(false);
      setOauthCode('');
      setOauthState('');
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to complete OAuth token exchange');
    } finally {
      setExchanging(false);
    }
  };

  const handleDisconnect = async (accountId, email) => {
    if (!window.confirm(`Are you sure you want to disconnect ${email}? Campaign sending from this address will be paused.`)) {
      return;
    }
    try {
      await disconnectEmailAccount(accountId);
      setSuccessMessage(`Account ${email} disconnected successfully`);
      loadData();
      if (testingAccountId === accountId) setTestingAccountId(null);
    } catch (err) {
      setError(err.message || 'Failed to disconnect account');
    }
  };

  const handleSendTestEmail = async (e) => {
    e.preventDefault();
    if (!testRecipient || !testRecipient.includes('@')) {
      setError('Please enter a valid recipient email address.');
      return;
    }
    setTestSending(true);
    setError('');
    setTestResult(null);
    try {
      const res = await sendTestEmail(testingAccountId, { recipientEmail: testRecipient.trim() });
      setTestResult({
        success: true,
        messageId: res.data?.messageId || 'SENT',
      });
      setSuccessMessage(`Test email sent successfully to ${testRecipient}!`);
    } catch (err) {
      setError(err.message || 'Failed to send test email through connected mailbox');
    } finally {
      setTestSending(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono uppercase tracking-widest text-indigo-400">
              EMAIL INFRASTRUCTURE
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-white sm:text-3xl">Email Accounts</h1>
          <p className="text-sm text-slate-400 mt-1">
            Connect mailboxes via OAuth to send personalized email campaigns from authorized sending domains in{' '}
            <span className="text-slate-300 font-semibold">{workspace?.name}</span>.
          </p>
        </div>

        {canManage && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setManualCodeModal(true)}
              className="border-slate-700 hover:border-slate-600 text-xs"
            >
              <Zap className="w-3.5 h-3.5 mr-1 text-amber-400" /> Manual Token Exchange
            </Button>
          </div>
        )}
      </div>

      {/* Messages */}
      {successMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> {successMessage}
          </span>
          <button onClick={() => setSuccessMessage('')} className="text-slate-400 hover:text-white">
            &times;
          </button>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
          </span>
          <button onClick={() => setError('')} className="text-slate-400 hover:text-white">
            &times;
          </button>
        </div>
      )}

      {/* Security Notice Card */}
      <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 text-xs text-indigo-300 space-y-1.5">
        <p className="font-semibold flex items-center gap-2 text-indigo-200">
          <ShieldCheck className="w-4 h-4 text-indigo-400" /> Identity vs. Mailbox Sending Permissions
        </p>
        <p className="text-slate-400 leading-relaxed">
          Google login authentication and Gmail mailbox authorization are separate permissions.
          Mailbox connections require explicit OAuth authorization with least-privilege sending scopes.
          OAuth tokens are encrypted at rest with AES-256-GCM and never exposed to the browser.
        </p>
      </div>

      {/* Connected Accounts Section */}
      <div>
        <h2 className="text-sm font-mono uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-2">
          <Mail className="w-4 h-4 text-violet-400" /> Connected Mailboxes ({accounts.length})
        </h2>

        {loading ? (
          <Card className="border-slate-800 p-8 text-center text-slate-500">
            <LoadingSpinner size="md" className="mx-auto mb-2" />
            Loading connected accounts...
          </Card>
        ) : accounts.length === 0 ? (
          <Card className="border-slate-800 p-8 text-center bg-slate-900/60">
            <Mail className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-300">No mailboxes connected yet</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Authorize a Gmail or Outlook account below to send campaigns from your verified address.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {accounts.map((acc) => {
              const isTesting = testingAccountId === acc._id;
              const isConnected = acc.connectionStatus === 'connected';

              return (
                <Card
                  key={acc._id}
                  className="border-slate-800 bg-slate-900 p-5 space-y-4 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                        <Mail className="w-5 h-5 text-violet-400" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">
                          {acc.displayName || acc.emailAddress}
                        </p>
                        <p className="text-xs font-mono text-slate-400">{acc.emailAddress}</p>
                        <span className="inline-block mt-1 text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                          {acc.provider}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono border ${
                        isConnected
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-red-500/10 text-red-400 border-red-500/20'
                      }`}
                    >
                      {isConnected ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : (
                        <AlertTriangle className="w-3 h-3" />
                      )}
                      {acc.connectionStatus.toUpperCase()}
                    </span>
                  </div>

                  {/* Sending Metadata */}
                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-[10px] font-mono uppercase text-slate-500">Daily Send Quota</p>
                      <p className="text-white font-semibold mt-0.5">
                        {acc.metadata?.dailyQuota || 500} emails/day
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-mono uppercase text-slate-500">Last Synced</p>
                      <p className="text-slate-300 font-mono text-[11px] mt-0.5">
                        {acc.lastSyncedAt ? new Date(acc.lastSyncedAt).toLocaleDateString() : '—'}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setTestingAccountId(isTesting ? null : acc._id);
                          setTestResult(null);
                        }}
                        className="text-[11px] border-slate-700 h-8 px-2.5"
                      >
                        <Send className="w-3 h-3 mr-1 text-indigo-400" />
                        {isTesting ? 'Hide Test Form' : 'Send Test Email'}
                      </Button>
                    </div>

                    {canManage && (
                      <button
                        onClick={() => handleDisconnect(acc._id, acc.emailAddress)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Disconnect account"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Inline Test Email Form */}
                  {isTesting && (
                    <form
                      onSubmit={handleSendTestEmail}
                      className="p-3.5 rounded-xl bg-slate-950 border border-indigo-500/30 space-y-3 animate-in fade-in"
                    >
                      <p className="text-xs font-semibold text-slate-300">
                        Dispatch Verification Test Email
                      </p>
                      <div className="flex gap-2">
                        <Input
                          type="email"
                          placeholder="recipient@example.com"
                          value={testRecipient}
                          onChange={(e) => setTestRecipient(e.target.value)}
                          required
                          className="h-8 text-xs"
                        />
                        <Button
                          type="submit"
                          variant="primary"
                          size="sm"
                          isLoading={testSending}
                          className="h-8 text-[11px] flex-shrink-0"
                        >
                          Send Test
                        </Button>
                      </div>

                      {testResult && (
                        <p className="text-[11px] font-mono text-emerald-400 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Delivered! ID: {testResult.messageId}
                        </p>
                      )}
                    </form>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Available Providers Section */}
      <div className="pt-4">
        <h2 className="text-sm font-mono uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-2">
          <Link2 className="w-4 h-4 text-emerald-400" /> Available Email Providers
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {providers.map((p) => (
            <Card
              key={p.id}
              className="border-slate-800 bg-slate-900 p-5 space-y-4 hover:border-slate-700 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">{p.name}</h3>
                  <p className="text-xs text-slate-400 mt-1">{p.description}</p>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono border ${
                    p.isConfigured
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  }`}
                >
                  {p.isConfigured ? 'READY' : 'CONFIG REQUIRED'}
                </span>
              </div>

              {!p.isConfigured && p.requiresEnv && p.requiresEnv.length > 0 && (
                <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 text-[11px] text-amber-300">
                  <p className="font-semibold mb-1">Missing environment configuration:</p>
                  <ul className="list-disc list-inside font-mono text-[10px] text-slate-400">
                    {p.requiresEnv.map((v) => (
                      <li key={v}>{v}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-end">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleConnectProvider(p.id)}
                  disabled={!canManage || !p.isConfigured}
                  className="text-xs"
                >
                  <Link2 className="w-3.5 h-3.5 mr-1.5" /> Connect {p.name}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Manual Code Exchange Modal */}
      {manualCodeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md">
            <Card className="border-slate-800 bg-slate-900 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white">Manual OAuth Token Exchange</h3>
                <button
                  onClick={() => setManualCodeModal(false)}
                  className="text-slate-400 hover:text-white"
                >
                  &times;
                </button>
              </div>

              <p className="text-xs text-slate-400">
                If completing OAuth in dev mode or with custom redirect URLs, input the returned authorization code and CSRF state parameter.
              </p>

              <form onSubmit={handleManualExchange} className="space-y-3">
                <div>
                  <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
                    State Parameter <span className="text-red-400">*</span>
                  </label>
                  <Input
                    placeholder="e.g. 9f8a7b6c5d..."
                    value={oauthState}
                    onChange={(e) => setOauthState(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
                    Authorization Code <span className="text-red-400">*</span>
                  </label>
                  <Input
                    placeholder="4/0AWgavdf..."
                    value={oauthCode}
                    onChange={(e) => setOauthCode(e.target.value)}
                    required
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={() => setManualCodeModal(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" size="sm" isLoading={exchanging}>
                    Exchange & Connect
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailAccountsPage;

