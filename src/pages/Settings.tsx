import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  User, 
  Building2, 
  Database, 
  Key, 
  CreditCard, 
  ChevronLeft,
  Camera,
  Moon,
  Sun,
  Plus,
  Trash2,
  Copy,
  RefreshCw,
  ArrowLeft,
  Edit,
  CheckCircle2,
  Zap
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useApp } from '../contexts/AppContext';
import { useTheme } from '../contexts/ThemeContext';
import axios from 'axios';
import { format } from 'date-fns';
import { toast } from 'sonner';

const settingsNav = [
  { icon: User, label: 'Personal', path: '/app/settings/personal' },
  { icon: Building2, label: 'Business', path: '/app/settings/business' },
  { icon: Database, label: 'Custom Attributes', path: '/app/settings/custom-attributes' },
  { icon: Zap, label: 'Automation', path: '/app/settings/automation' },
  { icon: Key, label: 'API Keys', path: '/app/settings/api-keys' },
  { icon: CreditCard, label: 'Billing', path: '/app/settings/billing' },
];

export default function Settings() {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme } = useTheme();

  return (
    <div className="h-full bg-[#F8F9FA] dark:bg-slate-950 flex transition-colors">
      <div className="w-64 border-r border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col gap-2 transition-colors">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Settings</h1>
        </div>
        {settingsNav.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all",
                isActive 
                  ? "bg-[#25D366]/10 text-[#25D366]" 
                  : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-700 dark:hover:text-gray-200"
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto relative">
        <button 
          onClick={() => navigate(-1)}
          className="absolute top-8 right-8 p-2 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 shadow-sm z-10 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="p-12 max-w-4xl">
          <Routes>
            <Route path="personal" element={<PersonalSettings />} />
            <Route path="business" element={<BusinessSettings />} />
            <Route path="automation" element={<AutomationRules />} />
            <Route path="custom-attributes" element={<CustomAttributes />} />
            <Route path="api-keys" element={<ApiKeys />} />
            <Route path="billing/*" element={<Billing />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

function PersonalSettings() {
  const { user } = useApp();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="space-y-12">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Personal Settings</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your profile and account preferences.</p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-gray-100 dark:border-slate-800 shadow-sm space-y-8 transition-colors">
        <div className="flex items-center gap-6">
          <div className="relative group">
            <div className="w-24 h-24 bg-gray-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-gray-400 dark:text-gray-500 text-2xl font-bold transition-colors">
              {user?.name?.[0]}
            </div>
            <button className="absolute inset-0 bg-black/40 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="w-6 h-6 text-white" />
            </button>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Profile Picture</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">JPG, GIF or PNG. Max size of 800K</p>
            <div className="flex gap-2 mt-3">
              <button className="px-4 py-1.5 bg-[#25D366] text-white text-xs font-bold rounded-lg hover:bg-[#128C7E] transition-colors">Upload</button>
              <button className="px-4 py-1.5 bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-gray-300 text-xs font-bold rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">Remove</button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Full Name</label>
            <input type="text" defaultValue={user?.name || ''} className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl outline-none text-gray-900 dark:text-white focus:ring-2 focus:ring-[#25D366]/20 transition-all" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Email Address</label>
            <input type="email" defaultValue={user?.email || ''} disabled className="w-full px-4 py-2 bg-gray-100 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl outline-none text-gray-500 dark:text-gray-500 cursor-not-allowed transition-all" />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-gray-100 dark:border-slate-800 shadow-sm transition-colors">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-6">Appearance</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Color Mode</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Choose between light and dark theme.</p>
          </div>
          <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-xl transition-colors">
            <button 
              onClick={() => theme === 'dark' && toggleTheme()}
              className={cn(
                "flex items-center gap-2 px-4 py-1.5 text-xs font-bold rounded-lg transition-all",
                theme === 'light' 
                  ? "bg-white text-gray-900 shadow-sm" 
                  : "text-gray-500 hover:text-gray-300"
              )}
            >
              <Sun className="w-4 h-4" />
              Light
            </button>
            <button 
              onClick={() => theme === 'light' && toggleTheme()}
              className={cn(
                "flex items-center gap-2 px-4 py-1.5 text-xs font-bold rounded-lg transition-all",
                theme === 'dark' 
                  ? "bg-slate-700 text-white shadow-sm" 
                  : "text-gray-500 hover:text-gray-300"
              )}
            >
              <Moon className="w-4 h-4" />
              Dark
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function BusinessSettings() {
  const { activeWorkspace } = useApp();
  return (
    <div className="space-y-12">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Business Settings</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your workspace and business information.</p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-gray-100 dark:border-slate-800 shadow-sm space-y-8 transition-colors">
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Business Name</label>
            <input type="text" defaultValue={activeWorkspace?.name || ''} className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl outline-none text-gray-900 dark:text-white focus:ring-2 focus:ring-[#25D366]/20 transition-all" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Timezone</label>
            <select className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl outline-none text-gray-900 dark:text-white focus:ring-2 focus:ring-[#25D366]/20 transition-all">
              <option>Asia/Dubai (GMT+04:00)</option>
              <option>UTC (GMT+00:00)</option>
            </select>
          </div>
        </div>
        <button className="px-6 py-2.5 bg-[#25D366] text-white text-sm font-bold rounded-xl hover:bg-[#128C7E] transition-all shadow-sm">
          Save Changes
        </button>
      </div>
    </div>
  );
}

function AutomationRules() {
  const { activeWorkspace } = useApp();
  const [rules, setRules] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newRule, setNewRule] = useState({
    name: '',
    trigger: 'NEW_LEAD',
    action: 'AUTO_ASSIGN',
    config: {}
  });

  useEffect(() => {
    if (activeWorkspace) {
      axios.get(`/api/automation/rules?workspaceId=${activeWorkspace.id}`)
        .then(res => setRules(res.data));
    }
  }, [activeWorkspace]);

  const handleAddRule = async () => {
    if (!newRule.name) return;
    try {
      await axios.post('/api/automation/rules', {
        name: newRule.name,
        trigger: newRule.trigger,
        actions: JSON.stringify([{ type: newRule.action, value: activeWorkspace?.members[0]?.userId }]),
        conditions: JSON.stringify({ keyword: '' }),
        workspaceId: activeWorkspace?.id
      });
      setIsAdding(false);
      setNewRule({ name: '', trigger: 'NEW_LEAD', action: 'AUTO_ASSIGN', config: {} });
      // Refresh
      const res = await axios.get(`/api/automation/rules?workspaceId=${activeWorkspace?.id}`);
      setRules(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Automation Rules</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Automate repetitive tasks and workflows.</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#25D366] text-white font-medium rounded-xl hover:bg-[#128C7E] transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Create Rule
        </button>
      </div>

      {isAdding && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border-2 border-[#25D366]/20 dark:border-[#25D366]/10 shadow-xl space-y-6 transition-colors">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Rule Name</label>
              <input 
                type="text" 
                placeholder="e.g., Auto-assign New Leads"
                value={newRule.name}
                onChange={e => setNewRule({...newRule, name: e.target.value})}
                className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl outline-none text-gray-900 dark:text-white focus:ring-2 focus:ring-[#25D366]/20 transition-all" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Trigger Event</label>
              <select 
                value={newRule.trigger}
                onChange={e => setNewRule({...newRule, trigger: e.target.value})}
                className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl outline-none text-gray-900 dark:text-white focus:ring-2 focus:ring-[#25D366]/20 transition-all"
              >
                <option value="NEW_LEAD">New Lead Created</option>
                <option value="KEYWORD">Keyword in Message</option>
                <option value="STAGE_CHANGE">Pipeline Stage Change</option>
                <option value="INACTIVITY">Inactivity (24h)</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Action to Perform</label>
              <select 
                value={newRule.action}
                onChange={e => setNewRule({...newRule, action: e.target.value})}
                className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl outline-none text-gray-900 dark:text-white focus:ring-2 focus:ring-[#25D366]/20 transition-all"
              >
                <option value="AUTO_ASSIGN">Auto-assign to Agent</option>
                <option value="AUTO_TAG">Add Tag</option>
                <option value="AUTO_PRIORITIZE">Set Priority to High</option>
                <option value="SEND_REMINDER">Send Internal Reminder</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button 
              onClick={() => setIsAdding(false)}
              className="px-6 py-2 text-sm font-bold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleAddRule}
              className="px-6 py-2 bg-[#25D366] text-white text-sm font-bold rounded-xl hover:bg-[#128C7E] transition-colors"
            >
              Save Rule
            </button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50/50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-800 transition-colors">
              <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Rule Name</th>
              <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Trigger</th>
              <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Action</th>
              <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-slate-800 transition-colors">
            {rules.length ? rules.map((rule) => (
              <tr key={rule.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-[#25D366]/10 rounded-lg flex items-center justify-center text-[#25D366]">
                      <Zap className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{rule.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-xs text-gray-500 dark:text-gray-400 font-mono">{rule.trigger}</td>
                <td className="px-6 py-4 text-xs text-gray-500 dark:text-gray-400 font-mono">
                  {(() => {
                    try {
                      const actions = JSON.parse(rule.actions || '[]');
                      return actions.map((a: any) => a.type).join(', ');
                    } catch (e) { return 'N/A'; }
                  })()}
                </td>
                <td className="px-6 py-4">
                  <span className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                    rule.enabled ? "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400" : "bg-gray-50 dark:bg-slate-800 text-gray-400 dark:text-gray-500"
                  )}>
                    {rule.enabled ? 'Active' : 'Paused'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg transition-colors"><Edit className="w-4 h-4" /></button>
                    <button className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-400 dark:text-gray-600 italic">
                  No automation rules created yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CustomAttributes() {
  return (
    <div className="space-y-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Custom Attributes</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Define extra fields to store for your contacts.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-[#25D366] text-white font-medium rounded-xl hover:bg-[#128C7E] transition-all shadow-sm">
          <Plus className="w-4 h-4" />
          Add Attribute
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50/50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-800 transition-colors">
              <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Key</th>
              <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Type</th>
              <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-slate-800 transition-colors">
            <tr className="hover:bg-gray-50/50 dark:hover:bg-slate-800/50 transition-colors">
              <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">Vehicle Type</td>
              <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">vehicle_type</td>
              <td className="px-6 py-4">
                <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[10px] font-bold rounded uppercase">String</span>
              </td>
              <td className="px-6 py-4 text-right">
                <div className="flex items-center justify-end gap-2">
                  <button className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg transition-colors"><Edit className="w-4 h-4" /></button>
                  <button className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ApiKeys() {
  return (
    <div className="space-y-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">API Keys</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Access your account via our REST API.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-[#25D366] text-white font-medium rounded-xl hover:bg-[#128C7E] transition-all shadow-sm">
          <Plus className="w-4 h-4" />
          Create New Key
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
        <div className="p-6 border-b border-gray-100 dark:border-slate-800">
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            Use these keys to authenticate requests to our API. Keep them secret and never share them in public repositories.
          </p>
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50/50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-800 transition-colors">
              <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Key</th>
              <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Created</th>
              <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-slate-800 transition-colors">
            <tr className="hover:bg-gray-50/50 dark:hover:bg-slate-800/50 transition-colors">
              <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">Production Key</td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-gray-500 dark:text-gray-400">sk_live_••••••••••••4567</span>
                  <button className="p-1 text-gray-400 hover:text-[#25D366] transition-colors"><Copy className="w-3 h-3" /></button>
                </div>
              </td>
              <td className="px-6 py-4 text-xs text-gray-500 dark:text-gray-400">Mar 08, 2024</td>
              <td className="px-6 py-4 text-right">
                <div className="flex items-center justify-end gap-2">
                  <button className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { PLANS, PlanType } from '../constants/plans';

function Billing() {
  const location = useLocation();
  const { activeWorkspace } = useApp();
  const [ledger, setLedger] = useState<any[]>([]);

  const currentPlan = (activeWorkspace?.plan || 'STARTER') as PlanType;

  useEffect(() => {
    if (activeWorkspace) {
      axios.get(`/api/billing/ledger?workspaceId=${activeWorkspace.id}`)
        .then(res => setLedger(res.data));
    }
  }, [activeWorkspace]);

  return (
    <div className="space-y-12">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Billing & Usage</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your subscription and view usage history.</p>
      </div>

      <div className="flex bg-white dark:bg-slate-900 p-1 rounded-xl border border-gray-100 dark:border-slate-800 w-fit transition-colors">
        <Link 
          to="/app/settings/billing" 
          className={cn(
            "px-6 py-2 text-sm font-medium rounded-lg transition-all",
            location.pathname === '/app/settings/billing' ? "bg-[#25D366] text-white shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          )}
        >
          Overview
        </Link>
        <Link 
          to="/app/settings/billing/plans" 
          className={cn(
            "px-6 py-2 text-sm font-medium rounded-lg transition-all",
            location.pathname === '/app/settings/billing/plans' ? "bg-[#25D366] text-white shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          )}
        >
          Plans
        </Link>
        <Link 
          to="/app/settings/billing/usage" 
          className={cn(
            "px-6 py-2 text-sm font-medium rounded-lg transition-all",
            location.pathname === '/app/settings/billing/usage' ? "bg-[#25D366] text-white shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          )}
        >
          Usage
        </Link>
      </div>

      <Routes>
        <Route index element={
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm transition-colors">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-semibold text-gray-900 dark:text-white">Current Plan</h3>
                <span className="px-3 py-1 bg-[#25D366]/10 text-[#25D366] text-xs font-bold rounded-full uppercase tracking-wider">
                  {PLANS[currentPlan].name}
                </span>
              </div>
              <div className="space-y-4 mb-8">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">WhatsApp Numbers</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{PLANS[currentPlan].whatsappLimit}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Instagram Accounts</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{PLANS[currentPlan].instagramLimit}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">AI Chatbots</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{PLANS[currentPlan].chatbotLimit}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Users</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{PLANS[currentPlan].userLimit}</span>
                </div>
              </div>
              <Link to="/app/settings/billing/plans" className="block w-full py-3 bg-gray-900 dark:bg-slate-800 text-white text-center font-bold rounded-xl hover:bg-gray-800 dark:hover:bg-slate-700 transition-all shadow-sm">
                Upgrade Plan
              </Link>
            </div>
            <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm transition-colors">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-semibold text-gray-900 dark:text-white">Credit Balance</h3>
                <button className="p-2 text-gray-400 hover:text-[#25D366] transition-colors"><RefreshCw className="w-4 h-4" /></button>
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-4xl font-bold text-gray-900 dark:text-white">500.00</span>
                <span className="text-sm font-medium text-gray-400 dark:text-gray-500 uppercase">Credits</span>
              </div>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-6 leading-relaxed">
                Credits are used exclusively for AI chatbot API charges and token usage. Meta's WhatsApp conversation charges are handled directly through your WhatsApp Business Account (WABA).
              </p>
              <button className="w-full py-3 bg-[#25D366] text-white font-bold rounded-xl hover:bg-[#128C7E] transition-all shadow-sm shadow-[#25D366]/20">
                Add to Credit Balance
              </button>
            </div>
          </div>
        } />
        <Route path="plans" element={
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {(Object.entries(PLANS) as [PlanType, any][]).map(([key, plan]) => (
              <div key={key} className={cn(
                "bg-white dark:bg-slate-900 p-8 rounded-2xl border transition-all relative overflow-hidden",
                currentPlan === key 
                  ? "border-[#25D366] ring-1 ring-[#25D366] shadow-md" 
                  : "border-gray-100 dark:border-slate-800 shadow-sm hover:border-gray-200 dark:hover:border-slate-700"
              )}>
                {currentPlan === key && (
                  <div className="absolute top-0 right-0 bg-[#25D366] text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider">
                    Current
                  </div>
                )}
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-3xl font-bold text-gray-900 dark:text-white">AED {plan.price}</span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">/month</span>
                </div>
                <ul className="space-y-4 mb-8">
                  <li className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <CheckCircle2 className="w-4 h-4 text-[#25D366]" />
                    {plan.whatsappLimit === 999 ? 'Unlimited' : plan.whatsappLimit} WhatsApp Number{plan.whatsappLimit !== 1 ? 's' : ''}
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <CheckCircle2 className="w-4 h-4 text-[#25D366]" />
                    {plan.instagramLimit === 999 ? 'Unlimited' : plan.instagramLimit} Instagram Account{plan.instagramLimit !== 1 ? 's' : ''}
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <CheckCircle2 className="w-4 h-4 text-[#25D366]" />
                    {plan.chatbotLimit === 999 ? 'Unlimited' : plan.chatbotLimit} AI Chatbot{plan.chatbotLimit !== 1 ? 's' : ''}
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <CheckCircle2 className="w-4 h-4 text-[#25D366]" />
                    {plan.userLimit === 999 ? 'Unlimited' : plan.userLimit} User{plan.userLimit !== 1 ? 's' : ''}
                  </li>
                </ul>
                <button 
                  disabled={currentPlan === key}
                  onClick={async () => {
                    try {
                      const res = await axios.post('/api/billing/create-checkout-session', {
                        planId: PLANS[key].stripePriceId,
                        planKey: key,
                        workspaceId: activeWorkspace?.id,
                        successUrl: `${window.location.origin}/app/settings/billing?success=true`,
                        cancelUrl: `${window.location.origin}/app/settings/billing?canceled=true`
                      });
                      window.location.href = res.data.url;
                    } catch (e) {
                      console.error('Stripe Error:', e);
                      toast.error('Failed to start checkout');
                    }
                  }}
                  className={cn(
                    "w-full py-3 rounded-xl font-bold transition-all",
                    currentPlan === key 
                      ? "bg-gray-50 dark:bg-slate-800 text-gray-400 dark:text-gray-600 cursor-not-allowed" 
                      : "bg-[#25D366] text-white hover:bg-[#128C7E] shadow-sm"
                  )}
                >
                  {currentPlan === key ? 'Active Plan' : 'Select Plan'}
                </button>
              </div>
            ))}
          </div>
        } />
        <Route path="usage" element={
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-800 transition-colors">
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-800 transition-colors">
                {ledger.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 text-xs text-gray-500 dark:text-gray-400">{format(new Date(entry.createdAt), 'MMM dd, yyyy')}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{entry.description}</td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                        entry.type === 'CREDIT' ? "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400" : "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
                      )}>
                        {entry.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-900 dark:text-white text-right">
                      {entry.type === 'CREDIT' ? '+' : '-'}{entry.amount.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        } />
      </Routes>
    </div>
  );
}
