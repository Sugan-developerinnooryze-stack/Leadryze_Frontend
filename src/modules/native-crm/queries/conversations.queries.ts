import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api';

const BASE = '/api/v1/native-crm/conversations';
const KEY  = ['native-crm', 'conversations'] as const;

export interface ConversationListItem {
  sessionId: string;
  visitorName?: string;
  visitorEmail?: string;
  visitorPhone?: string;
  channel: string;
  mode?: 'ai' | 'human';
  handoffStatus?: 'none' | 'waiting' | 'claimed';
  handoffRequestedAt?: string;
  claimedAt?: string;
  assignedToUserId?: string;
  assignedToName?: string;
  updatedAt: string;
  lastMessage?: { role: string; content: string; timestamp: string } | null;
}

export type ConversationStatusTab = 'waiting' | 'claimed' | 'mine' | 'all';

/** The shared claim queue list — re-fetched on mount and also kept fresh
 * live by the inbox page's own Socket.IO listeners (handoff:requested/
 * claimed/message), which call qc.invalidateQueries(KEY) directly rather
 * than going through a mutation here; this hook is the React-Query-level
 * backstop that reconciles state if a socket event is ever missed, not the
 * only source of truth. */
export function useConversationsListQuery(status: ConversationStatusTab | undefined, page = 1, limit = 20) {
  return useQuery({
    queryKey: [...KEY, 'list', status, page, limit],
    queryFn: () => api.get(BASE, { params: { status, page, limit } }).then((r) => ({
      items: r.data.data as ConversationListItem[],
      total: r.data.meta?.total ?? 0,
      totalPages: r.data.meta?.totalPages ?? 1,
    })),
  });
}

export function useConversationQuery(sessionId: string | undefined) {
  return useQuery({
    queryKey: [...KEY, sessionId],
    queryFn: () => api.get(`${BASE}/${sessionId}`).then((r) => r.data.data as any),
    enabled: !!sessionId,
  });
}

export function useClaimConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => api.post(`${BASE}/${sessionId}/claim`),
    onSuccess: (_r, sessionId) => {
      qc.invalidateQueries({ queryKey: [...KEY, 'list'] });
      qc.invalidateQueries({ queryKey: [...KEY, sessionId] });
    },
  });
}

export function useReplyToConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, content }: { sessionId: string; content: string }) =>
      api.post(`${BASE}/${sessionId}/reply`, { content }),
    onSuccess: (_r, { sessionId }) => {
      qc.invalidateQueries({ queryKey: [...KEY, 'list'] });
      qc.invalidateQueries({ queryKey: [...KEY, sessionId] });
    },
  });
}

export function useHandbackConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => api.post(`${BASE}/${sessionId}/handback`),
    onSuccess: (_r, sessionId) => {
      qc.invalidateQueries({ queryKey: [...KEY, 'list'] });
      qc.invalidateQueries({ queryKey: [...KEY, sessionId] });
    },
  });
}

export function useCreateLeadFromConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, data }: { sessionId: string; data: { firstName?: string; lastName?: string; email?: string; phone?: string } }) =>
      api.post(`${BASE}/${sessionId}/create-lead`, data),
    onSuccess: (_r, { sessionId }) => qc.invalidateQueries({ queryKey: [...KEY, sessionId] }),
  });
}
