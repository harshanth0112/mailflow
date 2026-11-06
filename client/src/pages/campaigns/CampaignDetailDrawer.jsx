import React, { useState, useEffect } from 'react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import {
  X,
  Mail,
  Send,
  CheckCircle2,
  AlertTriangle,
  Clock,
  User,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import { getCampaignRecipients } from '../../services/api';

export const CampaignDetailDrawer = ({ isOpen, onClose, campaign = null }) => {
  if (!isOpen || !campaign) return null;

  const [recipients, setRecipients] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchRecipients = async () => {
      setLoading(true);
      try {
        const res = await getCampaignRecipients(campaign._id, {
          page: pagination.page,
          limit: pagination.limit,
        });
        if (isMounted && res.data) {
          setRecipients(res.data);
          if (res.pagination) {
            setPagination((p) => ({
              ...p,
              total: res.pagination.total,
              totalPages: res.pagination.totalPages,
            }));
          }
        }
      } catch (err) {
        console.error('Failed to load campaign recipients:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchRecipients();
    return () => {
      isMounted = false;
    };
  }, [campaign._id, pagination.page]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-xl h-full bg-slate-900 border-l border-slate-800 p-6 overflow-y-auto space-y-6 flex flex-col justify-between">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-indigo-400">
                CAMPAIGN INSPECTOR
              </span>
              <h3 className="text-lg font-bold text-white mt-0.5">{campaign.name}</h3>
              <p className="text-xs text-slate-400 font-mono">Subject: {campaign.subject}</p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Delivery & Status Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-center">
              <span className="text-[10px] uppercase font-mono text-slate-500 block">Status</span>
              <span className="text-xs font-bold font-mono text-indigo-400 mt-0.5 block">
                {campaign.status.toUpperCase()}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-center">
              <span className="text-[10px] uppercase font-mono text-slate-500 block">Total Target</span>
              <span className="text-xs font-bold text-white mt-0.5 block">
                {campaign.statistics?.totalRecipients || campaign.recipientConfiguration?.estimatedCount || 0}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-center">
              <span className="text-[10px] uppercase font-mono text-slate-500 block">Dispatched</span>
              <span className="text-xs font-bold text-emerald-400 mt-0.5 block">
                {campaign.statistics?.sent || 0}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-center">
              <span className="text-[10px] uppercase font-mono text-slate-500 block">Failed</span>
              <span className="text-xs font-bold text-red-400 mt-0.5 block">
                {campaign.statistics?.failed || 0}
              </span>
            </div>
          </div>

          {/* Sender & Dates */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Sender Mailbox:</span>
              <span className="text-slate-200 font-mono">
                {campaign.senderEmailAccountId?.emailAddress || '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Sender Name:</span>
              <span className="text-slate-200">{campaign.senderName || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Created At:</span>
              <span className="text-slate-400 font-mono">
                {new Date(campaign.createdAt).toLocaleString()}
              </span>
            </div>
            {campaign.startedAt && (
              <div className="flex justify-between">
                <span className="text-slate-500">Started At:</span>
                <span className="text-indigo-300 font-mono">
                  {new Date(campaign.startedAt).toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {/* Recipient Delivery Records Table */}
          <div className="space-y-3">
            <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Recipient Delivery Records ({pagination.total})</span>
            </h4>

            {loading ? (
              <div className="py-8 text-center text-slate-500">
                <LoadingSpinner size="sm" className="mx-auto mb-2" />
                Loading recipient records...
              </div>
            ) : recipients.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center italic border border-dashed border-slate-800 rounded-xl">
                No individual recipient records generated yet. Launching the campaign will initialize delivery records.
              </p>
            ) : (
              <div className="border border-slate-800 rounded-xl overflow-hidden">
                <div className="max-h-60 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-mono uppercase">
                      <tr>
                        <th className="py-2 px-3">Recipient Email</th>
                        <th className="py-2 px-3">Delivery Status</th>
                        <th className="py-2 px-3 text-right">Message ID</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {recipients.map((r) => (
                        <tr key={r._id} className="hover:bg-slate-800/40">
                          <td className="py-2 px-3 font-mono text-slate-300 truncate max-w-[180px]">
                            {r.email}
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-mono border ${
                                r.recipientStatus === 'sent' || r.recipientStatus === 'delivered'
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                  : r.recipientStatus === 'failed' || r.recipientStatus === 'bounced'
                                  ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                  : 'bg-slate-800 text-slate-400 border-slate-700'
                              }`}
                            >
                              {r.recipientStatus.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-[10px] text-slate-500 truncate max-w-[120px]">
                            {r.providerMessageId || 'Pending'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                  <div className="p-2.5 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pagination.page <= 1}
                      onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                      className="h-7 px-2 text-[11px]"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </Button>
                    <span className="text-[11px] font-mono text-slate-400">
                      {pagination.page} / {pagination.totalPages}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pagination.page >= pagination.totalPages}
                      onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                      className="h-7 px-2 text-[11px]"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-800 flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};

