import { useState, useCallback, useRef } from 'react';
import { chatService } from '../services/chat.service';
import { useAuthStore } from '../stores/auth.store';
import api from '../services/api';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  escalated?: boolean;
  capturedData?: Record<string, string>;
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

        if (isCrmQuery(content)) {
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

  const clearChat = useCallback(() => {
    setMessages([]);
    sessionId.current = `session-${Date.now()}`;
  }, []);

  return { messages, isLoading, sendMessage, clearChat, sessionId: sessionId.current };
}
