import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useApp } from '../contexts/AppContext';
import { Route, Plus, Trash2, Edit3, X, Loader2, ToggleLeft, ToggleRight } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

interface AssignmentRule {
  id: string;
  name: string;
  strategy: string;
  conditions: string;
  agentIds: string;
  currentIndex: number;
  priority: number;
  enabled: boolean;
}

interface TeamMember {
  userId: string;
  user: { name?: string; email?: string };
  role: string;
}

export default function AutoAssign() {
  const { activeWorkspace } = useApp();
  const [rules, setRules] = useState<AssignmentRule[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<AssignmentRule | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [strategy, setStrategy] = useState('ROUND_ROBIN');
  const [condKeyword, setCondKeyword] = useState('');
  const [condLeadSource, setCondLeadSource] = useState('');
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [priority, setPriority] = useState(0);

  const workspaceId = activeWorkspace?.id;

  useEffect(() => {
    if (!workspaceId) return;
    loadData();
  }, [workspaceId]);

  async function loadData() {
    setLoading(true);
    try {
      const [rulesRes, teamRes] = await Promise.all([
        axios.get(`/api/assignment-rules?workspaceId=${workspaceId}`),
        axios.get(`/api/team?workspaceId=${workspaceId}`)
      ]);
      setRules(rulesRes.data);
      setTeam(teamRes.data);
    } catch (e) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditingRule(null);
    setName('');
    setStrategy('ROUND_ROBIN');
    setCondKeyword('');
    setCondLeadSource('');
    setSelectedAgents([]);
    setPriority(0);
    setShowModal(true);
  }

  function openEdit(rule: AssignmentRule) {
    setEditingRule(rule);
    setName(rule.name);
    setStrategy(rule.strategy);
    const conds = JSON.parse(rule.conditions || '{}');
    setCondKeyword(conds.keyword || '');
    setCondLeadSource(conds.leadSourcePrefix || '');
    setSelectedAgents(JSON.parse(rule.agentIds || '[]'));
    setPriority(rule.priority);
    setShowModal(true);
  }

  async function saveRule() {
    if (!name.trim() || selectedAgents.length === 0) {
      toast.error('Name and at least one agent required');
      return;
    }
    const conditions: any = {};
    if (strategy === 'KEYWORD') conditions.keyword = condKeyword;
    if (strategy === 'LEAD_SOURCE') conditions.leadSourcePrefix = condLeadSource;

    try {
      if (editingRule) {
        await axios.patch(`/api/assignment-rules/${editingRule.id}`, {
          name, strategy, conditions, agentIds: selectedAgents, priority
        });
        toast.success('Rule updated');
      } else {
        await axios.post('/api/assignment-rules', {
          name, strategy, conditions, agentIds: selectedAgents, priority, workspaceId
        });
        toast.success('Rule created');
      }
      setShowModal(false);
      loadData();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to save rule');
    }
  }

  async function toggleRule(rule: AssignmentRule) {
    try {
      await axios.patch(`/api/assignment-rules/${rule.id}`, { enabled: !rule.enabled });
      loadData();
    } catch { toast.error('Failed to toggle rule'); }
  }

  async function deleteRule(id: string) {
    if (!confirm('Delete this rule?')) return;
    try {
      await axios.delete(`/api/assignment-rules/${id}`);
      toast.success('Rule deleted');
      loadData();
    } catch { toast.error('Failed to delete'); }
  }

  function agentName(id: string) {
    const m = team.find(t => t.userId === id);
    return m?.user?.name || m?.user?.email || id;
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
            <Route className="w-6 h-6 text-[#25D366]" />
            Auto-Assign Rules
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Automatically assign incoming conversations to team members
          </p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-[#25D366] text-white rounded-lg hover:bg-[#20bd5a] transition-colors">
          <Plus className="w-4 h-4" /> New Rule
        </button>
      </div>

      {rules.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Route className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="font-medium">No assignment rules yet</p>
          <p className="text-sm mt-1">Create rules to auto-assign new conversations to your team</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map(rule => {
            const conds = JSON.parse(rule.conditions || '{}');
            const agents: string[] = JSON.parse(rule.agentIds || '[]');
            return (
              <div key={rule.id} className={cn(
                "border rounded-xl p-4 transition-all",
                rule.enabled
                  ? "bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700"
                  : "bg-gray-50 dark:bg-slate-900 border-gray-100 dark:border-slate-800 opacity-60"
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button onClick={() => toggleRule(rule)} className="text-gray-400 hover:text-[#25D366]">
                      {rule.enabled ? <ToggleRight className="w-6 h-6 text-[#25D366]" /> : <ToggleLeft className="w-6 h-6" />}
                    </button>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{rule.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
                          {rule.strategy.replace('_', ' ')}
                        </span>
                        {rule.strategy === 'KEYWORD' && conds.keyword && (
                          <span className="text-xs text-gray-500">Keyword: "{conds.keyword}"</span>
                        )}
                        {rule.strategy === 'LEAD_SOURCE' && conds.leadSourcePrefix && (
                          <span className="text-xs text-gray-500">Source: "{conds.leadSourcePrefix}"</span>
                        )}
                        <span className="text-xs text-gray-400">
                          → {agents.map(a => agentName(a)).join(', ')}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">Priority: {rule.priority}</span>
                    <button onClick={() => openEdit(rule)} className="p-1.5 text-gray-400 hover:text-blue-500 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20">
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button onClick={() => deleteRule(rule.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg shadow-xl">
            <div className="flex items-center justify-between p-5 border-b dark:border-slate-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {editingRule ? 'Edit Rule' : 'New Assignment Rule'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rule Name</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Round Robin Sales Team"
                  className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Strategy</label>
                <select value={strategy} onChange={e => setStrategy(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-slate-900 dark:border-slate-600 dark:text-white">
                  <option value="ROUND_ROBIN">Round Robin (all new conversations)</option>
                  <option value="LEAD_SOURCE">By Lead Source (ad campaigns)</option>
                  <option value="KEYWORD">By Keyword (message content)</option>
                </select>
              </div>

              {strategy === 'KEYWORD' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Keyword</label>
                  <input value={condKeyword} onChange={e => setCondKeyword(e.target.value)} placeholder="e.g. pricing"
                    className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                </div>
              )}

              {strategy === 'LEAD_SOURCE' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Lead Source Contains</label>
                  <input value={condLeadSource} onChange={e => setCondLeadSource(e.target.value)} placeholder="e.g. Ad:"
                    className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
                  <p className="text-xs text-gray-400 mt-1">Matches contacts whose lead source contains this text</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Assign To (select agents)</label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {team.map(m => (
                    <label key={m.userId} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={selectedAgents.includes(m.userId)}
                        onChange={e => {
                          if (e.target.checked) setSelectedAgents([...selectedAgents, m.userId]);
                          else setSelectedAgents(selectedAgents.filter(a => a !== m.userId));
                        }}
                        className="rounded border-gray-300" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {m.user?.name || m.user?.email} ({m.role})
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priority (higher = checked first)</label>
                <input type="number" value={priority} onChange={e => setPriority(Number(e.target.value))}
                  className="w-24 border rounded-lg px-3 py-2 text-sm dark:bg-slate-900 dark:border-slate-600 dark:text-white" />
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t dark:border-slate-700">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
                Cancel
              </button>
              <button onClick={saveRule} className="px-4 py-2 text-sm bg-[#25D366] text-white rounded-lg hover:bg-[#20bd5a]">
                {editingRule ? 'Update Rule' : 'Create Rule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
