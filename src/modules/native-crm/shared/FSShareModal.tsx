import { useEffect, useRef, useState } from 'react';
import { XMarkIcon, EnvelopeIcon, PhoneIcon } from '@heroicons/react/24/outline';
import api from '../../../services/api';

type ShareModule = 'quotations' | 'invoices' | 'contracts' | 'workorders';

const DOC_TYPE: Record<ShareModule, string> = {
  quotations: 'quotation',
  invoices:   'invoice',
  contracts:  'contract',
  workorders: 'workorder',
};

const DOC_LABEL: Record<ShareModule, string> = {
  quotations: 'Quotation',
  invoices:   'Invoice',
  contracts:  'Contract',
  workorders: 'Work Order',
};

interface ShareCustomer {
  email?:    string;
  addEmail?: string[];
  phone?:    string;
  addPhone?: string[];
}

interface FSShareModalProps {
  module:      ShareModule;
  docId:       string;
  docLabel:    string;
  customer:    ShareCustomer | null;
  onClose:     () => void;
  initialTab?: 'email' | 'whatsapp';
}

interface WaNumber { value: string; checked: boolean; }

export default function FSShareModal({ module, docId, docLabel, customer, onClose, initialTab = 'email' }: FSShareModalProps) {
  const [tab, setTab] = useState<'email' | 'whatsapp'>(initialTab);

  const typeLabel = DOC_LABEL[module];

  // ── Email tab state ───────────────────────────────────────────────────────
  const [to, setTo]           = useState(customer?.email ?? '');
  const [cc, setCc]           = useState<string[]>((customer?.addEmail ?? []).filter(Boolean));
  const [ccInput, setCcInput] = useState('');
  const [subject, setSubject] = useState(`${typeLabel} ${docLabel}`);
  const [message, setMessage] = useState(`Hi,\n\nPlease find attached the ${typeLabel.toLowerCase()} ${docLabel}.\n\nThank you.`);
  const [sending, setSending] = useState(false);
  const [emailError, setEmailError]     = useState('');
  const [emailSent, setEmailSent]       = useState(false);

  const addCc = () => {
    const v = ccInput.trim();
    if (v && !cc.includes(v)) setCc([...cc, v]);
    setCcInput('');
  };
  const removeCc = (i: number) => setCc(cc.filter((_, j) => j !== i));

  const handleSendEmail = async () => {
    if (!to.trim()) { setEmailError('Enter a recipient email'); return; }
    setSending(true);
    setEmailError('');
    // Pick up any address still sitting in the "Add CC" box that was never
    // confirmed with the + Add button/Enter — typing it and hitting Send
    // should still CC that address, not silently drop it.
    const pendingCc = ccInput.trim();
    const finalCc = pendingCc && !cc.includes(pendingCc) ? [...cc, pendingCc] : cc;
    if (pendingCc) { setCc(finalCc); setCcInput(''); }
    try {
      // Match the "Download PDF" button's template choice so the emailed PDF
      // never silently differs from what the same document looks like there.
      await api.post(`/api/v1/native-crm/pdf/${module}/${docId}/share-email?template=classic`, {
        to: to.trim(),
        cc: finalCc,
        subject,
        message,
      });
      setEmailSent(true);
      setTimeout(onClose, 1200);
    } catch (err: any) {
      setEmailError(err?.response?.data?.message ?? 'Failed to send email');
    } finally {
      setSending(false);
    }
  };

  // ── WhatsApp tab state ────────────────────────────────────────────────────
  const [numbers, setNumbers] = useState<WaNumber[]>(
    [customer?.phone, ...(customer?.addPhone ?? [])]
      .filter((v): v is string => !!v)
      .map((value) => ({ value, checked: true }))
  );
  const [numberInput, setNumberInput] = useState('');
  const [waMessage, setWaMessage]     = useState('');
  const [portalLink, setPortalLink]   = useState('');
  const waMessageInitialized = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.post('/api/v1/portal/generate-token', { docType: DOC_TYPE[module], docId });
        const token = res.data?.data?.token;
        if (!cancelled && token) setPortalLink(`${window.location.origin}/portal/${token}`);
      } catch { /* link generation is a nicety, not fatal */ }
    })();
    return () => { cancelled = true; };
  }, [module, docId]);

  useEffect(() => {
    if (portalLink && !waMessageInitialized.current) {
      waMessageInitialized.current = true;
      setWaMessage(`Hi, please find your ${typeLabel.toLowerCase()} ${docLabel} here: ${portalLink}`);
    }
  }, [portalLink, typeLabel, docLabel]);

  const toggleNumber = (i: number) =>
    setNumbers(numbers.map((n, j) => (j === i ? { ...n, checked: !n.checked } : n)));
  const editNumber = (i: number, value: string) =>
    setNumbers(numbers.map((n, j) => (j === i ? { ...n, value } : n)));
  const removeNumber = (i: number) => setNumbers(numbers.filter((_, j) => j !== i));
  const addNumber = () => {
    const v = numberInput.trim();
    if (v) setNumbers([...numbers, { value: v, checked: true }]);
    setNumberInput('');
  };

  const handleSendWhatsApp = () => {
    // Same "pending, unconfirmed add-box text" trap as CC — a number typed but
    // never confirmed with + Add should still be sent to, not silently dropped.
    const pendingNumber = numberInput.trim();
    const allNumbers = pendingNumber ? [...numbers, { value: pendingNumber, checked: true }] : numbers;
    if (pendingNumber) { setNumbers(allNumbers); setNumberInput(''); }

    allNumbers
      .filter((n) => n.checked && n.value.trim())
      .forEach((n) => {
        const digits = n.value.replace(/\D/g, '');
        window.open(`https://wa.me/${digits}?text=${encodeURIComponent(waMessage)}`, '_blank');
      });
    onClose();
  };

  const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent';

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <h3 className="text-sm font-semibold text-gray-900">Share {typeLabel} {docLabel}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex border-b border-gray-100 shrink-0">
          <button
            onClick={() => setTab('email')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              tab === 'email' ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <EnvelopeIcon className="h-4 w-4" /> Email
          </button>
          <button
            onClick={() => setTab('whatsapp')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              tab === 'whatsapp' ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <PhoneIcon className="h-4 w-4" /> WhatsApp
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {tab === 'email' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">To</label>
                <input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="customer@example.com" className={inputCls} />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">CC</label>
                <div className="flex flex-wrap gap-1.5 mb-1.5">
                  {cc.map((email, i) => (
                    <span key={i} className="flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full bg-gray-100 text-xs text-gray-700">
                      {email}
                      <button type="button" onClick={() => removeCc(i)} className="p-0.5 rounded-full hover:bg-gray-200 text-gray-400 hover:text-gray-600">
                        <XMarkIcon className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={ccInput}
                    onChange={(e) => setCcInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCc(); } }}
                    placeholder="Add CC email"
                    className={`${inputCls} flex-1`}
                  />
                  <button type="button" onClick={addCc} className="px-3 py-1.5 text-xs rounded-lg border border-brand-300 text-brand-600 hover:bg-brand-50 transition-colors shrink-0">
                    + Add
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Subject</label>
                <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} className={inputCls} />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Message</label>
                <textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} className={`${inputCls} resize-none`} />
              </div>

              {emailError && <p className="text-xs text-red-500">{emailError}</p>}
              {emailSent && <p className="text-xs text-green-600">Email sent!</p>}
            </>
          )}

          {tab === 'whatsapp' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Send to</label>
                <div className="space-y-1.5">
                  {numbers.map((n, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input type="checkbox" checked={n.checked} onChange={() => toggleNumber(i)} className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-400 shrink-0" />
                      <input type="tel" value={n.value} onChange={(e) => editNumber(i, e.target.value)} className={`${inputCls} flex-1`} />
                      <button type="button" onClick={() => removeNumber(i)} className="shrink-0 p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  {numbers.length === 0 && <p className="text-xs text-gray-400 italic">No numbers on file — add one below.</p>}
                </div>
                <div className="flex gap-2 mt-1.5">
                  <input
                    type="tel"
                    value={numberInput}
                    onChange={(e) => setNumberInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addNumber(); } }}
                    placeholder="+91 9876543210"
                    className={`${inputCls} flex-1`}
                  />
                  <button type="button" onClick={addNumber} className="px-3 py-1.5 text-xs rounded-lg border border-brand-300 text-brand-600 hover:bg-brand-50 transition-colors shrink-0">
                    + Add
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Message</label>
                <textarea rows={4} value={waMessage} onChange={(e) => setWaMessage(e.target.value)} className={`${inputCls} resize-none`} />
                <p className="mt-1 text-[11px] text-gray-400">Opens WhatsApp with this message pre-filled for each selected number — WhatsApp doesn't support attaching the PDF directly, so a view-online link is included instead.</p>
              </div>
            </>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-center gap-3 shrink-0 bg-gray-50/60">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">
            Cancel
          </button>
          {tab === 'email' ? (
            <button
              onClick={handleSendEmail}
              disabled={sending}
              className="px-6 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-60 transition-colors flex items-center gap-2 min-w-[120px] justify-center"
            >
              {sending && (
                <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              )}
              {sending ? 'Sending…' : 'Send Email'}
            </button>
          ) : (
            <button
              onClick={handleSendWhatsApp}
              disabled={!numbers.some((n) => n.checked && n.value.trim())}
              className="px-6 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-60 transition-colors"
            >
              Send via WhatsApp
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
