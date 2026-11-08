import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Mail,
  Shield,
  Info,
  CheckCheck,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../../services/api';
import { Button } from '../../components/common/Button';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

const getNotificationIcon = (type) => {
  switch (type) {
    case 'campaign_completed':
      return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
    case 'campaign_failed':
    case 'delivery_error':
      return <AlertTriangle className="w-5 h-5 text-amber-400" />;
    case 'security_alert':
      return <Shield className="w-5 h-5 text-rose-400" />;
    case 'workspace_invite':
    case 'role_changed':
      return <Mail className="w-5 h-5 text-indigo-400" />;
    default:
      return <Info className="w-5 h-5 text-blue-400" />;
  }
};

export const NotificationsPage = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState('all'); // 'all' | 'unread'
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [actionLoading, setActionLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: 15,
        ...(filter === 'unread' ? { isRead: false } : {}),
      };
      const [res, unreadRes] = await Promise.all([
        getNotifications(params),
        getUnreadNotificationCount(),
      ]);
      setNotifications(res.data || []);
      setPagination(res.pagination || { total: 0, totalPages: 1 });
      setUnreadCount(unreadRes.data?.unreadCount || 0);
    } catch (err) {
      console.error('Failed to load notifications', err);
    } finally {
      setLoading(false);
    }
  }, [page, filter]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAsRead = async (id) => {
    try {
      await markNotificationAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error('Failed to mark notification as read', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    setActionLoading(true);
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read', err);
    } finally {
      setActionLoading(false);
    }
  };

  const formatTimestamp = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-white tracking-tight">Notifications</h1>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                {unreadCount} unread
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Stay updated with campaign dispatches, team events, and security alerts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchNotifications}
            disabled={loading}
            className="text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllAsRead}
              disabled={actionLoading}
              className="text-xs"
            >
              <CheckCheck className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
              Mark all as read
            </Button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => {
            setFilter('all');
            setPage(1);
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            filter === 'all'
              ? 'bg-slate-800 text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          All Notifications
        </button>
        <button
          onClick={() => {
            setFilter('unread');
            setPage(1);
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            filter === 'unread'
              ? 'bg-slate-800 text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Unread Only ({unreadCount})
        </button>
      </div>

      {/* Content List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <LoadingSpinner size="lg" />
          <p className="text-xs text-slate-500 mt-3">Loading notifications...</p>
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-800/60 flex items-center justify-center mx-auto mb-3 text-slate-400">
            <Bell className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-white">No notifications yet</h3>
          <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">
            {filter === 'unread'
              ? 'You have caught up with everything! No unread notifications.'
              : 'Updates about your campaigns, team activity, and workspace will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {notifications.map((notif) => (
            <div
              key={notif._id}
              className={`p-4 rounded-xl border transition-all flex items-start gap-3.5 ${
                notif.isRead
                  ? 'bg-slate-900/30 border-slate-800/60 opacity-80'
                  : 'bg-slate-900/80 border-indigo-500/30 shadow-sm'
              }`}
            >
              <div className="p-2 rounded-lg bg-slate-800/60 shrink-0 mt-0.5">
                {getNotificationIcon(notif.type)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-white truncate">{notif.title}</h4>
                  <span className="text-[11px] text-slate-500 font-mono shrink-0">
                    {formatTimestamp(notif.createdAt)}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">{notif.message}</p>

                <div className="flex items-center gap-3 mt-3">
                  {notif.link && (
                    <a
                      href={notif.link}
                      className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                    >
                      <span>View details</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}

                  {!notif.isRead && (
                    <button
                      onClick={() => handleMarkAsRead(notif._id)}
                      className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
                    >
                      Mark as read
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <span className="text-xs text-slate-500">
                Page {page} of {pagination.totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="text-xs"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  className="text-xs"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
