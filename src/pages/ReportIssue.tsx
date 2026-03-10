import React, { useState } from 'react';
import { motion } from 'motion/react';
import { AlertCircle, Send, CheckCircle2, Upload, X } from 'lucide-react';
import { cn } from '../lib/utils';

export default function ReportIssue() {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    type: 'bug',
    priority: 'medium',
    subject: '',
    description: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="h-[calc(100vh-100px)] flex items-center justify-center p-8">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-md w-full text-center"
        >
          <div className="w-20 h-20 bg-[#25D366]/10 text-[#25D366] rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Issue Reported</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8">Thank you for your feedback. Our team will investigate this and get back to you shortly.</p>
          <button 
            onClick={() => setSubmitted(false)}
            className="px-6 py-3 bg-gray-900 dark:bg-slate-800 text-white rounded-xl font-semibold hover:bg-gray-800 dark:hover:bg-slate-700 transition-all"
          >
            Report Another Issue
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-10">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Report an Issue</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Found a bug or having trouble? Let us know.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Issue Type</label>
            <select 
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-[#25D366]/20 focus:border-[#25D366] transition-all bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
            >
              <option value="bug">Bug Report</option>
              <option value="ui">UI/UX Issue</option>
              <option value="performance">Performance</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Priority</label>
            <div className="flex gap-2">
              {['low', 'medium', 'high'].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setFormData({ ...formData, priority: p })}
                  className={cn(
                    "flex-1 py-3 rounded-xl border text-sm font-medium capitalize transition-all",
                    formData.priority === p 
                      ? "bg-gray-900 dark:bg-slate-800 border-gray-900 dark:border-slate-700 text-white shadow-md" 
                      : "bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-slate-700"
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Subject</label>
          <input 
            type="text"
            required
            placeholder="Briefly describe the issue"
            value={formData.subject}
            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#25D366]/20 focus:border-[#25D366] transition-all"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Detailed Description</label>
          <textarea 
            required
            rows={6}
            placeholder="What happened? How can we reproduce it?"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#25D366]/20 focus:border-[#25D366] transition-all resize-none"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Attachments (Optional)</label>
          <div className="border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-2xl p-8 text-center hover:border-[#25D366] hover:bg-[#25D366]/5 transition-all cursor-pointer group">
            <div className="w-12 h-12 bg-gray-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:bg-[#25D366]/10 transition-colors">
              <Upload className="w-6 h-6 text-gray-400 group-hover:text-[#25D366]" />
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">Click or drag to upload screenshots</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">PNG, JPG up to 5MB</p>
          </div>
        </div>

        <div className="pt-4">
          <button 
            type="submit"
            className="w-full py-4 bg-[#25D366] text-white rounded-xl font-bold hover:bg-[#21BD5B] transition-all shadow-lg shadow-[#25D366]/20 flex items-center justify-center gap-2"
          >
            <Send className="w-5 h-5" />
            Submit Report
          </button>
        </div>
      </form>
    </div>
  );
}
