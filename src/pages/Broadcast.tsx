import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useApp } from '../contexts/AppContext';
import { 
  Radio, 
  Plus, 
  Search, 
  Calendar, 
  Users, 
  FileText, 
  Image as ImageIcon,
  ArrowRight,
  MoreHorizontal,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

export default function Broadcast() {
  const { activeWorkspace } = useApp();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (activeWorkspace) {
      fetchCampaigns();
    }
  }, [activeWorkspace]);

  const fetchCampaigns = async () => {
    try {
      const res = await axios.get(`/api/campaigns?workspaceId=${activeWorkspace?.id}`);
      setCampaigns(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="h-full bg-[#F8F9FA] dark:bg-slate-950 p-8 overflow-y-auto transition-colors">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Broadcast Campaigns</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Manage and schedule bulk message campaigns.</p>
          </div>
          <button 
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#25D366] text-white font-medium rounded-xl hover:bg-[#128C7E] transition-all shadow-sm"
          >
            <Plus className="w-5 h-5" />
            New Broadcast
          </button>
        </div>

        {isCreating ? (
          <BroadcastBuilder onCancel={() => setIsCreating(false)} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {campaigns.map((campaign) => (
              <motion.div
                key={campaign.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={cn(
                    "p-2 rounded-xl",
                    campaign.status === 'COMPLETED' ? "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400" :
                    campaign.status === 'SCHEDULED' ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" : "bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-gray-400"
                  )}>
                    <Radio className="w-5 h-5" />
                  </div>
                  <button className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                    <MoreHorizontal className="w-5 h-5" />
                  </button>
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{campaign.name}</h3>
                <div className="flex items-center gap-2 mb-4">
                  <span className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                    campaign.status === 'COMPLETED' ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300" :
                    campaign.status === 'SCHEDULED' ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" : "bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300"
                  )}>
                    {campaign.status}
                  </span>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500">
                    {format(new Date(campaign.date), 'MMM dd, yyyy')}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="text-center p-2 bg-gray-50 dark:bg-slate-800 rounded-lg transition-colors">
                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase">Delivered</p>
                    <p className="text-xs font-bold text-gray-900 dark:text-white">{campaign.deliveredCount || 0}</p>
                  </div>
                  <div className="text-center p-2 bg-gray-50 dark:bg-slate-800 rounded-lg transition-colors">
                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase">Read</p>
                    <p className="text-xs font-bold text-gray-900 dark:text-white">{campaign.readCount || 0}</p>
                  </div>
                  <div className="text-center p-2 bg-gray-50 dark:bg-slate-800 rounded-lg transition-colors">
                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase">Replied</p>
                    <p className="text-xs font-bold text-gray-900 dark:text-white">{campaign.repliedCount || 0}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-gray-50 dark:border-slate-800 transition-colors">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{campaign.sentCount} recipients</span>
                  </div>
                  <button className="text-xs font-bold text-[#25D366] flex items-center gap-1 group-hover:gap-2 transition-all">
                    View Details
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BroadcastBuilder({ onCancel }: { onCancel: () => void }) {
  const [step, setStep] = useState(1);
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden transition-colors"
    >
      <div className="flex border-b border-gray-100 dark:border-slate-800">
        {[1, 2, 3].map((s) => (
          <div 
            key={s}
            className={cn(
              "flex-1 py-4 text-center text-sm font-medium transition-colors relative",
              step === s ? "text-[#25D366]" : "text-gray-400 dark:text-gray-500"
            )}
          >
            Step {s}: {s === 1 ? 'Setup' : s === 2 ? 'Content' : 'Review'}
            {step === s && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#25D366]" />}
          </div>
        ))}
      </div>

      <div className="p-8">
        {step === 1 && (
          <div className="space-y-6 max-w-xl mx-auto">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Campaign Name</label>
              <input
                type="text"
                className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-[#25D366]/20 outline-none text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 transition-colors"
                placeholder="e.g. Ramadan Offer 2024"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">From Sender</label>
              <select className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg outline-none text-gray-900 dark:text-white transition-colors">
                <option>Support Line (+971 50 123 4567)</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">To Contact List / Segment</label>
              <select className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg outline-none text-gray-900 dark:text-white transition-colors">
                <optgroup label="Static Lists" className="dark:bg-slate-900">
                  <option>All Customers (1,250)</option>
                  <option>VIP Clients (120)</option>
                  <option>Inactive Users (450)</option>
                </optgroup>
                <optgroup label="CRM Segments (Pipeline Stage)" className="dark:bg-slate-900">
                  <option>New Leads (320)</option>
                  <option>Qualified Leads (150)</option>
                  <option>Quote Sent (85)</option>
                  <option>Won Customers (45)</option>
                </optgroup>
              </select>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Select Template</label>
                <select className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg outline-none text-gray-900 dark:text-white transition-colors">
                  <option>welcome_message</option>
                  <option>payment_options</option>
                </select>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-xl border border-dashed border-gray-200 dark:border-slate-700 flex flex-col items-center justify-center text-center transition-colors">
                <ImageIcon className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-2" />
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Upload Header Image (Optional)</p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">Max size 5MB. JPG, PNG supported.</p>
              </div>
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Variable Mapping</h4>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono bg-gray-100 dark:bg-slate-800 px-2 py-1 rounded text-gray-600 dark:text-gray-400 transition-colors">{"{{1}}"}</span>
                  <select className="flex-1 text-xs px-3 py-1.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white transition-colors">
                    <option>Contact Name</option>
                    <option>Company Name</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Message Preview</h4>
              <div className="bg-[#E5DDD5] dark:bg-slate-800/50 p-4 rounded-2xl min-h-[300px] flex flex-col transition-colors">
                <div className="bg-white dark:bg-slate-900 p-3 rounded-xl rounded-tl-none shadow-sm max-w-[85%] transition-colors">
                  <div className="w-full aspect-video bg-gray-100 dark:bg-slate-800 rounded-lg mb-2 flex items-center justify-center transition-colors">
                    <ImageIcon className="w-6 h-6 text-gray-300 dark:text-gray-600" />
                  </div>
                  <p className="text-sm text-gray-800 dark:text-gray-200">
                    Hello Ahmed Hassan, Welcome to our service! How can we help you today?
                  </p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 text-right mt-1">14:30</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-8 max-w-xl mx-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-xl transition-colors">
                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase mb-1">Total Recipients</p>
                <p className="text-xl font-semibold text-gray-900 dark:text-white">1,250</p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-xl transition-colors">
                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase mb-1">Estimated Credits</p>
                <p className="text-xl font-semibold text-gray-900 dark:text-white">1,250.00</p>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Schedule Options</h4>
              <div className="grid grid-cols-2 gap-4">
                <button className="flex items-center gap-3 p-4 border-2 border-[#25D366] bg-[#25D366]/5 dark:bg-[#25D366]/10 rounded-xl text-left transition-colors">
                  <CheckCircle2 className="w-5 h-5 text-[#25D366]" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">Send Now</p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">Start sending immediately</p>
                  </div>
                </button>
                <button className="flex items-center gap-3 p-4 border border-gray-200 dark:border-slate-700 rounded-xl text-left hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                  <Clock className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">Schedule</p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">Pick a date and time</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-12 flex items-center justify-between pt-6 border-t border-gray-100 dark:border-slate-800 transition-colors">
          <button 
            onClick={step === 1 ? onCancel : () => setStep(step - 1)}
            className="px-6 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </button>
          <button 
            onClick={() => step < 3 ? setStep(step + 1) : onCancel()}
            className="px-8 py-2.5 bg-[#25D366] text-white font-semibold rounded-xl hover:bg-[#128C7E] transition-all shadow-sm"
          >
            {step === 3 ? 'Launch Campaign' : 'Next Step'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
