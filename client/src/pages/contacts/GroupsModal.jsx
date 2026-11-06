import React, { useState } from 'react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { Users, Plus, Trash2, Edit2, X, Check } from 'lucide-react';

export const GroupsModal = ({ isOpen, onClose, groups = [], onRefresh, onCreateGroup, onUpdateGroup, onDeleteGroup }) => {
  if (!isOpen) return null;

  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    setError('');
    setSubmitting(true);
    try {
      await onCreateGroup({ name: newGroupName.trim(), description: newGroupDesc.trim() });
      setNewGroupName('');
      setNewGroupDesc('');
      onRefresh();
    } catch (err) {
      setError(err.message || 'Failed to create group');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (groupId) => {
    if (!editingName.trim()) return;
    setError('');
    setSubmitting(true);
    try {
      await onUpdateGroup(groupId, { name: editingName.trim() });
      setEditingGroupId(null);
      setEditingName('');
      onRefresh();
    } catch (err) {
      setError(err.message || 'Failed to rename group');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (groupId, groupName) => {
    if (!window.confirm(`Are you sure you want to delete the group "${groupName}"? Contacts will remain in the workspace.`)) {
      return;
    }
    setError('');
    try {
      await onDeleteGroup(groupId);
      onRefresh();
    } catch (err) {
      setError(err.message || 'Failed to delete group');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <Card className="border-slate-800 bg-slate-900 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                <Users className="w-4 h-4 text-violet-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Contact Groups & Segments</h3>
                <p className="text-xs text-slate-400">Organize your workspace audience into targeted lists</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {error && (
            <div className="p-3 mb-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              {error}
            </div>
          )}

          {/* Create Group Form */}
          <form onSubmit={handleCreate} className="p-3.5 mb-5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
            <p className="text-xs font-semibold text-slate-300">Create New Group</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Input
                placeholder="Group Name (e.g., VIPs)"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                required
              />
              <Input
                placeholder="Description (optional)"
                value={newGroupDesc}
                onChange={(e) => setNewGroupDesc(e.target.value)}
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" variant="primary" size="sm" isLoading={submitting} disabled={!newGroupName.trim()}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Group
              </Button>
            </div>
          </form>

          {/* Existing Groups List */}
          <div>
            <p className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2">
              Existing Workspace Groups ({groups.length})
            </p>

            {groups.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center italic">
                No groups created yet. Create your first group above.
              </p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {groups.map((group) => (
                  <div
                    key={group._id}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-950/30 border border-slate-800 hover:border-slate-700 transition-colors"
                  >
                    {editingGroupId === group._id ? (
                      <div className="flex items-center gap-2 flex-1 mr-2">
                        <Input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="h-8 text-xs"
                          autoFocus
                        />
                        <button
                          onClick={() => handleUpdate(group._id)}
                          className="p-1.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingGroupId(null)}
                          className="p-1.5 rounded bg-slate-800 text-slate-400 hover:text-white"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-white">{group.name}</span>
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                            {group.contactCount || 0} contacts
                          </span>
                        </div>
                        {group.description && (
                          <p className="text-xs text-slate-500 mt-0.5">{group.description}</p>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-1.5">
                      {editingGroupId !== group._id && (
                        <>
                          <button
                            onClick={() => {
                              setEditingGroupId(group._id);
                              setEditingName(group.name);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                            title="Rename Group"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(group._id, group.name)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Delete Group"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-4 mt-4 border-t border-slate-800">
            <Button variant="outline" size="sm" onClick={onClose}>
              Done
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

