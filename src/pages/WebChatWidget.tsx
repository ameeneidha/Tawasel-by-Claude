import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { MessageSquare, Layout, Palette, Code, Eye, Copy, Check } from 'lucide-react';
import { cn } from '../lib/utils';

export default function WebChatWidget() {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [config, setConfig] = useState({
    title: 'Chat with us',
    welcomeMessage: 'Hi there! How can we help you today?',
    primaryColor: '#25D366',
    position: 'right',
    showAvatar: true,
  });

  const embedCode = `<script src="https://cdn.yourplatform.com/widget.js"></script>
<script>
  window.WhatsAppWidget.init({
    workspaceId: 'ws_123456',
    primaryColor: '${config.primaryColor}',
    position: '${config.position}',
    title: '${config.title}'
  });
</script>`;

  const handleCopy = () => {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="tawasel-page-inner p-8">
      <div className="mb-10">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{t('webChat.title')}</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">{t('webChat.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Configuration */}
          <section className="tawasel-card p-6 space-y-6 transition-colors">
            <div className="flex items-center gap-2 mb-2">
              <Palette className="w-5 h-5 text-[#25D366]" />
              <h2 className="font-semibold text-gray-900 dark:text-white">{t('webChat.appearance')}</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('webChat.widgetTitle')}</label>
                <input 
                  type="text"
                  value={config.title}
                  onChange={(e) => setConfig({ ...config, title: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#25D366]/20 focus:border-[#25D366] transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('webChat.primaryColor')}</label>
                <div className="flex gap-2">
                  <input 
                    type="color"
                    value={config.primaryColor}
                    onChange={(e) => setConfig({ ...config, primaryColor: e.target.value })}
                    className="w-10 h-10 rounded-lg border-0 p-0 cursor-pointer bg-transparent"
                  />
                  <input 
                    type="text"
                    value={config.primaryColor}
                    onChange={(e) => setConfig({ ...config, primaryColor: e.target.value })}
                    className="flex-1 px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#25D366]/20 focus:border-[#25D366] transition-all uppercase"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('webChat.welcomeMessage')}</label>
              <textarea 
                rows={3}
                value={config.welcomeMessage}
                onChange={(e) => setConfig({ ...config, welcomeMessage: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#25D366]/20 focus:border-[#25D366] transition-all resize-none"
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800/50 rounded-xl transition-colors">
              <div className="flex items-center gap-3">
                <Layout className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{t('webChat.widgetPosition')}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('webChat.widgetPositionDesc')}</p>
                </div>
              </div>
              <div className="flex bg-white dark:bg-slate-900 p-1 rounded-lg border border-gray-200 dark:border-slate-800 transition-colors">
                <button 
                  onClick={() => setConfig({ ...config, position: 'left' })}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                    config.position === 'left' ? "bg-gray-900 dark:bg-slate-700 text-white shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  )}
                >
                  {t('webChat.left')}
                </button>
                <button 
                  onClick={() => setConfig({ ...config, position: 'right' })}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                    config.position === 'right' ? "bg-gray-900 dark:bg-slate-700 text-white shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  )}
                >
                  {t('webChat.right')}
                </button>
              </div>
            </div>
          </section>

          {/* Embed Code */}
          <section className="bg-gray-900 dark:bg-slate-900 rounded-2xl p-6 overflow-hidden relative group border border-transparent dark:border-slate-800 transition-colors">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Code className="w-5 h-5 text-[#25D366]" />
                <h2 className="font-semibold text-white">{t('webChat.embedCode')}</h2>
              </div>
              <button 
                onClick={handleCopy}
                className="p-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-all flex items-center gap-2 text-xs font-medium"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? t('webChat.copied') : t('webChat.copyCode')}
              </button>
            </div>
            <pre className="text-sm text-gray-400 font-mono overflow-x-auto p-4 bg-black/30 rounded-xl">
              {embedCode}
            </pre>
          </section>
        </div>

        {/* Preview */}
        <div className="space-y-6">
          <div className="sticky top-8">
            <div className="flex items-center gap-2 mb-4">
              <Eye className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              <h2 className="font-semibold text-gray-900 dark:text-white">{t('webChat.livePreview')}</h2>
            </div>
            
            <div className="aspect-[9/16] bg-gray-100 dark:bg-slate-800 rounded-[2.5rem] border-[8px] border-gray-900 dark:border-slate-950 relative overflow-hidden shadow-2xl transition-colors">
              <div className="absolute inset-0 bg-white dark:bg-slate-900 transition-colors" />
              
              {/* Mock Website Content */}
              <div className="p-6 space-y-4">
                <div className="h-4 w-2/3 bg-gray-100 dark:bg-slate-800 rounded-full" />
                <div className="h-32 w-full bg-gray-50 dark:bg-slate-800/50 rounded-2xl" />
                <div className="space-y-2">
                  <div className="h-3 w-full bg-gray-100 dark:bg-slate-800 rounded-full" />
                  <div className="h-3 w-full bg-gray-100 dark:bg-slate-800 rounded-full" />
                  <div className="h-3 w-4/5 bg-gray-100 dark:bg-slate-800 rounded-full" />
                </div>
              </div>

              {/* Widget Bubble */}
              <motion.div 
                layout
                className={cn(
                  "absolute bottom-6 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white cursor-pointer",
                  config.position === 'left' ? "left-6" : "right-6"
                )}
                style={{ backgroundColor: config.primaryColor }}
              >
                <MessageSquare className="w-7 h-7" />
              </motion.div>

              {/* Widget Popup (Mock) */}
              <motion.div 
                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={cn(
                  "absolute bottom-24 w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-800 overflow-hidden transition-colors",
                  config.position === 'left' ? "left-6" : "right-6"
                )}
              >
                <div className="p-4 text-white flex items-center gap-3" style={{ backgroundColor: config.primaryColor }}>
                  <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <span className="font-semibold text-sm">{config.title}</span>
                </div>
                <div className="p-4">
                  <div className="bg-gray-50 dark:bg-slate-800 p-3 rounded-xl rounded-tl-none text-xs text-gray-700 dark:text-gray-300 leading-relaxed transition-colors">
                    {config.welcomeMessage}
                  </div>
                </div>
                <div className="p-3 border-t border-gray-50 dark:border-slate-800 transition-colors">
                  <div className="w-full h-8 bg-gray-100 dark:bg-slate-800 rounded-lg flex items-center px-3 text-[10px] text-gray-400 dark:text-gray-500 transition-colors">
                    Type a message...
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
