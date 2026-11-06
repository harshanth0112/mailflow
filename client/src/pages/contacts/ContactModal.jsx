import React, { useState } from 'react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { X, Check } from 'lucide-react';

export const ContactModal = ({ isOpen, onClose, onSave, contact = null, groups = [] }) => {
  if (!isOpen) return null;

  const isEdit = Boolean(contact && contact._id);

  const [formData, setFormData] = useState({
    email: contact?.email || '',
    firstName: contact?.firstName || '',
    lastName: contact?.lastName || '',
    phone: contact?.phone || '',
    company: contact?.company || '',
    jobTitle: contact?.jobTitle || '',
    status: contact?.status || 'subscribed',
    consentStatus: contact?.consentStatus || (isEdit ? 'pending' : 'opted_in'),
    tags: contact?.tags ? contact.tags.join(', ') : '',
    groups: contact?.groups ? contact.groups.map((g) => (typeof g === 'object' ? g._id : g)) : [],
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleGroupToggle = (groupId) => {
    setFormData((prev) => {
      const exists = prev.groups.includes(groupId);
      return {
        ...prev,
        groups: exists ? prev.groups.filter((id) => id !== groupId) : [...prev.groups, groupId],
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!formData.email || !formData.email.includes('@')) {
      setError('Please provide a valid email address');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        email: formData.email.trim(),
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        phone: formData.phone.trim(),
        company: formData.company.trim(),
        jobTitle: formData.jobTitle.trim(),
        status: formData.status,
        consentStatus: formData.consentStatus,
        tags: formData.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        groups: formData.groups,
      };

      await onSave(payload, contact?._id);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save contact');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <Card className="border-slate-800 bg-slate-900 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
            <div>
              <h3 className="text-lg font-bold text-white">
                {isEdit ? 'Edit Contact' : 'Add New Contact'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isEdit ? 'Update subscriber information and preferences' : 'Directly register a new subscriber in your workspace'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {error && (
            <div className="p-3 mb-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
                Email Address <span className="text-red-400">*</span>
              </label>
              <Input
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="sarah.connor@example.com"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
                  First Name
                </label>
                <Input
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  placeholder="Sarah"
                />
              </div>
              <div>
                <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
                  Last Name
                </label>
                <Input
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  placeholder="Connor"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
                  Company
                </label>
                <Input
                  name="company"
                  value={formData.company}
                  onChange={handleChange}
                  placeholder="Cyberdyne Systems"
                />
              </div>
              <div>
                <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
                  Job Title
                </label>
                <Input
                  name="jobTitle"
                  value={formData.jobTitle}
                  onChange={handleChange}
                  placeholder="Operations Lead"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
                  Phone Number
                </label>
                <Input
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+1 (555) 019-2834"
                />
              </div>
              <div>
                <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
                  Tags (comma separated)
                </label>
                <Input
                  name="tags"
                  value={formData.tags}
                  onChange={handleChange}
                  placeholder="vip, newsletter, enterprise"
                />
              </div>
            </div>

            {/* Status & Consent Section */}
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
                    Subscription Status
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="subscribed">Subscribed</option>
                    <option value="unsubscribed">Unsubscribed (Suppressed)</option>
                    <option value="bounced">Bounced</option>
                    <option value="suppressed">Suppressed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
                    Marketing Consent
                  </label>
                  <select
                    name="consentStatus"
                    value={formData.consentStatus}
                    onChange={handleChange}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="opted_in">Opted In (Eligible for campaigns)</option>
                    <option value="pending">Pending</option>
                    <option value="opted_out">Opted Out</option>
                    <option value="imported_unconfirmed">Imported (Unconfirmed)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Groups Selection */}
            {groups.length > 0 && (
              <div>
                <label className="block text-xs font-mono uppercase text-slate-400 mb-1.5">
                  Assign Groups
                </label>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 rounded-lg bg-slate-950/40 border border-slate-800">
                  {groups.map((grp) => {
                    const selected = formData.groups.includes(grp._id);
                    return (
                      <button
                        type="button"
                        key={grp._id}
                        onClick={() => handleGroupToggle(grp._id)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                          selected
                            ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                            : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:border-slate-600'
                        }`}
                      >
                        {selected && <Check className="w-3 h-3 text-indigo-400" />}
                        {grp.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" isLoading={submitting}>
                {isEdit ? 'Update Contact' : 'Create Contact'}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};

