import React from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { 
  Zap, 
  ShoppingBag, 
  MessageSquare, 
  Users, 
  Globe, 
  Database,
  ArrowUpRight,
  CheckCircle2,
  Instagram
} from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

export default function Integrations() {
  const navigate = useNavigate();
  const integrations = [
    {
      id: 'shopify',
      name: 'Shopify',
      description: 'Sync orders and send automated WhatsApp notifications for abandoned carts and order updates.',
      icon: ShoppingBag,
      color: 'bg-emerald-50 text-emerald-600',
      connected: true,
      category: 'E-commerce'
    },
    {
      id: 'hubspot',
      name: 'HubSpot',
      description: 'Automatically log WhatsApp conversations as activities in your HubSpot CRM.',
      icon: Database,
      color: 'bg-orange-50 text-orange-600',
      connected: false,
      category: 'CRM'
    },
    {
      id: 'slack',
      name: 'Slack',
      description: 'Get notified in Slack when a new WhatsApp message arrives or a campaign finishes.',
      icon: MessageSquare,
      color: 'bg-purple-50 text-purple-600',
      connected: false,
      category: 'Communication'
    },
    {
      id: 'zapier',
      name: 'Zapier',
      description: 'Connect WhatsApp with 5,000+ apps to automate your entire business workflow.',
      icon: Zap,
      color: 'bg-orange-50 text-orange-600',
      connected: true,
      category: 'Automation'
    },
    {
      id: 'google-sheets',
      name: 'Google Sheets',
      description: 'Export contacts and message logs automatically to Google Sheets for custom reporting.',
      icon: Globe,
      color: 'bg-green-50 text-green-600',
      connected: false,
      category: 'Productivity'
    },
    {
      id: 'instagram',
      name: 'Instagram DMs',
      description: 'Connect your Instagram Business account to manage DMs directly from your unified inbox.',
      icon: Instagram,
      color: 'bg-pink-50 text-pink-600',
      connected: true,
      category: 'Communication'
    },
  ];

  const handleConnect = (id: string) => {
    if (id === 'instagram') {
      navigate('/app/channels');
      toast.success('Instagram integration is active. Manage it in Channels.');
    } else {
      toast.info(`${id} integration is coming soon!`);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-10">
        <h1 className="text-2xl font-semibold text-gray-900">Integrations</h1>
        <p className="text-gray-500 mt-1">Connect your favorite tools to supercharge your WhatsApp operations.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {integrations.map((app) => (
          <motion.div
            key={app.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-6 rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all flex flex-col group"
          >
            <div className="flex items-start justify-between mb-6">
              <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center", app.color)}>
                <app.icon className="w-7 h-7" />
              </div>
              {app.connected ? (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold uppercase tracking-wider">
                  <CheckCircle2 className="w-3 h-3" />
                  Connected
                </div>
              ) : (
                <button 
                  onClick={() => handleConnect(app.id)}
                  className="text-xs font-semibold text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1"
                >
                  Connect
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-bold text-gray-900 text-lg">{app.name}</h3>
                <span className="text-[10px] text-gray-400 font-medium bg-gray-50 px-1.5 py-0.5 rounded uppercase tracking-tight">
                  {app.category}
                </span>
              </div>
              <p className="text-gray-500 text-sm leading-relaxed">
                {app.description}
              </p>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-50 flex items-center justify-between">
              <button 
                onClick={() => handleConnect(app.id)}
                className="text-sm font-medium text-[#25D366] hover:underline"
              >
                View Settings
              </button>
              <div className="flex -space-x-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="w-6 h-6 rounded-full border-2 border-white bg-gray-100" />
                ))}
              </div>
            </div>
          </motion.div>
        ))}

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-50 p-6 rounded-2xl border border-dashed border-gray-200 flex flex-col items-center justify-center text-center group cursor-pointer hover:bg-white hover:border-[#25D366] transition-all"
        >
          <div className="w-14 h-14 rounded-full bg-white border border-gray-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Zap className="w-6 h-6 text-gray-400 group-hover:text-[#25D366]" />
          </div>
          <h3 className="font-bold text-gray-900 mb-1">Request Integration</h3>
          <p className="text-xs text-gray-500 max-w-[180px]">
            Don't see the tool you use? Let us know and we'll build it.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
