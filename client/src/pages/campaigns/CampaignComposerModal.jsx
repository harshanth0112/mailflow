import React, { useState, useEffect } from 'react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import {
  X,
  Clock,
  Mail,
  Users,
  Eye,
  Send,
  Sparkles,
  Layers,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Smartphone,
  Monitor,
  Paperclip,
  Trash2,
  FileText,
} from 'lucide-react';
import { previewAudience, sendCampaignTestEmail, uploadAttachments } from '../../services/api';

const createInitialFormData = (campaign, senderAccounts = []) => {
  const activeSenders = senderAccounts.filter((acc) => !acc.connectionStatus || acc.connectionStatus === 'connected');
  const defaultSenderId =
    campaign?.senderEmailAccountId?._id ||
    campaign?.senderEmailAccountId ||
    (activeSenders[0]?._id || senderAccounts[0]?._id || '');

  return {
    name: campaign?.name || '',
    subject: campaign?.subject || '',
    previewText: campaign?.previewText || '',
    senderEmailAccountId: defaultSenderId,
    senderName: campaign?.senderName || '',
    replyTo: campaign?.replyTo || '',
    recipientType: campaign?.recipientConfiguration?.type || 'all_eligible',
    groupIds: campaign?.recipientConfiguration?.groupIds || [],
    tags: campaign?.recipientConfiguration?.tags ? campaign.recipientConfiguration.tags.join(', ') : '',
    attachments: campaign?.attachments || [],
    htmlContent:
      campaign?.htmlContent ||
      '<div style="font-family: sans-serif; line-height: 1.6; color: #1e293b;">\n  <h2>Hello {{firstName}},</h2>\n  <p>We are thrilled to share our latest product updates with {{company}}!</p>\n  <p>Let us know if you have any questions.</p>\n  <p>Best regards,<br/>The MailFlow Team</p>\n</div>',
    textContent:
      campaign?.textContent ||
      'Hello {{firstName}},\n\nWe are thrilled to share our latest product updates with {{company}}!\n\nBest regards,\nThe MailFlow Team',
    templateId: campaign?.templateId || '',
  };
};

