import { useState, Fragment } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon, PencilSquareIcon, PrinterIcon, ArrowDownTrayIcon,
  ArrowRightCircleIcon,
} from '@heroicons/react/24/outline';
import {
  useContractQuery,
  useVisitStatusUpdate,
  useGenerateWorkorders,
} from '../../../modules/native-crm/queries/contracts.queries';
import { useCustomersListQuery } from '../../../modules/native-crm/queries/customers.queries';
import { useFSSettingsQuery } from '../../../modules/native-crm/queries/fs-settings.queries';
import { buildPrefill } from '../../../modules/native-crm/shared/buildPrefill';
import { toDatetimeLocal } from '../../../modules/native-crm/shared/duration';
import { renderFieldValue } from '../../../modules/native-crm/shared/fieldValueRenderer';
import ShareMenuButton from '../../../modules/native-crm/shared/ShareMenuButton';
import FSShareModal from '../../../modules/native-crm/shared/FSShareModal';
import { canViewPII } from '../../../modules/native-crm/shared/piiAccess';
import ActivityFeedPanel from '../../../modules/native-crm/shared/ActivityFeedPanel';
import RecordTimeline from '../../../modules/native-crm/shared/RecordTimeline';
import { useAuthStore } from '../../../stores/auth.store';
import api from '../../../services/api';

const CUR: Record<string, string> = { AUD:'$',USD:'$',GBP:'£',EUR:'€',INR:'₹',CAD:'$',NZD:'$',SGD:'$' };
function fmt(n: number | undefined | null, cur = '$') {
  return `${cur}${n != null ? Number(n).toFixed(2) : '0.00'}`;
}
function fmtD(d: string | Date | undefined | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STATUS_COLORS: Record<string, string> = {
  draft:     'bg-black/[0.04] dark:bg-white/[0.06] text-text-muted',
  pending:   'bg-yellow-100 text-yellow-700',
  active:    'bg-green-100 text-green-700',
  suspended: 'bg-orange-100 text-orange-700',
  completed: 'bg-blue-100 text-blue-700',
  expired:   'bg-red-100 text-red-700',
  cancelled: 'bg-red-100 text-red-700',
};
const WF_COLORS: Record<string, string> = {
  pending:     'bg-yellow-50 text-yellow-700 ring-yellow-200',
  in_progress: 'bg-blue-50 text-blue-700 ring-blue-200',
  complete:    'bg-green-50 text-green-700 ring-green-200',
};
const STEP_LABELS: Record<string, string> = { workorder: 'Create Work Order', invoice: 'Create Invoice' };
const STEP_PATHS: Record<string, string>  = { workorder: '/native-crm/workorders', invoice: '/native-crm/invoices' };

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-border bg-black/[0.015] dark:bg-white/[0.02]">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">{title}</h3>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-border last:border-0">
      <span className="text-xs text-text-muted w-36 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-text-primary font-medium">{value ?? '—'}</span>
    </div>
  );
}

const VISIT_STATUS_COLORS: Record<string, string> = {
  planned:   'bg-yellow-100 text-yellow-700',
  scheduled: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-black/[0.04] dark:bg-white/[0.06] text-text-muted',
};

/** Fixed display order + labels for the frequency-wise schedule sections. */
const FREQ_ORDER = [
  'daily', 'weekly', 'fortnightly', 'monthly', 'bimonthly',
  'quarterly', 'halfyearly', 'yearly', 'custom_interval', 'custom_dates', 'once',
];
const FREQ_LABELS: Record<string, string> = {
  daily: 'Daily', weekly: 'Weekly', fortnightly: 'Fortnightly', monthly: 'Monthly',
  bimonthly: 'Bi-Monthly', quarterly: 'Quarterly', halfyearly: 'Half-Yearly',
  yearly: 'Yearly', custom_interval: 'Custom', custom_dates: 'Custom Dates', once: 'One-Time',
};

