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
import ActivationChecklist from '../components/ActivationChecklist';
import { useTranslation } from 'react-i18next';
import { formatLimitValue, getPlanConfig, getPlanPrice, isPaidPlan, PLAN_ORDER, PLANS, PlanType } from '../constants/plans';

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
      <div className="w-64 border-r border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col gap-2 transition-colors">
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
          className="absolute top-8 right-8 p-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 shadow-sm z-10 transition-colors"
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
  const { user, token, setUser } = useApp();
  const { theme, toggleTheme } = useTheme();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [name, setName] = React.useState(user?.name || '');
  const [saving, setSaving] = React.useState(false);
  const [avatarPreview, setAvatarPreview] = React.useState<string | null>(user?.image || null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 800 * 1024) {
      toast.error('Image too large. Max size is 800KB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    setAvatarPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await axios.patch('/api/users/me', {
        name: name.trim() || user?.name,
        image: avatarPreview,
      });
      setUser(res.data, token);
      toast.success('Profile updated');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-12">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Personal Settings</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your profile and account preferences.</p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-gray-200 dark:border-slate-800 shadow-sm space-y-8 transition-colors">
        <div className="flex items-center gap-6">
          <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <div className="w-24 h-24 bg-gray-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-gray-400 dark:text-gray-500 text-2xl font-bold transition-colors overflow-hidden">
              {avatarPreview
                ? <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" />
                : user?.name?.[0]}
            </div>
            <div className="absolute inset-0 bg-black/40 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="w-6 h-6 text-white" />
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Profile Picture</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">JPG, GIF or PNG. Max size of 800K</p>
            <div className="flex gap-2 mt-3">
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif" className="hidden" onChange={handleFileChange} />
              <button onClick={() => fileInputRef.current?.click()} className="px-4 py-1.5 bg-[#25D366] text-white text-xs font-bold rounded-lg hover:bg-[#128C7E] transition-colors">Upload</button>
              {avatarPreview && (
                <button onClick={handleRemoveAvatar} className="px-4 py-1.5 bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-gray-300 text-xs font-bold rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">Remove</button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Full Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl outline-none text-gray-900 dark:text-white focus:ring-2 focus:ring-[#25D366]/20 transition-all" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Email Address</label>
            <input type="email" defaultValue={user?.email || ''} disabled className="w-full px-4 py-2 bg-gray-100 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl outline-none text-gray-500 dark:text-gray-500 cursor-not-allowed transition-all" />
          </div>
        </div>

        <div className="flex justify-end">
          <button onClick={handleSave} disabled={saving} className="px-6 py-2 bg-[#25D366] text-white text-sm font-semibold rounded-xl hover:bg-[#128C7E] transition-colors disabled:opacity-60">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-gray-200 dark:border-slate-800 shadow-sm transition-colors">
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
  const { activeWorkspace, setActiveWorkspace } = useApp();
  const [businessName, setBusinessName] = useState(activeWorkspace?.name || '');
  const [saving, setSaving] = useState(false);

  // Sync if workspace changes (e.g. on first load)
  useEffect(() => {
    setBusinessName(activeWorkspace?.name || '');
  }, [activeWorkspace?.id]);

  const handleSave = async () => {
    if (!activeWorkspace || !businessName.trim()) return;
    setSaving(true);
    try {
      const res = await axios.patch(`/api/workspaces/${activeWorkspace.id}`, { name: businessName.trim() });
      // Update context so sidebar + everywhere else reflects immediately
      setActiveWorkspace({ ...activeWorkspace, name: res.data.name });
      toast.success('Business name updated!');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-12">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Business Settings</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your workspace and business information.</p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-gray-200 dark:border-slate-800 shadow-sm space-y-8 transition-colors">
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Business Name</label>
            <input
              type="text"
              value={businessName}
              onChange={e => setBusinessName(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl outline-none text-gray-900 dark:text-white focus:ring-2 focus:ring-[#25D366]/20 transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Timezone</label>
            <select className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl outline-none text-gray-900 dark:text-white focus:ring-2 focus:ring-[#25D366]/20 transition-all">
              <option>Asia/Dubai (GMT+04:00)</option>
              <option>UTC (GMT+00:00)</option>
            </select>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !businessName.trim() || businessName.trim() === activeWorkspace?.name}
          className="px-6 py-2.5 bg-[#25D366] text-white text-sm font-bold rounded-xl hover:bg-[#128C7E] transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : 'Save Changes'}
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

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50/50 dark:bg-slate-800/50 border-b border-gray-200 dark:border-slate-800 transition-colors">
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
  const { activeWorkspace } = useApp();
  const { t } = useTranslation();
  const [attributes, setAttributes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newType, setNewType] = useState('STRING');

  const fetchAttributes = async () => {
    if (!activeWorkspace?.id) return;
    try {
      const res = await axios.get(`/api/custom-attributes?workspaceId=${activeWorkspace.id}`);
      setAttributes(Array.isArray(res.data) ? res.data : []);
    } catch {
      // API might not exist yet — show empty
      setAttributes([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchAttributes(); }, [activeWorkspace?.id]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`${t('common.delete')} "${name}"?`)) return;
    try {
      await axios.delete(`/api/custom-attributes/${id}`, { headers: { 'x-workspace-id': activeWorkspace?.id } });
      toast.success(t('common.delete') + ' ✓');
      fetchAttributes();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete');
    }
  };

  const handleEdit = async (id: string) => {
    if (!editName.trim()) return;
    try {
      await axios.patch(`/api/custom-attributes/${id}`, { name: editName, workspaceId: activeWorkspace?.id });
      toast.success(t('common.save') + ' ✓');
      setEditingId(null);
      fetchAttributes();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update');
    }
  };

  const handleAdd = async () => {
    if (!newName.trim() || !newKey.trim()) return;
    try {
      await axios.post('/api/custom-attributes', {
        workspaceId: activeWorkspace?.id,
        name: newName,
        key: newKey.toLowerCase().replace(/\s+/g, '_'),
        type: newType
      });
      toast.success(t('common.create') + ' ✓');
      setShowAdd(false);
      setNewName('');
      setNewKey('');
      setNewType('STRING');
      fetchAttributes();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create');
    }
  };

  return (
    <div className="space-y-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">{t('inbox.customAttributes')}</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{t('common.description')}</p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 px-4 py-2 bg-[#25D366] text-white font-medium rounded-xl hover:bg-[#128C7E] transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" />
          {t('common.add')}
        </button>
      </div>

      {showAdd && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm p-6 space-y-4 transition-colors">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">{t('common.name')}</label>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Vehicle Type"
                className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:border-[#25D366]" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Key</label>
              <input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="e.g. vehicle_type"
                className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:border-[#25D366]" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">{t('common.type')}</label>
              <select value={newType} onChange={(e) => setNewType(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:border-[#25D366]">
                <option value="STRING">String</option>
                <option value="NUMBER">Number</option>
                <option value="DATE">Date</option>
                <option value="BOOLEAN">Boolean</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">{t('common.cancel')}</button>
            <button onClick={handleAdd} className="px-4 py-2 bg-[#25D366] text-white text-sm font-medium rounded-lg hover:bg-[#128C7E] transition-colors">{t('common.create')}</button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50/50 dark:bg-slate-800/50 border-b border-gray-200 dark:border-slate-800 transition-colors">
              <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t('common.actions')}</th>
              <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t('common.type')}</th>
              <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Key</th>
              <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t('common.name')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-slate-800 transition-colors">
            {isLoading ? (
              <tr><td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-400">{t('common.loading')}</td></tr>
            ) : attributes.length === 0 ? (
              <tr><td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-400">{t('common.noResults')}</td></tr>
            ) : attributes.map((attr) => (
              <tr key={attr.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleDelete(attr.id, attr.name)} className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                    <button onClick={() => { setEditingId(attr.id); setEditName(attr.name); }} className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg transition-colors"><Edit className="w-4 h-4" /></button>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[10px] font-bold rounded uppercase">{attr.type}</span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{attr.key}</td>
                <td className="px-6 py-4">
                  {editingId === attr.id ? (
                    <div className="flex items-center gap-2">
                      <input value={editName} onChange={(e) => setEditName(e.target.value)} className="px-2 py-1 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded text-sm outline-none focus:border-[#25D366]" autoFocus />
                      <button onClick={() => handleEdit(attr.id)} className="text-[#25D366] text-xs font-medium">{t('common.save')}</button>
                      <button onClick={() => setEditingId(null)} className="text-gray-400 text-xs">{t('common.cancel')}</button>
                    </div>
                  ) : (
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{attr.name}</span>
                  )}
                </td>
              </tr>
            ))}
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

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
        <div className="p-6 border-b border-gray-200 dark:border-slate-800">
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            Use these keys to authenticate requests to our API. Keep them secret and never share them in public repositories.
          </p>
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50/50 dark:bg-slate-800/50 border-b border-gray-200 dark:border-slate-800 transition-colors">
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

function Billing() {
  const location = useLocation();
  const { activeWorkspace, refreshWorkspaces, hasVerifiedEmail } = useApp();
  const [ledger, setLedger] = useState<any[]>([]);
  const [usageLogs, setUsageLogs] = useState<any[]>([]);
  const [billingSummary, setBillingSummary] = useState({
    balance: 0,
    totalCredits: 0,
    totalDebits: 0,
    aiTokensUsed: 0,
    aiSpend: 0,
    usageEvents: 0,
  });
  const [isBillingLoading, setIsBillingLoading] = useState(false);

  const currentPlan = activeWorkspace?.plan || 'NONE';
  const currentPlanInfo = getPlanConfig(currentPlan);
  const selectedPlanFromQuery = (new URLSearchParams(location.search).get('plan') || '').toUpperCase() as PlanType | '';
  const nextBillingDate = activeWorkspace?.subscriptionCurrentPeriodEnd
    ? new Date(activeWorkspace.subscriptionCurrentPeriodEnd)
    : null;
  const canManageStripeSubscription =
    !!activeWorkspace?.stripeCustomerId &&
    ['active', 'trialing', 'past_due', 'unpaid'].includes(
      String(activeWorkspace?.subscriptionStatus || '').toLowerCase()
    );
  const isPaidWorkspaceWithoutStripePortal =
    !!currentPlanInfo &&
    !canManageStripeSubscription;

  const fetchBillingData = async () => {
    if (!activeWorkspace?.id) return;

    setIsBillingLoading(true);
    try {
      const [ledgerRes, usageRes, summaryRes] = await Promise.all([
        axios.get(`/api/billing/ledger?workspaceId=${activeWorkspace.id}`),
        axios.get(`/api/billing/usage?workspaceId=${activeWorkspace.id}`),
        axios.get(`/api/billing/summary?workspaceId=${activeWorkspace.id}`),
      ]);

      setLedger(Array.isArray(ledgerRes.data) ? ledgerRes.data : []);
      setUsageLogs(Array.isArray(usageRes.data) ? usageRes.data : []);
      setBillingSummary({
        balance: Number(summaryRes.data?.balance || 0),
        totalCredits: Number(summaryRes.data?.totalCredits || 0),
        totalDebits: Number(summaryRes.data?.totalDebits || 0),
        aiTokensUsed: Number(summaryRes.data?.aiTokensUsed || 0),
        aiSpend: Number(summaryRes.data?.aiSpend || 0),
        usageEvents: Number(summaryRes.data?.usageEvents || 0),
      });
    } catch (error) {
      console.error('Failed to fetch billing data', error);
    } finally {
      setIsBillingLoading(false);
    }
  };

  useEffect(() => {
    fetchBillingData();
  }, [activeWorkspace?.id]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('success') === 'true') {
      if (!activeWorkspace) return;
      axios.post('/api/billing/sync-subscription', { workspaceId: activeWorkspace.id })
        .catch((error) => {
          console.error('Failed to sync workspace subscription after checkout', error);
        })
        .finally(() => {
          refreshWorkspaces().catch((error) => {
            console.error('Failed to refresh workspaces after checkout', error);
          });
          fetchBillingData().catch((error) => {
            console.error('Failed to refresh billing data after checkout', error);
          });
        });
    }
  }, [activeWorkspace, location.search, refreshWorkspaces]);

  const formatCreditValue = (value: number) => {
    const absValue = Math.abs(value);
    const precision = absValue > 0 && absValue < 1 ? 4 : 2;
    return value.toLocaleString(undefined, {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    });
  };

  const formatUsdValue = (value: number) =>
    value.toLocaleString(undefined, {
      minimumFractionDigits: value > 0 && value < 1 ? 4 : 2,
      maximumFractionDigits: value > 0 && value < 1 ? 4 : 2,
    });

  const openBillingPortal = async () => {
    if (!activeWorkspace?.id) return;

    try {
      const res = await axios.post('/api/billing/create-portal-session', {
        workspaceId: activeWorkspace.id,
        returnUrl: `${window.location.origin}/app/settings/billing`,
      });
      window.location.href = res.data.url;
    } catch (error) {
      console.error('Failed to open Stripe billing portal', error);
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.error || 'Could not open Stripe billing portal');
      } else {
        toast.error('Could not open Stripe billing portal');
      }
    }
  };

  return (
    <div className="space-y-12">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Billing & Usage</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your subscription and view usage history.</p>
      </div>

      <div className="flex bg-white dark:bg-slate-900 p-1 rounded-xl border border-gray-200 dark:border-slate-800 w-fit transition-colors">
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
          <div className="space-y-8">
            <ActivationChecklist />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm transition-colors">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-semibold text-gray-900 dark:text-white">Current Plan</h3>
                  <span className={cn(
                    "px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wider",
                    currentPlanInfo
                      ? "bg-[#25D366]/10 text-[#25D366]"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                  )}>
                    {currentPlanInfo ? currentPlanInfo.name : 'No Plan Selected'}
                  </span>
                </div>
                {currentPlanInfo ? (
                  <div className="mb-8 space-y-5">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{currentPlanInfo.shortLabel}</p>
                      <p className="mt-1 text-sm leading-relaxed text-gray-500 dark:text-gray-400">{currentPlanInfo.description}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">Contacts</p>
                        <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{formatLimitValue(currentPlanInfo.contactsLimit)}</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">Broadcasts / month</p>
                        <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{formatLimitValue(currentPlanInfo.broadcastLimit)}</p>
                      </div>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">WhatsApp Numbers</span>
                      <span className="font-semibold text-gray-900 dark:text-white">{formatLimitValue(currentPlanInfo.whatsappLimit)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">AI Assistants</span>
                      <span className="font-semibold text-gray-900 dark:text-white">{formatLimitValue(currentPlanInfo.chatbotLimit)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Users</span>
                      <span className="font-semibold text-gray-900 dark:text-white">{formatLimitValue(currentPlanInfo.userLimit)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Automations</span>
                      <span className="font-semibold text-gray-900 dark:text-white">{formatLimitValue(currentPlanInfo.automationLimit)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Conversation History</span>
                      <span className="font-semibold text-gray-900 dark:text-white">{currentPlanInfo.historyMonths} months</span>
                    </div>
                    <div className="rounded-xl border border-dashed border-gray-200 px-4 py-3 text-xs text-gray-500 dark:border-slate-700 dark:text-gray-400">
                      {currentPlanInfo.supportLabel}
                    </div>
                  </div>
                ) : (
                  <div className="mb-8 rounded-2xl border border-dashed border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-700 dark:border-amber-900/30 dark:bg-amber-900/10 dark:text-amber-300">
                    No package has been selected for this workspace yet. Choose one of the paid packages below to activate the account.
                  </div>
                )}
                <div className="mb-8 rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Subscription status</span>
                  <span className="font-semibold uppercase text-gray-900 dark:text-white">
                    {activeWorkspace?.subscriptionStatus || 'pending'}
                  </span>
                  </div>
                  <div className="mt-2 flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">
                      {activeWorkspace?.subscriptionCancelAtPeriodEnd ? 'Ends on' : 'Next payment'}
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {nextBillingDate ? format(nextBillingDate, 'MMM dd, yyyy') : 'Not available yet'}
                    </span>
                  </div>
                </div>
                <div className="space-y-3">
                  <Link to="/app/settings/billing/plans" className="block w-full py-3 bg-gray-900 dark:bg-slate-800 text-white text-center font-bold rounded-xl hover:bg-gray-800 dark:hover:bg-slate-700 transition-all shadow-sm">
                    {currentPlanInfo ? 'Change Plan' : 'Choose Your Plan'}
                  </Link>
                  {canManageStripeSubscription ? (
                    <button
                      type="button"
                      onClick={openBillingPortal}
                      className="block w-full rounded-xl border border-gray-200 bg-white py-3 text-center font-bold text-gray-700 transition-all hover:border-gray-300 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                    >
                      Manage or Cancel Subscription
                    </button>
                  ) : null}
                  {isPaidWorkspaceWithoutStripePortal ? (
                    <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700 dark:border-amber-900/30 dark:bg-amber-900/10 dark:text-amber-300">
                      This workspace is marked as paid locally, but it is not linked to a real Stripe customer yet, so self-serve cancellation is not available here.
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm transition-colors">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-semibold text-gray-900 dark:text-white">Credit Balance</h3>
                  <button
                    onClick={() => fetchBillingData()}
                    className="p-2 text-gray-400 hover:text-[#25D366] transition-colors"
                    disabled={isBillingLoading}
                  >
                    <RefreshCw className={cn("w-4 h-4", isBillingLoading && "animate-spin")} />
                  </button>
                </div>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-4xl font-bold text-gray-900 dark:text-white">{formatCreditValue(billingSummary.balance)}</span>
                  <span className="text-sm font-medium text-gray-400 dark:text-gray-500 uppercase">Credits</span>
                </div>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-6 leading-relaxed">
                    GPT-4.1 mini usage now creates real debit entries from token consumption. The balance below is calculated from your workspace ledger, while WhatsApp conversation charges stay on your own WABA billing.
                  </p>
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">AI Spend</p>
                    <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">${formatUsdValue(billingSummary.aiSpend)}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">Tokens Used</p>
                    <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{billingSummary.aiTokensUsed.toLocaleString()}</p>
                  </div>
                </div>
                <div className="rounded-xl border border-dashed border-gray-200 px-4 py-3 text-xs text-gray-500 dark:border-slate-700 dark:text-gray-400">
                  {billingSummary.usageEvents > 0
                    ? `${billingSummary.usageEvents} AI usage event${billingSummary.usageEvents === 1 ? '' : 's'} recorded for this workspace.`
                    : 'No AI usage has been recorded for this workspace yet.'}
                </div>
              </div>
            </div>
          </div>
        } />
        <Route path="plans" element={
          <div className="space-y-6">
            {selectedPlanFromQuery && (
              <div className="rounded-2xl border border-[#25D366]/20 bg-[#25D366]/5 px-5 py-4 text-sm text-gray-700 dark:border-[#25D366]/10 dark:bg-[#25D366]/10 dark:text-gray-200">
                You selected the <span className="font-semibold text-[#25D366]">{PLANS[selectedPlanFromQuery]?.name || selectedPlanFromQuery}</span> plan from the homepage. Review it below and continue to checkout when you're ready.
              </div>
            )}
            <div className="rounded-2xl border border-blue-100 bg-blue-50/80 px-5 py-4 text-sm text-blue-700 dark:border-blue-900/30 dark:bg-blue-950/20 dark:text-blue-200">
              Monthly checkout works now. Annual pricing is already packaged below and can be connected once deployment billing is finalized.
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {PLAN_ORDER.map((key) => {
                const plan = PLANS[key];
                const isCurrent = isPaidPlan(currentPlan) && currentPlan === key;
                const isRecommended = selectedPlanFromQuery === key && !isCurrent;
                return (
              <div key={key} className={cn(
                "bg-white dark:bg-slate-900 p-8 rounded-2xl border transition-all relative overflow-hidden",
                isCurrent
                  ? "border-[#25D366] ring-1 ring-[#25D366] shadow-md"
                  : isRecommended
                    ? "border-blue-300 ring-1 ring-blue-200 shadow-md dark:border-blue-500/50 dark:ring-blue-500/30"
                    : plan.highlight
                      ? "border-[#25D366]/50 shadow-md"
                      : "border-gray-200 dark:border-slate-800 shadow-sm hover:border-gray-300 dark:hover:border-slate-700"
              )}>
                {currentPlan === key && (
                  <div className="absolute top-0 right-0 bg-[#25D366] text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider">
                    Current
                  </div>
                )}
                {isRecommended && (
                    <div className="absolute top-0 right-0 bg-blue-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider">
                      Selected
                    </div>
                )}
                {plan.highlight && !isCurrent && !isRecommended && (
                  <div className="absolute top-0 left-0 bg-[#25D366] text-white text-[10px] font-bold px-3 py-1 rounded-br-xl uppercase tracking-wider">
                    Most Popular
                  </div>
                )}
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{plan.name}</h3>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500 mb-4">{plan.shortLabel}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-gray-900 dark:text-white">AED {getPlanPrice(plan, 'monthly')}</span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">/month</span>
                </div>
                <p className="mt-1 text-xs font-medium text-[#128C7E]">AED {plan.annualPrice}/month on annual billing</p>
                <p className="mt-4 text-sm leading-relaxed text-gray-500 dark:text-gray-400">{plan.description}</p>
                <ul className="space-y-4 mb-8">
                  {plan.billingHighlights.map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <CheckCircle2 className="w-4 h-4 text-[#25D366]" />
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="mb-6 rounded-xl bg-slate-50 px-4 py-3 text-xs text-gray-500 dark:bg-slate-800/60 dark:text-gray-400">
                  {plan.supportLabel}
                </div>
                <button 
                  disabled={isCurrent}
                  onClick={async () => {
                    if (!hasVerifiedEmail) {
                      toast.error('Verify your email before subscribing');
                      return;
                    }
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
                      if (axios.isAxiosError(e)) {
                        toast.error(e.response?.data?.error || 'Failed to start checkout');
                      } else {
                        toast.error('Failed to start checkout');
                      }
                    }
                  }}
                  className={cn(
                    "w-full py-3 rounded-xl font-bold transition-all",
                    isCurrent 
                      ? "bg-gray-50 dark:bg-slate-800 text-gray-400 dark:text-gray-600 cursor-not-allowed" 
                      : isRecommended
                        ? "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                        : "bg-[#25D366] text-white hover:bg-[#128C7E] shadow-sm"
                  )}
                >
                  {isCurrent ? 'Active Plan' : isRecommended ? 'Continue With This Plan' : 'Select Plan'}
                </button>
              </div>
            )})}
            </div>
          </div>
        } />
        <Route path="usage" element={
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/50 dark:bg-slate-800/50 border-b border-gray-200 dark:border-slate-800 transition-colors">
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Tokens</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider text-right">Cost (USD)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-800 transition-colors">
                {usageLogs.length > 0 ? usageLogs.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 text-xs text-gray-500 dark:text-gray-400">{format(new Date(entry.createdAt), 'MMM dd, yyyy HH:mm')}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                      {entry.type === 'AI_TOKEN' ? 'GPT-4.1 mini token usage' : entry.type}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                      {Number(entry.quantity || 0).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-900 dark:text-white text-right">
                      ${formatUsdValue(Number(entry.cost || 0))}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-sm text-gray-400 dark:text-gray-600 italic">
                      No AI token usage has been recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        } />
      </Routes>
    </div>
  );
}
