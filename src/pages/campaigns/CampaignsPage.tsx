import { useEffect, useState, useMemo, useRef, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PlusIcon, MagnifyingGlassIcon, EnvelopeIcon, ChatBubbleLeftRightIcon,
  DevicePhoneMobileIcon, TableCellsIcon, Squares2X2Icon, ArrowPathIcon,
  EllipsisVerticalIcon, DocumentDuplicateIcon, PlayIcon, PauseIcon,
  XCircleIcon, XMarkIcon, ChevronLeftIcon, ChevronRightIcon,
  ArrowTopRightOnSquareIcon, SparklesIcon,
} from '@heroicons/react/24/outline';
import api from '../../services/api';
import { useAuthStore } from '../../stores/auth.store';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import Modal from '../../components/Modal';

interface Campaign {
  _id: string;
  name: string;
  type: string;
  status: string;
  channel: string;
  stats?: {
    total?: number;
    sent?: number;
    delivered?: number;
    opened?: number;
    clicked?: number;
    replied?: number;
    failed?: number;
  };
  schedule?: {
    startAt?: string;
    endAt?: string;
    timezone?: string;
  };
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; badge: string; dot: string }> = {
  running: {
    label: 'Running',
    badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60',
    dot: 'bg-emerald-500 animate-pulse',
  },
  completed: {
    label: 'Completed',
    badge: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60',
    dot: 'bg-blue-500',
  },
  scheduled: {
    label: 'Scheduled',
    badge: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400 border border-sky-200/60 dark:border-sky-800/60',
    dot: 'bg-sky-500',
  },
  paused: {
    label: 'Paused',
    badge: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60',
    dot: 'bg-amber-500',
  },
  draft: {
    label: 'Draft',
    badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300 border border-slate-200 dark:border-slate-700',
    dot: 'bg-slate-400',
  },
  cancelled: {
    label: 'Cancelled',
    badge: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/60',
    dot: 'bg-rose-500',
  },
  failed: {
    label: 'Failed',
    badge: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/60',
    dot: 'bg-rose-500',
  },
};

const CHANNEL_CONFIG: Record<string, { label: string; icon: typeof EnvelopeIcon; badge: string; color: string; dot: string }> = {
  email: {
    label: 'Email',
    icon: EnvelopeIcon,
    badge: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60',
    color: '#6366f1',
    dot: 'bg-indigo-500',
  },
  whatsapp: {
    label: 'WhatsApp',
    icon: ChatBubbleLeftRightIcon,
    badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60',
    color: '#10b981',
    dot: 'bg-emerald-500',
  },
  sms: {
    label: 'SMS',
    icon: DevicePhoneMobileIcon,
    badge: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60',
    color: '#f59e0b',
    dot: 'bg-amber-500',
  },
};

const TYPE_CONFIG: Record<string, { label: string; badge: string }> = {
  broadcast: {
    label: 'Broadcast',
    badge: 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 border border-purple-200/60 dark:border-purple-800/60',
  },
  drip: {
    label: 'Drip Sequence',
    badge: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60',
  },
  reengagement: {
    label: 'Re-engagement',
    badge: 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400 border border-orange-200/60 dark:border-orange-800/60',
  },
  followup: {
    label: 'Follow-up',
    badge: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-400 border border-cyan-200/60 dark:border-cyan-800/60',
  },
};

const EMPTY = { name: '', type: 'broadcast', channel: 'email' };

