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
    // Mock campaigns for now
    setCampaigns([
      { id: '1', name: 'Ramadan Special Offer', status: 'COMPLETED', sentCount: 1250, date: '2024-03-01' },
      { id: '2', name: 'Service Reminder - heavy bus', status: 'SCHEDULED', sentCount: 450, date: '2024-03-15' },
      { id: '3', name: 'New Location Announcement', status: 'DRAFT', sentCount: 0, date: '2024-03-08' },
    ]);
  };

  return (
    <div className="h-full bg-[#F8F9FA] p-8 overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Broadcast Campaigns</h1>
            <p className="text-gray-500 mt-1">Manage and schedule bulk message campaigns.</p>
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
                className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={cn(
                    "p-2 rounded-xl",
                    campaign.status === 'COMPLETED' ? "bg-green-50 text-green-600" :
                    campaign.status === 'SCHEDULED' ? "bg-blue-50 text-blue-600" : "bg-gray-50 text-gray-600"
                  )}>
                    <Radio className="w-5 h-5" />
                  </div>
                  <button className="p-1 text-gray-400 hover:text-gray-600">
                    <MoreHorizontal className="w-5 h-5" />
                  </button>
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{campaign.name}</h3>
                <div className="flex items-center gap-2 mb-4">
                  <span className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                    campaign.status === 'COMPLETED' ? "bg-green-100 text-green-700" :
                    campaign.status === 'SCHEDULED' ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"
                  )}>
                    {campaign.status}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {format(new Date(campaign.date), 'MMM dd, yyyy')}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-gray-400" />
                    <span className="text-xs font-medium text-gray-700">{campaign.sentCount} recipients</span>
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
      className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
    >
      <div className="flex border-b border-gray-100">
        {[1, 2, 3].map((s) => (
          <div 
            key={s}
            className={cn(
              "flex-1 py-4 text-center text-sm font-medium transition-colors relative",
              step === s ? "text-[#25D366]" : "text-gray-400"
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
              <label className="text-sm font-medium text-gray-700">Campaign Name</label>
              <input
                type="text"
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#25D366]/20 outline-none"
                placeholder="e.g. Ramadan Offer 2024"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">From Sender</label>
              <select className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none">
                <option>Support Line (+971 50 123 4567)</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">To Contact List</label>
              <select className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none">
                <option>All Customers (1,250)</option>
                <option>VIP Clients (120)</option>
                <option>Inactive Users (450)</option>
              </select>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Select Template</label>
                <select className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none">
                  <option>welcome_message</option>
                  <option>payment_options</option>
                </select>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl border border-dashed border-gray-200 flex flex-col items-center justify-center text-center">
                <ImageIcon className="w-8 h-8 text-gray-300 mb-2" />
                <p className="text-xs text-gray-500 font-medium">Upload Header Image (Optional)</p>
                <p className="text-[10px] text-gray-400 mt-1">Max size 5MB. JPG, PNG supported.</p>
              </div>
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Variable Mapping</h4>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">{"{{1}}"}</span>
                  <select className="flex-1 text-xs px-3 py-1.5 bg-white border border-gray-200 rounded-lg">
                    <option>Contact Name</option>
                    <option>Company Name</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Message Preview</h4>
              <div className="bg-[#E5DDD5] p-4 rounded-2xl min-h-[300px] flex flex-col">
                <div className="bg-white p-3 rounded-xl rounded-tl-none shadow-sm max-w-[85%]">
                  <div className="w-full aspect-video bg-gray-100 rounded-lg mb-2 flex items-center justify-center">
                    <ImageIcon className="w-6 h-6 text-gray-300" />
                  </div>
                  <p className="text-sm text-gray-800">
                    Hello Ahmed Hassan, Welcome to our service! How can we help you today?
                  </p>
                  <p className="text-[10px] text-gray-400 text-right mt-1">14:30</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-8 max-w-xl mx-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Total Recipients</p>
                <p className="text-xl font-semibold text-gray-900">1,250</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Estimated Credits</p>
                <p className="text-xl font-semibold text-gray-900">1,250.00</p>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-700">Schedule Options</h4>
              <div className="grid grid-cols-2 gap-4">
                <button className="flex items-center gap-3 p-4 border-2 border-[#25D366] bg-[#25D366]/5 rounded-xl text-left">
                  <CheckCircle2 className="w-5 h-5 text-[#25D366]" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Send Now</p>
                    <p className="text-[10px] text-gray-500">Start sending immediately</p>
                  </div>
                </button>
                <button className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl text-left hover:bg-gray-50">
                  <Clock className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Schedule</p>
                    <p className="text-[10px] text-gray-500">Pick a date and time</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-12 flex items-center justify-between pt-6 border-t border-gray-100">
          <button 
            onClick={step === 1 ? onCancel : () => setStep(step - 1)}
            className="px-6 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
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
