import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useApp } from '../contexts/AppContext';
import { RefreshCw, Plus, Trash2, Edit3, X, Loader2, ToggleLeft, ToggleRight, Clock, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

interface FollowUpStep {
  id?: string;
  position: number;
  delayHours: number;
  templateName: string;
  templateLanguage: string;
}

interface FollowUpSequence {
  id: string;
  name: string;
  triggerType: string;
  enabled: boolean;
  steps: FollowUpStep[];
  _count?: { enrollments: number };
}

interface Template {
  id: string;
  name: string;
  status: string;
  language: string;
}

export default function FollowUps() {
  const { activeWorkspace } = useApp();
  const [sequences, setSequences] = useState<FollowUpSequence[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSeq, setEditingSeq] = useState<FollowUpSequence | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState('NEW_LEAD');
  const [steps, setSteps] = useState<FollowUpStep[]>([]);

  const workspaceId = activeWorkspace?.id;

  useEffect(() => {
    if (!workspaceId) return;
    loadData();
  }, [workspaceId]);

  async function loadData() {
    setLoading(true);
    try {
      const [seqRes, tplRes] = await Promise.all([
        axios.get(`/api/follow-up-sequences?workspaceId=${workspaceId}`),
        axios.get(`/api/templates?workspaceId=${workspaceId}`)
      ]);
      setSequences(seqRes.data);
      setTemplates(tplRes.data.filter((t: Template) => t.status === 'APPROVED'));
    } catch (e) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditingSeq(null);
    setName('');
    setTriggerType('NEW_LEAD');
    setSteps([{ position: 0, delayHours: 24, templateName: '', templateLanguage: 'en' }]);
    setShowModal(true);
  }

  function openEdit(seq: FollowUpSequence) {
    setEditingSeq(seq);
    setName(seq.name);
    setTriggerType(seq.triggerType);
    setSteps(seq.steps.length > 0 ? seq.steps : [{ position: 0, delayHours: 24, templateName: '', templateLanguage: 'en' }]);
    setShowModal(true);
  }

  function addStep() {
    setSteps([...steps, { position: steps.length, delayHours: 24, templateName: '', templateLanguage: 'en' }]);
  }

  function removeStep(index: number) {
    setSteps(steps.filter((_, i) => i !== index));
  }

  function updateStep(index: number, field: string, value: any) {
    const updated = [...steps];
    (updated[index] as any)[field] = value;
    setSteps(updated);
  }

  async function saveSequence() {
    if (!name.trim()) { toast.error('Name is required'); return; }
    if (steps.some(s => !s.templateName)) { toast.error('All steps need a template'); return; }

    try {
      if (editingSeq) {
        await axios.patch(`/api/follow-up-sequences/${editingSeq.id}`, {
          name, triggerType, steps
        });
        toast.success('Sequence updated');
      } else {
        await axios.post('/api/follow-up-sequences', {
          name, triggerType, steps, workspaceId
        });
        toast.success('Sequence created');
      }
      setShowModal(false);
      loadData();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to save sequence');
    }
  }

  async function toggleSequence(seq: FollowUpSequence) {
    try {
      await axios.patch(`/api/follow-up-sequences/${seq.id}`, { enabled: !seq.enabled });
      loadData();
    } catch { toast.error('Failed to toggle'); }
  }

  async function deleteSequence(id: string) {
    if (!confirm('Delete this sequence? Active enrollments will be cancelled.')) return;
    try {
      await axios.delete(`/api/follow-up-sequences/${id}`);
      toast.success('Sequence deleted');
      loadData();
    } catch { toast.error('Failed to delete'); }
  }

  function formatDelay(hours: number) {
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    const rem = hours % 24;
    return rem > 0 ? `${days}d ${rem}h` : `${days}d`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-[#25D366]" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <RefreshCw className="w-6 h-6 text-[#25D366]" />
            Follow-up Sequences
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Auto-send WhatsApp templates when leads don't reply
          </p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-[#25D366] text-white rounded-lg hover:bg-[#20bd5a] transition-colors">
          <Plus className="w-4 h-4" /> New Sequence
        </button>
      </div>

      {sequences.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <RefreshCw className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="font-medium">No follow-up sequences yet</p>
          <p className="text-sm mt-1">Create sequences to automatically follow up with unresponsive leads</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sequences.map(seq => (
            <div key={seq.id} className={cn(
              "border rounded-xl p-4 transition-all",
              seq.enabled
                ? "bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700"
                : "bg-gray-50 dark:bg-slate-900 border-gray-100 dark:border-slate-800 opacity-60"
            )}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button onClick={() => toggleSequence(seq)} className="text-gray-400 hover:text-[#25D366]">
                    {seq.enabled ? <ToggleRight className="w-6 h-6 text-[#25D366]" /> : <ToggleLeft className="w-6 h-6" />}
                  </button>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{seq.name}</h3>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full">
                        {seq.triggerType === 'AD_LEAD' ? 'Ad Leads' : seq.triggerType === 'NEW_LEAD' ? 'New Leads' : 'Manual'}
                      </span>
                      <span className="text-xs text-gray-400">{seq.steps.length} step{seq.steps.length !== 1 && 's'}</span>
                      {seq._count && (
                        <span className="text-xs text-gray-400">{seq._count.enrollments} enrolled</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => openEdit(seq)} className="p-1.5 text-gray-400 hover:text-blue-500 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20">
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteSequence(seq.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Steps preview */}
              {seq.steps.length > 0 && (
                <div className="mt-3 ml-9 flex items-center gap-2 flex-wrap">
                  {seq.steps.map((step, i) => (
                    <React.Fragment key={i}>
                      {i > 0 && <span className="text-gray-300 dark:text-gray-600">→</span>}
                      <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 rounded-lg flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDelay(step.delayHours)}:
                        <FileText className="w-3 h-3" />
                        {step.templateName}
                      </span>
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b dark:border-slate-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {editingSeq ? 'Edit Sequence' : 'New Follow-up Sequence'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sequence Name</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Ad Lead Follow-up"
                  className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Trigger</label>
                <select value={triggerType} onChange={e => setTriggerType(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-slate-900 dark:border-slate-600 dark:text-white">
                  <option value="NEW_LEAD">New Lead (any new contact)</option>
                  <option value="AD_LEAD">Ad Lead (Click-to-WhatsApp ads only)</option>
                  <option value="MANUAL">Manual (enroll from Inbox)</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Steps</label>
                  <button onClick={addStep} className="text-xs text-[#25D366] hover:text-[#20bd5a] flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Add Step
                  </button>
                </div>
                <div className="space-y-3">
                  {steps.map((step, i) => (
                    <div key={i} className="border rounded-lg p-3 dark:border-slate-600">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Step {i + 1}</span>
                        {steps.length > 1 && (
                          <button onClick={() => removeStep(i)} className="text-gray-400 hover:text-red-500">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-gray-500 dark:text-gray-400">Wait (hours)</label>
                          <input type="number" min={1} value={step.delayHours}
                            onChange={e => updateStep(i, 'delayHours', Number(e.target.value))}
                            className="w-full border rounded px-2 py-1 text-sm dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 dark:text-gray-400">Template</label>
                          <select value={step.templateName}
                            onChange={e => updateStep(i, 'templateName', e.target.value)}
                            className="w-full border rounded px-2 py-1 text-sm dark:bg-slate-900 dark:border-slate-600 dark:text-white">
                            <option value="">Select template...</option>
                            {templates.map(t => (
                              <option key={t.id} value={t.name}>{t.name} ({t.language})</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t dark:border-slate-700">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
                Cancel
              </button>
              <button onClick={saveSequence} className="px-4 py-2 text-sm bg-[#25D366] text-white rounded-lg hover:bg-[#20bd5a]">
                {editingSeq ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