function CampaignRowActions({
  campaign,
  onRefresh,
}: {
  campaign: Campaign;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const doDuplicate = async () => {
    setOpen(false);
    try {
      await api.post(`/api/v1/campaigns/${campaign._id}/duplicate`);
      toast.success('Campaign duplicated');
      onRefresh();
    } catch {
      toast.error('Could not duplicate campaign');
    }
  };

  const doPauseResume = async () => {
    setOpen(false);
    try {
      if (campaign.status === 'running') {
        await api.post(`/api/v1/campaigns/${campaign._id}/pause`);
        toast.success('Campaign paused');
      } else if (campaign.status === 'paused') {
        await api.post(`/api/v1/campaigns/${campaign._id}/resume`);
        toast.success('Campaign resumed');
      }
      onRefresh();
    } catch {
      toast.error('Action failed');
    }
  };

  const doCancel = async () => {
    setOpen(false);
    try {
      await api.post(`/api/v1/campaigns/${campaign._id}/cancel`);
      toast.success('Campaign cancelled');
      onRefresh();
    } catch {
      toast.error('Could not cancel campaign');
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="p-1.5 text-text-muted hover:text-text-primary hover:bg-background rounded-lg transition-colors"
        title="More options"
      >
        <EllipsisVerticalIcon className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-44 bg-surface border border-border rounded-xl shadow-lg py-1 animate-in fade-in duration-100">
          <button
            onClick={() => { setOpen(false); navigate(`/campaigns/${campaign._id}`); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-text-primary hover:bg-background"
          >
            <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5 text-text-muted" /> View Details
          </button>
          <button
            onClick={doDuplicate}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-text-primary hover:bg-background"
          >
            <DocumentDuplicateIcon className="h-3.5 w-3.5 text-text-muted" /> Duplicate
          </button>
          {campaign.status === 'running' && (
            <button
              onClick={doPauseResume}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30"
            >
              <PauseIcon className="h-3.5 w-3.5" /> Pause Campaign
            </button>
          )}
          {campaign.status === 'paused' && (
            <button
              onClick={doPauseResume}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
            >
              <PlayIcon className="h-3.5 w-3.5" /> Resume Campaign
            </button>
          )}
          {['draft', 'scheduled', 'running', 'paused'].includes(campaign.status) && (
            <>
              <div className="border-t border-border my-1" />
              <button
                onClick={doCancel}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
              >
                <XCircleIcon className="h-3.5 w-3.5" /> Cancel Campaign
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function CampaignsPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  // Filters & View State
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const fetchCampaigns = async (silent = false) => {
    if (!user?.tenantId) return;
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const res = await api.get(`/api/v1/campaigns?tenantId=${user.tenantId}&limit=300`);
      const items = (res.data?.data ?? []) as Campaign[];
      setCampaigns(items);

      // Auto-seed starter demo campaigns on first visit if completely empty
      if (items.length === 0) {
        await api.post('/api/v1/campaigns/seed').catch(() => {});
        const refetchRes = await api.get(`/api/v1/campaigns?tenantId=${user.tenantId}&limit=300`).catch(() => null);
        if (refetchRes?.data?.data) {
          setCampaigns(refetchRes.data.data);
        }
      }
    } catch {
      // errors handled cleanly
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.tenantId]);

  const handleSeedManual = async () => {
    setIsRefreshing(true);
    try {
      await api.post('/api/v1/campaigns/seed');
      toast.success('Starter campaigns seeded successfully!');
      fetchCampaigns(true);
    } catch {
      toast.error('Failed to seed starter campaigns');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.post('/api/v1/campaigns', {
        name: form.name,
        type: form.type,
        channel: form.channel,
      });
      toast.success('Campaign created!');
      setShowModal(false);
      setForm(EMPTY);
      const created = res.data?.data;
      if (created?._id) navigate(`/campaigns/${created._id}`);
      else fetchCampaigns(true);
    } catch {
      toast.error('Failed to create campaign');
    } finally {
      setSaving(false);
    }
  };

  const f = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  // Filtered dataset
  const filtered = useMemo(() => {
    let res = campaigns;
    if (channelFilter) res = res.filter((c) => c.channel === channelFilter);
    if (typeFilter) res = res.filter((c) => c.type === typeFilter);
    if (statusFilter) res = res.filter((c) => c.status === statusFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      res = res.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        c.channel.toLowerCase().includes(q) ||
        c.type.toLowerCase().includes(q)
      );
    }
    return res;
  }, [campaigns, search, channelFilter, typeFilter, statusFilter]);

  // Pagination slice
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;

  // Counts for top KPI strip
  const counts = useMemo(() => {
    const total = campaigns.length;
    const email = campaigns.filter((c) => c.channel === 'email').length;
    const whatsapp = campaigns.filter((c) => c.channel === 'whatsapp').length;
    const sms = campaigns.filter((c) => c.channel === 'sms').length;
    const active = campaigns.filter((c) => c.status === 'running' || c.status === 'scheduled').length;
    return { total, email, whatsapp, sms, active };
  }, [campaigns]);

  return (
    <div className="space-y-6">
      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">Campaigns</h1>
          <p className="text-sm text-text-muted mt-0.5">
            Launch, monitor, and optimize cross-channel messaging campaigns across Email, WhatsApp, and SMS.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchCampaigns(true)}
            disabled={isRefreshing}
            className="p-2 border border-border rounded-xl text-text-muted hover:text-text-primary bg-surface hover:bg-background transition-colors"
            title="Refresh campaigns"
          >
            <ArrowPathIcon className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-ryze-600' : ''}`} />
          </button>
          <button
            className="btn-primary gap-2 shadow-sm"
            onClick={() => setShowModal(true)}
          >
            <PlusIcon className="h-4 w-4" /> New Campaign
          </button>
        </div>
      </div>

      {/* ── Top Metrics Strip (KPI Cards) ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Total Campaigns */}
        <div
          onClick={() => { setChannelFilter(''); setStatusFilter(''); setTypeFilter(''); }}
          className={`bg-surface border rounded-2xl p-4 transition-all cursor-pointer hover:shadow-sm ${
            !channelFilter && !statusFilter && !typeFilter
              ? 'border-ryze-500/80 ring-1 ring-ryze-500/20'
              : 'border-border hover:border-ryze-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span className="font-medium">Total Campaigns</span>
            <span className="h-2 w-2 rounded-full bg-ryze-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-text-primary">{counts.total}</span>
            <span className="text-[11px] text-text-muted">({counts.active} active)</span>
          </div>
        </div>

        {/* Email Campaigns */}
        <div
          onClick={() => setChannelFilter((p) => p === 'email' ? '' : 'email')}
          className={`bg-surface border rounded-2xl p-4 transition-all cursor-pointer hover:shadow-sm ${
            channelFilter === 'email'
              ? 'border-indigo-500/80 ring-1 ring-indigo-500/20'
              : 'border-border hover:border-indigo-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span className="font-medium">Email Campaigns</span>
            <EnvelopeIcon className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-text-primary">{counts.email}</span>
          </div>
        </div>

        {/* WhatsApp Campaigns */}
        <div
          onClick={() => setChannelFilter((p) => p === 'whatsapp' ? '' : 'whatsapp')}
          className={`bg-surface border rounded-2xl p-4 transition-all cursor-pointer hover:shadow-sm ${
            channelFilter === 'whatsapp'
              ? 'border-emerald-500/80 ring-1 ring-emerald-500/20'
              : 'border-border hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span className="font-medium">WhatsApp Campaigns</span>
            <ChatBubbleLeftRightIcon className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-text-primary">{counts.whatsapp}</span>
          </div>
        </div>

        {/* SMS Campaigns */}
        <div
          onClick={() => setChannelFilter((p) => p === 'sms' ? '' : 'sms')}
          className={`bg-surface border rounded-2xl p-4 transition-all cursor-pointer hover:shadow-sm ${
            channelFilter === 'sms'
              ? 'border-amber-500/80 ring-1 ring-amber-500/20'
              : 'border-border hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span className="font-medium">SMS Campaigns</span>
            <DevicePhoneMobileIcon className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-text-primary">{counts.sms}</span>
          </div>
        </div>
      </div>

      {/* ── Toolbar: Search, Filters & View Switcher ──────────────────────────── */}
      <div className="bg-surface border border-border rounded-2xl p-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-1 min-w-[280px]">
          {/* Search box */}
          <div className="relative flex-1 max-w-md">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
            <input
              type="text"
              className="w-full pl-9 pr-8 py-2 bg-background border border-border rounded-xl text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-ryze-500 focus:border-transparent transition-all"
              placeholder="Search campaigns by name, channel, or type…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-0.5"
              >
                <XMarkIcon className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Channel dropdown */}
          <select
            className="bg-background border border-border rounded-xl px-3 py-2 text-xs font-medium text-text-primary focus:outline-none focus:ring-2 focus:ring-ryze-500"
            value={channelFilter}
            onChange={(e) => { setChannelFilter(e.target.value); setPage(1); }}
          >
            <option value="">All Channels</option>
            <option value="email">Email</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="sms">SMS</option>
          </select>

          {/* Type dropdown */}
          <select
            className="bg-background border border-border rounded-xl px-3 py-2 text-xs font-medium text-text-primary focus:outline-none focus:ring-2 focus:ring-ryze-500"
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          >
            <option value="">All Types</option>
            {Object.entries(TYPE_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>

          {/* Status dropdown */}
          <select
            className="bg-background border border-border rounded-xl px-3 py-2 text-xs font-medium text-text-primary focus:outline-none focus:ring-2 focus:ring-ryze-500"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          >
            <option value="">All Statuses</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>

          {(search || channelFilter || typeFilter || statusFilter) && (
            <button
              onClick={() => { setSearch(''); setChannelFilter(''); setTypeFilter(''); setStatusFilter(''); }}
              className="text-xs text-ryze-600 dark:text-ryze-400 hover:underline px-2 py-1"
            >
              Reset filters
            </button>
          )}
        </div>

        {/* View Switcher Toggle (Table vs Cards) */}
        <div className="flex items-center border border-border rounded-xl p-0.5 bg-background shrink-0">
          <button
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              viewMode === 'table'
                ? 'bg-surface text-ryze-700 dark:text-ryze-300 shadow-xs border border-border'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <TableCellsIcon className="h-3.5 w-3.5" />
            <span>Table</span>
          </button>
          <button
            onClick={() => setViewMode('cards')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              viewMode === 'cards'
                ? 'bg-surface text-ryze-700 dark:text-ryze-300 shadow-xs border border-border'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <Squares2X2Icon className="h-3.5 w-3.5" />
            <span>Cards</span>
          </button>
        </div>
      </div>

      {/* ── Content View ─────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="bg-surface rounded-2xl border border-border p-8 space-y-4 animate-pulse">
          <div className="h-6 bg-black/[0.04] dark:bg-white/[0.06] rounded w-1/4" />
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-12 bg-black/[0.03] dark:bg-white/[0.04] rounded-xl" />
            ))}
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-border text-center py-16 px-4 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-ryze-500/10 text-ryze-600 flex items-center justify-center mx-auto mb-3">
            <EnvelopeIcon className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-text-primary">No campaigns found</h3>
          <p className="text-xs text-text-muted max-w-sm mx-auto mt-1 mb-5">
            {search || channelFilter || typeFilter || statusFilter
              ? 'No campaigns match your active search and filter criteria. Try resetting the filters.'
              : 'Get started by creating your first campaign or load realistic demo campaigns.'}
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              className="btn-primary gap-2"
              onClick={() => setShowModal(true)}
            >
              <PlusIcon className="h-4 w-4" /> New Campaign
            </button>
            <button
              className="btn-secondary gap-2"
              onClick={handleSeedManual}
            >
              <SparklesIcon className="h-4 w-4" /> Load Demo Campaigns
            </button>
          </div>
        </div>
      ) : viewMode === 'table' ? (
        /* ─── Table View ────────────────────────────────────────────────────── */
        <div className="bg-surface rounded-2xl border border-border shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background/60 text-left text-xs font-semibold text-text-muted">
                  <th className="px-4 py-3.5 w-12 text-center">S.No.</th>
                  <th className="px-4 py-3.5">Campaign Name & Type</th>
                  <th className="px-4 py-3.5">Channel</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Sent / Delivered</th>
                  <th className="px-4 py-3.5">Responses</th>
                  <th className="px-4 py-3.5">Created Date</th>
                  <th className="px-4 py-3.5 text-right w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedItems.map((c, idx) => {
                  const chConf = CHANNEL_CONFIG[c.channel] ?? CHANNEL_CONFIG.email;
                  const ChIcon = chConf.icon;
                  const stConf = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.draft;
                  const typeConf = TYPE_CONFIG[c.type] ?? TYPE_CONFIG.broadcast;
                  const sNo = (page - 1) * pageSize + idx + 1;

                  const sentCount = c.stats?.sent ?? 0;
                  const deliveredCount = c.stats?.delivered ?? 0;
                  const repliedCount = c.stats?.replied ?? 0;
                  const deliveryRate = sentCount > 0 ? Math.round((deliveredCount / sentCount) * 100) : 0;

                  return (
                    <tr
                      key={c._id}
                      className="hover:bg-background/40 transition-colors group cursor-pointer"
                      onClick={() => navigate(`/campaigns/${c._id}`)}
                    >
                      {/* S.No */}
                      <td className="px-4 py-3 text-center text-xs text-text-muted font-mono" onClick={(e) => e.stopPropagation()}>
                        {sNo}
                      </td>

                      {/* Name & Type */}
                      <td className="px-4 py-3 max-w-sm">
                        <div className="flex items-start gap-3">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-white mt-0.5"
                            style={{ backgroundColor: chConf.color }}
                          >
                            <ChIcon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-semibold text-text-primary group-hover:text-ryze-600 dark:group-hover:text-ryze-400 transition-colors truncate">
                              {c.name}
                            </h3>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium ${typeConf.badge}`}>
                                {typeConf.label}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Channel */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${chConf.badge}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${chConf.dot}`} />
                          {chConf.label}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${stConf.badge}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${stConf.dot}`} />
                          {stConf.label}
                        </span>
                      </td>

                      {/* Sent / Delivered */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="space-y-1">
                          <div className="flex items-baseline gap-1.5 text-xs">
                            <span className="font-semibold text-text-primary">{deliveredCount}</span>
                            <span className="text-text-muted">/ {sentCount} sent</span>
                            {sentCount > 0 && (
                              <span className="text-[10px] text-text-muted font-mono">({deliveryRate}%)</span>
                            )}
                          </div>
                          {sentCount > 0 && (
                            <div className="w-24 h-1.5 bg-background rounded-full overflow-hidden border border-border/80">
                              <div
                                className="h-full bg-ryze-500 rounded-full"
                                style={{ width: `${deliveryRate}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Responses */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-xs">
                          <span className="font-semibold text-text-primary">{repliedCount}</span>
                          <span className="text-text-muted ml-1">replies</span>
                        </div>
                      </td>

                      {/* Created Date */}
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-text-muted">
                        {format(new Date(c.createdAt), 'dd MMM yyyy')}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => navigate(`/campaigns/${c._id}`)}
                            className="p-1.5 rounded-lg text-text-muted hover:text-ryze-600 hover:bg-background transition-colors"
                            title="View details"
                          >
                            <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                          </button>
                          <CampaignRowActions
                            campaign={c}
                            onRefresh={() => fetchCampaigns(true)}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table pagination */}
          <div className="border-t border-border px-4 py-3 flex items-center justify-between bg-surface flex-wrap gap-2 text-xs text-text-muted">
            <div className="flex items-center gap-3">
              <span>
                Showing <strong className="text-text-primary">{(page - 1) * pageSize + 1}</strong>–<strong className="text-text-primary">{Math.min(page * pageSize, filtered.length)}</strong> of <strong className="text-text-primary">{filtered.length}</strong> campaigns
              </span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="bg-background border border-border rounded-lg px-2 py-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-ryze-500"
              >
                {[10, 20, 50].map((n) => (
                  <option key={n} value={n}>{n} per page</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-2.5 py-1 rounded-lg border border-border bg-surface hover:bg-background disabled:opacity-40 transition-colors flex items-center gap-1"
              >
                <ChevronLeftIcon className="h-3 w-3" /> Prev
              </button>
              <span className="px-2 font-mono">{page} / {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-2.5 py-1 rounded-lg border border-border bg-surface hover:bg-background disabled:opacity-40 transition-colors flex items-center gap-1"
              >
                Next <ChevronRightIcon className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ─── Cards View ────────────────────────────────────────────────────── */
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedItems.map((c) => {
              const chConf = CHANNEL_CONFIG[c.channel] ?? CHANNEL_CONFIG.email;
              const ChIcon = chConf.icon;
              const stConf = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.draft;
              const typeConf = TYPE_CONFIG[c.type] ?? TYPE_CONFIG.broadcast;

              const sentCount = c.stats?.sent ?? 0;
              const deliveredCount = c.stats?.delivered ?? 0;
              const repliedCount = c.stats?.replied ?? 0;
              const deliveryRate = sentCount > 0 ? Math.round((deliveredCount / sentCount) * 100) : 0;

              return (
                <div
                  key={c._id}
                  onClick={() => navigate(`/campaigns/${c._id}`)}
                  className="bg-surface border border-border hover:border-ryze-400 dark:hover:border-ryze-600 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
                >
                  <div>
                    {/* Top badges */}
                    <div className="flex items-center justify-between gap-2 mb-3.5">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${chConf.badge}`}>
                          <ChIcon className="h-3.5 w-3.5" />
                          {chConf.label}
                        </span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${typeConf.badge}`}>
                          {typeConf.label}
                        </span>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${stConf.badge}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${stConf.dot}`} />
                        {stConf.label}
                      </span>
                    </div>

                    {/* Campaign Title */}
                    <h3
                      className="font-semibold text-base text-text-primary group-hover:text-ryze-600 dark:group-hover:text-ryze-400 transition-colors truncate"
                      title={c.name}
                    >
                      {c.name}
                    </h3>

                    {/* Performance metrics box */}
                    <div className="mt-4 p-3 rounded-xl bg-background border border-border/80">
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="text-base font-bold text-text-primary">{sentCount}</p>
                          <p className="text-[10px] text-text-muted uppercase tracking-wider mt-0.5">Sent</p>
                        </div>
                        <div>
                          <p className="text-base font-bold text-text-primary">{deliveredCount}</p>
                          <p className="text-[10px] text-text-muted uppercase tracking-wider mt-0.5">Delivered</p>
                        </div>
                        <div>
                          <p className="text-base font-bold text-ryze-600 dark:text-ryze-400">{repliedCount}</p>
                          <p className="text-[10px] text-text-muted uppercase tracking-wider mt-0.5">Replies</p>
                        </div>
                      </div>

                      {sentCount > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-border/60">
                          <div className="flex items-center justify-between text-[11px] text-text-muted mb-1">
                            <span>Delivery Rate</span>
                            <span className="font-semibold text-text-primary">{deliveryRate}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-surface rounded-full overflow-hidden border border-border">
                            <div className="h-full bg-ryze-500 rounded-full" style={{ width: `${deliveryRate}%` }} />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="flex items-center justify-between border-t border-border pt-3.5 mt-4 text-xs text-text-muted">
                    <span>Created {format(new Date(c.createdAt), 'dd MMM yyyy')}</span>
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => navigate(`/campaigns/${c._id}`)}
                        className="p-1 rounded-lg text-text-muted hover:text-ryze-600 hover:bg-background transition-colors"
                        title="View Details"
                      >
                        <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                      </button>
                      <CampaignRowActions
                        campaign={c}
                        onRefresh={() => fetchCampaigns(true)}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Cards pagination */}
          <div className="border border-border rounded-xl px-4 py-3 flex items-center justify-between bg-surface flex-wrap gap-2 text-xs text-text-muted">
            <span>
              Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of {filtered.length} campaigns
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-2.5 py-1 rounded-lg border border-border bg-surface hover:bg-background disabled:opacity-40 transition-colors"
              >
                Prev
              </button>
              <span className="px-2 font-mono">{page} / {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-2.5 py-1 rounded-lg border border-border bg-surface hover:bg-background disabled:opacity-40 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── New Campaign Modal ───────────────────────────────────────────────── */}
      <Modal open={showModal} title="Create New Campaign" onClose={() => { setShowModal(false); setForm(EMPTY); }}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Channel selector segment buttons */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2 block">
              Communication Channel
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {(['email', 'whatsapp', 'sms'] as const).map((ch) => {
                const conf = CHANNEL_CONFIG[ch];
                const Icon = conf.icon;
                const isSelected = form.channel === ch;
                return (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, channel: ch }))}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-sm font-medium transition-all ${
                      isSelected
                        ? 'border-ryze-500 bg-ryze-500/10 text-ryze-700 dark:text-ryze-300 ring-2 ring-ryze-500/20 shadow-xs'
                        : 'border-border bg-surface text-text-muted hover:text-text-primary hover:bg-background'
                    }`}
                  >
                    <Icon className="h-4 w-4" style={{ color: isSelected ? conf.color : undefined }} />
                    <span>{conf.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="label">Campaign Name *</label>
            <input
              className="input text-sm"
              placeholder="e.g. June Product Launch Broadcast"
              value={form.name}
              onChange={f('name')}
              required
            />
          </div>

          <div>
            <label className="label">Campaign Type</label>
            <select className="input text-sm" value={form.type} onChange={f('type')}>
              <option value="broadcast">Broadcast — One-time message blast</option>
              <option value="drip">Drip Sequence — Timed automated sequence</option>
              <option value="reengagement">Re-engagement — Inactive customer recovery</option>
              <option value="followup">Follow-up — Post-interaction nurturing</option>
            </select>
          </div>

          <div className="bg-ryze-50 dark:bg-ryze-950/30 rounded-xl p-3.5 text-xs text-ryze-800 dark:text-ryze-300 border border-ryze-200/60 dark:border-ryze-800/60 leading-relaxed">
            ⓘ The campaign will be initialized in <strong>Draft</strong> mode. After creation, you can define audience filters, select or design message templates, and configure automated dispatch schedules.
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => { setShowModal(false); setForm(EMPTY); }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={saving}
            >
              {saving ? 'Creating…' : 'Create Campaign'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
