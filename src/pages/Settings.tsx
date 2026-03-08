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
  Edit
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useApp } from '../contexts/AppContext';
import axios from 'axios';
import { format } from 'date-fns';

const settingsNav = [
  { icon: User, label: 'Personal', path: '/app/settings/personal' },
  { icon: Building2, label: 'Business', path: '/app/settings/business' },
  { icon: Database, label: 'Custom Attributes', path: '/app/settings/custom-attributes' },
  { icon: Key, label: 'API Keys', path: '/app/settings/api-keys' },
  { icon: CreditCard, label: 'Billing', path: '/app/settings/billing' },
];

export default function Settings() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="h-full bg-[#F8F9FA] flex">
      <div className="w-64 border-r border-gray-100 bg-white p-6 flex flex-col gap-2">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
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
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
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
          className="absolute top-8 right-8 p-2 bg-white border border-gray-100 rounded-xl text-gray-400 hover:text-gray-600 shadow-sm z-10"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="p-12 max-w-4xl">
          <Routes>
            <Route path="personal" element={<PersonalSettings />} />
            <Route path="business" element={<BusinessSettings />} />
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
  return (
    <div className="space-y-12">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Personal Settings</h2>
        <p className="text-gray-500 mt-1">Manage your profile and account preferences.</p>
      </div>

      <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm space-y-8">
        <div className="flex items-center gap-6">
          <div className="relative group">
            <div className="w-24 h-24 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-400 text-2xl font-bold">
              {user?.name?.[0]}
            </div>
            <button className="absolute inset-0 bg-black/40 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="w-6 h-6 text-white" />
            </button>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Profile Picture</h3>
            <p className="text-xs text-gray-500 mt-1">JPG, GIF or PNG. Max size of 800K</p>
            <div className="flex gap-2 mt-3">
              <button className="px-4 py-1.5 bg-[#25D366] text-white text-xs font-bold rounded-lg">Upload</button>
              <button className="px-4 py-1.5 bg-gray-50 text-gray-600 text-xs font-bold rounded-lg">Remove</button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Full Name</label>
            <input type="text" defaultValue={user?.name || ''} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Email Address</label>
            <input type="email" defaultValue={user?.email || ''} disabled className="w-full px-4 py-2 bg-gray-100 border border-gray-200 rounded-xl outline-none text-gray-500" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
        <h3 className="font-semibold text-gray-900 mb-6">Appearance</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">Color Mode</p>
            <p className="text-xs text-gray-500 mt-1">Choose between light and dark theme.</p>
          </div>
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button className="flex items-center gap-2 px-4 py-1.5 bg-white text-gray-900 text-xs font-bold rounded-lg shadow-sm">
              <Sun className="w-4 h-4" />
              Light
            </button>
            <button className="flex items-center gap-2 px-4 py-1.5 text-gray-500 text-xs font-bold rounded-lg">
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
        <h2 className="text-2xl font-semibold text-gray-900">Business Settings</h2>
        <p className="text-gray-500 mt-1">Manage your workspace and business information.</p>
      </div>

      <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm space-y-8">
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Business Name</label>
            <input type="text" defaultValue={activeWorkspace?.name || ''} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Timezone</label>
            <select className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none">
              <option>Asia/Dubai (GMT+04:00)</option>
              <option>UTC (GMT+00:00)</option>
            </select>
          </div>
        </div>
        <button className="px-6 py-2.5 bg-[#25D366] text-white text-sm font-bold rounded-xl hover:bg-[#128C7E] transition-all">
          Save Changes
        </button>
      </div>
    </div>
  );
}

