import React, { useState, useEffect, useCallback } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import {
  getCampaigns,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  duplicateCampaign,
  sendCampaign,
  scheduleCampaign,
  getConnectedEmailAccounts,
  getContactGroups,
  getEmailTemplates,
} from '../../services/api';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { CampaignComposerModal } from './CampaignComposerModal';
import { CampaignDetailDrawer } from './CampaignDetailDrawer';
import {
  Send,
  Plus,
  Search,
  Filter,
  Copy,
  Trash2,
  Edit2,
  Eye,
  CheckCircle2,
  Clock,
  AlertCircle,
  Users,
  ChevronLeft,
  ChevronRight,
  Zap,
} from 'lucide-react';

export const CampaignsPage = () => {
  const { workspace, isCampaignManager, isAdmin, isSuperAdmin } = useWorkspace();
  const canManage = isCampaignManager || isAdmin || isSuperAdmin;

  const [campaigns, setCampaigns] = useState([]);
  const [senderAccounts, setSenderAccounts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [inspectingCampaign, setInspectingCampaign] = useState(null);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getCampaigns({
        page: pagination.page,
        limit: pagination.limit,
        search,
        status: statusFilter || undefined,
      });

      setCampaigns(res.data || []);
      if (res.pagination) {
        setPagination((prev) => ({
          ...prev,
          total: res.pagination.total,
          totalPages: res.pagination.totalPages,
        }));
      }
    } catch (err) {
      setError(err.message || 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, search, statusFilter]);

  const loadSupportingData = useCallback(async () => {
    try {
      const [accRes, grpRes, templateRes] = await Promise.all([
        getConnectedEmailAccounts().catch(() => ({ data: [] })),
        getContactGroups().catch(() => ({ data: [] })),
        getEmailTemplates({ limit: 100 }).catch(() => ({ data: [] })),
      ]);
      setSenderAccounts(accRes.data || []);
      setGroups(grpRes.data || []);
      setTemplates(templateRes.data || []);
    } catch (err) {
      console.error('Failed to load supporting data for campaigns:', err);
    }
  }, []);

  // Re-fetch sender accounts whenever the composer opens so a freshly
  // connected OAuth account is always available for selection.
  const refreshSenderAccounts = useCallback(async () => {
    try {
      const accRes = await getConnectedEmailAccounts().catch(() => ({ data: [] }));
      setSenderAccounts(accRes.data || []);
    } catch (err) {
      console.error('Failed to refresh sender accounts:', err);
    }
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  useEffect(() => {
    loadSupportingData();
  }, [loadSupportingData]);

  const handleSaveCampaign = async (payload, campaignId) => {
    if (campaignId) {
      const res = await updateCampaign(campaignId, payload);
      setSuccessMessage('Campaign draft updated');
      fetchCampaigns();
      return res.data;
    } else {
      const res = await createCampaign(payload);
      setSuccessMessage('Campaign created successfully');
      fetchCampaigns();
      return res.data;
    }
  };

  const handleSendCampaign = async (campaignId, payload = {}) => {
    try {
      await sendCampaign(campaignId, payload);
      setSuccessMessage('Campaign queued for delivery!');
      fetchCampaigns();
    } catch (err) {
      setError(err.message || 'Failed to trigger campaign send');
      throw err;
    }
  };

  const handleScheduleCampaign = async (campaignId, schedule) => {
    try {
      await scheduleCampaign(campaignId, schedule);
      setSuccessMessage('Campaign scheduled successfully.');
      fetchCampaigns();
    } catch (err) {
      setError(err.message || 'Failed to schedule campaign');
      throw err;
    }
  };

  const handleDuplicate = async (campaignId) => {
    try {
      await duplicateCampaign(campaignId);
      setSuccessMessage('Campaign duplicated as draft');
      fetchCampaigns();
    } catch (err) {
      setError(err.message || 'Failed to duplicate campaign');
    }
  };

  const handleDelete = async (campaignId, name) => {
    if (!window.confirm(`Are you sure you want to delete campaign "${name}"?`)) {
      return;
    }
    try {
      await deleteCampaign(campaignId);
      setSuccessMessage('Campaign deleted');
      fetchCampaigns();
      if (inspectingCampaign?._id === campaignId) setInspectingCampaign(null);
    } catch (err) {
      setError(err.message || 'Failed to delete campaign');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono uppercase tracking-widest text-amber-400">
              OUTBOUND COMMUNICATIONS
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-white sm:text-3xl">Email Campaigns</h1>
          <p className="text-sm text-slate-400 mt-1">
            Compose, personalize, and orchestrate targeted email campaigns for{' '}
            <span className="text-slate-300 font-semibold">{workspace?.name}</span>.
          </p>
        </div>

        {canManage && (
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setEditingCampaign(null);
                refreshSenderAccounts();
                setIsComposerOpen(true);
              }}
              className="bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              <Plus className="w-4 h-4 mr-1.5" /> Create Campaign
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

      {/* Filter Bar */}
      <Card className="p-4 border-slate-800 bg-slate-900/90">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search campaigns by name or subject line..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Campaign Statuses</option>
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
              <option value="queued">Queued</option>
              <option value="processing">Processing</option>
              <option value="sent">Sent</option>
              <option value="partially_failed">Partially Failed</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Campaigns Table */}
      <Card className="border-slate-800 p-0 overflow-hidden bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-mono uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Campaign Name & Subject</th>
                <th className="py-3 px-4">Sender Mailbox</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Audience</th>
                <th className="py-3 px-4">Created</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-500">
                    <LoadingSpinner size="md" className="mx-auto mb-2" />
                    Loading campaigns...
                  </td>
                </tr>
              ) : campaigns.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400">
                    <Send className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-300">No campaigns found</p>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      {search || statusFilter
                        ? 'Try clearing your search or status filters.'
                        : 'Get started by composing your first email campaign.'}
                    </p>
                  </td>
                </tr>
              ) : (
                campaigns.map((camp) => {
                  const isDraft = camp.status === 'draft';
                  const isQueuedOrProcessing =
                    camp.status === 'queued' || camp.status === 'processing';

                  return (
                    <tr
                      key={camp._id}
                      className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                      onClick={() => setInspectingCampaign(camp)}
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white text-sm">{camp.name}</div>
                        <div className="text-slate-400 font-mono text-[11px] truncate max-w-sm">
                          {camp.subject}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-300 font-mono text-[11px]">
                        {camp.senderEmailAccountId?.emailAddress || (
                          <span className="text-amber-400/80 italic">Not Assigned</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono border ${
                            camp.status === 'sent'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : isQueuedOrProcessing
                              ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 animate-pulse'
                              : isDraft
                              ? 'bg-slate-800 text-slate-400 border-slate-700'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          }`}
                        >
                          {camp.status.toUpperCase()}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="text-white font-semibold">
                          {camp.statistics?.totalRecipients ||
                            camp.recipientConfiguration?.estimatedCount ||
                            0}
                        </span>{' '}
                        <span className="text-slate-500 text-[11px]">contacts</span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                        {new Date(camp.createdAt).toLocaleDateString()}
                      </td>

                      <td
                        className="py-3.5 px-4 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setInspectingCampaign(camp)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                            title="Inspect details & recipients"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {canManage && (
                            <>
                              {isDraft && (
                                <button
                                  onClick={() => {
                                    setEditingCampaign(camp);
                                    refreshSenderAccounts();
                                    setIsComposerOpen(true);
                                  }}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                                  title="Edit Campaign"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              )}

                              <button
                                onClick={() => handleDuplicate(camp._id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors"
                                title="Duplicate Campaign"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>

                              {isDraft && (
                                <button
                                  onClick={() => handleDelete(camp._id, camp.name)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                  title="Delete Draft"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 bg-slate-950/60 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div>
            Showing{' '}
            <span className="text-white font-medium">
              {campaigns.length > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0}
            </span>{' '}
            to{' '}
            <span className="text-white font-medium">
              {Math.min(pagination.page * pagination.limit, pagination.total)}
            </span>{' '}
            of <span className="text-white font-medium">{pagination.total}</span> campaigns
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
              className="h-8 px-2.5"
            >
              <ChevronLeft className="w-4 h-4" /> Prev
            </Button>
            <span className="font-mono text-slate-300">
              Page {pagination.page} / {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
              className="h-8 px-2.5"
            >
              Next <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Composer Modal */}
      <CampaignComposerModal
        isOpen={isComposerOpen}
        onClose={() => setIsComposerOpen(false)}
        onSave={handleSaveCampaign}
        onSend={handleSendCampaign}
        campaign={editingCampaign}
        senderAccounts={senderAccounts}
        groups={groups}
        templates={templates}
        onSchedule={handleScheduleCampaign}
      />

      {/* Inspection Drawer */}
      <CampaignDetailDrawer
        isOpen={Boolean(inspectingCampaign)}
        onClose={() => setInspectingCampaign(null)}
        campaign={inspectingCampaign}
      />
    </div>
  );
};

export default CampaignsPage;
