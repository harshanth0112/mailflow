import React, { useState } from 'react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertTriangle, X, ArrowRight, RefreshCw } from 'lucide-react';
import { previewContactImport, executeContactImport } from '../../services/api';

export const ImportModal = ({ isOpen, onClose, onImportComplete, groups = [] }) => {
  if (!isOpen) return null;

  const [step, setStep] = useState(1); // 1: Upload, 2: Mapping, 3: Executing, 4: Summary
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Preview data
  const [previewData, setPreviewData] = useState(null);
  const [mapping, setMapping] = useState({});
  const [defaultTags, setDefaultTags] = useState('');
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [updateExisting, setUpdateExisting] = useState(false);
  
  // Result
  const [summary, setSummary] = useState(null);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      const ext = selected.name.toLowerCase().split('.').pop();
      if (!['csv', 'xlsx', 'xls'].includes(ext)) {
        setError('Only CSV and Excel (.xlsx, .xls) files are supported.');
        return;
      }
      setFile(selected);
      setError('');
    }
  };

  const handleUploadAndPreview = async () => {
    if (!file) {
      setError('Please select a file to upload');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await previewContactImport(formData);
      const data = res.data;
      setPreviewData(data);
      setMapping(data.suggestedMapping || {});
      setStep(2);
    } catch (err) {
      setError(err.message || 'Failed to parse file preview');
    } finally {
      setLoading(false);
    }
  };

  const handleFieldMapChange = (header, targetField) => {
    setMapping((prev) => ({
      ...prev,
      [header]: targetField,
    }));
  };

  const handleGroupToggle = (groupId) => {
    setSelectedGroups((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
    );
  };

  const handleExecuteImport = async () => {
    // Validate email is mapped
    const hasEmail = Object.values(mapping).includes('email');
    if (!hasEmail) {
      setError('You must map at least one column to "Email" to import contacts.');
      return;
    }

    setLoading(true);
    setError('');
    setStep(3);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mapping', JSON.stringify(mapping));
      formData.append('updateExisting', updateExisting);

      const parsedTags = defaultTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      formData.append('defaultTags', JSON.stringify(parsedTags));
      formData.append('defaultGroups', JSON.stringify(selectedGroups));

      const res = await executeContactImport(formData);
      setSummary(res.data);
      setStep(4);
      onImportComplete();
    } catch (err) {
      setError(err.message || 'Failed to execute import');
      setStep(2);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setFile(null);
    setPreviewData(null);
    setMapping({});
    setSummary(null);
    setError('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <Card className="border-slate-800 bg-slate-900 shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Import Contacts</h3>
                <p className="text-xs text-slate-400">Upload CSV or Excel spreadsheets safely</p>
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

          {/* STEP 1: Upload */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-slate-700 hover:border-indigo-500/50 rounded-2xl p-8 text-center transition-colors">
                <UploadCloud className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                <p className="text-sm font-semibold text-white mb-1">
                  Choose a CSV or Excel spreadsheet
                </p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
                  Supports .csv, .xlsx, and .xls up to 10MB. Formulas and macros are safely neutralized.
                </p>
                <label className="inline-block cursor-pointer">
                  <span className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold tracking-wide shadow-md transition-colors">
                    Browse File
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                    onChange={handleFileChange}
                  />
                </label>
                {file && (
                  <p className="text-xs font-mono text-emerald-400 mt-4 flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>

              <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs text-amber-300">
                <span className="font-bold">Anti-Spam Compliance Notice:</span> Uploading a contact list does not equate to active marketing consent. Imported contacts will initially be labeled with unconfirmed consent status.
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <Button variant="outline" size="sm" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleUploadAndPreview}
                  isLoading={loading}
                  disabled={!file}
                >
                  Continue to Mapping <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2: Field Mapping & Options */}
          {step === 2 && previewData && (
            <div className="space-y-5">
              <div>
                <p className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2">
                  Map Spreadsheet Columns to Contact Attributes ({previewData.totalRows} rows found)
                </p>
                <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                  {previewData.headers.map((header) => (
                    <div
                      key={header}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/40 border border-slate-800"
                    >
                      <div className="min-w-0 pr-3">
                        <span className="text-xs font-semibold text-slate-200 block truncate">
                          {header}
                        </span>
                        <span className="text-[11px] text-slate-500 truncate block">
                          Sample: {previewData.sampleRows?.[0]?.[header] || '—'}
                        </span>
                      </div>
                      <select
                        value={mapping[header] || ''}
                        onChange={(e) => handleFieldMapChange(header, e.target.value)}
                        className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 min-w-[150px]"
                      >
                        <option value="">-- Ignore column --</option>
                        <option value="email">Email Address (Required)</option>
                        <option value="firstName">First Name</option>
                        <option value="lastName">Last Name</option>
                        <option value="phone">Phone Number</option>
                        <option value="company">Company</option>
                        <option value="jobTitle">Job Title</option>
                        <option value="tags">Tags (delimited)</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Import Options */}
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                <p className="text-xs font-semibold text-white">Import Configuration</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
                      Apply Default Tags
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. webinar-lead, q4-import"
                      value={defaultTags}
                      onChange={(e) => setDefaultTags(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
                      Duplicate Handling
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-300 mt-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={updateExisting}
                        onChange={(e) => setUpdateExisting(e.target.checked)}
                        className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0"
                      />
                      Update existing contacts if email matches
                    </label>
                  </div>
                </div>

                {groups.length > 0 && (
                  <div>
                    <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
                      Assign to Groups
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {groups.map((grp) => {
                        const isSelected = selectedGroups.includes(grp._id);
                        return (
                          <button
                            type="button"
                            key={grp._id}
                            onClick={() => handleGroupToggle(grp._id)}
                            className={`px-2 py-0.5 rounded text-[11px] border font-medium transition-colors ${
                              isSelected
                                ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}
                          >
                            {grp.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-slate-800">
                <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
                  Back
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm" onClick={handleExecuteImport} isLoading={loading}>
                    Confirm & Start Import
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Executing */}
          {step === 3 && (
            <div className="py-12 text-center space-y-4">
              <RefreshCw className="w-10 h-10 text-indigo-400 animate-spin mx-auto" />
              <h4 className="text-base font-bold text-white">Importing Contacts...</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Normalizing email addresses, validating duplicates, and writing contacts with workspace isolation.
              </p>
            </div>
          )}

          {/* STEP 4: Summary */}
          {step === 4 && summary && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-white">Import Execution Complete</h4>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Your contacts have been safely processed according to workspace boundaries.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-800 text-center">
                  <p className="text-xs text-slate-500">Total Rows</p>
                  <p className="text-lg font-bold text-white mt-1">{summary.total}</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-800 text-center">
                  <p className="text-xs text-emerald-400">Imported</p>
                  <p className="text-lg font-bold text-emerald-300 mt-1">{summary.imported}</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-800 text-center">
                  <p className="text-xs text-indigo-400">Updated</p>
                  <p className="text-lg font-bold text-indigo-300 mt-1">{summary.updated}</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-800 text-center">
                  <p className="text-xs text-amber-400">Skipped/Invalid</p>
                  <p className="text-lg font-bold text-amber-300 mt-1">
                    {summary.skippedDuplicates + summary.invalid}
                  </p>
                </div>
              </div>

              {summary.errors && summary.errors.length > 0 && (
                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 max-h-40 overflow-y-auto">
                  <p className="text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Skipped Rows & Errors ({summary.errors.length})
                  </p>
                  <ul className="space-y-1 text-[11px] font-mono text-slate-500">
                    {summary.errors.slice(0, 50).map((err, idx) => (
                      <li key={idx}>
                        Row {err.row}: {err.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex justify-end pt-3 border-t border-slate-800">
                <Button variant="primary" size="sm" onClick={onClose}>
                  Done
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