export const CampaignComposerModal = ({
  isOpen,
  onClose,
  onSave,
  onSend,
  campaign = null,
  senderAccounts = [],
  groups = [],
  templates = [],
  onSchedule,
}) => {
  const isEdit = Boolean(campaign && campaign._id);

  const [step, setStep] = useState(1); // 1: Setup & Sender, 2: Audience, 3: Content & Personalization, 4: Preview & Confirm
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form State
  const [formData, setFormData] = useState(() => createInitialFormData(campaign, senderAccounts));

  // Audience Count Preview State
  const [audienceLoading, setAudienceLoading] = useState(false);
  const [audienceCount, setAudienceCount] = useState(campaign?.recipientConfiguration?.estimatedCount || 0);

  // Preview Mode
  const [previewDevice, setPreviewDevice] = useState('desktop'); // desktop | mobile

  // Test Email State
  const [testEmailRecipient, setTestEmailRecipient] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [scheduleAt, setScheduleAt] = useState('');
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  const handleAttachmentUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setError('');
    setUploadingAttachment(true);
    try {
      const data = new FormData();
      files.forEach((f) => data.append('files', f));
      const res = await uploadAttachments(data);
      const newAtts = res.data?.attachments || [];
      setFormData((prev) => ({
        ...prev,
        attachments: [...(prev.attachments || []), ...newAtts],
      }));
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Attachment upload failed');
    } finally {
      setUploadingAttachment(false);
      e.target.value = '';
    }
  };

  const removeAttachment = (index) => {
    setFormData((prev) => ({
      ...prev,
      attachments: (prev.attachments || []).filter((_, i) => i !== index),
    }));
  };

  // Fetch Audience preview when configuration changes
  useEffect(() => {
    let isMounted = true;
    const fetchAudience = async () => {
      if (!isOpen) return;
      setAudienceLoading(true);
      try {
        const payload = {
          type: formData.recipientType,
          groupIds: formData.groupIds,
          tags: formData.tags.split(',').map((t) => t.trim()).filter(Boolean),
        };
        const res = await previewAudience(payload);
        if (isMounted && res.data) {
          setAudienceCount(res.data.eligibleCount);
        }
      } catch (err) {
        console.error('Failed to preview audience count', err);
      } finally {
        if (isMounted) setAudienceLoading(false);
      }
    };

    fetchAudience();
    return () => {
      isMounted = false;
    };
  }, [isOpen, formData.recipientType, formData.groupIds, formData.tags]);

  useEffect(() => {
    if (!isOpen) return;
    setFormData(createInitialFormData(campaign, senderAccounts));
    setStep(1);
    setAudienceCount(campaign?.recipientConfiguration?.estimatedCount || 0);
    setPreviewDevice('desktop');
    setScheduleAt('');
    setTestEmailRecipient('');
    setError('');
    setSuccess('');
  }, [isOpen, campaign?._id, senderAccounts]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleGroupToggle = (groupId) => {
    setFormData((prev) => {
      const exists = prev.groupIds.includes(groupId);
      return {
        ...prev,
        groupIds: exists
          ? prev.groupIds.filter((id) => id !== groupId)
          : [...prev.groupIds, groupId],
      };
    });
  };

  const handleInsertPlaceholder = (placeholder) => {
    setFormData((prev) => ({
      ...prev,
      htmlContent: prev.htmlContent + ` ${placeholder}`,
      textContent: prev.textContent + ` ${placeholder}`,
    }));
  };

  const handleApplyTemplate = (templateId) => {
    const template = templates.find((item) => item._id === templateId);
    setFormData((prev) => ({
      ...prev,
      templateId,
      ...(template
        ? {
            subject: template.subject || prev.subject,
            htmlContent: template.htmlContent || prev.htmlContent,
            textContent: template.textContent || prev.textContent,
          }
        : {}),
    }));
  };

  const buildPayload = () => {
    return {
      name: formData.name.trim(),
      subject: formData.subject.trim(),
      previewText: formData.previewText.trim(),
      senderEmailAccountId: formData.senderEmailAccountId || null,
      senderName: formData.senderName.trim(),
      replyTo: formData.replyTo.trim(),
      htmlContent: formData.htmlContent,
      textContent: formData.textContent,
      attachments: formData.attachments || [],
      templateId: formData.templateId || null,
      recipientConfiguration: {
        type: formData.recipientType,
        groupIds: formData.groupIds,
        tags: formData.tags.split(',').map((t) => t.trim()).filter(Boolean),
      },
    };
  };

  const handleSaveDraft = async () => {
    setError('');
    setSubmitting(true);
    try {
      const payload = buildPayload();
      await onSave(payload, campaign?._id);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save campaign draft');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendNow = async () => {
    if (!formData.senderEmailAccountId) {
      setError('Please select a sender email account before launching.');
      setStep(1);
      return;
    }

    if (audienceCount === 0) {
      setError('Cannot send campaign with 0 eligible opted-in recipients.');
      setStep(2);
      return;
    }

    if (!window.confirm(`Are you sure you want to send this campaign to ${audienceCount} eligible recipient(s)?`)) {
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      const payload = buildPayload();
      let saved = campaign;
      if (!saved?._id) {
        saved = await onSave(payload, null);
      } else {
        saved = await onSave(payload, campaign._id);
      }
      await onSend(saved._id || campaign._id, {
        senderEmailAccountId: formData.senderEmailAccountId,
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to trigger campaign dispatch');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSchedule = async () => {
    if (!formData.senderEmailAccountId) {
      setError('Please select a sender email account before scheduling.');
      setStep(1);
      return;
    }
    if (audienceCount === 0) {
      setError('Cannot schedule a campaign with 0 eligible opted-in recipients.');
      setStep(2);
      return;
    }
    const scheduledDate = new Date(scheduleAt);
    if (!scheduleAt || Number.isNaN(scheduledDate.getTime()) || scheduledDate <= new Date()) {
      setError('Choose a send time in the future.');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      const saved = await onSave(buildPayload(), campaign?._id);
      await onSchedule(saved._id || campaign?._id, {
        scheduledAt: scheduledDate.toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      });
      onClose();
    } catch (scheduleError) {
      setError(scheduleError.message || 'Failed to schedule campaign');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendTest = async (e) => {
    e.preventDefault();
    if (!testEmailRecipient || !testEmailRecipient.includes('@')) {
      setError('Please provide a valid test recipient email address.');
      return;
    }
    if (!formData.senderEmailAccountId) {
      setError('Please select a sender email account to dispatch the test email. Connect one in Workspace > Email Accounts if none are available.');
      return;
    }

    setSendingTest(true);
    setError('');
    setSuccess('');
    try {
      // First save draft so campaign has latest subject/content and sender account assigned
      const payload = buildPayload();
      const saved = await onSave(payload, campaign?._id);
      const campId = saved._id || campaign?._id;

      await sendCampaignTestEmail(campId, {
        recipientEmail: testEmailRecipient.trim(),
        senderEmailAccountId: formData.senderEmailAccountId,
      });
      setSuccess(`Test email dispatched successfully to ${testEmailRecipient}!`);
    } catch (err) {
      setError(err.message || 'Failed to dispatch test email');
    } finally {
      setSendingTest(false);
    }
  };

  // Personalized preview content
  const previewHtml = (formData.htmlContent || '')
    .replace(/\{\{\s*firstName\s*\}\}/g, 'Sarah')
    .replace(/\{\{\s*lastName\s*\}\}/g, 'Connor')
    .replace(/\{\{\s*email\s*\}\}/g, 'sarah.connor@example.com')
    .replace(/\{\{\s*company\s*\}\}/g, 'Cyberdyne Systems');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
          <div>
            <h3 className="text-base font-bold text-white">
              {isEdit ? 'Edit Campaign' : 'Compose Email Campaign'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Step {step} of 4 —{' '}
              {step === 1 && 'Campaign Details & Sender Identity'}
              {step === 2 && 'Target Audience Selection'}
              {step === 3 && 'Email Content & Personalization'}
              {step === 4 && 'Preview, Test Email & Confirmation'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator Tabs */}
        <div className="grid grid-cols-4 border-b border-slate-800 text-center text-xs font-mono uppercase">
          {[
            { id: 1, label: '1. Setup' },
            { id: 2, label: '2. Audience' },
            { id: 3, label: '3. Content' },
            { id: 4, label: '4. Review & Send' },
          ].map((s) => (
            <button
              key={s.id}
              onClick={() => setStep(s.id)}
              className={`py-2.5 transition-colors border-b-2 ${
                step === s.id
                  ? 'border-indigo-500 text-white font-bold bg-indigo-500/10'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Messages */}
        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center justify-between">
            <span className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </span>
            <button onClick={() => setError('')} className="text-slate-400 hover:text-white">&times;</button>
          </div>
        )}

        {success && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> {success}
            </span>
            <button onClick={() => setSuccess('')} className="text-slate-400 hover:text-white">&times;</button>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* STEP 1: Campaign Details & Sender */}
          {step === 1 && (
            <div className="space-y-4 max-w-2xl mx-auto">
              <div>
                <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
                  Campaign Name (Internal Reference) <span className="text-red-400">*</span>
                </label>
                <Input
                  name="name"
                  placeholder="e.g. Q4 Product Launch Newsletter"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
                  Subject Line <span className="text-red-400">*</span>
                </label>
                <Input
                  name="subject"
                  placeholder="e.g. Introducing MailFlow 2.0: Send smarter emails"
                  value={formData.subject}
                  onChange={handleChange}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
                  Preview Text (Preheader)
                </label>
                <Input
                  name="previewText"
                  placeholder="Snippet displayed alongside the subject line in inboxes"
                  value={formData.previewText}
                  onChange={handleChange}
                />
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                <p className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                  Sender Identity Configuration
                </p>

                <div>
                  <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
                    Sending Mailbox Account <span className="text-red-400">*</span>
                  </label>
                  {senderAccounts.length === 0 ? (
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
                      No connected email accounts available in this workspace. Please connect a Gmail or Outlook account in Email Accounts settings first.
                    </div>
                  ) : (
                    <select
                      name="senderEmailAccountId"
                      value={formData.senderEmailAccountId}
                      onChange={handleChange}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">-- Select Mailbox --</option>
                      {senderAccounts.map((acc) => (
                        <option key={acc._id} value={acc._id}>
                          {acc.emailAddress} ({acc.provider.toUpperCase()})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
                      From Display Name
                    </label>
                    <Input
                      name="senderName"
                      placeholder="e.g. Alex at MailFlow"
                      value={formData.senderName}
                      onChange={handleChange}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
                      Reply-To Address (Optional)
                    </label>
                    <Input
                      name="replyTo"
                      type="email"
                      placeholder="support@company.com"
                      value={formData.replyTo}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Target Audience Selection */}
          {step === 2 && (
            <div className="space-y-5 max-w-2xl mx-auto">
              <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-between">
                <div>
                  <p className="text-xs font-mono uppercase text-indigo-300">Audience Calculation</p>
                  <p className="text-2xl font-black text-white mt-0.5">
                    {audienceLoading ? 'Calculating...' : `${audienceCount.toLocaleString()} Eligible Recipients`}
                  </p>
                </div>
                <Users className="w-8 h-8 text-indigo-400" />
              </div>

              {/* Compliance notice */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-400 space-y-1">
                <p className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Strict Marketing Consent Enforced
                </p>
                <p>
                  Only contacts with explicit <code>opted_in</code> marketing consent, active <code>subscribed</code> status, and non-suppressed email addresses are included in this count.
                </p>
              </div>

              {/* Audience selection radio */}
              <div className="space-y-3">
                <label className="block text-xs font-mono uppercase text-slate-400 mb-2">
                  Select Audience Segment
                </label>

                {[
                  {
                    id: 'all_eligible',
                    label: 'All Opted-In Subscribers',
                    desc: 'Deliver to all eligible contacts across the workspace',
                  },
                  {
                    id: 'groups',
                    label: 'Target Specific Contact Groups',
                    desc: 'Segment delivery based on contact group memberships',
                  },
                  {
                    id: 'tags',
                    label: 'Filter by Contact Tags',
                    desc: 'Deliver only to contacts matching selected tags',
                  },
                ].map((opt) => (
                  <label
                    key={opt.id}
                    className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${
                      formData.recipientType === opt.id
                        ? 'bg-indigo-500/10 border-indigo-500/40 text-white'
                        : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="recipientType"
                      value={opt.id}
                      checked={formData.recipientType === opt.id}
                      onChange={handleChange}
                      className="mt-1 text-indigo-600 focus:ring-0"
                    />
                    <div>
                      <p className="text-xs font-bold">{opt.label}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>

              {/* Conditional Group Multi-Select */}
              {formData.recipientType === 'groups' && (
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <p className="text-xs font-semibold text-slate-300">Choose Groups:</p>
                  {groups.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">No contact groups created yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {groups.map((grp) => {
                        const isSelected = formData.groupIds.includes(grp._id);
                        return (
                          <button
                            type="button"
                            key={grp._id}
                            onClick={() => handleGroupToggle(grp._id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                              isSelected
                                ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                                : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600'
                            }`}
                          >
                            {grp.name} ({grp.contactCount || 0})
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Conditional Tags Input */}
              {formData.recipientType === 'tags' && (
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
                    Matching Tags (comma separated)
                  </label>
                  <Input
                    name="tags"
                    placeholder="e.g. newsletter, vip, q4-lead"
                    value={formData.tags}
                    onChange={handleChange}
                  />
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Content & Personalization */}
          {step === 3 && (
            <div className="space-y-4">
              {templates.length > 0 && (
                <div className="flex flex-col gap-2 rounded-xl border border-teal-500/20 bg-teal-500/[0.04] p-3 sm:flex-row sm:items-center">
                  <label htmlFor="campaign-template" className="text-xs font-mono uppercase text-teal-300">Start from template</label>
                  <select
                    id="campaign-template"
                    value={formData.templateId}
                    onChange={(event) => handleApplyTemplate(event.target.value)}
                    className="flex-1 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 outline-none focus:border-teal-500"
                  >
                    <option value="">Keep current content</option>
                    {templates.map((template) => <option key={template._id} value={template._id}>{template.name}</option>)}
                  </select>
                </div>
              )}
              {/* Placeholders Toolbar */}
              <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                <span className="text-xs font-mono uppercase text-slate-400 flex items-center gap-1 mr-1">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> Insert Tag:
                </span>
                {[
                  { tag: '{{firstName}}', label: 'First Name' },
                  { tag: '{{lastName}}', label: 'Last Name' },
                  { tag: '{{email}}', label: 'Email' },
                  { tag: '{{company}}', label: 'Company' },
                ].map((ph) => (
                  <button
                    type="button"
                    key={ph.tag}
                    onClick={() => handleInsertPlaceholder(ph.tag)}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-indigo-300 font-mono text-[11px] transition-colors"
                  >
                    {ph.tag}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* HTML Source */}
                <div>
                  <label className="block text-xs font-mono uppercase text-slate-400 mb-1.5 flex items-center justify-between">
                    <span>HTML Email Body</span>
                    <span className="text-[10px] text-slate-500 font-normal">Supports inline styling</span>
                  </label>
                  <textarea
                    name="htmlContent"
                    rows={14}
                    value={formData.htmlContent}
                    onChange={handleChange}
                    className="w-full font-mono text-xs p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-indigo-500"
                    placeholder="Enter email HTML markup..."
                  />
                </div>

                {/* Plain Text Fallback */}
                <div>
                  <label className="block text-xs font-mono uppercase text-slate-400 mb-1.5 flex items-center justify-between">
                    <span>Plain-Text Fallback</span>
                    <span className="text-[10px] text-slate-500 font-normal">For text-only mail clients</span>
                  </label>
                  <textarea
                    name="textContent"
                    rows={14}
                    value={formData.textContent}
                    onChange={handleChange}
                    className="w-full font-mono text-xs p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-indigo-500"
                    placeholder="Enter plain text version..."
                  />
                </div>
              </div>

              {/* Campaign Attachments Review */}
              {(formData.attachments || []).length > 0 && (
                <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/60">
                  <div className="flex items-center gap-2 mb-2">
                    <Paperclip className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-xs font-semibold text-slate-300">
                      Attached Files ({formData.attachments.length})
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.attachments.map((att, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-[11px] text-slate-300"
                      >
                        <FileText className="w-3 h-3 text-slate-400" />
                        <span className="max-w-[120px] truncate">{att.originalName || att.filename}</span>
                        <span className="text-slate-500 text-[10px]">
                          ({Math.round((att.size || 0) / 1024)} KB)
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: Review, Preview, Test Email & Confirmation */}
          {step === 4 && (
            <div className="space-y-5">
              {/* Device Selector */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-violet-400" />
                  <span className="text-xs font-mono uppercase text-slate-300">
                    Live Rendering Preview (Personalized with Sample Contact)
                  </span>
                </div>
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                  <button
                    onClick={() => setPreviewDevice('desktop')}
                    className={`p-1.5 rounded ${previewDevice === 'desktop' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
                    title="Desktop View"
                  >
                    <Monitor className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setPreviewDevice('mobile')}
                    className={`p-1.5 rounded ${previewDevice === 'mobile' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
                    title="Mobile View"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Rendered Preview Box */}
              <div className="flex justify-center bg-slate-950/60 p-4 rounded-xl border border-slate-800 overflow-x-auto">
                <div
                  className={`bg-white text-slate-900 rounded-lg shadow-lg overflow-hidden transition-all ${
                    previewDevice === 'mobile' ? 'w-[375px]' : 'w-full max-w-2xl'
                  }`}
                >
                  <div className="bg-slate-100 p-3 border-b border-slate-200 text-xs">
                    <p className="font-bold text-slate-800">Subject: {formData.subject || '—'}</p>
                    {formData.previewText && (
                      <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                        {formData.previewText}
                      </p>
                    )}
                  </div>
                  <div
                    className="p-5 overflow-y-auto max-h-72 text-sm"
                    dangerouslySetInnerHTML={{ __html: previewHtml }}
                  />
                </div>
              </div>

              {/* Test Email Action */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                <p className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5 text-indigo-400" /> Send a Single Test Email Before Launch
                </p>

                {senderAccounts.length === 0 ? (
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">No connected email account</p>
                      <p className="text-slate-400 mt-0.5">
                        You need at least one connected mailbox in this workspace to send test emails. Connect an account in Workspace &rarr; Email Accounts.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-400 shrink-0">Send from:</label>
                      <select
                        name="senderEmailAccountId"
                        value={formData.senderEmailAccountId}
                        onChange={handleChange}
                        className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-indigo-500 flex-1 max-w-xs"
                      >
                        <option value="">-- Select Mailbox --</option>
                        {senderAccounts.map((acc) => (
                          <option key={acc._id} value={acc._id}>
                            {acc.emailAddress} ({acc.provider.toUpperCase()})
                            {acc.connectionStatus && acc.connectionStatus !== 'connected' ? ` [${acc.connectionStatus}]` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <form onSubmit={handleSendTest} className="flex gap-2">
                      <Input
                        type="email"
                        placeholder="Enter your email to receive test message..."
                        value={testEmailRecipient}
                        onChange={(e) => setTestEmailRecipient(e.target.value)}
                        required
                        className="h-9 text-xs"
                      />
                      <Button
                        type="submit"
                        variant="outline"
                        size="sm"
                        isLoading={sendingTest}
                        disabled={!formData.senderEmailAccountId}
                        className="h-9 text-xs flex-shrink-0 border-slate-700"
                      >
                        Send Test Email
                      </Button>
                    </form>
                  </div>
                )}
              </div>

              {/* Schedule */}
              <div className="rounded-xl border border-orange-500/20 bg-orange-500/[0.04] p-4">
                <label htmlFor="campaign-schedule-at" className="mb-2 block text-xs font-mono uppercase text-orange-300">Or schedule for later</label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    id="campaign-schedule-at"
                    type="datetime-local"
                    min={(() => {
                      const minDate = new Date(Date.now() + 60000);
                      return new Date(minDate.getTime() - minDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                    })()}
                    value={scheduleAt}
                    onChange={(event) => setScheduleAt(event.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 outline-none focus:border-orange-400"
                  />
                  <span className="self-center text-[11px] text-slate-500">{Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local timezone'}</span>
                </div>
                <p className="mt-2 text-[11px] text-slate-500">The campaign is saved first, then added to the scheduled delivery queue.</p>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-800">
                  <span className="text-slate-500 block">Total Target Audience</span>
                  <span className="text-white font-bold text-sm mt-0.5 block">
                    {audienceCount.toLocaleString()} Contacts
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-800">
                  <span className="text-slate-500 block">Sender Mailbox</span>
                  <span className="text-white font-bold text-xs mt-0.5 block truncate">
                    {senderAccounts.find((a) => a._id === formData.senderEmailAccountId)?.emailAddress || 'Not Selected'}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-800 col-span-2 sm:col-span-1">
                  <span className="text-slate-500 block">Send-now action</span>
                  <span className="text-indigo-400 font-bold text-sm mt-0.5 block">
                    Queue campaign now
                  </span>
                </div>
              </div>

              {/* Campaign Attachments Review */}
              {(formData.attachments || []).length > 0 && (
                <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/60">
                  <div className="flex items-center gap-2 mb-2">
                    <Paperclip className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-xs font-semibold text-slate-300">
                      Attached Files ({formData.attachments.length})
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.attachments.map((att, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-[11px] text-slate-300"
                      >
                        <FileText className="w-3 h-3 text-slate-400" />
                        <span className="max-w-[120px] truncate">{att.originalName || att.filename}</span>
                        <span className="text-slate-500 text-[10px]">
                          ({Math.round((att.size || 0) / 1024)} KB)
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/80">
          <div>
            {step > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep(step - 1)}
                className="text-xs"
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Back
              </Button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveDraft}
              isLoading={submitting}
              className="text-xs border-slate-700"
            >
              Save as Draft
            </Button>

            {step < 4 ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setStep(step + 1)}
                className="text-xs"
              >
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSchedule}
                  isLoading={submitting}
                  disabled={!scheduleAt || !onSchedule}
                  className="text-xs bg-orange-500 text-slate-950 hover:bg-orange-400"
                >
                  <Clock className="w-3.5 h-3.5 mr-1.5" /> Schedule
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSendNow}
                  isLoading={submitting}
                  className="text-xs bg-emerald-600 hover:bg-emerald-500"
                >
                  <Send className="w-3.5 h-3.5 mr-1.5" /> Queue & Send Campaign
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
