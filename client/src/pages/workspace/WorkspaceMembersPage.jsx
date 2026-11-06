import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import {
  getWorkspaceMembers,
  getWorkspaceInvitations,
  createWorkspaceInvitation,
} from '../../services/api';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import {
  Users,
  UserPlus,
  Shield,
  Clock,
  CheckCircle,
  AlertCircle,
  Mail,
  Copy,
  Check,
} from 'lucide-react';

export const WorkspaceMembersPage = () => {
  const { workspace, userRole, isAdmin, isSuperAdmin } = useWorkspace();
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('User');
  const [submitting, setSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');
  const [copiedToken, setCopiedToken] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setActionError('');
    try {
      const [membersRes, invitesRes] = await Promise.all([
        getWorkspaceMembers(),
        getWorkspaceInvitations().catch(() => ({ data: { invitations: [] } })),
      ]);
      setMembers(membersRes.data?.members || []);
      setInvitations(invitesRes.data?.invitations || []);
    } catch (err) {
      setActionError(err.message || 'Failed to load team data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSendInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail) return;

    setSubmitting(true);
    setActionSuccess('');
    setActionError('');

    try {
      const res = await createWorkspaceInvitation({
        email: inviteEmail,
        role: inviteRole,
      });

      const devToken = res.data?.devInvitationToken;
      setActionSuccess(
        `Invitation created for ${inviteEmail}!${
          devToken
            ? ` Development invite token generated: ${devToken}`
            : ' An invitation link will be delivered.'
        }`
      );
      setInviteEmail('');
      setInviteRole('User');
      loadData();
    } catch (err) {
      setActionError(err.message || 'Failed to send invitation');
    } finally {
      setSubmitting(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedToken(text);
    setTimeout(() => setCopiedToken(null), 3000);
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'Super Admin':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'Admin':
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
      case 'Campaign Manager':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white sm:text-3xl flex items-center gap-2.5">
            <Users className="w-7 h-7 text-indigo-400" /> Workspace Team & Access
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Manage members, delegate role-based permissions, and invite collaborators to{' '}
            <span className="font-semibold text-slate-200">
              {workspace?.name || 'your workspace'}
            </span>
            .
          </p>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-start gap-3">
          <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1 break-all">{actionSuccess}</div>
        </div>
      )}

      {actionError && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>{actionError}</div>
        </div>
      )}

      {/* Invite Member Card (Admins / Super Admins only) */}
      {isAdmin && (
        <Card className="p-6 border-slate-800">
          <div className="flex items-center gap-2 mb-4">
            <UserPlus className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-bold text-white">Invite Team Member</h2>
          </div>
          <form onSubmit={handleSendInvite} className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-6">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <Input
                type="email"
                placeholder="colleague@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
              />
            </div>
            <div className="md:col-span-4">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Workspace Role
              </label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="User">User (Read-only access)</option>
                <option value="Campaign Manager">Campaign Manager (Manage campaigns & contacts)</option>
                {isSuperAdmin && <option value="Admin">Admin (Workspace & team admin)</option>}
              </select>
            </div>
            <div className="md:col-span-2 flex items-end">
              <Button
                type="submit"
                variant="primary"
                size="md"
                className="w-full h-[42px]"
                disabled={submitting}
              >
                {submitting ? 'Sending...' : 'Send Invite'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Active Members Table */}
      <Card className="overflow-hidden border-slate-800">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-bold text-white">Active Members ({members.length})</h2>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            Your role: <span className="text-indigo-400 font-semibold">{userRole || 'User'}</span>
          </span>
        </div>

        {loading ? (
          <div className="p-12 flex justify-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : members.length === 0 ? (
          <div className="p-12 text-center text-slate-400">No active members found.</div>
        ) : (
          <div className="divide-y divide-slate-800">
            {members.map((member) => (
              <div
                key={member.id}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-900/40 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-sm">
                    {member.user?.name ? member.user.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white flex items-center gap-2">
                      {member.user?.name || 'Workspace Member'}
                    </div>
                    <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                      <Mail className="w-3.5 h-3.5" />
                      {member.user?.email}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getRoleBadge(
                      member.role
                    )}`}
                  >
                    {member.role}
                  </span>
                  <span className="text-xs text-slate-500 hidden md:inline">
                    Joined {new Date(member.joinedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Pending Invitations Table */}
      {isAdmin && invitations.length > 0 && (
        <Card className="overflow-hidden border-slate-800">
          <div className="p-6 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg font-bold text-white">Pending Invitations ({invitations.length})</h2>
            </div>
          </div>
          <div className="divide-y divide-slate-800">
            {invitations.map((inv) => (
              <div
                key={inv.id}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div>
                  <div className="text-sm font-semibold text-white">{inv.email}</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Invited {new Date(inv.createdAt).toLocaleDateString()} by{' '}
                    {inv.invitedBy?.name || 'Team Admin'}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getRoleBadge(
                      inv.role
                    )}`}
                  >
                    {inv.role}
                  </span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    Pending
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

