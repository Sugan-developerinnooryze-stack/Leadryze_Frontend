import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PrinterIcon, XMarkIcon, ArrowDownTrayIcon, PencilIcon, ArrowRightCircleIcon } from '@heroicons/react/24/outline';
import { buildPrefill } from '../../../modules/native-crm/shared/buildPrefill';
import { useContractQuery, useContractUpdate } from '../../../modules/native-crm/queries/contracts.queries';
import { useFSSettingsQuery } from '../../../modules/native-crm/queries/fs-settings.queries';
import { useCustomersListQuery } from '../../../modules/native-crm/queries/customers.queries';
import ShareMenuButton from '../../../modules/native-crm/shared/ShareMenuButton';
import FSShareModal from '../../../modules/native-crm/shared/FSShareModal';
import { canViewPII } from '../../../modules/native-crm/shared/piiAccess';
import { useAuthStore } from '../../../stores/auth.store';
import api from '../../../services/api';
import RichEditor from '../../../components/RichEditor';
import { useServicesListQuery } from '../../../modules/native-crm/queries/services.queries';
import { usePartsListQuery } from '../../../modules/native-crm/queries/parts.queries';
import AutocompleteInput from '../../../components/ui/AutocompleteInput';

function fmt(n: number | undefined | null, cur = '$') {
  return `${cur}${n != null ? Number(n).toFixed(2) : '0.00'}`;
}
function fmtD(d: string | Date | undefined | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
}

const VARIANTS = [
  { value: 'classic', label: 'Classic' },
  { value: 'modern',  label: 'Modern'  },
  { value: 'minimal', label: 'Minimal' },
];
const CUR_SYMBOL: Record<string, string> = { AUD:'$',USD:'$',GBP:'£',EUR:'€',INR:'₹',CAD:'$',NZD:'$',SGD:'$' };

