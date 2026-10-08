import { useState, FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCreateLeadFromConversation } from '../../../native-crm/queries/conversations.queries';

interface LeadSummary { _id: string; leadId: string; firstName: string; lastName?: string; status?: string; }
interface ConversationDetail {
  sessionId: string;
  visitorName?: string; visitorEmail?: string; visitorPhone?: string; channel: string;
  lead?: LeadSummary | null;
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-xs text-text-muted w-16 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-text-primary break-all">{value || '—'}</span>
    </div>
  );
}

/** Visitor details + Lead linkage. captureLeadFromExternalSource (the same
 * canonical path the AI widget's own lead capture already uses) requires at
 * least a name — a visitor who never gave one needs it typed in here. */
export default function ConversationContextPanel({ conversation }: { conversation: ConversationDetail | undefined }) {
  const qc = useQueryClient();
  const createLead = useCreateLeadFromConversation();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '' });

  if (!conversation) return null;
  const lead = conversation.lead;

  const submit = (e: FormEvent): void => {
    e.preventDefault();
    createLead.mutate({ sessionId: conversation.sessionId, data: form }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: ['native-crm', 'conversations', conversation.sessionId] }),
    });
  };

  return (
    <div className="flex flex-col h-full border-l border-border bg-surface overflow-y-auto">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Visitor</h3>
      </div>
      <div className="px-4 py-3 space-y-2">
        <Row label="Name" value={conversation.visitorName} />
        <Row label="Email" value={conversation.visitorEmail} />
        <Row label="Phone" value={conversation.visitorPhone} />
        <Row label="Channel" value={conversation.channel} />
      </div>

      <div className="px-4 py-3 border-t border-border">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Lead</h3>
        {lead ? (
          <div className="text-sm px-3 py-2.5 rounded-lg border border-border">
            <p className="font-semibold text-text-primary">{lead.firstName} {lead.lastName}</p>
            <p className="text-xs text-text-muted mt-0.5">{lead.leadId} · {lead.status}</p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-2">
            <input
              placeholder="First name" value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-text-primary"
            />
            <input
              placeholder="Last name" value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-text-primary"
            />
            <input
              placeholder="Email" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-text-primary"
            />
            <input
              placeholder="Phone" value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-text-primary"
            />
            <button
              type="submit" disabled={createLead.isPending}
              className="w-full text-xs font-semibold px-3 py-2 rounded-lg bg-ryze-600 text-white hover:bg-ryze-700 disabled:opacity-50"
            >
              Create Lead
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
