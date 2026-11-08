import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  Users,
  Layers,
  Send,
  Mail,
  Activity,
  AlertOctagon,
  RefreshCw,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  RotateCcw,
  UserCheck,
  UserX,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  getAdminOverview,
  getAdminUsers,
  updateAdminUserStatus,
  updateAdminUserRole,
  getAdminQueues,
  retryAdminQueueJobs,
} from '../../services/api';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

export const AdminPage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'users' | 'queues'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Overview Data
  const [overview, setOverview] = useState(null);

  // Users Data
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [userPagination, setUserPagination] = useState({ total: 0, totalPages: 1 });
  const [actionUserId, setActionUserId] = useState(null);

  // Queues Data
  const [queueData, setQueueData] = useState(null);
  const [retryingQueue, setRetryingQueue] = useState(null);

  const fetchOverview = useCallback(async () => {
    try {
      const res = await getAdminOverview();
      setOverview(res.data);
    } catch (err) {
      console.error('Failed to load admin overview', err);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await getAdminUsers({
        search: userSearch,
        role: userRoleFilter || undefined,
        status: userStatusFilter || undefined,
        page: userPage,
        limit: 15,
      });
      setUsers(res.data || []);
      setUserPagination(res.pagination || { total: 0, totalPages: 1 });
    } catch (err) {
      console.error('Failed to load users', err);
    }
  }, [userSearch, userRoleFilter, userStatusFilter, userPage]);

  const fetchQueues = useCallback(async () => {
    try {
      const res = await getAdminQueues();
      setQueueData(res.data);
    } catch (err) {
      console.error('Failed to load queue stats', err);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await Promise.all([fetchOverview(), fetchUsers(), fetchQueues()]);
    } catch (err) {
      setError(err.message || 'Failed to refresh admin data');
    } finally {
      setLoading(false);
    }
  }, [fetchOverview, fetchUsers, fetchQueues]);

  useEffect(() => {
    if (user?.role === 'admin') {
      refreshAll();
    }
  }, [user, refreshAll]);

  const handleStatusChange = async (targetUser, newStatus) => {
    setError('');
    setSuccess('');
    setActionUserId(targetUser._id);
    try {
      let reason = '';
      if (newStatus === 'suspended') {
        reason = window.prompt(`Enter reason for suspending ${targetUser.email}:`) || 'Administrative action';
      }
      await updateAdminUserStatus(targetUser._id, { status: newStatus, reason });
      setSuccess(`User ${targetUser.email} status updated to ${newStatus}.`);
      fetchUsers();
      fetchOverview();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to update user status');
    } finally {
      setActionUserId(null);
    }
  };

  const handleRoleChange = async (targetUser, newRole) => {
    if (!window.confirm(`Are you sure you want to change role of ${targetUser.email} to ${newRole.toUpperCase()}?`)) {
      return;
    }
    setError('');
    setSuccess('');
    setActionUserId(targetUser._id);
    try {
      await updateAdminUserRole(targetUser._id, { role: newRole });
      setSuccess(`User ${targetUser.email} role updated to ${newRole}.`);
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to update user role');
    } finally {
      setActionUserId(null);
    }
  };

  const handleRetryQueue = async (qName) => {
    setRetryingQueue(qName);
    setError('');
    setSuccess('');
    try {
      const res = await retryAdminQueueJobs(qName);
      setSuccess(`Queued ${res.data?.retriedCount || 0} failed job(s) for retry on ${qName}.`);
      fetchQueues();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to retry queue jobs');
    } finally {
      setRetryingQueue(null);
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div className="max-w-md mx-auto my-20 p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center mx-auto text-rose-400">
          <AlertOctagon className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-white">Access Denied</h2>
        <p className="text-xs text-slate-400">
          Platform administration features require an account with administrative permissions.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Shield className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Platform Administration</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/30">
              Admin Console
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Global management of registered accounts, background BullMQ workers, and platform health.
          </p>
        </div>

        <Button variant="ghost" size="sm" onClick={refreshAll} disabled={loading} className="text-xs self-start">
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Data
        </Button>
      </div>

      {/* Notifications / Alerts */}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-rose-400 hover:text-rose-200">✕</button>
        </div>
      )}
      {success && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess('')} className="text-emerald-400 hover:text-emerald-200">✕</button>
        </div>
      )}

      {/* Overview Cards */}
      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Total Users</span>
              <Users className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-2xl font-bold text-white mt-1">
              {overview.users?.total?.toLocaleString() || 0}
            </div>
            <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
              <span>{overview.users?.active || 0} active</span>
              {overview.users?.suspended > 0 && (
                <span className="text-rose-400">· {overview.users.suspended} suspended</span>
              )}
            </div>
          </div>

          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Workspaces</span>
              <Layers className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl font-bold text-white mt-1">
              {overview.workspaces?.total?.toLocaleString() || 0}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Multi-tenant instances</div>
          </div>

          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Campaigns</span>
              <Send className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-white mt-1">
              {overview.campaigns?.total?.toLocaleString() || 0}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Dispatched platform-wide</div>
          </div>

          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Connected Mailboxes</span>
              <Mail className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-white mt-1">
              {overview.emailAccounts?.total?.toLocaleString() || 0}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">OAuth accounts</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeTab === 'overview' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          System Health
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeTab === 'users' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          User Management ({userPagination.total})
        </button>
        <button
          onClick={() => setActiveTab('queues')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeTab === 'queues' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Queue & Workers
        </button>
      </div>

      {/* TAB 1: System Health */}
      {activeTab === 'overview' && overview && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/40 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              Runtime Telemetry
            </h3>
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Environment</span>
                <span className="font-mono text-white uppercase">{overview.system?.nodeEnv}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Uptime</span>
                <span className="font-mono text-white">
                  {Math.floor((overview.system?.uptimeSeconds || 0) / 3600)}h{' '}
                  {Math.floor(((overview.system?.uptimeSeconds || 0) % 3600) / 60)}m
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Heap Memory Used</span>
                <span className="font-mono text-white">
                  {Math.round((overview.system?.memoryUsage?.heapUsed || 0) / 1024 / 1024)} MB
                </span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-400">Resident Set Size (RSS)</span>
                <span className="font-mono text-white">
                  {Math.round((overview.system?.memoryUsage?.rss || 0) / 1024 / 1024)} MB
                </span>
              </div>
            </div>
          </div>

          <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/40 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-400" />
              Security Governance
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Administrative operations trigger mandatory records in the platform audit log.
              Role changes take effect upon the user's subsequent token refresh.
            </p>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300">
              <span className="text-emerald-400 font-semibold block mb-0.5">Role-Based Access Enforced</span>
              Only users with <code className="text-indigo-400">admin</code> role can view or modify global state.
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: User Management */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={userSearch}
                onChange={(e) => {
                  setUserSearch(e.target.value);
                  setUserPage(1);
                }}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex gap-2">
              <select
                value={userRoleFilter}
                onChange={(e) => {
                  setUserRoleFilter(e.target.value);
                  setUserPage(1);
                }}
                className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:outline-none"
              >
                <option value="">All Roles</option>
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>

              <select
                value={userStatusFilter}
                onChange={(e) => {
                  setUserStatusFilter(e.target.value);
                  setUserPage(1);
                }}
                className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:outline-none"
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="deactivated">Deactivated</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 font-mono uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Verified</th>
                  <th className="py-3 px-4">Joined</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {users.map((u) => (
                  <tr key={u._id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-medium text-white">{u.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{u.email}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          u.role === 'admin'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                          u.status === 'active'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : u.status === 'suspended'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-rose-500/20 text-rose-400'
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {u.isVerified ? (
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-slate-600" />
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-500 font-mono">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {u._id === user._id ? (
                        <span className="text-[11px] text-slate-600 italic">Self</span>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          {u.status === 'active' ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-[10px] text-amber-400 border-amber-500/30 hover:bg-amber-500/10 py-1 px-2"
                              disabled={actionUserId === u._id}
                              onClick={() => handleStatusChange(u, 'suspended')}
                            >
                              <UserX className="w-3 h-3 mr-1" />
                              Suspend
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-[10px] text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 py-1 px-2"
                              disabled={actionUserId === u._id}
                              onClick={() => handleStatusChange(u, 'active')}
                            >
                              <UserCheck className="w-3 h-3 mr-1" />
                              Reactivate
                            </Button>
                          )}

                          {u.role === 'admin' ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-[10px] text-slate-400 hover:text-slate-200 py-1 px-2"
                              disabled={actionUserId === u._id}
                              onClick={() => handleRoleChange(u, 'user')}
                            >
                              Demote
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-[10px] text-indigo-400 hover:text-indigo-300 py-1 px-2"
                              disabled={actionUserId === u._id}
                              onClick={() => handleRoleChange(u, 'admin')}
                            >
                              Promote
                            </Button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {userPagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-500">
                Page {userPage} of {userPagination.totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={userPage <= 1}
                  onClick={() => setUserPage((p) => Math.max(1, p - 1))}
                  className="text-xs"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={userPage >= userPagination.totalPages}
                  onClick={() => setUserPage((p) => Math.min(userPagination.totalPages, p + 1))}
                  className="text-xs"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Queue & Worker Monitoring */}
      {activeTab === 'queues' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-3 h-3 rounded-full ${
                  queueData?.workerOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
                }`}
              />
              <div>
                <span className="text-xs font-semibold text-white">BullMQ Worker Process</span>
                <span className="text-[11px] text-slate-400 block">
                  {queueData?.workerOnline
                    ? 'Worker daemon is healthy and listening to queue channels'
                    : 'Worker daemon offline (in-memory test mode active)'}
                </span>
              </div>
            </div>
          </div>

          {/* Queues Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {queueData?.queues &&
              Object.entries(queueData.queues).map(([key, q]) => (
                <div key={key} className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-mono font-bold text-white">{q.name}</h4>
                      <span className="text-[10px] text-slate-500 uppercase">{q.status}</span>
                    </div>

                    {q.counts?.failed > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={retryingQueue === q.name}
                        onClick={() => handleRetryQueue(q.name)}
                        className="text-[10px] text-indigo-400 border-indigo-500/30 py-1 px-2"
                      >
                        <RotateCcw className="w-3 h-3 mr-1" />
                        Retry Failed ({q.counts.failed})
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-5 gap-2 text-center text-xs">
                    <div className="p-2 rounded bg-slate-950/60 border border-slate-800/60">
                      <span className="text-[10px] text-slate-500 block uppercase">Waiting</span>
                      <span className="font-mono text-white font-semibold mt-0.5 block">
                        {q.counts?.waiting || 0}
                      </span>
                    </div>
                    <div className="p-2 rounded bg-slate-950/60 border border-slate-800/60">
                      <span className="text-[10px] text-slate-500 block uppercase">Active</span>
                      <span className="font-mono text-blue-400 font-semibold mt-0.5 block">
                        {q.counts?.active || 0}
                      </span>
                    </div>
                    <div className="p-2 rounded bg-slate-950/60 border border-slate-800/60">
                      <span className="text-[10px] text-slate-500 block uppercase">Delayed</span>
                      <span className="font-mono text-purple-400 font-semibold mt-0.5 block">
                        {q.counts?.delayed || 0}
                      </span>
                    </div>
                    <div className="p-2 rounded bg-slate-950/60 border border-slate-800/60">
                      <span className="text-[10px] text-slate-500 block uppercase">Done</span>
                      <span className="font-mono text-emerald-400 font-semibold mt-0.5 block">
                        {q.counts?.completed || 0}
                      </span>
                    </div>
                    <div className="p-2 rounded bg-slate-950/60 border border-slate-800/60">
                      <span className="text-[10px] text-slate-500 block uppercase">Failed</span>
                      <span className="font-mono text-rose-400 font-semibold mt-0.5 block">
                        {q.counts?.failed || 0}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