export default function ContractPrintPage() {
  const { id }     = useParams<{ id: string }>();
  const navigate   = useNavigate();
  const [variant, setVariant]         = useState('classic');
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing]         = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareModalTab, setShareModalTab] = useState<'email' | 'whatsapp' | null>(null);
  const [editing, setEditing]         = useState(false);
  const [draft, setDraft]             = useState<any>(null);
  const [dragSvcIdx, setDragSvcIdx]   = useState<number | null>(null);
  const [dragPrtIdx, setDragPrtIdx]   = useState<number | null>(null);

  const { data: item, isLoading } = useContractQuery(id ?? '');
  const { data: settings }        = useFSSettingsQuery();
  const { data: custList }        = useCustomersListQuery({ page: 1, limit: 500 });
  const { data: svcData }         = useServicesListQuery({ limit: 500 });
  const { data: prtData }         = usePartsListQuery({ limit: 500 });
  const updateMutation            = useContractUpdate();

  const customer = custList?.items?.find((c: any) => c.customerId === item?.customerId) ?? null;
  const cur      = CUR_SYMBOL[settings?.currency ?? 'AUD'] ?? '$';
  const doc      = editing ? draft : item;
  const user     = useAuthStore((s) => s.user);
  const canShareContact = canViewPII('customers', settings, user?.role);

  function enterEdit() { setDraft(structuredClone(item)); setEditing(true); }
  function cancelEdit() { setDraft(null); setEditing(false); }

  function handleSave() {
    if (!draft) return;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _id, __v, createdAt, updatedAt, tenantId, clientId, ...safeDraft } = draft;
    const rawSvc = (safeDraft.services ?? []).reduce((s: number, sv: any) => s + (sv.amount ?? 0) * (sv.count ?? 1), 0);
    const rawPrt = (safeDraft.parts ?? []).reduce((s: number, pt: any) => s + (pt.amount ?? 0) * (pt.count ?? 1), 0);
    const combined = rawSvc + rawPrt;
    const servicesAmount        = combined - (safeDraft.discount ?? 0);
    const servicesAmountWithTax = servicesAmount * (1 + (safeDraft.gstPercentage ?? 0) / 100);
    updateMutation.mutate(
      { id: id!, data: { ...safeDraft, servicesAmount, servicesAmountWithTax, partsAmount: rawPrt } },
      { onSuccess: () => { setEditing(false); setDraft(null); } }
    );
  }

  function updateService(i: number, field: string, val: any) {
    setDraft((d: any) => { const svcs = [...d.services]; svcs[i] = { ...svcs[i], [field]: val }; return { ...d, services: svcs }; });
  }
  function removeService(i: number) {
    setDraft((d: any) => ({ ...d, services: d.services.filter((_: any, idx: number) => idx !== i) }));
  }
  function addService() {
    setDraft((d: any) => ({ ...d, services: [...(d.services ?? []), { name: '', amount: 0, count: 1 }] }));
  }
  function reorderService(from: number, to: number) {
    setDraft((d: any) => {
      const svcs = [...d.services];
      const [removed] = svcs.splice(from, 1);
      svcs.splice(to, 0, removed);
      return { ...d, services: svcs };
    });
  }

  function updatePart(i: number, field: string, val: any) {
    setDraft((d: any) => { const pts = [...(d.parts ?? [])]; pts[i] = { ...pts[i], [field]: val }; return { ...d, parts: pts }; });
  }
  function removePart(i: number) {
    setDraft((d: any) => ({ ...d, parts: (d.parts ?? []).filter((_: any, idx: number) => idx !== i) }));
  }
  function addPart() {
    setDraft((d: any) => ({ ...d, parts: [...(d.parts ?? []), { name: '', partNumber: '', amount: 0, count: 1 }] }));
  }
  function reorderPart(from: number, to: number) {
    setDraft((d: any) => {
      const pts = [...(d.parts ?? [])];
      const [removed] = pts.splice(from, 1);
      pts.splice(to, 0, removed);
      return { ...d, parts: pts };
    });
  }

  const handleShare = async () => {
    if (!id || !item) return;
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
      const res = await api.get(`/api/v1/native-crm/pdf/contracts/${id}?template=${variant}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a   = document.createElement('a');
      a.href = url; a.download = `contract-${item?.contractId ?? id}.pdf`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch { } finally { setDownloading(false); }
  };

  if (isLoading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="flex gap-2">{[0,1,2].map(i => <span key={i} className="h-2.5 w-2.5 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}</div>
    </div>
  );
  if (!item) return <div className="flex items-center justify-center h-screen text-gray-500">Contract not found.</div>;

  const svcSubtotal   = (doc?.services ?? []).reduce((s: number, sv: any) => s + (sv.amount ?? 0) * (sv.count ?? 1), 0);
  const prtSubtotal   = (doc?.parts ?? []).reduce((s: number, pt: any) => s + (pt.amount ?? 0) * (pt.count ?? 1), 0);
  const combined      = svcSubtotal + prtSubtotal;
  const discount      = doc?.discount ?? 0;
  const gst           = doc?.gstPercentage ?? 0;
  const afterDiscount = combined - discount;
  const total         = afterDiscount * (1 + gst / 100);

  const companyAddr = [settings?.address1, settings?.address2, settings?.city, settings?.state, settings?.postalCode, settings?.country].filter(Boolean).join(', ');
  const custAddr    = [customer?.address, customer?.city, customer?.state, customer?.postcode, customer?.country].filter(Boolean).join(', ');

  const thCls = variant === 'modern'  ? 'bg-brand-600 text-white'
              : variant === 'minimal' ? 'bg-transparent text-gray-500 border-b-2 border-gray-300 border-l-0 border-r-0 border-t-0'
              : 'bg-gray-50 text-gray-600';
  const tdCls = variant === 'minimal' ? 'border-b border-gray-100 px-3 py-2' : 'border border-gray-200 px-3 py-2';
  const a4Cls = variant === 'modern'  ? 'border-t-4 border-brand-600' : '';

  return (
    <div className="bg-gray-100 min-h-screen">
      {/* Toolbar */}
      <div className="print:hidden bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center gap-2 px-4 py-2 flex-wrap justify-end">
          <select value={variant} onChange={e => setVariant(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-700">
            {VARIANTS.map(v => <option key={v.value} value={v.value}>{v.label} Template</option>)}
          </select>
          {!editing && item && (() => {
            const STEP_LABELS: Record<string, string> = { workorder: 'Create Work Order', invoice: 'Create Invoice' };
            const STEP_PATHS: Record<string, string>  = { workorder: '/native-crm/workorders', invoice: '/native-crm/invoices' };
            const steps: string[] = settings?.workflowSteps ?? ['quotation', 'workorder', 'invoice'];
            const idx = steps.indexOf('contract');
            const nextStep = idx >= 0 && idx < steps.length - 1 ? steps[idx + 1] : null;
            if (!nextStep || !STEP_PATHS[nextStep]) return null;
            return (
              <button
                onClick={() => navigate(STEP_PATHS[nextStep], { state: { openDrawer: true, prefill: buildPrefill(item, 'contract', nextStep as any) } })}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
              >
                <ArrowRightCircleIcon className="h-4 w-4" />{STEP_LABELS[nextStep]}
              </button>
            );
          })()}
          {!editing ? (
            <button onClick={enterEdit}
              className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50">
              <PencilIcon className="h-4 w-4" />Edit
            </button>
          ) : (
            <>
              <button onClick={handleSave} disabled={updateMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-60">
                {updateMutation.isPending ? 'Saving…' : 'Save'}
              </button>
              <button onClick={cancelEdit}
                className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50">
                Cancel
              </button>
            </>
          )}
          <ShareMenuButton
            copying={sharing}
            copyLabel={shareCopied ? 'Copied!' : sharing ? 'Generating…' : 'Copy Link'}
            onCopyLink={handleShare}
            onEmail={() => setShareModalTab('email')}
            onWhatsApp={() => setShareModalTab('whatsapp')}
            showContactShare={canShareContact}
          />
          <button onClick={handleDownload} disabled={downloading}
            className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-60">
            <ArrowDownTrayIcon className="h-4 w-4" />{downloading ? 'Generating…' : 'Download PDF'}
          </button>
          <button onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700">
            <PrinterIcon className="h-4 w-4" />Print
          </button>
          <button onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50">
            <XMarkIcon className="h-4 w-4" />Close
          </button>
        </div>
      </div>

      {/* A4 Document */}
      <div className={`w-[210mm] min-h-[297mm] mx-auto my-8 print:my-0 bg-white shadow-xl print:shadow-none p-[15mm] font-sans text-sm text-gray-800 ${a4Cls}${editing ? ' outline outline-2 outline-brand-400 outline-offset-4' : ''}`}>

        {/* Company Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            {settings?.companyLogo && <img src={settings.companyLogo} alt="Logo" className="h-14 mb-2 object-contain" />}
            {settings?.companyName && <div className="text-xl font-bold text-gray-900">{settings.companyName}</div>}
            <div className="text-xs text-gray-500 mt-1 space-y-0.5">
              {companyAddr                 && <div>{companyAddr}</div>}
              {settings?.gstin             && <div>GSTIN: {settings.gstin}</div>}
              {settings?.pan               && <div>PAN: {settings.pan}</div>}
              {settings?.businessRegNumber && <div>Reg: {settings.businessRegNumber}</div>}
              {settings?.companyEmail      && <div>{settings.companyEmail}</div>}
              {settings?.phone             && <div>{settings.phone}</div>}
              {settings?.whatsapp          && <div>WA: {settings.whatsapp}</div>}
              {settings?.website           && <div>{settings.website}</div>}
              {settings?.branch            && <div>Branch: {settings.branch}</div>}
            </div>
          </div>
          <div className="text-right">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">SERVICE CONTRACT</h1>
            <p className="text-gray-400 text-xs mt-1">{item.contractId}</p>
            <div className="text-xs text-gray-600 space-y-0.5 mt-2">
              <div><span className="text-gray-400">Created:</span> {fmtD(item.createdAt)}</div>
              {item.startDate && <div><span className="text-gray-400">Start:</span> {fmtD(item.startDate)}</div>}
              {item.endDate   && <div><span className="text-gray-400">End:</span>   {fmtD(item.endDate)}</div>}
              <div className="flex justify-end mt-1">
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                  item.status === 'active'    ? 'bg-green-100 text-green-700' :
                  item.status === 'expired'   ? 'bg-red-100 text-red-700'     :
                  item.status === 'cancelled' ? 'bg-gray-200 text-gray-600'   :
                  'bg-blue-100 text-blue-700'
                }`}>{item.status?.toUpperCase()}</span>
              </div>
            </div>
          </div>
        </div>

        <hr className="border-gray-200 mb-6" />

        {/* Parties */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Client</p>
            <p className="font-semibold text-gray-900 text-sm">{customer?.name ?? item.customerId}</p>
            <div className="text-xs text-gray-500 mt-1 space-y-0.5">
              {customer?.email && <div>{customer.email}</div>}
              {customer?.phone && <div>{customer.phone}</div>}
              {custAddr         && <div>{custAddr}</div>}
            </div>
          </div>
          <div className="text-xs space-y-3">
            {item.serviceFrequency && (
              <div>
                <p className="text-gray-400 uppercase tracking-wider font-semibold mb-0.5">Service Frequency</p>
                <p className="font-medium text-gray-800 capitalize">{item.serviceFrequency}</p>
              </div>
            )}
            {item.quotationId && (
              <div>
                <p className="text-gray-400 uppercase tracking-wider font-semibold mb-0.5">Based on Quotation</p>
                <p className="font-medium text-gray-800">{item.quotationId}</p>
              </div>
            )}
          </div>
        </div>

        {/* Contract Title */}
        <div className="bg-gray-50 rounded p-3 mb-6">
          <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-1">Contract Title</p>
          {editing
            ? <input value={draft.title ?? ''} onChange={e => setDraft((d: any) => ({ ...d, title: e.target.value }))}
                className="w-full font-medium text-gray-800 border-b border-gray-300 focus:outline-none bg-transparent" />
            : <p className="font-medium text-gray-800">{doc?.title}</p>
          }
        </div>

        {/* Services Table */}
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Services</p>
        <table className="w-full border-collapse mb-2 text-xs" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '5%' }} />
            <col />
            <col style={{ width: '11%' }} />
            <col style={{ width: '17%' }} />
            <col style={{ width: '19%' }} />
            {editing && <col style={{ width: '5%' }} />}
          </colgroup>
          <thead>
            <tr className={thCls}>
              <th className={`${tdCls} text-left font-semibold`}>#</th>
              <th className={`${tdCls} text-left font-semibold`}>Service</th>
              <th className={`${tdCls} text-right font-semibold`}>Qty</th>
              <th className={`${tdCls} text-right font-semibold`}>Unit Price</th>
              <th className={`${tdCls} text-right font-semibold`}>Amount</th>
              {editing && <th className={`${tdCls}`}></th>}
            </tr>
          </thead>
          <tbody>
            {editing ? (
              <>
                {(draft.services ?? []).map((s: any, i: number) => (
                  <tr key={i}
                    draggable
                    onDragStart={() => setDragSvcIdx(i)}
                    onDragOver={e => e.preventDefault()}
                    onDrop={() => { if (dragSvcIdx !== null && dragSvcIdx !== i) { reorderService(dragSvcIdx, i); } setDragSvcIdx(null); }}
                    onDragEnd={() => setDragSvcIdx(null)}
                    className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} cursor-grab ${dragSvcIdx === i ? 'opacity-40' : ''}`}>
                    <td className={`${tdCls} text-gray-400 select-none`}>⠿</td>
                    <td className={tdCls}>
                      <AutocompleteInput
                        value={s.name}
                        onChange={val => updateService(i, 'name', val)}
                        options={svcData?.items || []}
                        displayKey="name"
                        onSelect={(item: any) => {
                          updateService(i, 'name', item.name);
                          if (item.description) updateService(i, 'description', item.description);
                          if (item.price != null) updateService(i, 'amount', item.price);
                        }}
                        placeholder="Service name"
                        className="w-full font-medium text-gray-800 border-b border-gray-300 focus:outline-none bg-transparent"
                      />
                      <input value={s.description ?? ''} onChange={e => updateService(i, 'description', e.target.value)} placeholder="Description (optional)"
                        className="w-full text-gray-400 border-b border-gray-100 focus:outline-none bg-transparent mt-0.5" />
                    </td>
                    <td className={tdCls}>
                      <input type="number" min={1} value={s.count ?? 1} onChange={e => updateService(i, 'count', Number(e.target.value))}
                        className="w-12 text-right border-b border-gray-300 focus:outline-none bg-transparent" />
                    </td>
                    <td className={tdCls}>
                      <input type="number" min={0} step="0.01" value={s.amount ?? 0} onChange={e => updateService(i, 'amount', parseFloat(e.target.value) || 0)}
                        className="w-full text-right border-b border-gray-300 focus:outline-none bg-transparent" />
                    </td>
                    <td className={`${tdCls} text-right font-medium`}>{fmt((s.amount ?? 0) * (s.count ?? 1), cur)}</td>
                    <td className={`${tdCls} text-center`}>
                      <button onClick={() => removeService(i)} className="text-red-400 hover:text-red-600">✕</button>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={6} className={`${tdCls} bg-white`}>
                    <button onClick={addService} className="text-brand-600 hover:underline">+ Add Service</button>
                  </td>
                </tr>
              </>
            ) : (
              (doc?.services ?? []).length > 0 ? (doc?.services ?? []).map((s: any, i: number) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className={`${tdCls} text-gray-400`}>{i + 1}</td>
                  <td className={tdCls}>
                    <p className="font-medium text-gray-800">{s.name}</p>
                    {s.description && <p className="text-gray-400">{s.description}</p>}
                  </td>
                  <td className={`${tdCls} text-right`}>{s.count ?? 1}</td>
                  <td className={`${tdCls} text-right`}>{fmt(s.amount, cur)}</td>
                  <td className={`${tdCls} text-right font-medium`}>{fmt((s.amount ?? 0) * (s.count ?? 1), cur)}</td>
                </tr>
              )) : (
                <tr><td colSpan={5} className={`${tdCls} text-center text-gray-400 py-3`}>No services added</td></tr>
              )
            )}
          </tbody>
        </table>

        {/* Parts Table */}
        {(editing || (doc?.parts ?? []).length > 0) && (
          <>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-4 mb-1">Parts / Materials</p>
            <table className="w-full border-collapse mb-2 text-xs" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '5%' }} />
                <col />
                <col style={{ width: '15%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '18%' }} />
                {editing && <col style={{ width: '5%' }} />}
              </colgroup>
              <thead>
                <tr className={thCls}>
                  <th className={`${tdCls} text-left font-semibold`}>#</th>
                  <th className={`${tdCls} text-left font-semibold`}>Part Name</th>
                  <th className={`${tdCls} text-left font-semibold`}>Part No.</th>
                  <th className={`${tdCls} text-right font-semibold`}>Qty</th>
                  <th className={`${tdCls} text-right font-semibold`}>Unit Price</th>
                  <th className={`${tdCls} text-right font-semibold`}>Amount</th>
                  {editing && <th className={`${tdCls}`}></th>}
                </tr>
              </thead>
              <tbody>
                {editing ? (
                  <>
                    {(draft.parts ?? []).map((p: any, i: number) => (
                      <tr key={i}
                        draggable
                        onDragStart={() => setDragPrtIdx(i)}
                        onDragOver={e => e.preventDefault()}
                        onDrop={() => { if (dragPrtIdx !== null && dragPrtIdx !== i) { reorderPart(dragPrtIdx, i); } setDragPrtIdx(null); }}
                        onDragEnd={() => setDragPrtIdx(null)}
                        className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} cursor-grab ${dragPrtIdx === i ? 'opacity-40' : ''}`}>
                        <td className={`${tdCls} text-gray-400 select-none`}>⠿</td>
                        <td className={tdCls}>
                          <AutocompleteInput
                            value={p.name}
                            onChange={val => updatePart(i, 'name', val)}
                            options={prtData?.items || []}
                            displayKey="name"
                            onSelect={(item: any) => {
                              updatePart(i, 'name', item.name);
                              if (item.description) updatePart(i, 'description', item.description);
                              if (item.price != null) updatePart(i, 'amount', item.price);
                              if (item.partNumber) updatePart(i, 'partNumber', item.partNumber);
                            }}
                            placeholder="Part name"
                            className="w-full font-medium text-gray-800 border-b border-gray-300 focus:outline-none bg-transparent"
                          />
                          <input value={p.description ?? ''} onChange={e => updatePart(i, 'description', e.target.value)} placeholder="Description (optional)"
                            className="w-full text-gray-400 border-b border-gray-100 focus:outline-none bg-transparent mt-0.5" />
                        </td>
                        <td className={tdCls}>
                          <input value={p.partNumber ?? ''} onChange={e => updatePart(i, 'partNumber', e.target.value)} placeholder="SKU/Part#"
                            className="w-full text-gray-500 border-b border-gray-200 focus:outline-none bg-transparent" />
                        </td>
                        <td className={tdCls}>
                          <input type="number" min={1} value={p.count ?? 1} onChange={e => updatePart(i, 'count', Number(e.target.value))}
                            className="w-12 text-right border-b border-gray-300 focus:outline-none bg-transparent" />
                        </td>
                        <td className={tdCls}>
                          <input type="number" min={0} step="0.01" value={p.amount ?? 0} onChange={e => updatePart(i, 'amount', parseFloat(e.target.value) || 0)}
                            className="w-full text-right border-b border-gray-300 focus:outline-none bg-transparent" />
                        </td>
                        <td className={`${tdCls} text-right font-medium`}>{fmt((p.amount ?? 0) * (p.count ?? 1), cur)}</td>
                        <td className={`${tdCls} text-center`}>
                          <button onClick={() => removePart(i)} className="text-red-400 hover:text-red-600">✕</button>
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={7} className={`${tdCls} bg-white`}>
                        <button onClick={addPart} className="text-brand-600 hover:underline">+ Add Part</button>
                      </td>
                    </tr>
                  </>
                ) : (
                  (doc?.parts ?? []).map((p: any, i: number) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className={`${tdCls} text-gray-400`}>{i + 1}</td>
                      <td className={tdCls}>
                        <p className="font-medium text-gray-800">{p.name}</p>
                        {p.description && <p className="text-gray-400">{p.description}</p>}
                      </td>
                      <td className={`${tdCls} text-gray-500`}>{p.partNumber ?? '—'}</td>
                      <td className={`${tdCls} text-right`}>{p.count ?? 1}</td>
                      <td className={`${tdCls} text-right`}>{fmt(p.amount, cur)}</td>
                      <td className={`${tdCls} text-right font-medium`}>{fmt((p.amount ?? 0) * (p.count ?? 1), cur)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </>
        )}

        {/* Discount / GST edit controls */}
        {editing && (
          <div className="flex justify-end gap-6 text-xs mb-2 print:hidden">
            <label className="flex items-center gap-1 text-gray-600">Discount:
              <input type="number" min={0} step="0.01" value={draft.discount ?? 0}
                onChange={e => setDraft((d: any) => ({ ...d, discount: parseFloat(e.target.value) || 0 }))}
                className="w-20 text-right border-b border-gray-300 focus:outline-none ml-1 bg-transparent" />
            </label>
            <label className="flex items-center gap-1 text-gray-600">GST %:
              <input type="number" min={0} max={100} step="0.5" value={draft.gstPercentage ?? 0}
                onChange={e => setDraft((d: any) => ({ ...d, gstPercentage: parseFloat(e.target.value) || 0 }))}
                className="w-16 text-right border-b border-gray-300 focus:outline-none ml-1 bg-transparent" />
            </label>
          </div>
        )}

        {/* Totals */}
        <div className="flex justify-end mb-6">
          <div className="w-56 text-xs space-y-1.5">
            {prtSubtotal > 0 && <div className="flex justify-between text-gray-600"><span>Services</span><span>{fmt(svcSubtotal, cur)}</span></div>}
            {prtSubtotal > 0 && <div className="flex justify-between text-gray-600"><span>Parts</span><span>{fmt(prtSubtotal, cur)}</span></div>}
            <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{fmt(combined, cur)}</span></div>
            {discount > 0 && <div className="flex justify-between text-red-600"><span>Discount</span><span>-{fmt(discount, cur)}</span></div>}
            {gst > 0 && <div className="flex justify-between text-gray-600"><span>GST ({gst}%)</span><span>{fmt(total - afterDiscount, cur)}</span></div>}
            <div className="flex justify-between font-bold text-sm border-t-2 border-gray-300 pt-1.5 text-gray-900">
              <span>CONTRACT VALUE</span><span>{fmt(total, cur)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {(editing || doc?.notes) && (
          <div className="border border-gray-200 rounded p-3 mb-4 text-xs">
            <p className="font-semibold text-gray-600 mb-1">Notes</p>
            {editing
              ? <RichEditor value={draft.notes ?? ''} onChange={html => setDraft((d: any) => ({ ...d, notes: html }))} />
              : <div className="prose prose-xs max-w-none text-gray-500 [&_ul]:list-disc [&_ol]:list-decimal [&_ul,&_ol]:pl-4 [&_li]:my-0 [&_h2]:text-xs [&_h3]:text-xs [&_p]:my-0.5"
                  dangerouslySetInnerHTML={{ __html: doc?.notes ?? '' }} />
            }
          </div>
        )}

        {/* Terms & Conditions */}
        {(editing || doc?.termsAndConditions) && (
          <div className="border border-gray-200 rounded p-3 mb-6 text-xs">
            <p className="font-semibold text-gray-600 mb-1">Terms &amp; Conditions</p>
            {editing
              ? <RichEditor value={draft.termsAndConditions ?? ''} onChange={html => setDraft((d: any) => ({ ...d, termsAndConditions: html }))} />
              : <div className="prose prose-xs max-w-none text-gray-500 [&_ul]:list-disc [&_ol]:list-decimal [&_ul,&_ol]:pl-4 [&_li]:my-0 [&_h2]:text-xs [&_h3]:text-xs [&_p]:my-0.5"
                  dangerouslySetInnerHTML={{ __html: doc?.termsAndConditions ?? '' }} />
            }
          </div>
        )}

        {/* Bank Details */}
        {(settings?.bankName || settings?.accountNumber || settings?.upiId) && (
          <div className="border border-gray-200 rounded p-3 mb-6 bg-gray-50 text-xs">
            <p className="font-semibold text-gray-600 mb-2">Payment Details</p>
            <div className="flex items-start gap-4">
              <div className="flex-1 grid grid-cols-2 gap-2 text-gray-600">
                {settings.bankName      && <div><span className="text-gray-400">Bank:</span> {settings.bankName}</div>}
                {settings.accountName   && <div><span className="text-gray-400">Account Name:</span> {settings.accountName}</div>}
                {settings.accountNumber && <div><span className="text-gray-400">Account No:</span> {settings.accountNumber}</div>}
                {settings.ifscCode      && <div><span className="text-gray-400">BSB / IFSC:</span> {settings.ifscCode}</div>}
                {settings.upiId         && <div className="col-span-2"><span className="text-gray-400">UPI:</span> {settings.upiId}</div>}
              </div>
              {settings?.qrCodeImage && (
                <div className="flex-shrink-0 text-center">
                  <img src={settings.qrCodeImage} alt="QR" className="h-20 w-20 object-contain" />
                  <p className="text-gray-400 text-[10px] mt-0.5">Scan to Pay</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        {settings?.contractFooter && (
          <p className="text-xs text-gray-400 border-t border-gray-200 pt-3 mb-6 whitespace-pre-line text-center">{settings.contractFooter}</p>
        )}

        {/* Signatures */}
        <div className="flex justify-between mt-12 text-xs text-gray-500">
          <div className="text-center">
            <div className="flex items-end justify-center gap-2 mb-1">
              {settings?.companySignature && <img src={settings.companySignature} alt="Signature" className="h-10 object-contain" />}
              {settings?.stampImage && <img src={settings.stampImage} alt="Stamp" className="h-14 object-contain" />}
            </div>
            <div className="border-t border-gray-400 w-44 pt-1.5">Service Provider Signature</div>
          </div>
          <div className="text-center">
            <div className="h-14 mb-1" />
            <div className="border-t border-gray-400 w-44 pt-1.5">Client Signature &amp; Date</div>
          </div>
        </div>
      </div>

      <style>{`@media print { body { margin: 0; background: white; } @page { size: A4; margin: 0; } }`}</style>

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
