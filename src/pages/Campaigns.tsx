import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { useApp } from '../contexts/AppContext';
import { useTranslation } from 'react-i18next';
import {
  Link2, Copy, Check, Plus, Trash2, Smartphone, Globe, Info,
  ExternalLink, QrCode, ArrowRight, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import TawaselLoader from '../components/TawaselLoader';

const PLATFORMS = [
  { code: 'SC', name: 'Snapchat', color: '#FFFC00', textColor: '#000', icon: '👻' },
  { code: 'GG', name: 'Google', color: '#4285F4', textColor: '#fff', icon: '🔍' },
  { code: 'TT', name: 'TikTok', color: '#000000', textColor: '#fff', icon: '🎵' },
  { code: 'FB', name: 'Facebook', color: '#1877F2', textColor: '#fff', icon: '📘' },
  { code: 'IG', name: 'Instagram', color: '#E4405F', textColor: '#fff', icon: '📸' },
  { code: 'TW', name: 'Twitter/X', color: '#000000', textColor: '#fff', icon: '𝕏' },
  { code: 'YT', name: 'YouTube', color: '#FF0000', textColor: '#fff', icon: '▶️' },
  { code: 'LI', name: 'LinkedIn', color: '#0A66C2', textColor: '#fff', icon: '💼' },
  { code: 'EM', name: 'Email', color: '#6366f1', textColor: '#fff', icon: '📧' },
  { code: 'WB', name: 'Website', color: '#059669', textColor: '#fff', icon: '🌐' },
  { code: 'QR', name: 'QR Code', color: '#374151', textColor: '#fff', icon: '📱' },
  { code: 'RF', name: 'Referral', color: '#f59e0b', textColor: '#000', icon: '🤝' },
];

interface WhatsAppNumber {
  id: string;
  phoneNumber: string;
  displayName: string;
}

interface SavedCampaign {
  id: string;
  platform: string;
  campaignName: string;
  phoneNumber: string;
  greeting: string;
  code: string;
  link: string;
  createdAt: string;
}

export default function Campaigns() {
  const { activeWorkspace } = useApp();
  const { t } = useTranslation();
  const workspaceId = activeWorkspace?.id;

  const [numbers, setNumbers] = useState<WhatsAppNumber[]>([]);
  const [savedCampaigns, setSavedCampaigns] = useState<SavedCampaign[]>([]);
  const [loading, setLoading] = useState(true);

  // Generator form
  const [selectedPlatform, setSelectedPlatform] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [selectedNumber, setSelectedNumber] = useState('');
  const [greeting, setGreeting] = useState('Hi, I\'m interested in your offer');
  const [copied, setCopied] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    if (!workspaceId) return;
    loadData();
    // Load saved campaigns from localStorage
    const stored = localStorage.getItem(`campaigns_${workspaceId}`);
    if (stored) setSavedCampaigns(JSON.parse(stored));
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId || savedCampaigns.length === 0) return;
    localStorage.setItem(`campaigns_${workspaceId}`, JSON.stringify(savedCampaigns));
  }, [savedCampaigns, workspaceId]);

  async function loadData() {
    setLoading(true);
    try {
      const numbersRes = await axios.get(`/api/numbers?workspaceId=${workspaceId}`);
      setNumbers(numbersRes.data);
      if (numbersRes.data.length > 0 && !selectedNumber) {
        setSelectedNumber(numbersRes.data[0].phoneNumber);
      }
    } catch {}
    setLoading(false);
  }

  // Clean phone number for wa.me link (digits only, no + or spaces)
  const cleanPhone = (phone: string) => phone.replace(/[^0-9]/g, '');

  const campaignCode = useMemo(() => {
    if (!selectedPlatform || !campaignName) return '';
    const sanitized = campaignName.toUpperCase().replace(/[^A-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    return `${selectedPlatform}-${sanitized}`;
  }, [selectedPlatform, campaignName]);

  const generatedLink = useMemo(() => {
    if (!selectedNumber || !campaignCode) return '';
    const phone = cleanPhone(selectedNumber);
    const text = encodeURIComponent(`${greeting} ${campaignCode}`);
    return `https://wa.me/${phone}?text=${text}`;
  }, [selectedNumber, greeting, campaignCode]);

  const platformInfo = PLATFORMS.find(p => p.code === selectedPlatform);

  async function copyToClipboard(text: string, id: string) {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    toast.success(t('campaigns.copiedToClipboard'));
    setTimeout(() => setCopied(null), 2000);
  }

  function saveCampaign() {
    if (!campaignCode || !generatedLink) return;
    const newCampaign: SavedCampaign = {
      id: Date.now().toString(),
      platform: selectedPlatform,
      campaignName,
      phoneNumber: selectedNumber,
      greeting,
      code: campaignCode,
      link: generatedLink,
      createdAt: new Date().toISOString(),
    };
    setSavedCampaigns(prev => [newCampaign, ...prev]);
    toast.success(t('campaigns.campaignLinkCreated'));
    setCampaignName('');
    setSelectedPlatform('');
  }

  function deleteCampaign(id: string) {
    setSavedCampaigns(prev => prev.filter(c => c.id !== id));
    toast.success(t('campaigns.campaignRemoved'));
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <TawaselLoader size={48} variant="orbit" label={t('common.loading')} />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto h-full">
      <div className="max-w-5xl mx-auto p-6 space-y-6 pb-20">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Link2 className="w-7 h-7 text-[#25D366]" />
              {t('campaigns.linkGenerator')}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              {t('campaigns.createTrackableLinks')}
            </p>
          </div>
          <button
            onClick={() => setShowGuide(!showGuide)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
              showGuide
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                : "bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700"
            )}
          >
            <Info className="w-4 h-4" />
            {t('campaigns.howItWorks')}
          </button>
        </div>

        {/* How It Works Guide */}
        {showGuide && (
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-xl p-6 border border-blue-100 dark:border-blue-900/50">
            <h3 className="font-semibold text-blue-900 dark:text-blue-300 flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5" />
              {t('campaigns.howTrackingWorks')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                {
                  step: '1',
                  title: t('campaigns.step1Title'),
                  desc: t('campaigns.step1Desc')
                },
                {
                  step: '2',
                  title: t('campaigns.step2Title'),
                  desc: t('campaigns.step2Desc')
                },
                {
                  step: '3',
                  title: t('campaigns.step3Title'),
                  desc: t('campaigns.step3Desc')
                },
                {
                  step: '4',
                  title: t('campaigns.step4Title'),
                  desc: t('campaigns.step4Desc')
                },
              ].map((item) => (
                <div key={item.step} className="flex flex-col items-center text-center">
                  <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-lg mb-2">
                    {item.step}
                  </div>
                  <h4 className="font-medium text-gray-900 dark:text-white text-sm">{item.title}</h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{item.desc}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 p-4 bg-white dark:bg-slate-800 rounded-lg border border-blue-100 dark:border-slate-700">
              <h4 className="font-medium text-gray-900 dark:text-white text-sm mb-2">{t('campaigns.codeReference')}</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                {t('campaigns.codeReferenceDesc')}
              </p>
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map(p => (
                  <span
                    key={p.code}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-mono"
                    style={{ backgroundColor: p.color + '20', color: p.color === '#FFFC00' || p.color === '#f59e0b' ? '#92400e' : p.color }}
                  >
                    <span>{p.icon}</span>
                    <span className="font-bold">{p.code}</span>
                    <span className="text-gray-500 dark:text-gray-400">= {p.name}</span>
                  </span>
                ))}
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
                {t('campaigns.codeExample')} <code className="bg-gray-100 dark:bg-slate-700 px-1 rounded">SC-SUMMER-SALE</code> {' '}
                {t('campaigns.codeExampleTagged')} <span className="text-[#25D366] font-medium">"Snapchat: SUMMER-SALE"</span>
              </p>
            </div>
          </div>
        )}

        {/* Generator Card */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-6 space-y-5">
          <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Plus className="w-5 h-5 text-[#25D366]" />
            {t('campaigns.createCampaignLink')}
          </h2>

          {/* Step 1: Platform */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('campaigns.selectAdPlatform')}
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {PLATFORMS.map(p => (
                <button
                  key={p.code}
                  onClick={() => setSelectedPlatform(p.code)}
                  className={cn(
                    "flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all text-sm",
                    selectedPlatform === p.code
                      ? "border-[#25D366] bg-green-50 dark:bg-green-950/30"
                      : "border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600"
                  )}
                >
                  <span className="text-xl">{p.icon}</span>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{p.name}</span>
                  <span className="text-[10px] font-mono text-gray-400">{p.code}-</span>
                </button>
              ))}
            </div>
          </div>

          {/* Step 2: Campaign Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('campaigns.campaignName')}
            </label>
            <input
              type="text"
              value={campaignName}
              onChange={e => setCampaignName(e.target.value)}
              placeholder={t('campaigns.campaignNamePlaceholder')}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-[#25D366] focus:border-transparent"
            />
            <p className="text-xs text-gray-400 mt-1">{t('campaigns.campaignNameHint')}</p>
          </div>

          {/* Step 3: Phone Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('campaigns.whatsappNumber')}
            </label>
            {numbers.length > 0 ? (
              <select
                value={selectedNumber}
                onChange={e => setSelectedNumber(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-[#25D366]"
              >
                {numbers.map(n => (
                  <option key={n.id} value={n.phoneNumber}>
                    {n.displayName || n.phoneNumber} ({n.phoneNumber})
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                {t('campaigns.noNumbersConnected')}
              </p>
            )}
          </div>

          {/* Step 4: Greeting Message */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('campaigns.prefilledMessage')}
            </label>
            <textarea
              value={greeting}
              onChange={e => setGreeting(e.target.value)}
              rows={2}
              placeholder={t('campaigns.prefilledMessagePlaceholder')}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-[#25D366] resize-none"
            />
            <p className="text-xs text-gray-400 mt-1">{t('campaigns.prefilledMessageHint')}</p>
          </div>

          {/* Preview & Generated Link */}
          {campaignCode && generatedLink && (
            <div className="space-y-4">
              {/* Phone Preview */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('campaigns.previewLabel')}
                </label>
                <div className="bg-[#e5ddd5] dark:bg-[#0b141a] rounded-xl p-4 max-w-sm">
                  <div className="bg-[#dcf8c6] dark:bg-[#005c4b] rounded-lg px-3 py-2 ml-auto max-w-[85%] shadow-sm">
                    <p className="text-sm text-gray-900 dark:text-gray-100">
                      {greeting} <span className="font-mono text-xs px-1 py-0.5 bg-green-200/50 dark:bg-green-800/50 rounded">{campaignCode}</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Campaign Code */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('campaigns.campaignCode')}</span>
                  <code className="px-3 py-1.5 bg-white dark:bg-slate-900 rounded-md border border-gray-200 dark:border-slate-600 font-mono text-sm font-bold text-[#25D366]">
                    {campaignCode}
                  </code>
                </div>
                <button
                  onClick={() => copyToClipboard(campaignCode, 'code')}
                  className="ml-auto p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  {copied === 'code' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gray-400" />}
                </button>
              </div>

              {/* Generated Link */}
              <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-900/50">
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400 block mb-1">{t('campaigns.generatedLink')}</span>
                  <code className="text-xs text-green-800 dark:text-green-300 break-all block">
                    {generatedLink}
                  </code>
                </div>
                <button
                  onClick={() => copyToClipboard(generatedLink, 'link')}
                  className="p-2 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg transition-colors shrink-0"
                >
                  {copied === 'link' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-green-600" />}
                </button>
                <a
                  href={generatedLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg transition-colors shrink-0"
                  title={t('campaigns.testLink')}
                >
                  <ExternalLink className="w-4 h-4 text-green-600" />
                </a>
              </div>

              {/* Save Button */}
              <button
                onClick={saveCampaign}
                className="w-full py-2.5 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                {t('campaigns.saveCampaignLink')}
              </button>
            </div>
          )}
        </div>

        {/* Where to Put Your Link — Platform Guide */}
        {selectedPlatform && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
              <span className="text-xl">{platformInfo?.icon}</span>
              {t('campaigns.howToUseOn', { platform: platformInfo?.name })}
            </h3>
            {getPlatformGuide(selectedPlatform, t)}
          </div>
        )}

        {/* Saved Campaigns */}
        {savedCampaigns.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-6">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-4">
              {t('campaigns.savedCampaignLinks', { count: savedCampaigns.length })}
            </h2>
            <div className="space-y-3">
              {savedCampaigns.map(campaign => {
                const plat = PLATFORMS.find(p => p.code === campaign.platform);
                return (
                  <div
                    key={campaign.id}
                    className="flex items-center gap-4 p-4 rounded-lg border border-gray-200 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <span className="text-2xl">{plat?.icon || '🔗'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-white text-sm">{plat?.name}</span>
                        <code className="text-xs font-mono px-2 py-0.5 bg-gray-100 dark:bg-slate-800 rounded text-[#25D366]">
                          {campaign.code}
                        </code>
                      </div>
                      <p className="text-xs text-gray-400 truncate mt-0.5">{campaign.link}</p>
                    </div>
                    <button
                      onClick={() => copyToClipboard(campaign.link, campaign.id)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      {copied === campaign.id ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gray-400" />}
                    </button>
                    <button
                      onClick={() => deleteCampaign(campaign.id)}
                      className="p-2 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function getPlatformGuide(platform: string, t: (key: string) => string) {
  const guides: Record<string, { steps: string[]; tip: string }> = {
    SC: {
      steps: [
        'Open Snapchat Ads Manager → Create a new ad',
        'Set your objective (Traffic, Lead Generation, etc.)',
        'In the "Attachments" section, select "Web View" or "Deep Link"',
        'Paste your generated wa.me link as the URL',
        'The customer will tap "Swipe Up" → WhatsApp opens with your tracking code',
      ],
      tip: 'Snapchat\'s "Swipe Up" format works great with WhatsApp links. Use vertical video ads for best engagement.'
    },
    GG: {
      steps: [
        'Open Google Ads → Create a new campaign',
        'Choose your campaign type (Search, Display, Performance Max)',
        'In the ad setup, paste the wa.me link as the Final URL',
        'For Search Ads, add "Message us on WhatsApp" as a Call-to-Action extension',
        'Customer clicks your ad → WhatsApp opens with the tracking code',
      ],
      tip: 'For Google Search Ads, pair this with a landing page that has a WhatsApp chat widget for maximum lead capture.'
    },
    TT: {
      steps: [
        'Open TikTok Ads Manager → Create a new campaign',
        'Choose "Traffic" or "Lead Generation" as your objective',
        'In the ad setup, set "Destination Page" to "External Website"',
        'Paste the wa.me link as the URL',
        'The "Call to Action" button (e.g., "Contact Us") will open WhatsApp',
      ],
      tip: 'TikTok works best with short, authentic video content. Include a clear CTA like "Message us on WhatsApp for a special deal!"'
    },
    FB: {
      steps: [
        'Open Meta Ads Manager → Create a new campaign',
        'Choose "Messages" as your objective for best results',
        'Select "Click to WhatsApp" as the messaging app',
        'Note: Facebook Click-to-WhatsApp ads automatically include referral data — this link is a backup method',
        'Alternatively, use "Traffic" objective with the wa.me link as destination URL',
      ],
      tip: 'For Facebook, the native "Click to WhatsApp" ad format is recommended — Tawasel automatically detects the ad referral data without needing a campaign code.'
    },
    IG: {
      steps: [
        'Open Meta Ads Manager → Create a new campaign',
        'Choose "Messages" as objective, select Instagram as placement',
        'Select "Click to WhatsApp" as the messaging app',
        'Or use a "Traffic" campaign with the wa.me link in your Instagram bio/story link',
        'For organic posts, add the link to your Instagram bio using a link-in-bio tool',
      ],
      tip: 'Instagram Stories with "Swipe Up" or the link sticker are perfect for WhatsApp campaign links.'
    },
    TW: {
      steps: [
        'Open Twitter/X Ads → Create a new campaign',
        'Choose "Website Traffic" as your objective',
        'Create a tweet with the wa.me link',
        'Or add the link as a Website Card with CTA "Message Us"',
        'Customer clicks → WhatsApp opens with campaign code',
      ],
      tip: 'Pin a tweet with your WhatsApp link for ongoing organic lead capture.'
    },
    YT: {
      steps: [
        'Open Google Ads → Create a YouTube Video campaign',
        'In "Companion banner" or "Call to action", set your wa.me link',
        'Add the link in your video description as well',
        'Use YouTube End Screens to direct viewers to WhatsApp',
        'Or add the link as a pinned comment on your videos',
      ],
      tip: 'Mention the WhatsApp link verbally in your video: "Click the link in the description to message us directly!"'
    },
    LI: {
      steps: [
        'Open LinkedIn Campaign Manager → Create a new campaign',
        'Choose "Website Visits" or "Lead Generation" objective',
        'In the ad creative, paste the wa.me link as the destination URL',
        'Use a clear CTA like "Chat with us on WhatsApp"',
        'Great for B2B lead generation campaigns',
      ],
      tip: 'LinkedIn works best for B2B. Use Sponsored Content format and target by job title/industry for quality leads.'
    },
    EM: {
      steps: [
        'Create your email campaign in your email tool (Mailchimp, Resend, etc.)',
        'Add a CTA button with text like "Chat with us on WhatsApp"',
        'Paste the wa.me link as the button URL',
        'The tracking code will identify this lead came from your email campaign',
        'Works for newsletters, promotions, and follow-up sequences',
      ],
      tip: 'Use unique campaign codes for different email campaigns (e.g., EM-NEWSLETTER-MAR, EM-PROMO-SPRING) to track which emails drive the most WhatsApp conversations.'
    },
    WB: {
      steps: [
        'Add a WhatsApp chat button on your website',
        'Use the generated link as the button\'s URL',
        'Place it as a floating button, contact page link, or popup CTA',
        'Different pages can use different campaign codes (e.g., WB-HOMEPAGE, WB-PRICING)',
        'Track which pages drive the most WhatsApp conversations',
      ],
      tip: 'Create separate campaign links for different website pages to see which pages convert best (pricing page vs. homepage vs. product page).'
    },
    QR: {
      steps: [
        'Copy the generated link',
        'Go to any QR code generator (e.g., qr-code-generator.com)',
        'Paste the wa.me link to generate a QR code',
        'Print and place the QR code on flyers, posters, business cards, or storefronts',
        'Customers scan → WhatsApp opens with the campaign code',
      ],
      tip: 'QR codes are perfect for offline-to-online tracking. Use different codes for different locations (e.g., QR-STORE-DXB, QR-BOOTH-EXPO).'
    },
    RF: {
      steps: [
        'Share the generated link with your referral partners or affiliates',
        'Each partner can get their own unique campaign code (e.g., RF-AHMED, RF-PARTNER1)',
        'When their referred customer messages you, Tawasel tags the lead source',
        'Track which partners bring the most leads',
        'Great for referral programs, affiliate marketing, and influencer partnerships',
      ],
      tip: 'Give each influencer or referral partner their own unique code so you can track exactly who sent each lead and calculate commission/rewards.'
    },
  };

  const guide = guides[platform];
  if (!guide) return null;

  return (
    <div className="space-y-3">
      <ol className="space-y-2">
        {guide.steps.map((step, i) => (
          <li key={i} className="flex items-start gap-3 text-sm">
            <span className="w-6 h-6 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-gray-500 dark:text-gray-400 shrink-0 mt-0.5">
              {i + 1}
            </span>
            <span className="text-gray-700 dark:text-gray-300">{step}</span>
          </li>
        ))}
      </ol>
      <div className="flex items-start gap-2 mt-3 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-100 dark:border-amber-900/30">
        <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800 dark:text-amber-300"><span className="font-medium">{t('campaigns.proTip')}</span> {guide.tip}</p>
      </div>
    </div>
  );
}
