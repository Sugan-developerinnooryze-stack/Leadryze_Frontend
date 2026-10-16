import { useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { chatService } from '../services/chat.service';
import { useAuthStore } from '../stores/auth.store';
import api from '../services/api';
import { tenantAiUsageQueryKey } from '../modules/native-crm/queries/tenant.queries';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  escalated?: boolean;
  capturedData?: Record<string, string>;
  /** Internal CRM Assistant only (Phase 1) — present when this message
   * proposed a create/update/delete that needs an explicit Confirm/Cancel
   * before it actually happens. Cleared once the staff member responds, so
   * the buttons don't stay clickable after the operation is already
   * resolved (and reposting the same operationId is a server-side no-op
   * either way — the backend consumes it exactly once). */
  confirmation?: { summary: string; operationId: string; resolved?: 'confirm' | 'cancel' };
  /** 'Native CRM' for CRM Assistant responses — shown as a small source
   * badge so it's always clear this answer came from the tenant's own
   * Leads/Work Orders/Invoices, not a synced or omnichannel source. */
  source?: string;
}

/* Phase 1 of the internal CRM Assistant — narrow, deliberately conservative
 * detection for "do something to a Lead/Work Order/Invoice" (create/update/
 * delete), routed to the new /api/v1/ai/crm-chat endpoint. Everything else
 * (plain read-only questions, general chat) keeps using the existing
 * isCrmQuery()/chatService paths below, completely unchanged. */
const CRM_MODULE_RE = /\b(lead|work\s?order|invoice)s?\b/i;
const CRM_ACTION_VERB_RE = /\b(create|add|make|generate|update|change|set|mark|edit|delete|remove|cancel)\b/i;

function isCrmAssistantAction(msg: string): boolean {
  return CRM_MODULE_RE.test(msg) && CRM_ACTION_VERB_RE.test(msg);
}

/* Keywords that indicate the user is querying My CRM data locally */
const CRM_LOCAL_RE = /\b(task|tasks|event|events|booking|bookings|appointment|appointments|schedule|schedules|follow.?up|activities|activity|overdue|upcoming|pending|completed|in.?progress|how many|any task|have any|anytask)\b/i;

// Time/date references that signal a *create/schedule* intent rather than a query
const TIME_REF_RE = /\b(tomorrow|today|next\s+\w+|\d{1,2}\s*(?:am|pm)|at\s+\d|\d:\d{2})\b/i;

// Action words that, combined with a time ref, mean "schedule this" not "query this"
const SCHEDULE_ACTION_RE = /\b(schedule|book|arrange|create|add|plan|setup|set up|fix)\b.{0,60}\b(meeting|appointment|call|booking)\b|\b(meeting|appointment|call|booking)\b.{0,40}\b(schedule|arrange|book|fix|setup)\b/i;
const RESCHEDULE_RE = /\b(reschedule|postpone|move the meeting|change the meeting|shift the meeting)\b/i;

function isScheduleOrRescheduleRequest(msg: string): boolean {
  if (RESCHEDULE_RE.test(msg)) return true;
  return SCHEDULE_ACTION_RE.test(msg) && TIME_REF_RE.test(msg);
}

function isCrmQuery(msg: string): boolean {
  // Never route schedule/reschedule intents to the local CRM search
  if (isScheduleOrRescheduleRequest(msg)) return false;
  return CRM_LOCAL_RE.test(msg);
}

export function useChat() {
  const user = useAuthStore((s) => s.user);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const sessionId = useRef(`session-${Date.now()}`);
  const queryClient = useQueryClient();

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || !user) return;

      const userMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'user',
        content,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      try {
        let response: string;
        let escalate = false;
        let capturedData: Record<string, string> = {};
        let confirmation: ChatMessage['confirmation'];
        let source: string | undefined;

        if (isCrmAssistantAction(content)) {
          // Internal CRM Assistant (Phase 1) — real CRUD on Leads/Work
          // Orders/Invoices, entirely separate from both paths below.
          const res = await api.post('/api/v1/ai/crm-chat', { sessionId: sessionId.current, message: content });
          response = res.data.data.response;
          source = res.data.data.source;
          confirmation = res.data.data.confirmation;
          // The internal assistant just spent real tokens against this
          // tenant's shared allowance — refresh the usage display rather
          // than wait for its next background poll tick.
          if (user) queryClient.invalidateQueries({ queryKey: tenantAiUsageQueryKey(user.tenantId) });
        } else if (isCrmQuery(content)) {
          // Route to local CRM + activities search
          const res = await api.post('/api/v1/bot/crm-chat', { message: content });
          response    = res.data.data.response;
          escalate    = res.data.data.escalate ?? false;
          capturedData = res.data.data.capturedData ?? {};
        } else {
          // Forward to external AI microservice
          const res = await chatService.sendMessage({
            tenantId: user.tenantId,
            sessionId: sessionId.current,
            message: content,
            companyName: 'LeadRyze',
          });
          response    = res.data.data.response;
          escalate    = res.data.data.escalate;
          capturedData = res.data.data.capturedData;
        }

        const aiMsg: ChatMessage = {
          id: `msg-${Date.now()}-ai`,
          role: 'assistant',
          content: response,
          timestamp: new Date(),
          escalated: escalate,
          capturedData,
          confirmation,
          source,
        };
        setMessages((prev) => [...prev, aiMsg]);

        // Notify Calendar/Management/Automation pages to refresh when AI creates or updates an activity
        const ACTIVITY_SIGNAL_RE = /\b(scheduled|rescheduled|created|linked|meeting|appointment|booking|task|event)\b/i;
        if (ACTIVITY_SIGNAL_RE.test(response)) {
          window.dispatchEvent(new Event('leadryze:activity-updated'));
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: 'assistant',
            content: 'Sorry, I encountered an issue. Please try again.',
            timestamp: new Date(),
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [user]
  );

  // Confirm/Cancel on a CRM Assistant proposal — a structured action, never
  // free text, so there's no classifier and no risk of the model
  // "interpreting" a yes/no. Marks the originating message's confirmation
  // as resolved so its buttons stop being clickable (reposting the same
  // operationId would safely no-op server-side regardless — it's consumed
  // exactly once — this is purely so the UI doesn't look reusable).
  const respondToConfirmation = useCallback(
    async (messageId: string, operationId: string, decision: 'confirm' | 'cancel') => {
      setMessages((prev) => prev.map((m) => (
        m.id === messageId && m.confirmation ? { ...m, confirmation: { ...m.confirmation, resolved: decision } } : m
      )));
      setIsLoading(true);
      try {
        const res = await api.post('/api/v1/ai/crm-chat', {
          sessionId: sessionId.current,
          confirmationAction: { operationId, decision },
        });
        setMessages((prev) => [...prev, {
          id: `msg-${Date.now()}-ai`,
          role: 'assistant',
          content: res.data.data.response,
          timestamp: new Date(),
          source: res.data.data.source,
        }]);
      } catch {
        setMessages((prev) => [...prev, {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: 'Sorry, I encountered an issue. Please try again.',
          timestamp: new Date(),
        }]);
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const clearChat = useCallback(() => {
    setMessages([]);
    sessionId.current = `session-${Date.now()}`;
  }, []);

  return { messages, isLoading, sendMessage, respondToConfirmation, clearChat, sessionId: sessionId.current };
}
