import React, { useState, useEffect, useCallback } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import {
  getContacts,
  getContactGroups,
  createContact,
  updateContact,
  deleteContact,
  unsubscribeContact,
  createContactGroup,
  updateContactGroup,
  deleteContactGroup,
  exportContactsUrl,
} from '../../services/api';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ContactModal } from './ContactModal';
import { GroupsModal } from './GroupsModal';
import { ImportModal } from './ImportModal';
import {
  Users,
  UserPlus,
  Upload,
  Download,
  Search,
  Filter,
  MoreVertical,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FolderPlus,
  Trash2,
  Edit2,
  Ban,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  HelpCircle,
} from 'lucide-react';

export const ContactsPage = () => {
  const { workspace, isCampaignManager, isAdmin, isSuperAdmin } = useWorkspace();
  const canManage = isCampaignManager || isAdmin || isSuperAdmin;

  // Data state
  const [contacts, setContacts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Filters & Search
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [consentFilter, setConsentFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');

  // Modals
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [isGroupsModalOpen, setIsGroupsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Selected for details slideover or actions
  const [inspectingContact, setInspectingContact] = useState(null);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getContacts({
        page: pagination.page,
        limit: pagination.limit,
        search,
        status: statusFilter || undefined,
        consentStatus: consentFilter || undefined,
        groupId: groupFilter || undefined,
        sortBy,
        sortOrder,
      });

      setContacts(res.data || []);
      if (res.pagination) {
        setPagination((prev) => ({
          ...prev,
          total: res.pagination.total,
          totalPages: res.pagination.totalPages,
        }));
      }
    } catch (err) {
      setError(err.message || 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, search, statusFilter, consentFilter, groupFilter, sortBy, sortOrder]);

  const fetchGroups = useCallback(async () => {
    try {
      const res = await getContactGroups();
      setGroups(res.data || []);
    } catch (err) {
      console.error('Error fetching contact groups:', err);
    }
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  // Actions
  const handleSaveContact = async (payload, contactId) => {
    if (contactId) {
      await updateContact(contactId, payload);
      setSuccessMessage('Contact updated successfully');
    } else {
      await createContact(payload);
      setSuccessMessage('Contact created successfully');
    }
    fetchContacts();
    fetchGroups();
  };

  const handleDeleteContact = async (id, email) => {
    if (!window.confirm(`Are you sure you want to delete contact "${email}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await deleteContact(id);
      setSuccessMessage('Contact deleted');
      fetchContacts();
      fetchGroups();
      if (inspectingContact?._id === id) setInspectingContact(null);
    } catch (err) {
      setError(err.message || 'Failed to delete contact');
    }
  };

  const handleUnsubscribeContact = async (id, email) => {
    if (!window.confirm(`Unsubscribe and suppress "${email}" from all marketing communications?`)) {
      return;
    }
    try {
      await unsubscribeContact(id);
      setSuccessMessage('Contact unsubscribed and suppressed');
      fetchContacts();
      if (inspectingContact?._id === id) {
        setInspectingContact((prev) => ({
          ...prev,
          status: 'unsubscribed',
          consentStatus: 'opted_out',
        }));
      }
    } catch (err) {
      setError(err.message || 'Failed to unsubscribe contact');
    }
  };

  const handleExport = (format) => {
    const filters = {};
    if (statusFilter) filters.status = statusFilter;
    if (consentFilter) filters.consentStatus = consentFilter;
    if (groupFilter) filters.groupId = groupFilter;
    window.open(exportContactsUrl(format, filters), '_blank');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono uppercase tracking-widest text-violet-400">
              AUDIENCE MANAGEMENT
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-white sm:text-3xl">Contacts</h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage subscribers, maintain consent records, and segment lists for campaigns in{' '}
            <span className="text-slate-300 font-semibold">{workspace?.name}</span>.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsGroupsModalOpen(true)}
            className="border-slate-700 hover:border-slate-600"
          >
            <FolderPlus className="w-4 h-4 mr-1.5 text-violet-400" /> Groups ({groups.length})
          </Button>

          {canManage && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsImportModalOpen(true)}
              className="border-slate-700 hover:border-slate-600"
            >
              <Upload className="w-4 h-4 mr-1.5 text-emerald-400" /> Import
            </Button>
          )}

          <div className="relative inline-flex">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('csv')}
              className="border-slate-700 hover:border-slate-600"
              title="Export as CSV"
            >
              <Download className="w-4 h-4 mr-1.5 text-indigo-400" /> Export CSV
            </Button>
          </div>

          {canManage && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setEditingContact(null);
                setIsContactModalOpen(true);
              }}
            >
              <UserPlus className="w-4 h-4 mr-1.5" /> Add Contact
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      {successMessage && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> {successMessage}
          </span>
          <button onClick={() => setSuccessMessage('')} className="text-slate-400 hover:text-white">
            &times;
          </button>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {error}
          </span>
          <button onClick={() => setError('')} className="text-slate-400 hover:text-white">
            &times;
          </button>
        </div>
      )}

      {/* Filter / Search Bar */}
      <Card className="p-4 border-slate-800 bg-slate-900/90">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, email, company, tag..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Group Filter */}
          <div>
            <select
              value={groupFilter}
              onChange={(e) => {
                setGroupFilter(e.target.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Groups</option>
              {groups.map((g) => (
                <option key={g._id} value={g._id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          {/* Subscription Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Subscription Statuses</option>
              <option value="subscribed">Subscribed</option>
              <option value="unsubscribed">Unsubscribed</option>
              <option value="bounced">Bounced</option>
              <option value="suppressed">Suppressed</option>
            </select>
          </div>

          {/* Consent Filter */}
          <div>
            <select
              value={consentFilter}
              onChange={(e) => {
                setConsentFilter(e.target.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Consent States</option>
              <option value="opted_in">Opted In (Eligible)</option>
              <option value="pending">Pending</option>
              <option value="opted_out">Opted Out</option>
              <option value="imported_unconfirmed">Imported Unconfirmed</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Contacts Table */}
      <Card className="border-slate-800 p-0 overflow-hidden bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-mono uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4">Company & Role</th>
                <th className="py-3 px-4">Groups & Tags</th>
                <th className="py-3 px-4">Status & Consent</th>
                <th className="py-3 px-4">Added</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-500">
                    <LoadingSpinner size="md" className="mx-auto mb-2" />
                    Loading contacts...
                  </td>
                </tr>
              ) : contacts.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400">
                    <Users className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-300">No contacts found</p>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      {search || statusFilter || consentFilter || groupFilter
                        ? 'Try clearing your filters or search term to see more contacts.'
                        : 'Your workspace audience is empty. Add your first contact or import a CSV/Excel file.'}
                    </p>
                  </td>
                </tr>
              ) : (
                contacts.map((contact) => {
                  const isEligible =
                    contact.status === 'subscribed' &&
                    contact.consentStatus === 'opted_in' &&
                    !contact.unsubscribedAt;

                  return (
                    <tr
                      key={contact._id}
                      className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                      onClick={() => setInspectingContact(contact)}
                    >
                      {/* Name & Email */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-white">
                          {contact.firstName || contact.lastName
                            ? `${contact.firstName} ${contact.lastName}`.trim()
                            : '—'}
                        </div>
                        <div className="text-slate-400 font-mono text-[11px]">
                          {contact.email}
                        </div>
                      </td>

                      {/* Company & Role */}
                      <td className="py-3.5 px-4">
                        <div className="text-slate-300">{contact.company || '—'}</div>
                        <div className="text-slate-500 text-[11px]">{contact.jobTitle || ''}</div>
                      </td>

                      {/* Groups & Tags */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {(contact.groups || []).map((grp) => (
                            <span
                              key={grp._id || grp}
                              className="px-2 py-0.5 rounded-full text-[10px] bg-violet-500/10 text-violet-400 border border-violet-500/20 font-medium"
                            >
                              {grp.name || 'Group'}
                            </span>
                          ))}
                          {(contact.tags || []).map((tag, idx) => (
                            <span
                              key={idx}
                              className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 border border-slate-700"
                            >
                              #{tag}
                            </span>
                          ))}
                          {(!contact.groups || contact.groups.length === 0) &&
                            (!contact.tags || contact.tags.length === 0) && (
                              <span className="text-slate-600 italic">None</span>
                            )}
                        </div>
                      </td>

                      {/* Status & Consent */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1">
                          {/* Status Badge */}
                          <span
                            className={`inline-flex items-center gap-1 w-max px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                              contact.status === 'subscribed'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : contact.status === 'unsubscribed'
                                ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}
                          >
                            {contact.status === 'subscribed' ? (
                              <CheckCircle2 className="w-2.5 h-2.5" />
                            ) : (
                              <Ban className="w-2.5 h-2.5" />
                            )}
                            {contact.status.toUpperCase()}
                          </span>

                          {/* Consent Indicator */}
                          <span
                            className={`text-[10px] flex items-center gap-1 ${
                              isEligible
                                ? 'text-emerald-400'
                                : 'text-amber-400/90'
                            }`}
                            title={isEligible ? 'Eligible for campaign sending' : 'Ineligible for marketing campaigns'}
                          >
                            {isEligible ? (
                              <ShieldCheck className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <ShieldAlert className="w-3 h-3 text-amber-400" />
                            )}
                            {contact.consentStatus}
                          </span>
                        </div>
                      </td>

                      {/* Added */}
                      <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                        {contact.createdAt
                          ? new Date(contact.createdAt).toLocaleDateString()
                          : '—'}
                      </td>

                      {/* Actions */}
                      <td
                        className="py-3.5 px-4 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1">
                          {canManage && (
                            <>
                              <button
                                onClick={() => {
                                  setEditingContact(contact);
                                  setIsContactModalOpen(true);
                                }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                                title="Edit Contact"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              {contact.status !== 'unsubscribed' && (
                                <button
                                  onClick={() => handleUnsubscribeContact(contact._id, contact.email)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                                  title="Unsubscribe & Suppress"
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                </button>
                              )}

                              <button
                                onClick={() => handleDeleteContact(contact._id, contact.email)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                title="Delete Contact"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
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
              {contacts.length > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0}
            </span>{' '}
            to{' '}
            <span className="text-white font-medium">
              {Math.min(pagination.page * pagination.limit, pagination.total)}
            </span>{' '}
            of <span className="text-white font-medium">{pagination.total}</span> contacts
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

      {/* Contact Details Inspection Drawer/Modal */}
      {inspectingContact && (
        <div className="fixed inset-0 z-40 flex items-center justify-end bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-md h-full bg-slate-900 border-l border-slate-800 p-6 overflow-y-auto space-y-6 animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white">Contact Details</h3>
                <p className="text-xs text-slate-400 font-mono">{inspectingContact.email}</p>
              </div>
              <button
                onClick={() => setInspectingContact(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                &times;
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <p className="font-mono uppercase text-slate-500 mb-1">Full Name</p>
                <p className="text-white font-semibold">
                  {inspectingContact.firstName || inspectingContact.lastName
                    ? `${inspectingContact.firstName} ${inspectingContact.lastName}`.trim()
                    : 'Not specified'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="font-mono uppercase text-slate-500 mb-1">Company</p>
                  <p className="text-slate-300">{inspectingContact.company || '—'}</p>
                </div>
                <div>
                  <p className="font-mono uppercase text-slate-500 mb-1">Job Title</p>
                  <p className="text-slate-300">{inspectingContact.jobTitle || '—'}</p>
                </div>
              </div>

              <div>
                <p className="font-mono uppercase text-slate-500 mb-1">Phone</p>
                <p className="text-slate-300">{inspectingContact.phone || '—'}</p>
              </div>

              {/* Status and Consent Overview */}
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <p className="font-semibold text-white">Campaign Delivery Eligibility</p>
                <div className="flex items-center gap-2">
                  {inspectingContact.status === 'subscribed' &&
                  inspectingContact.consentStatus === 'opted_in' &&
                  !inspectingContact.unsubscribedAt ? (
                    <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4" /> Eligible for Campaign Sending
                    </span>
                  ) : (
                    <span className="text-amber-400 font-semibold flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4" /> Excluded from Campaigns
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400">
                  Status: <span className="text-white font-mono">{inspectingContact.status}</span>
                  <br />
                  Consent: <span className="text-white font-mono">{inspectingContact.consentStatus}</span>
                  {inspectingContact.unsubscribedAt && (
                    <>
                      <br />
                      Unsubscribed At:{' '}
                      <span className="text-red-400 font-mono">
                        {new Date(inspectingContact.unsubscribedAt).toLocaleString()}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Consent History Log */}
              {inspectingContact.consentHistory && inspectingContact.consentHistory.length > 0 && (
                <div>
                  <p className="font-mono uppercase text-slate-500 mb-2">Consent Audit Trail</p>
                  <div className="space-y-2 border-l-2 border-slate-800 pl-3">
                    {inspectingContact.consentHistory.map((item, idx) => (
                      <div key={idx} className="text-[11px]">
                        <p className="text-slate-300 font-medium">{item.status}</p>
                        <p className="text-slate-500">{item.note || item.source}</p>
                        <p className="text-[10px] font-mono text-slate-600">
                          {new Date(item.timestamp).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditingContact(inspectingContact);
                  setIsContactModalOpen(true);
                }}
              >
                Edit Contact
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setInspectingContact(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Contact Modal */}
      <ContactModal
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
        onSave={handleSaveContact}
        contact={editingContact}
        groups={groups}
      />

      {/* Groups Management Modal */}
      <GroupsModal
        isOpen={isGroupsModalOpen}
        onClose={() => setIsGroupsModalOpen(false)}
        groups={groups}
        onRefresh={() => {
          fetchGroups();
          fetchContacts();
        }}
        onCreateGroup={createContactGroup}
        onUpdateGroup={updateContactGroup}
        onDeleteGroup={deleteContactGroup}
      />

      {/* Import Modal */}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        groups={groups}
        onImportComplete={() => {
          fetchContacts();
          fetchGroups();
        }}
      />
    </div>
  );
};

export default ContactsPage;
