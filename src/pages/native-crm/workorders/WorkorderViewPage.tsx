import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon, PencilSquareIcon, PrinterIcon, ArrowDownTrayIcon,
  ArrowRightCircleIcon, CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { useWorkorderQuery } from '../../../modules/native-crm/queries/workorders.queries';
import { useCustomersListQuery } from '../../../modules/native-crm/queries/customers.queries';
import { useFSSettingsQuery } from '../../../modules/native-crm/queries/fs-settings.queries';
import { useSitesListQuery } from '../../../modules/native-crm/queries/sites.queries';
import { useTeamsListQuery } from '../../../modules/native-crm/queries/teams.queries';
import { useStaffsListQuery } from '../../../modules/native-crm/queries/staffs.queries';
import { buildPrefill } from '../../../modules/native-crm/shared/buildPrefill';
import { renderFieldValue } from '../../../modules/native-crm/shared/fieldValueRenderer';
import ShareMenuButton from '../../../modules/native-crm/shared/ShareMenuButton';
import FSShareModal from '../../../modules/native-crm/shared/FSShareModal';
import { canViewPII } from '../../../modules/native-crm/shared/piiAccess';
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
  draft:       'bg-gray-100 text-gray-600',
  scheduled:   'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  completed:   'bg-green-100 text-green-700',
  cancelled:   'bg-red-100 text-red-700',
};
const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-green-50 text-green-700', medium: 'bg-amber-50 text-amber-700', high: 'bg-red-50 text-red-700',
};
const WF_COLORS: Record<string, string> = {
  pending:     'bg-yellow-50 text-yellow-700 ring-yellow-200',
  in_progress: 'bg-blue-50 text-blue-700 ring-blue-200',
  complete:    'bg-green-50 text-green-700 ring-green-200',
};
const STEP_LABELS: Record<string, string> = { contract: 'Create Contract', workorder: 'Create Work Order', invoice: 'Create Invoice' };
const STEP_PATHS: Record<string, string>  = { contract: '/native-crm/contracts', workorder: '/native-crm/workorders', invoice: '/native-crm/invoices' };

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</h3>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 w-36 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-800 font-medium">{value ?? '—'}</span>
    </div>
  );
}

