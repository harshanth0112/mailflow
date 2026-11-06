import React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Check, Code2, FileText, Monitor, Pencil, Plus, Search, Smartphone, Trash2, X } from 'lucide-react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useWorkspace } from '../../context/WorkspaceContext';
import { createEmailTemplate, deleteEmailTemplate, getEmailTemplates, updateEmailTemplate } from '../../services/api';

const emptyTemplate = {
  name: '',
  description: '',
  subject: '',
  htmlContent: '<div style="font-family: sans-serif; line-height: 1.6; color: #1e293b; padding: 24px;">\n  <h1>Hello {{firstName}},</h1>\n  <p>Write your message here. Use {{company}} to personalize it.</p>\n</div>',
  textContent: 'Hello {{firstName}},\n\nWrite your message here. Use {{company}} to personalize it.',
};

const variables = [
  ['{{firstName}}', 'First name'],
  ['{{lastName}}', 'Last name'],
  ['{{email}}', 'Email'],
  ['{{company}}', 'Company'],
];

const renderSample = (content = '') =>
  content
    .replaceAll('{{firstName}}', 'Sarah')
    .replaceAll('{{lastName}}', 'Connor')
    .replaceAll('{{email}}', 'sarah@example.com')
    .replaceAll('{{company}}', 'Acme Studio');

