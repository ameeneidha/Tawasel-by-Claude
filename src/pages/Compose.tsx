import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useApp } from '../contexts/AppContext';
import { Send, User, Phone, FileText, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export default function Compose() {
  const { activeWorkspace } = useApp();
  const { t } = useTranslation();
  const [numbers, setNumbers] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    fromNumber: '',
    recipientName: '',
    recipientPhone: '',
    templateId: '',
    message: ''
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (activeWorkspace) {
      fetchData();
    }
  }, [activeWorkspace]);

  const fetchData = async () => {
    try {
      const [numsRes, tempsRes] = await Promise.all([
        axios.get(`/api/numbers?workspaceId=${activeWorkspace?.id}`),
        axios.get(`/api/templates/whatsapp?workspaceId=${activeWorkspace?.id}`)
      ]);
      setNumbers(numsRes.data);
      const approved = (Array.isArray(tempsRes.data) ? tempsRes.data : []).filter((t: any) => t.status === 'APPROVED');
      setTemplates(approved);
      if (numsRes.data.length > 0) {
        setFormData(prev => ({ ...prev, fromNumber: numsRes.data[0].id }));
      }
    } catch (error) {
      console.error('Failed to fetch data', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace) return;
    setIsLoading(true);
    try {
      const selectedTemplate = templates.find(t => t.id === formData.templateId);
      await axios.post('/api/compose/send', {
        workspaceId: activeWorkspace.id,
        numberId: formData.fromNumber,
        recipientPhone: formData.recipientPhone,
        recipientName: formData.recipientName,
        templateName: selectedTemplate?.name || '',
        templateLanguage: selectedTemplate?.language || 'en',
        message: formData.message,
      });
      toast.success(t('compose.messageSent'));
      setFormData(prev => ({
        ...prev,
        recipientName: '',
        recipientPhone: '',
        templateId: '',
        message: ''
      }));
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('compose.messageFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="tawasel-page overflow-y-auto">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{t('compose.title')}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{t('compose.subtitleAlt')}</p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="tawasel-card p-8 transition-colors"
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('compose.fromNumber')}</label>
              <select
                value={formData.fromNumber}
                onChange={(e) => setFormData({ ...formData, fromNumber: e.target.value })}
                className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-[#25D366]/20 focus:border-[#25D366] outline-none transition-colors"
                required
              >
                {numbers.map(num => (
                  <option key={num.id} value={num.id}>{num.name} ({num.phoneNumber})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('compose.recipientName')}</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={formData.recipientName}
                    onChange={(e) => setFormData({ ...formData, recipientName: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-[#25D366]/20 focus:border-[#25D366] outline-none transition-colors"
                    placeholder={t('compose.recipientNamePlaceholder')}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('compose.phoneNumber')}</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="tel"
                    value={formData.recipientPhone}
                    onChange={(e) => setFormData({ ...formData, recipientPhone: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-[#25D366]/20 focus:border-[#25D366] outline-none transition-colors"
                    placeholder={t('compose.phonePlaceholder')}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('compose.template')}</label>
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select
                  value={formData.templateId}
                  onChange={(e) => {
                    const temp = templates.find(t => t.id === e.target.value);
                    setFormData({ ...formData, templateId: e.target.value, message: temp?.content || '' });
                  }}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-[#25D366]/20 focus:border-[#25D366] outline-none transition-colors"
                >
                  <option value="">{t('compose.selectTemplatePlaceholder')}</option>
                  {templates.length === 0 && (
                    <option value="" disabled>{t('compose.noApprovedTemplates')}</option>
                  )}
                  {templates.map(temp => (
                    <option key={temp.id} value={temp.id}>{temp.name} ({temp.language})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('compose.messagePreview')}</label>
              <textarea
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                rows={5}
                className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-[#25D366]/20 focus:border-[#25D366] outline-none resize-none transition-colors"
                placeholder={t('compose.messagePreviewPlaceholder')}
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-[#25D366] hover:bg-[#128C7E] text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm shadow-[#25D366]/20"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  {t('compose.sendMessage')}
                </>
              )}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