function CustomAttributes() {
  return (
    <div className="space-y-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Custom Attributes</h2>
          <p className="text-gray-500 mt-1">Define extra fields to store for your contacts.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-[#25D366] text-white font-medium rounded-xl hover:bg-[#128C7E] transition-all shadow-sm">
          <Plus className="w-4 h-4" />
          Add Attribute
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50/50 border-b border-gray-100">
              <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Name</th>
              <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Key</th>
              <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Type</th>
              <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            <tr className="hover:bg-gray-50/50 transition-colors">
              <td className="px-6 py-4 text-sm font-medium text-gray-900">Vehicle Type</td>
              <td className="px-6 py-4 text-sm text-gray-500">vehicle_type</td>
              <td className="px-6 py-4">
                <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-bold rounded uppercase">String</span>
              </td>
              <td className="px-6 py-4 text-right">
                <div className="flex items-center justify-end gap-2">
                  <button className="p-2 text-gray-400 hover:text-blue-600 rounded-lg"><Edit className="w-4 h-4" /></button>
                  <button className="p-2 text-gray-400 hover:text-red-600 rounded-lg"><Trash2 className="w-4 h-4" /></button>
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
          <h2 className="text-2xl font-semibold text-gray-900">API Keys</h2>
          <p className="text-gray-500 mt-1">Access your account via our REST API.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-[#25D366] text-white font-medium rounded-xl hover:bg-[#128C7E] transition-all shadow-sm">
          <Plus className="w-4 h-4" />
          Create New Key
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <p className="text-sm text-gray-600 leading-relaxed">
            Use these keys to authenticate requests to our API. Keep them secret and never share them in public repositories.
          </p>
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50/50 border-b border-gray-100">
              <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Name</th>
              <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Key</th>
              <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Created</th>
              <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            <tr className="hover:bg-gray-50/50 transition-colors">
              <td className="px-6 py-4 text-sm font-medium text-gray-900">Production Key</td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-gray-500">sk_live_••••••••••••4567</span>
                  <button className="p-1 text-gray-400 hover:text-[#25D366]"><Copy className="w-3 h-3" /></button>
                </div>
              </td>
              <td className="px-6 py-4 text-xs text-gray-500">Mar 08, 2024</td>
              <td className="px-6 py-4 text-right">
                <div className="flex items-center justify-end gap-2">
                  <button className="p-2 text-gray-400 hover:text-red-600 rounded-lg"><Trash2 className="w-4 h-4" /></button>
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
  const { activeWorkspace } = useApp();
  const [ledger, setLedger] = useState<any[]>([]);

  useEffect(() => {
    if (activeWorkspace) {
      axios.get(`/api/billing/ledger?workspaceId=${activeWorkspace.id}`)
        .then(res => setLedger(res.data));
    }
  }, [activeWorkspace]);

  return (
    <div className="space-y-12">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Billing & Usage</h2>
        <p className="text-gray-500 mt-1">Manage your subscription and view usage history.</p>
      </div>

      <div className="flex bg-white p-1 rounded-xl border border-gray-100 w-fit">
        <Link 
          to="/app/settings/billing" 
          className={cn(
            "px-6 py-2 text-sm font-medium rounded-lg transition-all",
            location.pathname === '/app/settings/billing' ? "bg-[#25D366] text-white shadow-sm" : "text-gray-500 hover:text-gray-700"
          )}
        >
          Overview
        </Link>
        <Link 
          to="/app/settings/billing/usage" 
          className={cn(
            "px-6 py-2 text-sm font-medium rounded-lg transition-all",
            location.pathname === '/app/settings/billing/usage' ? "bg-[#25D366] text-white shadow-sm" : "text-gray-500 hover:text-gray-700"
          )}
        >
          Usage
        </Link>
      </div>

      <Routes>
        <Route index element={
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-semibold text-gray-900">Credit Balance</h3>
                <button className="p-2 text-gray-400 hover:text-[#25D366]"><RefreshCw className="w-4 h-4" /></button>
              </div>
              <div className="flex items-baseline gap-2 mb-8">
                <span className="text-4xl font-bold text-gray-900">500.00</span>
                <span className="text-sm font-medium text-gray-400 uppercase">Credits</span>
              </div>
              <button className="w-full py-3 bg-[#25D366] text-white font-bold rounded-xl hover:bg-[#128C7E] transition-all shadow-sm shadow-[#25D366]/20">
                Add to Credit Balance
              </button>
            </div>
            <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-center text-center">
              <CreditCard className="w-12 h-12 text-gray-200 mx-auto mb-4" />
              <h3 className="font-semibold text-gray-900">No Payment Method</h3>
              <p className="text-sm text-gray-500 mt-1">Add a credit card to enable automatic top-ups.</p>
              <button className="mt-6 text-sm font-bold text-[#25D366] uppercase">Add Card</button>
            </div>
          </div>
        } />
        <Route path="usage" element={
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Description</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {ledger.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 text-xs text-gray-500">{format(new Date(entry.createdAt), 'MMM dd, yyyy')}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{entry.description}</td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                        entry.type === 'CREDIT' ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                      )}>
                        {entry.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-900 text-right">
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
