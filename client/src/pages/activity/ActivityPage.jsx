import React, { useState, useEffect } from 'react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import {
  Activity,
  Search,
  RefreshCw,
  Clock,
  Shield,
  User,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { getAuditLogs } from '../../services/api';

export const ActivityPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const loadLogs = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getAuditLogs({ search: searchTerm, action: actionFilter, limit: 100 });
      setLogs(res.data?.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [actionFilter]);

  const handleSearch = (e) => {
    e.preventDefault();
    loadLogs();
  };

  const getActionBadgeColor = (action) => {
    if (action.startsWith('auth.')) return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
    if (action.startsWith('campaign.')) return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
    if (action.startsWith('mailbox.')) return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    if (action.startsWith('autoreply.')) return 'bg-teal-500/10 text-teal-400 border-teal-500/20';
    return 'bg-slate-800 text-slate-300 border-slate-700';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Activity className="w-6 h-6 text-blue-400" /> Audit Trail & Activity Logs
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Complete security audit trail of workspace events, campaign lifecycle changes, and member actions.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadLogs}
          disabled={loading}
          className="text-xs border-slate-700"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Trail
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <form onSubmit={handleSearch} className="relative flex-1 w-full max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
          <Input
            placeholder="Search by actor, action, or entity..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </form>

        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="w-full sm:w-auto bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none"
        >
          <option value="">All Action Types</option>
          <option value="auth.login">Logins</option>
          <option value="campaign.send">Campaign Dispatches</option>
          <option value="campaign.schedule">Campaign Schedules</option>
          <option value="mailbox.connect">Mailbox Connections</option>
          <option value="autoreply.rule_create">Auto-Reply Changes</option>
        </select>
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
      ) : logs.length === 0 ? (
        <Card className="p-12 text-center border-dashed border-slate-800">
          <FileText className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-white mb-1">No audit events recorded</h3>
          <p className="text-xs text-slate-500">
            Administrative and security events will automatically appear here as team members take action.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <Card key={log._id} className="p-4 border-slate-800 text-xs flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-full font-mono text-[10px] uppercase border ${getActionBadgeColor(
                      log.action
                    )}`}
                  >
                    {log.action}
                  </span>
                  <span className="text-slate-300 font-semibold">{log.actorName || 'System'}</span>
                  {log.actorEmail && <span className="text-slate-500">({log.actorEmail})</span>}
                </div>
                {log.entityType && (
                  <p className="text-[11px] text-slate-400">
                    Target: <strong className="text-slate-300">{log.entityType}</strong>{' '}
                    {log.entityId && <span className="font-mono text-slate-500">[{log.entityId}]</span>}
                  </p>
                )}
              </div>
              <span className="text-[10px] font-mono text-slate-500 whitespace-nowrap ml-4">
                {new Date(log.createdAt).toLocaleString()}
              </span>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ActivityPage;
