import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useApp } from '../contexts/AppContext';
import {
  Radio,
  Plus,
  Users,
  Image as ImageIcon,
  ArrowRight,
  MoreHorizontal,
  CheckCircle2,
  Clock,
  X
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { PipelineStage } from '../lib/pipelineStages';
import { useTranslation } from 'react-i18next';

interface ContactList {
  id: string;
  name: string;
  members: { contactId: string }[];
}

interface WhatsAppChannel {
  id: string;
  name: string;
  phoneNumber: string;
  status: string;
}

interface Contact {
  id: string;
  phoneNumber?: string | null;
  pipelineStage: string;
}

interface AudienceOption {
  id: string;
  label: string;
  count: number;
  type: 'LIST' | 'PIPELINE';
}

interface Campaign {
  id: string;
  name: string;
  status: string;
  scheduledAt?: string | null;
  templateId?: string | null;
  messageBody?: string | null;
  headerImageData?: string | null;
  deliveredCount: number;
  readCount: number;
  repliedCount: number;
  _count?: {
    recipients: number;
  };
  number?: {
    name: string;
    phoneNumber: string;
  } | null;
}

interface CampaignDetail extends Campaign {
  recipients: {
    id: string;
    phoneNumber: string;
    status: string;
  }[];
}

function CampaignPreviewCard({ campaign }: { campaign: Pick<Campaign, 'name' | 'messageBody' | 'headerImageData' | 'scheduledAt'> }) {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-sm rounded-[28px] bg-[#EDE7DF] p-4">
      <div className="overflow-hidden rounded-[22px] bg-white shadow-sm">
        {campaign.headerImageData ? (
          <img
            src={campaign.headerImageData}
            alt={`${campaign.name} preview`}
            className="h-64 w-full object-cover"
          />
        ) : (
          <div className="flex h-40 w-full items-center justify-center bg-gray-50 text-gray-300 dark:bg-slate-800 dark:text-gray-600">
            <ImageIcon className="h-8 w-8" />
          </div>
        )}
        <div className="px-4 py-3">
          <p className="text-sm text-gray-800 dark:text-gray-200">
            {campaign.messageBody?.trim() || t('broadcast.noMessageBody')}
          </p>
          <p className="mt-2 text-right text-[10px] text-gray-400 dark:text-gray-500">
            {campaign.scheduledAt ? format(new Date(campaign.scheduledAt), 'HH:mm') : t('broadcast.now')}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Broadcast() {
  const { activeWorkspace } = useApp();
  const { t } = useTranslation();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [contactLists, setContactLists] = useState<ContactList[]>([]);
  const [numbers, setNumbers] = useState<WhatsAppChannel[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignDetail | null>(null);
  const [previewCampaign, setPreviewCampaign] = useState<Campaign | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  useEffect(() => {
    if (activeWorkspace) {
      fetchCampaigns();
      fetchContactLists();
      fetchNumbers();
      fetchContacts();
      fetchPipelineStages();
    }
  }, [activeWorkspace]);

  useEffect(() => {
    if (!activeWorkspace) {
      return;
    }

    const intervalId = window.setInterval(() => {
      fetchCampaigns();

      if (selectedCampaign) {
        fetchCampaignDetails(selectedCampaign.id, false);
      }
    }, 8000);

    return () => window.clearInterval(intervalId);
  }, [activeWorkspace, selectedCampaign?.id]);

  const fetchCampaigns = async () => {
    try {
      const res = await axios.get(`/api/campaigns?workspaceId=${activeWorkspace?.id}`);
      setCampaigns(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchContactLists = async () => {
    try {
      const res = await axios.get(`/api/contact-lists?workspaceId=${activeWorkspace?.id}`);
      setContactLists(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchNumbers = async () => {
    try {
      const res = await axios.get(`/api/numbers?workspaceId=${activeWorkspace?.id}`);
      setNumbers(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchContacts = async () => {
    try {
      const res = await axios.get(`/api/contacts?workspaceId=${activeWorkspace?.id}`);
      setContacts(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchPipelineStages = async () => {
    try {
      const res = await axios.get(`/api/pipeline-stages?workspaceId=${activeWorkspace?.id}`);
      setPipelineStages(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchCampaignDetails = async (campaignId: string, showLoader = true) => {
    if (showLoader) {
      setIsLoadingDetails(true);
    }

    try {
      const res = await axios.get(`/api/campaigns/${campaignId}`);
      setSelectedCampaign(res.data);
    } catch (error) {
      if (showLoader && axios.isAxiosError(error)) {
        toast.error(error.response?.data?.error || t('broadcast.detailsError'));
      } else if (showLoader) {
        toast.error(t('broadcast.detailsError'));
      }
    } finally {
      if (showLoader) {
        setIsLoadingDetails(false);
      }
    }
  };

  const openCampaignDetails = async (campaignId: string) => {
    await fetchCampaignDetails(campaignId, true);
  };

  return (
    <div className="h-full bg-[#F8F9FA] dark:bg-slate-950 p-8 overflow-y-auto transition-colors">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{t('broadcast.title')}</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">{t('broadcast.subtitleAlt')}</p>
          </div>
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#25D366] text-white font-medium rounded-xl hover:bg-[#128C7E] transition-all shadow-sm"
          >
            <Plus className="w-5 h-5" />
            {t('broadcast.newBroadcast')}
          </button>
        </div>

        {isCreating ? (
          <BroadcastBuilder
            onCancel={() => setIsCreating(false)}
            onCreated={(campaign) => {
              setCampaigns((prev) => [campaign, ...prev]);
              setIsCreating(false);
            }}
            workspaceId={activeWorkspace?.id || ''}
            contactLists={contactLists}
            numbers={numbers}
            contacts={contacts}
            pipelineStages={pipelineStages}
          />
        ) : (
          campaigns.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#25D366]/10 text-[#25D366]">
                <Radio className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('broadcast.noCampaigns')}</h3>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                {t('broadcast.noCampaignsDescAlt')}
              </p>
            </div>
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {campaigns.map((campaign) => (
              <motion.div
                key={campaign.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={cn(
                    "p-2 rounded-xl",
                    campaign.status === 'COMPLETED' ? "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400" :
                    campaign.status === 'SCHEDULED' ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" : "bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-gray-400"
                  )}>
                    <Radio className="w-5 h-5" />
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreviewCampaign(campaign)}
                    className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    title={t('broadcast.previewBroadcast')}
                  >
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
                    {campaign.scheduledAt ? format(new Date(campaign.scheduledAt), 'MMM dd, yyyy') : t('broadcast.noDate')}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2 mb-4">
                  <div className="text-center p-2 bg-gray-50 dark:bg-slate-800 rounded-lg transition-colors">
                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase">{t('broadcast.recipients')}</p>
                    <p className="text-xs font-bold text-gray-900 dark:text-white">{campaign._count?.recipients || 0}</p>
                  </div>
                  <div className="text-center p-2 bg-gray-50 dark:bg-slate-800 rounded-lg transition-colors">
                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase">{t('broadcast.delivered')}</p>
                    <p className="text-xs font-bold text-gray-900 dark:text-white">{campaign.deliveredCount || 0}</p>
                  </div>
                  <div className="text-center p-2 bg-gray-50 dark:bg-slate-800 rounded-lg transition-colors">
                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase">{t('broadcast.read')}</p>
                    <p className="text-xs font-bold text-gray-900 dark:text-white">{campaign.readCount || 0}</p>
                  </div>
                  <div className="text-center p-2 bg-gray-50 dark:bg-slate-800 rounded-lg transition-colors">
                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase">{t('broadcast.replied')}</p>
                    <p className="text-xs font-bold text-gray-900 dark:text-white">{campaign.repliedCount || 0}</p>
                  </div>
                </div>
                {campaign.number && (
                  <div className="mb-4 rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-slate-800 dark:text-gray-300">
                    {campaign.number.name} ({campaign.number.phoneNumber})
                  </div>
                )}
                <div className="flex items-center justify-between pt-4 border-t border-gray-50 dark:border-slate-800 transition-colors">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{campaign._count?.recipients || 0} {t('broadcast.recipients').toLowerCase()}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => openCampaignDetails(campaign.id)}
                    disabled={isLoadingDetails}
                    className="text-xs font-bold text-[#25D366] flex items-center gap-1 group-hover:gap-2 transition-all disabled:opacity-50"
                  >
                    {t('broadcast.viewDetails')}
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
          )
        )}
      </div>

      {selectedCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between border-b border-gray-200 px-6 py-5 dark:border-slate-800">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{selectedCampaign.name}</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {selectedCampaign.number?.name} ({selectedCampaign.number?.phoneNumber})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCampaign(null)}
                className="rounded-xl p-2 text-gray-400 transition hover:bg-gray-50 hover:text-gray-600 dark:hover:bg-slate-800 dark:hover:text-gray-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-3 px-6 py-5">
              <div className="rounded-2xl bg-gray-50 p-4 dark:bg-slate-800">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">{t('broadcast.recipients')}</p>
                <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{selectedCampaign._count?.recipients || 0}</p>
              </div>
              <div className="rounded-2xl bg-gray-50 p-4 dark:bg-slate-800">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">{t('broadcast.delivered')}</p>
                <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{selectedCampaign.deliveredCount}</p>
              </div>
              <div className="rounded-2xl bg-gray-50 p-4 dark:bg-slate-800">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">{t('broadcast.read')}</p>
                <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{selectedCampaign.readCount}</p>
              </div>
              <div className="rounded-2xl bg-gray-50 p-4 dark:bg-slate-800">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">{t('broadcast.replied')}</p>
                <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{selectedCampaign.repliedCount}</p>
              </div>
            </div>

            <div className="border-t border-gray-200 px-6 py-5 dark:border-slate-800">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{t('broadcast.broadcastPreview')}</h4>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {selectedCampaign.scheduledAt ? format(new Date(selectedCampaign.scheduledAt), 'MMM dd, yyyy HH:mm') : t('broadcast.noDate')}
                </span>
              </div>
              <CampaignPreviewCard campaign={selectedCampaign} />
            </div>

            <div className="border-t border-gray-200 px-6 py-5 dark:border-slate-800">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{t('broadcast.recipients')}</h4>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {selectedCampaign.scheduledAt ? format(new Date(selectedCampaign.scheduledAt), 'MMM dd, yyyy HH:mm') : t('broadcast.noDate')}
                </span>
              </div>
              <div className="max-h-80 overflow-y-auto rounded-2xl border border-gray-200 dark:border-slate-800">
                {selectedCampaign.recipients.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    {t('broadcast.noRecipients')}
                  </div>
                ) : (
                  selectedCampaign.recipients.map((recipient) => (
                    <div
                      key={recipient.id}
                      className="flex items-center justify-between border-b border-gray-200 px-4 py-3 text-sm last:border-b-0 dark:border-slate-800"
                    >
                      <span className="font-medium text-gray-900 dark:text-white">{recipient.phoneNumber}</span>
                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-600 dark:bg-slate-800 dark:text-gray-300">
                        {recipient.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {previewCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between border-b border-gray-200 px-6 py-5 dark:border-slate-800">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{t('broadcast.broadcastPreview')}</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {previewCampaign.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewCampaign(null)}
                className="rounded-xl p-2 text-gray-400 transition hover:bg-gray-50 hover:text-gray-600 dark:hover:bg-slate-800 dark:hover:text-gray-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 py-6">
              <CampaignPreviewCard campaign={previewCampaign} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BroadcastBuilder({
  onCancel,
  onCreated,
  workspaceId,
  contactLists,
  numbers,
  contacts,
  pipelineStages,
}: {
  onCancel: () => void;
  onCreated: (campaign: Campaign) => void;
  workspaceId: string;
  contactLists: ContactList[];
  numbers: WhatsAppChannel[];
  contacts: Contact[];
  pipelineStages: PipelineStage[];
}) {
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [isLaunching, setIsLaunching] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [sendMode, setSendMode] = useState<'NOW' | 'SCHEDULE'>('NOW');
  const [campaignName, setCampaignName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [waTemplates, setWaTemplates] = useState<Array<{ id: string; name: string; content: string; category: string; language: string; status: string }>>([]);

  useEffect(() => {
    axios.get(`/api/templates/whatsapp?workspaceId=${workspaceId}`)
      .then(res => {
        const approved = (Array.isArray(res.data) ? res.data : []).filter((t: any) => t.status === 'APPROVED');
        setWaTemplates(approved);
        if (approved.length > 0 && !selectedTemplate) {
          setSelectedTemplate(approved[0].name);
        }
      })
      .catch(() => {});
  }, [workspaceId]);
  const [testPhoneNumber, setTestPhoneNumber] = useState('');
  const activeNumbers = numbers.filter((number) => number.status === 'CONNECTED');
  const phoneContacts = contacts.filter((contact) => Boolean(contact.phoneNumber));
  const pipelineOptions: AudienceOption[] = pipelineStages
    .map((stage) => ({
      id: stage.key,
      label: stage.name,
      count: phoneContacts.filter((contact) => contact.pipelineStage === stage.key).length,
      type: 'PIPELINE' as const,
    }))
    .filter((option) => option.count > 0);
  const customListOptions: AudienceOption[] = contactLists.map((list) => ({
    id: list.id,
    label: list.name,
    count: list.members.filter((member) => phoneContacts.some((contact) => contact.id === member.contactId)).length,
    type: 'LIST' as const,
  }));
  const audienceOptions = [...pipelineOptions, ...customListOptions];
  const [senderId, setSenderId] = useState('');
  const [audienceSelection, setAudienceSelection] = useState('');
  const [headerImage, setHeaderImage] = useState<File | null>(null);
  const [headerPreviewUrl, setHeaderPreviewUrl] = useState('');
  const [uploadError, setUploadError] = useState('');
  const headerImageInputRef = useRef<HTMLInputElement>(null);
  const selectedSender = activeNumbers.find((number) => number.id === senderId) || null;
  const selectedAudience = audienceSelection
    ? audienceOptions.find((option) => `${option.type}:${option.id}` === audienceSelection) || null
    : null;
  const totalRecipients = selectedAudience?.count || 0;
  const estimatedCredits = totalRecipients;
  const canContinueFromSetup = Boolean(campaignName.trim() && senderId && audienceSelection);
  const selectedTemplateObj = waTemplates.find(t => t.name === selectedTemplate);
  const previewMessage = selectedTemplateObj?.content || t('broadcast.selectTemplatePreview');
  const reviewItems = [
    { label: t('broadcast.campaignName'), value: campaignName.trim() || t('broadcast.notSet') },
    {
      label: t('broadcast.sender'),
      value: selectedSender ? `${selectedSender.name} (${selectedSender.phoneNumber})` : t('broadcast.noSenderSelected'),
    },
    {
      label: t('broadcast.audience'),
      value: selectedAudience
        ? `${selectedAudience.label} ${selectedAudience.type === 'PIPELINE' ? `(${t('broadcast.pipeline')})` : `(${t('broadcast.customList')})`}`
        : t('broadcast.noAudienceSelected'),
    },
  ];

  useEffect(() => {
    if (!senderId && activeNumbers[0]) {
      setSenderId(activeNumbers[0].id);
    }
  }, [senderId, activeNumbers]);

  useEffect(() => {
    return () => {
      if (headerPreviewUrl) {
        URL.revokeObjectURL(headerPreviewUrl);
      }
    };
  }, [headerPreviewUrl]);

  const handleHeaderImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError(t('broadcast.uploadImageError'));
      event.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError(t('broadcast.imageSizeError'));
      event.target.value = '';
      return;
    }

    if (headerPreviewUrl) {
      URL.revokeObjectURL(headerPreviewUrl);
    }

    setUploadError('');
    setHeaderImage(file);
    setHeaderPreviewUrl(URL.createObjectURL(file));
    event.target.value = '';
  };

  const handleLaunchCampaign = async () => {
    if (!workspaceId || !campaignName.trim() || !senderId || !selectedAudience) {
      toast.error(t('broadcast.setupError'));
      return;
    }

    const formData = new FormData();
    formData.append('workspaceId', workspaceId);
    formData.append('name', campaignName.trim());
    formData.append('numberId', senderId);
    formData.append('audienceType', selectedAudience.type);
    formData.append('audienceId', selectedAudience.id);
    formData.append('sendMode', sendMode);
    formData.append('templateId', selectedTemplate);
    formData.append('messageBody', previewMessage);
    if (headerImage) {
      formData.append('headerImage', headerImage, headerImage.name);
    }

    setIsLaunching(true);
    try {
      const response = await axios.post('/api/campaigns', formData, {
        headers: { 'x-workspace-id': workspaceId },
      });

      toast.success(sendMode === 'SCHEDULE' ? t('broadcast.campaignScheduled') : t('broadcast.campaignLaunched'));
      onCreated(response.data);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.error || t('broadcast.launchError'));
      } else {
        toast.error(t('broadcast.launchError'));
      }
    } finally {
      setIsLaunching(false);
    }
  };

  const handleSendTestMessage = async () => {
    if (!workspaceId || !campaignName.trim() || !senderId || !testPhoneNumber.trim()) {
      toast.error(t('broadcast.testSetupError'));
      return;
    }

    const formData = new FormData();
    formData.append('workspaceId', workspaceId);
    formData.append('name', campaignName.trim());
    formData.append('numberId', senderId);
    formData.append('phoneNumber', testPhoneNumber.trim());
    formData.append('messageBody', previewMessage);
    if (headerImage) {
      formData.append('headerImage', headerImage, headerImage.name);
    }

    setIsSendingTest(true);
    try {
      await axios.post('/api/campaigns/test', formData, {
        headers: { 'x-workspace-id': workspaceId },
      });
      toast.success(t('broadcast.testSent'));
    } catch (error) {
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.error || t('broadcast.testError'));
      } else {
        toast.error(t('broadcast.testError'));
      }
    } finally {
      setIsSendingTest(false);
    }
  };

  const canNavigateToStep = (targetStep: number) => {
    if (targetStep <= step) return true;
    if (targetStep === 2) return canContinueFromSetup;
    if (targetStep === 3) return canContinueFromSetup;
    return false;
  };

  const stepLabels: Record<number, string> = {
    1: t('broadcast.stepSetup'),
    2: t('broadcast.stepContent'),
    3: t('broadcast.stepReview'),
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 overflow-hidden transition-colors"
    >
      <div className="flex border-b border-gray-200 dark:border-slate-800">
        {[1, 2, 3].map((s) => (
          <button
            type="button"
            key={s}
            onClick={() => {
              if (canNavigateToStep(s)) {
                setStep(s);
              }
            }}
            disabled={!canNavigateToStep(s)}
            className={cn(
              "flex-1 py-4 text-center text-sm font-medium transition-colors relative disabled:cursor-not-allowed disabled:opacity-60",
              step === s ? "text-[#25D366]" : "text-gray-400 dark:text-gray-500",
              canNavigateToStep(s) ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800/40" : ""
            )}
          >
            {t('broadcast.step')} {s}: {stepLabels[s]}
            {step === s && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#25D366]" />}
          </button>
        ))}
      </div>

      <div className="p-8">
        {step === 1 && (
          <div className="space-y-6 max-w-xl mx-auto">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('broadcast.campaignName')}</label>
              <input
                type="text"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-[#25D366]/20 outline-none text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 transition-colors"
                placeholder={t('broadcast.campaignNamePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('broadcast.fromSender')}</label>
              <select
                value={senderId}
                onChange={(e) => setSenderId(e.target.value)}
                className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg outline-none text-gray-900 dark:text-white transition-colors"
              >
                {activeNumbers.length === 0 && <option value="">{t('broadcast.noActiveChannels')}</option>}
                {activeNumbers.map((number) => (
                  <option key={number.id} value={number.id}>
                    {number.name} ({number.phoneNumber})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {t('broadcast.senderHint')}
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('broadcast.toContactList')}</label>
              <select
                value={audienceSelection}
                onChange={(e) => setAudienceSelection(e.target.value)}
                className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg outline-none text-gray-900 dark:text-white transition-colors"
              >
                <option value="">{t('broadcast.selectSegment')}</option>
                {pipelineOptions.length > 0 && (
                  <optgroup label={t('broadcast.pipelineSegments')}>
                    {pipelineOptions.map((option) => (
                      <option key={`pipeline-${option.id}`} value={`PIPELINE:${option.id}`}>
                        {option.label} ({option.count})
                      </option>
                    ))}
                  </optgroup>
                )}
                {customListOptions.length > 0 && (
                  <optgroup label={t('broadcast.customLists')}>
                    {customListOptions.map((option) => (
                      <option key={`list-${option.id}`} value={`LIST:${option.id}`}>
                        {option.label} ({option.count})
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              {audienceOptions.length === 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-300">
                  {t('broadcast.audienceHint')}
                </p>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('broadcast.selectTemplate')}</label>
                <select
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg outline-none text-gray-900 dark:text-white transition-colors"
                >
                  {waTemplates.length === 0 && (
                    <option value="">{t('broadcast.noApprovedTemplates')}</option>
                  )}
                  {waTemplates.map(t_item => (
                    <option key={t_item.id} value={t_item.name}>
                      {t_item.name} ({t_item.language})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-3">
                <input
                  ref={headerImageInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  className="hidden"
                  onChange={handleHeaderImageChange}
                />
                <button
                  type="button"
                  onClick={() => headerImageInputRef.current?.click()}
                  className="w-full p-4 bg-gray-50 dark:bg-slate-800 rounded-xl border border-dashed border-gray-200 dark:border-slate-700 flex flex-col items-center justify-center text-center transition-colors hover:border-[#25D366] hover:bg-[#25D366]/5 dark:hover:bg-[#25D366]/10"
                >
                  <ImageIcon className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-2" />
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                    {headerImage ? t('broadcast.replaceHeaderImage') : t('broadcast.uploadHeaderImage')}
                  </p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">{t('broadcast.maxSize')}</p>
                </button>
                {headerImage && (
                  <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-300">
                    <span className="truncate">{headerImage.name}</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (headerPreviewUrl) {
                          URL.revokeObjectURL(headerPreviewUrl);
                        }
                        setHeaderImage(null);
                        setHeaderPreviewUrl('');
                        setUploadError('');
                      }}
                      className="font-semibold text-red-500 hover:text-red-600"
                    >
                      {t('broadcast.remove')}
                    </button>
                  </div>
                )}
                {uploadError && (
                  <p className="text-xs text-red-500">{uploadError}</p>
                )}
              </div>
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t('broadcast.variableMapping')}</h4>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono bg-gray-100 dark:bg-slate-800 px-2 py-1 rounded text-gray-600 dark:text-gray-400 transition-colors">{"{{1}}"}</span>
                  <select className="flex-1 text-xs px-3 py-1.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white transition-colors">
                    <option>{t('broadcast.contactName')}</option>
                    <option>{t('broadcast.companyName')}</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t('broadcast.messagePreview')}</h4>
              <div className="bg-[#E5DDD5] dark:bg-slate-800/50 p-4 rounded-2xl min-h-[300px] flex flex-col transition-colors">
                <div className="bg-white dark:bg-slate-900 p-3 rounded-xl rounded-tl-none shadow-sm max-w-[85%] transition-colors">
                  <div className="w-full aspect-video bg-gray-100 dark:bg-slate-800 rounded-lg mb-2 flex items-center justify-center overflow-hidden transition-colors">
                    {headerPreviewUrl ? (
                      <img
                        src={headerPreviewUrl}
                        alt={headerImage?.name || 'Broadcast header preview'}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-gray-300 dark:text-gray-600" />
                    )}
                  </div>
                  <p className="text-sm text-gray-800 dark:text-gray-200">
                    {previewMessage}
                  </p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 text-right mt-1">14:30</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-8 max-w-xl mx-auto">
            <div className="grid grid-cols-1 gap-3">
              {reviewItems.map((item) => (
                <div key={item.label} className="rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">{item.label}</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-xl transition-colors">
                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase mb-1">{t('broadcast.totalRecipients')}</p>
                <p className="text-xl font-semibold text-gray-900 dark:text-white">{totalRecipients.toLocaleString()}</p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-xl transition-colors">
                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase mb-1">{t('broadcast.estimatedCredits')}</p>
                <p className="text-xl font-semibold text-gray-900 dark:text-white">{estimatedCredits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('broadcast.scheduleOptions')}</h4>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setSendMode('NOW')}
                  className={cn(
                    "flex items-center gap-3 p-4 rounded-xl text-left transition-colors",
                    sendMode === 'NOW'
                      ? "border-2 border-[#25D366] bg-[#25D366]/5 dark:bg-[#25D366]/10"
                      : "border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800"
                  )}
                >
                  <CheckCircle2 className="w-5 h-5 text-[#25D366]" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{t('broadcast.sendNow')}</p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">{t('broadcast.sendImmediately')}</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setSendMode('SCHEDULE')}
                  className={cn(
                    "flex items-center gap-3 p-4 rounded-xl text-left transition-colors",
                    sendMode === 'SCHEDULE'
                      ? "border-2 border-[#25D366] bg-[#25D366]/5 dark:bg-[#25D366]/10"
                      : "border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800"
                  )}
                >
                  <Clock className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{t('broadcast.schedule')}</p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">{t('broadcast.pickDateTime')}</p>
                  </div>
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('broadcast.testMessage')}</h4>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
                <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
                  {t('broadcast.testMessageDesc')}
                </p>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    type="text"
                    value={testPhoneNumber}
                    onChange={(e) => setTestPhoneNumber(e.target.value)}
                    placeholder={t('broadcast.testPhonePlaceholder')}
                    className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-[#25D366]/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={handleSendTestMessage}
                    disabled={isSendingTest}
                    className="rounded-xl border border-[#25D366] px-4 py-2 text-sm font-semibold text-[#25D366] transition-colors hover:bg-[#25D366]/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSendingTest ? t('broadcast.sendingTest') : t('broadcast.sendTestMessage')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-12 flex items-center justify-between pt-6 border-t border-gray-200 dark:border-slate-800 transition-colors">
          <button
            onClick={step === 1 ? onCancel : () => setStep(step - 1)}
            className="px-6 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            {step === 1 ? t('broadcast.cancel') : t('broadcast.back')}
          </button>
          <button
            onClick={() => {
              if (step === 1 && !canContinueFromSetup) return;
              if (step < 3) {
                setStep(step + 1);
              } else {
                handleLaunchCampaign();
              }
            }}
            disabled={(step === 1 && !canContinueFromSetup) || isLaunching}
            className="px-8 py-2.5 bg-[#25D366] text-white font-semibold rounded-xl hover:bg-[#128C7E] transition-all shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            {step === 3 ? (isLaunching ? t('broadcast.launching') : t('broadcast.launchCampaign')) : t('broadcast.nextStep')}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
