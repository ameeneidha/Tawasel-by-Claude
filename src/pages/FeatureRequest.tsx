import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Lightbulb, ThumbsUp, MessageSquare, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';

export default function FeatureRequest() {
  const [activeTab, setActiveTab] = useState<'all' | 'my'>('all');

  const features = [
    { 
      id: '1', 
      title: 'WhatsApp Voice Message Support', 
      description: 'Ability to send and receive voice messages directly from the inbox.',
      votes: 124,
      status: 'Planned',
      category: 'Messaging'
    },
    { 
      id: '2', 
      title: 'Advanced Analytics Dashboard', 
      description: 'More detailed charts for message delivery, response times, and agent performance.',
      votes: 89,
      status: 'In Review',
      category: 'Analytics'
    },
    { 
      id: '3', 
      title: 'Shopify Integration', 
      description: 'Automatically send order updates and abandoned cart reminders via WhatsApp.',
      votes: 215,
      status: 'In Progress',
      category: 'Integrations'
    },
  ];

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Feature Requests</h1>
          <p className="text-gray-500 mt-1">Help us prioritize what to build next.</p>
        </div>
        <button className="px-6 py-3 bg-[#25D366] text-white rounded-xl font-semibold hover:bg-[#21BD5B] transition-all shadow-sm shadow-[#25D366]/20 flex items-center gap-2">
          <Lightbulb className="w-5 h-5" />
          Submit Request
        </button>
      </div>

      <div className="flex gap-8 border-b border-gray-100 mb-8">
        <button 
          onClick={() => setActiveTab('all')}
          className={cn(
            "pb-4 text-sm font-medium transition-all relative",
            activeTab === 'all' ? "text-[#25D366]" : "text-gray-500 hover:text-gray-700"
          )}
        >
          All Requests
          {activeTab === 'all' && (
            <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#25D366]" />
          )}
        </button>
        <button 
          onClick={() => setActiveTab('my')}
          className={cn(
            "pb-4 text-sm font-medium transition-all relative",
            activeTab === 'my' ? "text-[#25D366]" : "text-gray-500 hover:text-gray-700"
          )}
        >
          My Requests
          {activeTab === 'my' && (
            <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#25D366]" />
          )}
        </button>
      </div>

      <div className="grid gap-4">
        {features.map((feature) => (
          <motion.div
            key={feature.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-6 rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all flex items-start gap-6"
          >
            <button className="flex flex-col items-center gap-1 p-3 rounded-xl bg-gray-50 hover:bg-[#25D366]/10 hover:text-[#25D366] transition-colors min-w-[64px]">
              <ThumbsUp className="w-5 h-5" />
              <span className="text-sm font-bold">{feature.votes}</span>
            </button>

            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h3 className="font-semibold text-gray-900 text-lg">{feature.title}</h3>
                <span className={cn(
                  "px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full",
                  feature.status === 'In Progress' ? "bg-blue-50 text-blue-600" :
                  feature.status === 'Planned' ? "bg-purple-50 text-purple-600" :
                  "bg-gray-100 text-gray-600"
                )}>
                  {feature.status}
                </span>
              </div>
              <p className="text-gray-500 text-sm mb-4 leading-relaxed">{feature.description}</p>
              
              <div className="flex items-center gap-4">
                <span className="text-xs font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded-md">
                  {feature.category}
                </span>
                <div className="flex items-center gap-1 text-gray-400 text-xs">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>12 comments</span>
                </div>
              </div>
            </div>

            <ChevronRight className="w-5 h-5 text-gray-300 self-center" />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