/** Contract master engine — schedule grouped frequency-wise with per-visit Work Order actions. */
function ScheduleSection({ item, navigate }: { item: any; navigate: (to: any, opts?: any) => void }) {
  const [pageData, setPageData] = useState<Record<string, number>>({});
  const [generating, setGenerating] = useState(false);
  const visitStatusMutation = useVisitStatusUpdate();
  const generateMutation    = useGenerateWorkorders();

  const visits: any[] = item.visits ?? [];
  const balance = item.serviceBalance;
  const ROWS_PER_SECTION = 10;
  const plannedCount = visits.filter((v) => v.status === 'planned').length;

  // Frequency of each visit-service: stored on the snapshot for new contracts;
  // older visits fall back to matching the contract line's rule by service name.
  const nameToFreq: Record<string, string> = {};
  (item.services ?? []).forEach((l: any) => {
    if (l?.name && l?.scheduleRule?.frequency) nameToFreq[l.name] = l.scheduleRule.frequency;
  });
  const freqOf = (s: any): string => s?.frequency ?? nameToFreq[s?.name] ?? '';

  // Group: a merged visit (e.g. Daily + Weekly on the same date) appears in BOTH sections
  const groups = FREQ_ORDER
    .map((freq) => ({
      freq,
      label: FREQ_LABELS[freq] ?? freq,
      rows: visits.filter((v) => (v.services ?? []).some((s: any) => freqOf(s) === freq)),
    }))
    .filter((g) => g.rows.length > 0);
  const ungrouped = visits.filter((v) => !(v.services ?? []).some((s: any) => FREQ_ORDER.includes(freqOf(s))));
  if (ungrouped.length) groups.push({ freq: 'other', label: 'Other', rows: ungrouped });

  if (!visits.length) return null;

  const setSectionPage = (freq: string, next: number) =>
    setPageData((prev) => ({ ...prev, [freq]: next }));

  const createWorkorderFor = (v: any) => {
    navigate('/native-crm/workorders', {
      state: {
        openDrawer: true,
        prefill: {
          customerId:          item.customerId,
          contractId:          item.contractId,
          contractVisitNumber: v.visitNumber,
          title:               `${item.title} — Visit ${v.visitNumber}`,
          services:            v.services ?? [],
          scheduledDate:       toDatetimeLocal(v.serviceDate),
          teamId:              item.teamId ?? '',
          staffIds:            item.staffIds?.length ? item.staffIds : (item.staffId ? [item.staffId] : []),
        },
      },
    });
  };

  const handleGenerateAll = async () => {
    setGenerating(true);
    try { await generateMutation.mutateAsync({ id: item._id }); }
    finally { setGenerating(false); }
  };

  return (
    <div className="space-y-5">
      {/* Balance card */}
      {balance && (
        <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-black/[0.015] dark:bg-white/[0.02] flex items-center justify-between">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Service Balance</h3>
            {item.serviceRangeSummary && (
              <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">{item.serviceRangeSummary}</span>
            )}
          </div>
          <div className="px-5 py-4 grid grid-cols-3 md:grid-cols-6 gap-3">
            {[
              ['Total Visits', balance.total,     'text-text-primary'],
              ['Completed',    balance.completed, 'text-green-600'],
              ['Upcoming',     balance.upcoming,  'text-blue-600'],
              ['Overdue',      balance.overdue,   'text-red-500'],
              ['Cancelled',    balance.cancelled, 'text-text-muted'],
              ['Remaining',    balance.remaining, 'text-ryze-600 dark:text-ryze-400'],
            ].map(([label, val, color]) => (
              <div key={String(label)} className="text-center bg-background rounded-lg py-2.5">
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wide">{label}</p>
                <p className={`text-xl font-bold mt-0.5 ${color}`}>{val as number}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Schedule table */}
      <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-black/[0.015] dark:bg-white/[0.02] flex items-center justify-between">
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            All Contract Services Details ({visits.length})
          </h3>
          {plannedCount > 0 && (
            <button
              onClick={handleGenerateAll}
              disabled={generating}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-60 transition-colors"
            >
              {generating ? 'Generating…' : `+ Generate All Work Orders (${plannedCount})`}
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-background text-text-muted text-xs uppercase">
                <th className="text-left py-2.5 px-4 font-semibold w-16">Visit</th>
                <th className="text-left py-2.5 px-4 font-semibold">Services</th>
                <th className="text-left py-2.5 px-4 font-semibold">Service Date</th>
                <th className="text-right py-2.5 px-4 font-semibold">Amount</th>
                <th className="text-left py-2.5 px-4 font-semibold">Status</th>
                <th className="text-right py-2.5 px-4 font-semibold w-56">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {groups.map((group) => {
                const sectionPage = pageData[group.freq] ?? 1;
                const sectionPages = Math.max(1, Math.ceil(group.rows.length / ROWS_PER_SECTION));
                const rows = group.rows.slice((sectionPage - 1) * ROWS_PER_SECTION, sectionPage * ROWS_PER_SECTION);
                return (
                  <Fragment key={group.freq}>
                    {/* Section header — one per frequency, like "Daily Services (7)" */}
                    <tr className="bg-purple-50">
                      <td colSpan={6} className="py-2.5 px-4 text-left">
                        <span className="text-sm font-semibold text-purple-600">
                          {group.label} Services ({group.rows.length})
                        </span>
                      </td>
                    </tr>

                    {rows.map((v: any) => (
                      <tr key={`${group.freq}-${v.visitNumber}`} className="hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors">
                        <td className="py-2.5 px-4 text-text-muted font-mono text-xs">{v.visitNumber}</td>
                        <td className="py-2.5 px-4 text-text-primary">
                          {[...new Set((v.services ?? []).map((s: any) => s.name))].join(', ') || '—'}
                          {(v.services ?? []).length > 1 && (
                            <span className="ml-1.5 text-[10px] font-medium text-purple-500 bg-purple-50 px-1.5 py-0.5 rounded-full">merged day</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-text-muted whitespace-nowrap">{fmtD(v.serviceDate)}</td>
                        <td className="py-2.5 px-4 text-right text-text-primary">{Number(v.amount ?? 0).toFixed(2)}</td>
                        <td className="py-2.5 px-4">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${VISIT_STATUS_COLORS[v.status] ?? 'bg-black/[0.04] dark:bg-white/[0.06] text-text-muted'}`}>
                            {v.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="flex items-center justify-end gap-1.5">
                            {v.status === 'planned' && (
                              <>
                                <button
                                  onClick={() => createWorkorderFor(v)}
                                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-ryze-600 text-white hover:bg-ryze-700 transition-colors"
                                >
                                  Work Order
                                </button>
                                <button
                                  onClick={() => visitStatusMutation.mutate({ id: item._id, visitNumber: v.visitNumber, status: 'cancelled' })}
                                  title="Cancel this visit"
                                  className="px-2 py-1 rounded-lg text-xs font-medium text-text-muted hover:text-red-600 hover:bg-red-50 transition-colors"
                                >
                                  ✕
                                </button>
                              </>
                            )}
                            {(v.status === 'scheduled' || v.status === 'completed') && (
                              v.woId ? (
                                <button
                                  onClick={() => navigate(`/native-crm/workorders/${v.woId}`)}
                                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                                >
                                  View WorkOrder{v.workOrderId ? ` (${v.workOrderId})` : ''}
                                </button>
                              ) : (
                                <span className="text-xs text-text-muted">WO created</span>
                              )
                            )}
                            {v.status === 'cancelled' && (
                              <button
                                onClick={() => visitStatusMutation.mutate({ id: item._id, visitNumber: v.visitNumber, status: 'planned' })}
                                className="px-2.5 py-1 rounded-lg text-xs font-medium text-text-muted border border-border hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
                              >
                                Restore
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}

                    {/* Per-section pagination */}
                    {sectionPages > 1 && (
                      <tr>
                        <td colSpan={6} className="py-2.5 px-4">
                          <div className="flex items-center justify-center gap-3">
                            <button
                              onClick={() => setSectionPage(group.freq, Math.max(1, sectionPage - 1))}
                              disabled={sectionPage <= 1}
                              className="px-3 py-1 text-xs font-medium rounded-lg border border-border text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06] disabled:opacity-40"
                            >
                              Prev
                            </button>
                            <span className="text-xs text-text-muted">
                              Page {sectionPage} of {sectionPages} · {group.rows.length} {group.label.toLowerCase()} visits
                            </span>
                            <button
                              onClick={() => setSectionPage(group.freq, Math.min(sectionPages, sectionPage + 1))}
                              disabled={sectionPage >= sectionPages}
                              className="px-3 py-1 text-xs font-medium rounded-lg border border-border text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06] disabled:opacity-40"
                            >
                              Next
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function ContractViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareModalTab, setShareModalTab] = useState<'email' | 'whatsapp' | null>(null);

  const { data: item, isLoading } = useContractQuery(id ?? '');
  const { data: settings } = useFSSettingsQuery();
  const { data: custList } = useCustomersListQuery({ page: 1, limit: 500 });
  const user = useAuthStore((s) => s.user);
  const canShareContact = canViewPII('customers', settings, user?.role);

  const customer = custList?.items?.find((c: any) => c.customerId === item?.customerId) ?? null;
  const cur = CUR[settings?.currency ?? 'AUD'] ?? '$';

  const svcSubtotal = (item?.services ?? []).reduce((s: number, sv: any) => s + (sv.amount ?? 0) * (sv.count ?? 1), 0);
  const prtSubtotal = (item?.parts ?? []).reduce((s: number, pt: any) => s + (pt.amount ?? 0) * (pt.count ?? 1), 0);
  const combined = svcSubtotal + prtSubtotal;
  const discount = item?.discount ?? 0;
  const gst = item?.gstPercentage ?? 0;
  const afterDiscount = combined - discount;
  const total = afterDiscount * (1 + gst / 100);

  const steps: string[] = settings?.workflowSteps ?? ['quotation', 'workorder', 'invoice'];
  const idx = steps.indexOf('contract');
  const nextStep = idx >= 0 && idx < steps.length - 1 ? steps[idx + 1] : null;

  const handleShare = async () => {
    if (!item) return;
    setSharing(true);
    try {
      const res = await api.post('/api/v1/portal/generate-token', { docType: 'contract', docId: item._id });
      const token = res.data?.data?.token;
      if (token) {
        await navigator.clipboard.writeText(`${window.location.origin}/portal/${token}`);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2500);
      }
    } catch { } finally { setSharing(false); }
  };

  const handleDownload = async () => {
    if (!id) return;
    setDownloading(true);
    try {
      const res = await api.get(`/api/v1/native-crm/pdf/contracts/${id}?template=classic`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url; a.download = `contract-${item?.contractId ?? id}.pdf`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch { } finally { setDownloading(false); }
  };

  if (isLoading) return (
    <div className="flex items-center justify-center h-full">
      <div className="flex gap-2">{[0,1,2].map(i => <span key={i} className="h-2.5 w-2.5 rounded-full bg-ryze-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}</div>
    </div>
  );
  if (!item) return <div className="flex items-center justify-center h-full text-text-muted">Contract not found.</div>;

  const custAddr    = [customer?.address, customer?.city, customer?.state, customer?.postcode, customer?.country].filter(Boolean).join(', ');
  const companyAddr = [settings?.address1, settings?.address2, settings?.city, settings?.state, settings?.postalCode, settings?.country].filter(Boolean).join(', ');
  const customFields = Object.entries(item.customFields ?? {}).filter(([, v]) => v !== null && v !== undefined && v !== '');

  const recurringLabel = item.recurringUnit
    ? item.recurringUnit === 'custom' && item.recurringInterval
      ? `Every ${item.recurringInterval} days`
      : item.recurringUnit.charAt(0).toUpperCase() + item.recurringUnit.slice(1)
    : null;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Toolbar */}
      <div className="bg-surface border-b border-border px-6 py-3 flex items-center gap-3 flex-wrap shrink-0">
        <button onClick={() => navigate('/native-crm/contracts')}
          className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors mr-2">
          <ArrowLeftIcon className="h-4 w-4" /> Contracts
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-sm font-semibold text-text-primary">{item.contractId}</span>
          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_COLORS[item.status] ?? 'bg-black/[0.04] dark:bg-white/[0.06] text-text-muted'}`}>
            {item.status}
          </span>
          {item.workflowState && (
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ring-1 capitalize ${WF_COLORS[item.workflowState] ?? ''}`}>
              {item.workflowState.replace('_',' ')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {nextStep && STEP_PATHS[nextStep] && (
            <button
              onClick={() => navigate(STEP_PATHS[nextStep], { state: { openDrawer: true, prefill: buildPrefill(item, 'contract', nextStep as any) } })}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-ryze-600 text-white text-xs font-medium rounded-lg hover:bg-ryze-700">
              <ArrowRightCircleIcon className="h-4 w-4" />{STEP_LABELS[nextStep]}
            </button>
          )}
          <button onClick={() => navigate('/native-crm/contracts', { state: { openDrawer: true, prefill: item } })}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border text-text-primary text-xs font-medium rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.06]">
            <PencilSquareIcon className="h-4 w-4" />Edit
          </button>
          <ShareMenuButton
            copying={sharing}
            copyLabel={shareCopied ? 'Copied!' : sharing ? 'Generating…' : 'Copy Link'}
            onCopyLink={handleShare}
            onEmail={() => setShareModalTab('email')}
            onWhatsApp={() => setShareModalTab('whatsapp')}
            showContactShare={canShareContact}
          />
          <button onClick={handleDownload} disabled={downloading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border text-text-primary text-xs font-medium rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.06] disabled:opacity-60">
            <ArrowDownTrayIcon className="h-4 w-4" />{downloading ? 'Generating…' : 'Download PDF'}
          </button>
          <button onClick={() => navigate(`/native-crm/contracts/${id}/print`)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-ryze-600 text-white text-xs font-medium rounded-lg hover:bg-ryze-700">
            <PrinterIcon className="h-4 w-4" />Print PDF
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Company Header Card */}
        <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-5">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-5">
              <div className="flex items-start gap-4">
                {settings?.companyLogo && (
                  <img src={settings.companyLogo} alt="logo" className="h-16 w-auto max-w-[120px] object-contain rounded shrink-0" />
                )}
                <div className="space-y-0.5">
                  {settings?.companyName && <p className="text-sm font-bold text-text-primary">{settings.companyName}</p>}
                  {companyAddr && <p className="text-xs text-text-muted">{companyAddr}</p>}
                  {settings?.gstin && <p className="text-xs text-text-muted">GSTIN: {settings.gstin}</p>}
                  {settings?.pan && <p className="text-xs text-text-muted">PAN: {settings.pan}</p>}
                  {settings?.regNumber && <p className="text-xs text-text-muted">Reg: {settings.regNumber}</p>}
                  {settings?.email && <p className="text-xs text-text-muted">{settings.email}</p>}
                  {settings?.phone && <p className="text-xs text-text-muted">{settings.phone}</p>}
                  {settings?.whatsapp && <p className="text-xs text-text-muted">WA: {settings.whatsapp}</p>}
                  {settings?.website && <p className="text-xs text-text-muted">{settings.website}</p>}
                  {settings?.branch && <p className="text-xs text-text-muted">Branch: {settings.branch}</p>}
                </div>
              </div>
              <div className="md:text-right shrink-0">
                <p className="text-2xl font-extrabold text-text-primary tracking-widest">CONTRACT</p>
                <p className="text-sm font-semibold text-text-muted mt-1">{item.contractId}</p>
                {item.title && <p className="text-xs text-text-muted mt-0.5">{item.title}</p>}
                <p className="text-xs text-text-muted mt-0.5">Start: {fmtD(item.startDate)}</p>
                <p className="text-xs text-text-muted">End: {fmtD(item.endDate)}</p>
                <div className="mt-2 flex md:justify-end flex-wrap gap-1.5">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_COLORS[item.status] ?? 'bg-black/[0.04] dark:bg-white/[0.06] text-text-muted'}`}>{item.status}</span>
                  {item.workflowState && (
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ring-1 capitalize ${WF_COLORS[item.workflowState] ?? ''}`}>
                      {item.workflowState.replace('_', ' ')}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <hr className="my-4 border-border" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1.5">Bill To</p>
                <p className="text-sm font-semibold text-text-primary">{customer?.name ?? item.customerId}</p>
                {customer?.email && <p className="text-xs text-text-muted">{customer.email}</p>}
                {customer?.phone && <p className="text-xs text-text-muted">{customer.phone}</p>}
                {custAddr && <p className="text-xs text-text-muted">{custAddr}</p>}
                {customer?.gstin && <p className="text-xs text-text-muted">GSTIN: {customer.gstin}</p>}
              </div>
              <div>
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1.5">Contract Info</p>
                {item.contractType && <p className="text-xs text-text-primary"><span className="text-text-muted">Type: </span><span className="uppercase font-medium">{item.contractType}</span></p>}
                {item.priority && <p className="text-xs text-text-primary mt-0.5"><span className="text-text-muted">Priority: </span><span className="capitalize">{item.priority}</span></p>}
                {item.renewalType && <p className="text-xs text-text-primary mt-0.5"><span className="text-text-muted">Renewal: </span><span className="capitalize">{item.renewalType}</span>{item.renewBeforeDays ? ` (${item.renewBeforeDays} days before)` : ''}</p>}
                {item.woGenerationMode && item.woGenerationMode !== 'manual' && (
                  <p className="text-xs text-text-primary mt-0.5"><span className="text-text-muted">WO Generation: </span>
                    {item.woGenerationMode === 'on_visit_day' ? 'Auto — on visit day' : `Auto — ${item.woLeadDays ?? 0} days before`}</p>
                )}
                {item.quotationId && <p className="text-xs text-text-primary mt-0.5"><span className="text-text-muted">Quotation: </span>{item.quotationId}</p>}
                {item.teamId && <p className="text-xs text-text-primary mt-0.5"><span className="text-text-muted">Team: </span>{item.teamId}</p>}
                {(item.staffIds?.length || item.staffId) && (
                  <p className="text-xs text-text-primary mt-0.5"><span className="text-text-muted">Staff: </span>
                    {item.staffIds?.length ? item.staffIds.join(', ') : item.staffId}</p>
                )}
                {recurringLabel && (
                  <p className="text-xs text-text-primary mt-0.5">
                    <span className="text-text-muted">Recurrence: </span>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700">
                      {recurringLabel}
                    </span>
                  </p>
                )}
                {item.nextServiceDate && <p className="text-xs text-text-primary mt-0.5"><span className="text-text-muted">Next Service: </span>{fmtD(item.nextServiceDate)}</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Services */}
        <Card title={`Services (${(item.services ?? []).length})`}>
          {(item.services ?? []).length === 0 ? (
            <p className="text-sm text-text-muted">No services added.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-background text-text-muted text-xs uppercase">
                    <th className="text-left py-2 px-3 font-semibold">#</th>
                    <th className="text-left py-2 px-3 font-semibold">Description</th>
                    <th className="text-right py-2 px-3 font-semibold">Qty</th>
                    <th className="text-right py-2 px-3 font-semibold">Unit Price</th>
                    <th className="text-right py-2 px-3 font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(item.services ?? []).map((s: any, i: number) => (
                    <tr key={i} className="border-t border-border">
                      <td className="py-2 px-3 text-text-muted">{i + 1}</td>
                      <td className="py-2 px-3">
                        <p className="font-medium text-text-primary">{s.name}</p>
                        {s.description && <p className="text-xs text-text-muted mt-0.5">{s.description}</p>}
                      </td>
                      <td className="py-2 px-3 text-right">{s.count ?? 1}</td>
                      <td className="py-2 px-3 text-right">{fmt(s.amount, cur)}</td>
                      <td className="py-2 px-3 text-right font-semibold">{fmt((s.amount ?? 0) * (s.count ?? 1), cur)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Contract Schedule — generated visits + per-visit Work Order actions */}
        <ScheduleSection item={item} navigate={navigate} />

        {/* Parts */}
        {(item.parts ?? []).length > 0 && (
          <Card title={`Parts / Materials (${(item.parts ?? []).length})`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-background text-text-muted text-xs uppercase">
                    <th className="text-left py-2 px-3 font-semibold">#</th>
                    <th className="text-left py-2 px-3 font-semibold">Part Name</th>
                    <th className="text-left py-2 px-3 font-semibold">Part No.</th>
                    <th className="text-right py-2 px-3 font-semibold">Qty</th>
                    <th className="text-right py-2 px-3 font-semibold">Unit Price</th>
                    <th className="text-right py-2 px-3 font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(item.parts ?? []).map((p: any, i: number) => (
                    <tr key={i} className="border-t border-border">
                      <td className="py-2 px-3 text-text-muted">{i + 1}</td>
                      <td className="py-2 px-3">
                        <p className="font-medium text-text-primary">{p.name}</p>
                        {p.description && <p className="text-xs text-text-muted mt-0.5">{p.description}</p>}
                      </td>
                      <td className="py-2 px-3 text-text-muted">{p.partNumber ?? '—'}</td>
                      <td className="py-2 px-3 text-right">{p.count ?? 1}</td>
                      <td className="py-2 px-3 text-right">{fmt(p.amount, cur)}</td>
                      <td className="py-2 px-3 text-right font-semibold">{fmt((p.amount ?? 0) * (p.count ?? 1), cur)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Financial summary */}
        <Card title="Financial Summary">
          <div className="flex justify-end">
            <div className="w-64 space-y-2 text-sm">
              {prtSubtotal > 0 && (
                <>
                  <div className="flex justify-between text-text-muted"><span>Services Subtotal</span><span>{fmt(svcSubtotal, cur)}</span></div>
                  <div className="flex justify-between text-text-muted"><span>Parts Subtotal</span><span>{fmt(prtSubtotal, cur)}</span></div>
                </>
              )}
              <div className="flex justify-between text-text-muted"><span>Subtotal</span><span>{fmt(combined, cur)}</span></div>
              {discount > 0 && <div className="flex justify-between text-red-500"><span>Discount</span><span>-{fmt(discount, cur)}</span></div>}
              {gst > 0 && <div className="flex justify-between text-text-muted"><span>GST ({gst}%)</span><span>{fmt(total - afterDiscount, cur)}</span></div>}
              <div className="flex justify-between font-bold text-base border-t-2 border-border pt-2 text-text-primary">
                <span>Total</span><span>{fmt(total, cur)}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Notes */}
        {item.notes && (
          <Card title="Notes">
            <div className="prose prose-sm max-w-none text-text-muted [&_ul]:list-disc [&_ol]:list-decimal [&_ul,&_ol]:pl-4 [&_p]:my-1"
              dangerouslySetInnerHTML={{ __html: item.notes }} />
          </Card>
        )}

        {/* Terms */}
        {item.termsAndConditions && (
          <Card title="Terms & Conditions">
            <div className="prose prose-sm max-w-none text-text-muted [&_ul]:list-disc [&_ol]:list-decimal [&_ul,&_ol]:pl-4 [&_p]:my-1"
              dangerouslySetInnerHTML={{ __html: item.termsAndConditions }} />
          </Card>
        )}

        {/* Custom Fields */}
        {customFields.length > 0 && (
          <Card title="Custom Fields">
            {customFields.map(([k, v]) => (
              <div key={k}>
                {v !== null && typeof v === 'object' && !Array.isArray(v) ? (
                  <div className="py-1.5 border-b border-border last:border-0">
                    <p className="text-xs text-text-muted mb-1.5">{k}</p>
                    <div className="pl-3 space-y-1 border-l-2 border-purple-100">
                      {Object.entries(v as Record<string, any>).map(([sk, sv]) => (
                        <div key={sk} className="flex items-start gap-2">
                          <span className="text-xs text-text-muted w-32 shrink-0">{sk}</span>
                          <span className="text-xs text-text-primary font-medium">{renderFieldValue(sv)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <InfoRow label={k} value={renderFieldValue(v)} />
                )}
              </div>
            ))}
          </Card>
        )}

        <ActivityFeedPanel
          relatedModule="contract"
          relatedId={item._id}
          relatedLabel={item.contractId}
        />

        <div className="mt-6">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Activity Timeline</p>
          <RecordTimeline entityModule="contract" entityId={item._id} />
        </div>
      </div>

      {shareModalTab && (
        <FSShareModal
          module="contracts"
          docId={id ?? ''}
          docLabel={item.contractId}
          customer={customer}
          initialTab={shareModalTab}
          onClose={() => setShareModalTab(null)}
        />
      )}
    </div>
  );
}