export const TemplatesPage = () => {
  const { isCampaignManager, isAdmin, isSuperAdmin } = useWorkspace();
  const canManage = isCampaignManager || isAdmin || isSuperAdmin;
  const canDelete = isAdmin || isSuperAdmin;
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyTemplate);
  const [previewMode, setPreviewMode] = useState(false);
  const [mobilePreview, setMobilePreview] = useState(false);
  const [activeEditor, setActiveEditor] = useState('htmlContent');
  const htmlEditorRef = useRef(null);
  const textEditorRef = useRef(null);

  const previewHtml = useMemo(() => renderSample(form.htmlContent), [form.htmlContent]);
  const insertVariable = (token) => {
    const ref = activeEditor === 'htmlContent' ? htmlEditorRef : textEditorRef;
    const editor = ref.current;
    const value = form[activeEditor] || '';
    const start = editor?.selectionStart ?? value.length;
    const end = editor?.selectionEnd ?? start;
    setForm((current) => ({
      ...current,
      [activeEditor]: `${value.slice(0, start)}${token}${value.slice(end)}`,
    }));
    requestAnimationFrame(() => {
      if (!editor) return;
      editor.focus();
      editor.setSelectionRange(start + token.length, start + token.length);
    });
  };
  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await getEmailTemplates({ search: search.trim(), limit: 100 });
      setTemplates(response.data || []);
    } catch (loadError) {
      setError(loadError.message || 'Could not load email templates.');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const startNew = () => {
    setEditing(null);
    setForm(emptyTemplate);
    setError('');
    setSuccess('');
    setPreviewMode(false);
  };

  const startEdit = (template) => {
    setEditing(template);
    setForm({
      name: template.name || '',
      description: template.description || '',
      subject: template.subject || '',
      htmlContent: template.htmlContent || '',
      textContent: template.textContent || '',
    });
    setError('');
    setSuccess('');
    setPreviewMode(false);
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      if (editing) await updateEmailTemplate(editing._id, form);
      else await createEmailTemplate(form);
      setSuccess(editing ? 'Template updated.' : 'Template created.');
      setEditing(null);
      setForm(emptyTemplate);
      await loadTemplates();
    } catch (saveError) {
      setError(saveError.message || 'Could not save this template.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (template) => {
    if (!window.confirm(`Delete the template "${template.name}"?`)) return;
    setError('');
    setSuccess('');
    try {
      await deleteEmailTemplate(template._id);
      if (editing?._id === template._id) startNew();
      setSuccess('Template deleted.');
      await loadTemplates();
    } catch (deleteError) {
      setError(deleteError.message || 'Could not delete this template.');
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.2em] text-teal-400">
            <Code2 className="h-4 w-4" /> Campaign toolkit <span className="text-slate-600">/</span> Phase 08
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Email templates</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">Build reusable HTML and plain-text messages for campaigns and auto-replies.</p>
        </div>
        {canManage && <Button onClick={startNew} className="bg-teal-600 text-white hover:bg-teal-500">
          <Plus className="h-4 w-4" /> New template
        </Button>}
      </header>

      {(error || success) && (
        <div className={`flex items-center gap-2 rounded-xl border p-3 text-sm ${error ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'}`}>
          {error ? <AlertCircle className="h-4 w-4" /> : <Check className="h-4 w-4" />}
          {error || success}
          <button className="ml-auto" onClick={() => { setError(''); setSuccess(''); }} aria-label="Dismiss message"><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.4fr)]">
        <section className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a template..." className="w-full rounded-xl border border-slate-800 bg-slate-900 py-2.5 pl-10 pr-3 text-sm text-white outline-none focus:border-teal-500" />
          </div>
          {loading ? (
            <Card className="flex justify-center p-10"><LoadingSpinner /></Card>
          ) : templates.length === 0 ? (
            <Card className="border-dashed border-slate-700 p-8 text-center">
              <FileText className="mx-auto mb-3 h-8 w-8 text-slate-600" />
              <h2 className="font-semibold text-white">{search ? 'No matching templates' : 'Your template library is empty'}</h2>
              <p className="mt-1 text-xs text-slate-400">{search ? 'Try another search.' : 'Create a template once and reuse it across your workspace.'}</p>
            </Card>
          ) : templates.map((template) => (
            <Card key={template._id} className={`border-slate-800 p-4 transition-colors ${editing?._id === template._id ? 'border-teal-500/60 bg-teal-500/5' : 'bg-slate-900/80'}`}>
              <div className="flex items-start gap-3">
                <div className="rounded-lg border border-teal-500/20 bg-teal-500/10 p-2 text-teal-300"><FileText className="h-4 w-4" /></div>
                <button className="min-w-0 flex-1 text-left" onClick={() => canManage && startEdit(template)}>
                  <span className="block truncate text-sm font-semibold text-white">{template.name}</span>
                  <span className="mt-1 block line-clamp-2 text-xs text-slate-400">{template.description || template.subject || 'No description'}</span>
                  <span className="mt-2 block text-[10px] font-mono uppercase tracking-wider text-slate-500">Updated {new Date(template.updatedAt).toLocaleDateString()}</span>
                </button>
                {canDelete && <button onClick={() => handleDelete(template)} className="rounded-lg p-2 text-slate-500 hover:bg-red-500/10 hover:text-red-300" title="Delete template" aria-label={`Delete ${template.name}`}><Trash2 className="h-4 w-4" /></button>}
              </div>
            </Card>
          ))}
        </section>

        <Card className="overflow-hidden border-slate-800 bg-slate-900/90 p-0">
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/60 px-5 py-4">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500">{editing ? 'Edit saved design' : 'New design'}</span>
              <h2 className="mt-1 font-semibold text-white">{editing ? editing.name : 'Template editor'}</h2>
            </div>
            <div className="flex rounded-lg border border-slate-800 bg-slate-950 p-1">
              <button onClick={() => setPreviewMode(false)} className={`rounded-md px-3 py-1.5 text-xs ${!previewMode ? 'bg-slate-800 text-white' : 'text-slate-400'}`}><Pencil className="mr-1 inline h-3.5 w-3.5" />Edit</button>
              <button onClick={() => setPreviewMode(true)} className={`rounded-md px-3 py-1.5 text-xs ${previewMode ? 'bg-teal-600 text-white' : 'text-slate-400'}`}><Monitor className="mr-1 inline h-3.5 w-3.5" />Preview</button>
            </div>
          </div>
          {previewMode ? (
            <div className="space-y-4 p-5">
              <div className="flex items-center justify-between text-xs text-slate-400"><span>Personalized sample preview</span><button onClick={() => setMobilePreview((value) => !value)} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 hover:text-white"><Smartphone className="h-3.5 w-3.5" />{mobilePreview ? 'Desktop' : 'Mobile'}</button></div>
              <div className="flex justify-center overflow-auto rounded-xl border border-slate-800 bg-slate-950 p-4">
                <div className={`overflow-hidden rounded-lg bg-white shadow-xl transition-all ${mobilePreview ? 'w-[375px]' : 'w-full'}`}>
                  <div className="border-b border-slate-200 bg-slate-50 p-3 text-xs text-slate-600"><b>Subject:</b> {renderSample(form.subject) || '—'}</div>
                  <iframe title="Email template preview" sandbox="" srcDoc={previewHtml} className="min-h-[480px] w-full border-0" />
                </div>
              </div>
            </div>
          ) : canManage ? (
            <form onSubmit={handleSave} className="space-y-4 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-xs text-slate-400">Template name
                  <input required maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Welcome sequence" className="mt-1.5 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-teal-500" />
                </label>
                <label className="text-xs text-slate-400">Subject line
                  <input maxLength={300} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="A note for {{firstName}}" className="mt-1.5 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-teal-500" />
                </label>
              </div>
              <label className="block text-xs text-slate-400">Description
                <input maxLength={500} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="When should this template be used?" className="mt-1.5 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-teal-500" />
              </label>
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                <span className="mr-1 text-[10px] font-mono uppercase tracking-wider text-slate-500">Variables</span>
                {variables.map(([token, label]) => <button key={token} type="button" onClick={() => insertVariable(token)} title={`Insert ${label}`} className="rounded-md border border-slate-700 px-2 py-1 font-mono text-[10px] text-teal-300 hover:bg-slate-800">{token}</button>)}
              </div>
              <label className="block text-xs text-slate-400">HTML email
                <textarea ref={htmlEditorRef} onFocus={() => setActiveEditor('htmlContent')} rows={12} value={form.htmlContent} onChange={(e) => setForm({ ...form, htmlContent: e.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-xs leading-relaxed text-slate-200 outline-none focus:border-teal-500" placeholder="Paste or write email HTML..." />
              </label>
              <label className="block text-xs text-slate-400">Plain-text fallback
                <textarea ref={textEditorRef} onFocus={() => setActiveEditor('textContent')} rows={5} value={form.textContent} onChange={(e) => setForm({ ...form, textContent: e.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-xs leading-relaxed text-slate-200 outline-none focus:border-teal-500" placeholder="Text-only version for email clients..." />
              </label>
              <div className="flex justify-end gap-2 border-t border-slate-800 pt-4">
                {editing && <Button type="button" variant="ghost" onClick={startNew}>Cancel edit</Button>}
                <Button type="submit" isLoading={saving} className="bg-teal-600 text-white hover:bg-teal-500"><Check className="h-4 w-4" />{editing ? 'Save changes' : 'Create template'}</Button>
              </div>
            </form>
          ) : <div className="p-8 text-center text-sm text-slate-400">You have read-only access to this template library.</div>}
        </Card>
      </div>
    </div>
  );
};
