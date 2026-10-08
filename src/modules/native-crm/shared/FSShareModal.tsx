import { useState } from 'react';
import { XMarkIcon, EnvelopeIcon, PhoneIcon } from '@heroicons/react/24/outline';
import api from '../../../services/api';

type ShareModule = 'quotations' | 'invoices' | 'contracts' | 'workorders';

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
  templateId?: string; // designer template for the attached PDF (default template used when omitted)
}

interface WaNumber { value: string; checked: boolean; }

export default function FSShareModal({ module, docId, docLabel, customer, onClose, initialTab = 'email', templateId }: FSShareModalProps) {
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
      // A designer templateId takes priority; the backend otherwise falls back
      // to the tenant's default designer template, then the legacy variant.
      const qs = templateId ? `templateId=${templateId}` : 'template=classic';
      await api.post(`/api/v1/native-crm/pdf/${module}/${docId}/share-email?${qs}`, {
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
  const [waMessage, setWaMessage]     = useState(`Please find attached the ${typeLabel.toLowerCase()} ${docLabel}.`);
  const [waSending, setWaSending]     = useState(false);
  const [waError, setWaError]         = useState('');
  const [waSent, setWaSent]           = useState(false);

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

  // Real Meta Cloud API send (replaces the old client-side wa.me deep-link,
  // which never touched Meta's API at all and couldn't attach the PDF — it
  // just opened a new tab with a pre-filled message the user had to send
  // themselves). Meta sends to one recipient per call, so each checked
  // number gets its own request; a failure on one (e.g. that customer
  // hasn't messaged this number in the last 24 hours — Meta only allows a
  // business to START a conversation via an approved template message,
  // which isn't set up yet) doesn't block the others.
  const handleSendWhatsApp = async () => {
    const pendingNumber = numberInput.trim();
    const allNumbers = pendingNumber ? [...numbers, { value: pendingNumber, checked: true }] : numbers;
    if (pendingNumber) { setNumbers(allNumbers); setNumberInput(''); }

    const targets = allNumbers.filter((n) => n.checked && n.value.trim());
    if (targets.length === 0) return;

    setWaSending(true);
    setWaError('');
    try {
      const qs = templateId ? `templateId=${templateId}` : 'template=classic';
      const failures: string[] = [];
      for (const n of targets) {
        try {
          await api.post(`/api/v1/native-crm/pdf/${module}/${docId}/share-whatsapp?${qs}`, {
            to: n.value.trim(),
            message: waMessage,
          });
        } catch (err: any) {
          failures.push(`${n.value}: ${err?.response?.data?.message ?? 'failed'}`);
        }
      }
      if (failures.length === targets.length) {
        setWaError(failures[0]?.split(': ').slice(1).join(': ') || 'Failed to send WhatsApp message');
      } else if (failures.length > 0) {
        setWaError(`Sent to ${targets.length - failures.length} of ${targets.length} — ${failures.join('; ')}`);
        setWaSent(true);
        setTimeout(onClose, 1800);
      } else {
        setWaSent(true);
        setTimeout(onClose, 1200);
      }
    } finally {
      setWaSending(false);
    }
  };

  const inputCls = 'w-full rounded-lg bg-surface border border-border px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-ryze-400 focus:border-transparent';

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-surface-elevated rounded-xl shadow-xl max-w-lg w-full flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h3 className="text-sm font-semibold text-text-primary">Share {typeLabel} {docLabel}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex border-b border-border shrink-0">
          <button
            onClick={() => setTab('email')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              tab === 'email' ? 'border-ryze-500 text-ryze-600 dark:text-ryze-400' : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            <EnvelopeIcon className="h-4 w-4" /> Email
          </button>
          <button
            onClick={() => setTab('whatsapp')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              tab === 'whatsapp' ? 'border-ryze-500 text-ryze-600 dark:text-ryze-400' : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            <PhoneIcon className="h-4 w-4" /> WhatsApp
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {tab === 'email' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1 uppercase tracking-wide">To</label>
                <input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="customer@example.com" className={inputCls} />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1 uppercase tracking-wide">CC</label>
                <div className="flex flex-wrap gap-1.5 mb-1.5">
                  {cc.map((email, i) => (
                    <span key={i} className="flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full bg-black/[0.04] dark:bg-white/[0.06] text-xs text-text-primary">
                      {email}
                      <button type="button" onClick={() => removeCc(i)} className="p-0.5 rounded-full hover:bg-black/[0.08] dark:hover:bg-white/[0.1] text-text-muted hover:text-text-primary">
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
                  <button type="button" onClick={addCc} className="px-3 py-1.5 text-xs rounded-lg border border-ryze-300 dark:border-ryze-700 text-ryze-600 dark:text-ryze-400 hover:bg-ryze-600/10 transition-colors shrink-0">
                    + Add
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1 uppercase tracking-wide">Subject</label>
                <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} className={inputCls} />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1 uppercase tracking-wide">Message</label>
                <textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} className={`${inputCls} resize-none`} />
              </div>

              {emailError && <p className="text-xs text-danger-500">{emailError}</p>}
              {emailSent && <p className="text-xs text-success-600 dark:text-success-500">Email sent!</p>}
            </>
          )}

          {tab === 'whatsapp' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Send to</label>
                <div className="space-y-1.5">
                  {numbers.map((n, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input type="checkbox" checked={n.checked} onChange={() => toggleNumber(i)} className="h-4 w-4 rounded border-border text-ryze-600 focus:ring-ryze-400 shrink-0" />
                      <input type="tel" value={n.value} onChange={(e) => editNumber(i, e.target.value)} className={`${inputCls} flex-1`} />
                      <button type="button" onClick={() => removeNumber(i)} className="shrink-0 p-2 rounded-lg text-text-muted hover:text-danger-500 hover:bg-danger-500/10 transition-colors">
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  {numbers.length === 0 && <p className="text-xs text-text-muted italic">No numbers on file — add one below.</p>}
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
                  <button type="button" onClick={addNumber} className="px-3 py-1.5 text-xs rounded-lg border border-ryze-300 dark:border-ryze-700 text-ryze-600 dark:text-ryze-400 hover:bg-ryze-600/10 transition-colors shrink-0">
                    + Add
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1 uppercase tracking-wide">Caption</label>
                <textarea rows={4} value={waMessage} onChange={(e) => setWaMessage(e.target.value)} className={`${inputCls} resize-none`} />
                <p className="mt-1 text-[11px] text-text-muted">Sends the PDF directly as a WhatsApp document with this caption. Only delivers to a number that has messaged this WhatsApp number within the last 24 hours — Meta requires an approved message template to start a new conversation, which isn't set up yet.</p>
              </div>

              {waError && <p className="text-xs text-danger-500">{waError}</p>}
              {waSent && !waError && <p className="text-xs text-success-600 dark:text-success-500">Sent!</p>}
            </>
          )}
        </div>

        <div className="px-5 py-4 border-t border-border flex items-center justify-center gap-3 shrink-0 bg-black/[0.015] dark:bg-white/[0.02]">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-border text-sm font-medium text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors">
            Cancel
          </button>
          {tab === 'email' ? (
            <button
              onClick={handleSendEmail}
              disabled={sending}
              className="px-6 py-2.5 rounded-xl bg-ryze-600 text-white text-sm font-medium hover:bg-ryze-700 disabled:opacity-60 transition-colors flex items-center gap-2 min-w-[120px] justify-center"
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
              disabled={waSending || !numbers.some((n) => n.checked && n.value.trim())}
              className="px-6 py-2.5 rounded-xl bg-ryze-600 text-white text-sm font-medium hover:bg-ryze-700 disabled:opacity-60 transition-colors flex items-center gap-2 min-w-[150px] justify-center"
            >
              {waSending && (
                <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              )}
              {waSending ? 'Sending…' : 'Send via WhatsApp'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
