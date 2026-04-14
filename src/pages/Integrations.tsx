import React from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Zap,
  ShoppingBag,
  MessageSquare,
  Users,
  Globe,
  Database,
  ArrowUpRight,
  CheckCircle2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

export default function Integrations() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const integrations = [
    {
      id: 'shopify',
      name: 'Shopify',
      description: t('integrations.shopifyDesc'),
      icon: ShoppingBag,
      color: 'bg-emerald-50 text-emerald-600',
      connected: true,
      category: t('integrations.ecommerce')
    },
    {
      id: 'hubspot',
      name: 'HubSpot',
      description: t('integrations.hubspotDesc'),
      icon: Database,
      color: 'bg-orange-50 text-orange-600',
      connected: false,
      category: t('integrations.crm')
    },
    {
      id: 'slack',
      name: 'Slack',
      description: t('integrations.slackDesc'),
      icon: MessageSquare,
      color: 'bg-purple-50 text-purple-600',
      connected: false,
      category: t('integrations.communication')
    },
    {
      id: 'zapier',
      name: 'Zapier',
      description: t('integrations.zapierDesc'),
      icon: Zap,
      color: 'bg-orange-50 text-orange-600',
      connected: true,
      category: t('integrations.automation')
    },
    {
      id: 'google-sheets',
      name: 'Google Sheets',
      description: t('integrations.googleSheetsDesc'),
      icon: Globe,
      color: 'bg-green-50 text-green-600',
      connected: false,
      category: t('integrations.productivity')
    },
  ];

  const handleConnect = (id: string) => {
    toast.info(t('integrations.comingSoon', { id }));
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-10">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{t('integrations.title')}</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">{t('integrations.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {integrations.map((app) => (
          <motion.div
            key={app.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-100 dark:border-slate-800 hover:border-gray-200 dark:hover:border-slate-700 hover:shadow-sm transition-all flex flex-col group"
          >
            <div className="flex items-start justify-between mb-6">
              <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center transition-colors", 
                app.connected ? app.color : "bg-gray-50 dark:bg-slate-800 text-gray-400 dark:text-gray-500"
              )}>
                <app.icon className="w-7 h-7" />
              </div>
              {app.connected ? (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-full text-[10px] font-bold uppercase tracking-wider">
                  <CheckCircle2 className="w-3 h-3" />
                  {t('integrations.connected')}
                </div>
              ) : (
                <button 
                  onClick={() => handleConnect(app.id)}
                  className="text-xs font-semibold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors flex items-center gap-1"
                >
                  {t('integrations.connect')}
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-bold text-gray-900 dark:text-white text-lg">{app.name}</h3>
                <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium bg-gray-50 dark:bg-slate-800 px-1.5 py-0.5 rounded uppercase tracking-tight">
                  {app.category}
                </span>
              </div>
              <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
                {app.description}
              </p>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-50 dark:border-slate-800 flex items-center justify-between">
              <button 
                onClick={() => handleConnect(app.id)}
                className="text-sm font-medium text-[#25D366] hover:underline"
              >
                {t('integrations.viewSettings')}
              </button>
              <div className="flex -space-x-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-900 bg-gray-100 dark:bg-slate-800" />
                ))}
              </div>
            </div>
          </motion.div>
        ))}

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-50 dark:bg-slate-900/50 p-6 rounded-2xl border border-dashed border-gray-200 dark:border-slate-800 flex flex-col items-center justify-center text-center group cursor-pointer hover:bg-white dark:hover:bg-slate-900 hover:border-[#25D366] transition-all"
        >
          <div className="w-14 h-14 rounded-full bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Zap className="w-6 h-6 text-gray-400 group-hover:text-[#25D366]" />
          </div>
          <h3 className="font-bold text-gray-900 dark:text-white mb-1">{t('integrations.requestIntegration')}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-[180px]">
            {t('integrations.requestIntegrationDesc')}
          </p>
        </motion.div>
      </div>
    </div>
  );
}