export default function WorkorderViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareModalTab, setShareModalTab] = useState<'email' | 'whatsapp' | null>(null);

  const { data: item, isLoading } = useWorkorderQuery(id ?? '');
  const { data: settings } = useFSSettingsQuery();
  const { data: custList } = useCustomersListQuery({ page: 1, limit: 500 });
  const user = useAuthStore((s) => s.user);
  const canShareContact = canViewPII('customers', settings, user?.role);
  const { data: siteList } = useSitesListQuery({ limit: 500 });
  const { data: teamList } = useTeamsListQuery({ limit: 500 });
  const { data: staffList } = useStaffsListQuery({ limit: 500 });

  const customer = custList?.items?.find((c: any) => c.customerId === item?.customerId || c._id === item?.customerId) ?? null;
  const site = siteList?.items?.find((s: any) => s.siteId === item?.siteId || s._id === item?.siteId) ?? null;
  const team = teamList?.items?.find((t: any) => t.teamId === item?.teamId || t._id === item?.teamId) ?? null;
  const staff = staffList?.items?.find((s: any) => s.staffId === item?.staffId || s._id === item?.staffId) ?? null;
  const cur = CUR[settings?.currency ?? 'AUD'] ?? '$';

  const svcSubtotal = (item?.services ?? []).reduce((s: number, sv: any) => s + (sv.amount ?? 0) * (sv.count ?? 1), 0);
  const prtSubtotal = (item?.parts ?? []).reduce((s: number, pt: any) => s + (pt.amount ?? 0) * (pt.count ?? 1), 0);
  const combined = svcSubtotal + prtSubtotal;

  const steps: string[] = settings?.workflowSteps ?? ['quotation', 'workorder', 'invoice'];
  const idx = steps.indexOf('workorder');
  const nextStep = idx >= 0 && idx < steps.length - 1 ? steps[idx + 1] : null;

  const handleShare = async () => {
    if (!item) return;
    setSharing(true);
    try {
      const res = await api.post('/api/v1/portal/generate-token', { docType: 'workorder', docId: item._id });
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
      const res = await api.get(`/api/v1/native-crm/pdf/workorders/${id}?template=classic`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url; a.download = `workorder-${item?.workOrderId ?? id}.pdf`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch { } finally { setDownloading(false); }
  };

  if (isLoading) return (
    <div className="flex items-center justify-center h-full">
      <div className="flex gap-2">{[0,1,2].map(i => <span key={i} className="h-2.5 w-2.5 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}</div>
    </div>
  );
  if (!item) return <div className="flex items-center justify-center h-full text-gray-400">Work order not found.</div>;

  const custAddr    = [customer?.address, customer?.city, customer?.state, customer?.postcode, customer?.country].filter(Boolean).join(', ');
  const companyAddr = [settings?.address1, settings?.address2, settings?.city, settings?.state, settings?.postalCode, settings?.country].filter(Boolean).join(', ');
  const customFields = Object.entries(item.customFields ?? {}).filter(([, v]) => v !== null && v !== undefined && v !== '');

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Toolbar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3 flex-wrap shrink-0">
        <button onClick={() => navigate('/native-crm/workorders')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors mr-2">
          <ArrowLeftIcon className="h-4 w-4" /> Work Orders
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-sm font-semibold text-gray-800">{item.workOrderId}</span>
          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_COLORS[item.status] ?? 'bg-gray-100 text-gray-500'}`}>
            {item.status?.replace('_',' ')}
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
              onClick={() => navigate(STEP_PATHS[nextStep], { state: { openDrawer: true, prefill: buildPrefill(item, 'workorder', nextStep as any) } })}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700">
              <ArrowRightCircleIcon className="h-4 w-4" />{STEP_LABELS[nextStep]}
            </button>
          )}
          <button onClick={() => navigate('/native-crm/workorders', { state: { openDrawer: true, prefill: item } })}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-50">
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
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-50 disabled:opacity-60">
            <ArrowDownTrayIcon className="h-4 w-4" />{downloading ? 'Generating…' : 'Download PDF'}
          </button>
          <button onClick={() => navigate(`/native-crm/workorders/${id}/print`)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white text-xs font-medium rounded-lg hover:bg-brand-700">
            <PrinterIcon className="h-4 w-4" />Print PDF
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Company Header Card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-5">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-5">
              <div className="flex items-start gap-4">
                {settings?.companyLogo && (
                  <img src={settings.companyLogo} alt="logo" className="h-16 w-auto max-w-[120px] object-contain rounded shrink-0" />
                )}
                <div className="space-y-0.5">
                  {settings?.companyName && <p className="text-sm font-bold text-gray-900">{settings.companyName}</p>}
                  {companyAddr && <p className="text-xs text-gray-500">{companyAddr}</p>}
                  {settings?.gstin && <p className="text-xs text-gray-500">GSTIN: {settings.gstin}</p>}
                  {settings?.pan && <p className="text-xs text-gray-500">PAN: {settings.pan}</p>}
                  {settings?.regNumber && <p className="text-xs text-gray-500">Reg: {settings.regNumber}</p>}
                  {settings?.email && <p className="text-xs text-gray-500">{settings.email}</p>}
                  {settings?.phone && <p className="text-xs text-gray-500">{settings.phone}</p>}
                  {settings?.whatsapp && <p className="text-xs text-gray-500">WA: {settings.whatsapp}</p>}
                  {settings?.website && <p className="text-xs text-gray-500">{settings.website}</p>}
                  {settings?.branch && <p className="text-xs text-gray-500">Branch: {settings.branch}</p>}
                </div>
              </div>
              <div className="md:text-right shrink-0">
                <p className="text-2xl font-extrabold text-gray-700 tracking-widest">WORK ORDER</p>
                <p className="text-sm font-semibold text-gray-600 mt-1">{item.workOrderId}</p>
                {item.title && <p className="text-xs text-gray-500 mt-0.5">{item.title}</p>}
                {item.scheduledDate && <p className="text-xs text-gray-400 mt-0.5">Scheduled: {fmtD(item.scheduledDate)}</p>}
                {item.completedDate && <p className="text-xs text-gray-400">Completed: {fmtD(item.completedDate)}</p>}
                <div className="mt-2 flex md:justify-end flex-wrap gap-1.5">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_COLORS[item.status] ?? 'bg-gray-100 text-gray-500'}`}>{item.status?.replace('_', ' ')}</span>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${PRIORITY_COLORS[item.priority] ?? 'bg-gray-100 text-gray-500'}`}>{item.priority ?? 'medium'}</span>
                  {item.workflowState && (
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ring-1 capitalize ${WF_COLORS[item.workflowState] ?? ''}`}>
                      {item.workflowState.replace('_', ' ')}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <hr className="my-4 border-gray-100" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Bill To</p>
                <p className="text-sm font-semibold text-gray-800">{customer?.name ?? item.customerId}</p>
                {customer?.email && <p className="text-xs text-gray-500">{customer.email}</p>}
                {customer?.phone && <p className="text-xs text-gray-500">{customer.phone}</p>}
                {custAddr && <p className="text-xs text-gray-500">{custAddr}</p>}
                {customer?.gstin && <p className="text-xs text-gray-500">GSTIN: {customer.gstin}</p>}
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Assignment</p>
                {item.siteId && <p className="text-xs text-gray-700"><span className="text-gray-400">Site: </span>{site?.name ?? item.siteId}</p>}
                {item.teamId && <p className="text-xs text-gray-700 mt-0.5"><span className="text-gray-400">Team: </span>{team?.name ?? item.teamId}</p>}
                {item.staffId && <p className="text-xs text-gray-700 mt-0.5"><span className="text-gray-400">Staff: </span>{staff ? `${staff.firstName} ${staff.lastName ?? ''}`.trim() : item.staffId}</p>}
                {item.quotationId && <p className="text-xs text-gray-700 mt-0.5"><span className="text-gray-400">Quotation: </span>{item.quotationId}</p>}
                {item.contractId && <p className="text-xs text-gray-700 mt-0.5"><span className="text-gray-400">Contract: </span>{item.contractId}</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Skills */}
        {(item.skills ?? []).length > 0 && (
          <Card title="Required Skills">
            <div className="flex flex-wrap gap-2">
              {(item.skills ?? []).map((s: string) => (
                <span key={s} className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-brand-50 text-brand-700 ring-1 ring-brand-200 capitalize">
                  {s}
                </span>
              ))}
            </div>
          </Card>
        )}

        {/* Services */}
        <Card title={`Services (${(item.services ?? []).length})`}>
          {(item.services ?? []).length === 0 ? (
            <p className="text-sm text-gray-400">No services added.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <th className="text-left py-2 px-3 font-semibold">#</th>
                    <th className="text-left py-2 px-3 font-semibold">Description</th>
                    <th className="text-right py-2 px-3 font-semibold">Qty</th>
                    <th className="text-right py-2 px-3 font-semibold">Unit Price</th>
                    <th className="text-right py-2 px-3 font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(item.services ?? []).map((s: any, i: number) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="py-2 px-3 text-gray-400">{i + 1}</td>
                      <td className="py-2 px-3">
                        <p className="font-medium text-gray-800">{s.name}</p>
                        {s.description && <p className="text-xs text-gray-400 mt-0.5">{s.description}</p>}
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

        {/* Parts */}
        {(item.parts ?? []).length > 0 && (
          <Card title={`Parts / Materials (${(item.parts ?? []).length})`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs uppercase">
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
                    <tr key={i} className="border-t border-gray-100">
                      <td className="py-2 px-3 text-gray-400">{i + 1}</td>
                      <td className="py-2 px-3">
                        <p className="font-medium text-gray-800">{p.name}</p>
                        {p.description && <p className="text-xs text-gray-400 mt-0.5">{p.description}</p>}
                      </td>
                      <td className="py-2 px-3 text-gray-500">{p.partNumber ?? '—'}</td>
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
                  <div className="flex justify-between text-gray-600"><span>Services Subtotal</span><span>{fmt(svcSubtotal, cur)}</span></div>
                  <div className="flex justify-between text-gray-600"><span>Parts Subtotal</span><span>{fmt(prtSubtotal, cur)}</span></div>
                </>
              )}
              <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{fmt(combined, cur)}</span></div>
              <div className="flex justify-between font-bold text-base border-t-2 border-gray-300 pt-2 text-gray-900">
                <span>Total</span><span>{fmt(combined, cur)}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Checklists */}
        {(item.checklists ?? []).length > 0 && (
          <Card title={`Checklist (${(item.checklists ?? []).filter((c: any) => c.completed).length}/${(item.checklists ?? []).length} done)`}>
            <ul className="space-y-2">
              {(item.checklists ?? []).map((c: any, i: number) => (
                <li key={i} className="flex items-center gap-3">
                  <CheckCircleIcon className={`h-5 w-5 shrink-0 ${c.completed ? 'text-green-500' : 'text-gray-300'}`} />
                  <span className={`text-sm ${c.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>{c.item}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {/* Photos */}
        {(item.photos ?? []).length > 0 && (
          <Card title={`Photos (${(item.photos ?? []).length})`}>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
              {(item.photos ?? []).map((url: string, i: number) => (
                <a key={i} href={url} target="_blank" rel="noreferrer">
                  <img src={url} alt={`Photo ${i + 1}`} className="w-full h-24 object-cover rounded-lg border border-gray-200 hover:opacity-80 transition-opacity" />
                </a>
              ))}
            </div>
          </Card>
        )}

        {/* Signature */}
        {item.signatureUrl && (
          <Card title="Customer Signature">
            <img src={item.signatureUrl} alt="Signature" className="h-16 object-contain border border-gray-200 rounded p-2 bg-gray-50" />
          </Card>
        )}

        {/* Notes */}
        {item.notes && (
          <Card title="Notes">
            <div className="prose prose-sm max-w-none text-gray-600 [&_ul]:list-disc [&_ol]:list-decimal [&_ul,&_ol]:pl-4 [&_p]:my-1"
              dangerouslySetInnerHTML={{ __html: item.notes }} />
          </Card>
        )}

        {/* Terms */}
        {item.termsAndConditions && (
          <Card title="Terms & Conditions">
            <div className="prose prose-sm max-w-none text-gray-600 [&_ul]:list-disc [&_ol]:list-decimal [&_ul,&_ol]:pl-4 [&_p]:my-1"
              dangerouslySetInnerHTML={{ __html: item.termsAndConditions }} />
          </Card>
        )}

        {/* Custom Fields */}
        {customFields.length > 0 && (
          <Card title="Custom Fields">
            {customFields.map(([k, v]) => (
              <div key={k}>
                {v !== null && typeof v === 'object' && !Array.isArray(v) ? (
                  <div className="py-1.5 border-b border-gray-50 last:border-0">
                    <p className="text-xs text-gray-400 mb-1.5">{k}</p>
                    <div className="pl-3 space-y-1 border-l-2 border-purple-100">
                      {Object.entries(v as Record<string, any>).map(([sk, sv]) => (
                        <div key={sk} className="flex items-start gap-2">
                          <span className="text-xs text-gray-400 w-32 shrink-0">{sk}</span>
                          <span className="text-xs text-gray-700 font-medium">{renderFieldValue(sv)}</span>
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
      </div>

      {shareModalTab && (
        <FSShareModal
          module="workorders"
          docId={id ?? ''}
          docLabel={item.workOrderId}
          customer={customer}
          initialTab={shareModalTab}
          onClose={() => setShareModalTab(null)}
        />
      )}
    </div>
  );
}
