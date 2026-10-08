import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api';

const BASE = '/api/v1/notifications';
const LIST_KEY  = ['notifications', 'list'] as const;
const COUNT_KEY = ['notifications', 'unread-count'] as const;

export interface AppNotification {
  _id: string;
  userId?: string;
  type: 'new_lead' | 'booking' | 'message' | 'system' | 'alert';
  title: string;
  body: string;
  isRead: boolean;
  readBy: string[];
  data?: { sessionId?: string; [key: string]: unknown };
  createdAt: string;
}

export function useNotificationsListQuery(enabled = true) {
  return useQuery({
    queryKey: LIST_KEY,
    queryFn: () => api.get(BASE).then((r) => (r.data.data ?? []) as AppNotification[]),
    enabled,
  });
}

export function useUnreadCountQuery(enabled = true) {
  return useQuery({
    queryKey: COUNT_KEY,
    queryFn: () => api.get(`${BASE}/unread-count`).then((r) => (r.data.data?.count ?? 0) as number),
    enabled,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch(`${BASE}/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LIST_KEY });
      qc.invalidateQueries({ queryKey: COUNT_KEY });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.patch(`${BASE}/read-all`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LIST_KEY });
      qc.invalidateQueries({ queryKey: COUNT_KEY });
    },
  });
}

export function invalidateNotifications(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: LIST_KEY });
  qc.invalidateQueries({ queryKey: COUNT_KEY });
}
