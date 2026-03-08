import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useApp } from '../contexts/AppContext';
import { 
  FileText, 
  Search, 
  Filter, 
  Plus, 
  MoreVertical, 
  RefreshCw,
  Copy,
  Edit,
  Trash2,
  CheckCircle2
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import * as Tabs from '@radix-ui/react-tabs';

export default function Templates() {
  const { activeWorkspace } = useApp();
  const [waTemplates, setWaTemplates] = useState<any[]>([]);
  const [sessionTemplates, setSessionTemplates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (activeWorkspace) {
      fetchTemplates();
    } else {
      setIsLoading(false);
    }
  }, [activeWorkspace]);

  const fetchTemplates = async () => {
    try {
      const res = await axios.get(`/api/templates/whatsapp?workspaceId=${activeWorkspace?.id}`);
      const data = Array.isArray(res.data) ? res.data : [];
      setWaTemplates(data);
      // Mock session templates
      setSessionTemplates([
        { id: 's1', name: 'Quick Greeting', content: 'Hi there! How can I help you today?' },
        { id: 's2', name: 'Closing Statement', content: 'Thank you for contacting us. Have a great day!' },
      ]);
    } catch (error) {
      console.error('Failed to fetch templates', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full bg-[#F8F9FA] p-8 overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        <Tabs.Root defaultValue="whatsapp" className="space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Message Templates</h1>
              <p className="text-gray-500 mt-1">Manage reusable message structures for your business.</p>
            </div>
            <Tabs.List className="bg-white p-1 rounded-xl border border-gray-100 flex gap-1">
              <Tabs.Trigger 
                value="whatsapp"
                className="px-4 py-1.5 text-sm font-medium rounded-lg transition-all data-[state=active]:bg-[#25D366] data-[state=active]:text-white text-gray-500"
              >
                WhatsApp
              </Tabs.Trigger>
              <Tabs.Trigger 
                value="session"
                className="px-4 py-1.5 text-sm font-medium rounded-lg transition-all data-[state=active]:bg-[#25D366] data-[state=active]:text-white text-gray-500"
              >
                Session
              </Tabs.Trigger>
            </Tabs.List>
          </div>

          <Tabs.Content value="whatsapp" className="space-y-6 outline-none">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 flex-1 max-w-md">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input 
                    type="text" 
                    placeholder="Search templates..."
                    className="w-full pl-10 pr-4 py-2 bg-white border border-gray-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#25D366]/10"
                  />
                </div>
                <button className="p-2 bg-white border border-gray-100 rounded-xl text-gray-400 hover:text-gray-600">
                  <Filter className="w-4 h-4" />
                </button>
              </div>
              <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-all shadow-sm">
                <RefreshCw className="w-4 h-4" />
                Sync from WhatsApp
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {waTemplates.map((temp) => (
                <div key={temp.id}>
                  <TemplateCard template={temp} type="whatsapp" />
                </div>
              ))}
            </div>
          </Tabs.Content>

          <Tabs.Content value="session" className="space-y-6 outline-none">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 flex-1 max-w-md">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input 
                    type="text" 
                    placeholder="Search session templates..."
                    className="w-full pl-10 pr-4 py-2 bg-white border border-gray-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#25D366]/10"
                  />
                </div>
              </div>
              <button className="flex items-center gap-2 px-4 py-2 bg-[#25D366] text-white font-medium rounded-xl hover:bg-[#128C7E] transition-all shadow-sm">
                <Plus className="w-4 h-4" />
                New Template
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sessionTemplates.map((temp) => (
                <div key={temp.id}>
                  <TemplateCard template={temp} type="session" />
                </div>
              ))}
            </div>
          </Tabs.Content>
        </Tabs.Root>
      </div>
    </div>
  );
}

function TemplateCard({ template, type }: { template: any, type: 'whatsapp' | 'session' }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all group"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="p-2 bg-gray-50 text-gray-600 rounded-xl">
          <FileText className="w-5 h-5" />
        </div>
        <div className="flex items-center gap-2">
          {type === 'whatsapp' && (
            <span className="px-2 py-0.5 bg-green-50 text-green-600 text-[10px] font-bold rounded uppercase">Approved</span>
          )}
          <button className="p-1 text-gray-400 hover:text-gray-600">
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>
      <h3 className="font-semibold text-gray-900 mb-2 truncate">{template.name}</h3>
      <div className="bg-gray-50 p-3 rounded-xl mb-4 min-h-[80px]">
        <p className="text-xs text-gray-500 line-clamp-3 leading-relaxed">
          {template.content}
        </p>
      </div>
      <div className="flex items-center justify-between pt-4 border-t border-gray-50">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            {type === 'whatsapp' ? template.category : 'Session'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-1.5 text-gray-400 hover:text-[#25D366] hover:bg-[#25D366]/5 rounded-lg transition-colors">
            <Copy className="w-4 h-4" />
          </button>
          <button className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
            <Edit className="w-4 h-4" />
          </button>
          <button className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
