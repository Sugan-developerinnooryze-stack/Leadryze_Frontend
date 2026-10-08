import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellIcon } from '@heroicons/react/24/outline';
import { useQueryClient } from '@tanstack/react-query';
import { getSocket } from '../../services/socket';
import { useAuthStore } from '../../stores/auth.store';
import { usePermission } from '../../hooks/usePermission';
import {
  useNotificationsListQuery, useUnreadCountQuery,
  useMarkNotificationRead, useMarkAllNotificationsRead,
  invalidateNotifications, type AppNotification,
} from '../../modules/native-crm/queries/notifications.queries';

function timeAgo(iso?: string): string {
  if (!iso) return '';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function isUnread(n: AppNotification, myUserId?: string): boolean {
  return n.userId ? !n.isRead : !n.readBy.includes(myUserId ?? '');
}

/** Header bell — gated on the exact same permission the backend's
 * `join-conversations` socket handler checks (native_crm.conversations.view),
 * so a user who can't see the handoff inbox never joins the room or sees
 * the bell populate. Joins globally here (Header renders on every
 * authenticated page) instead of per-page, mirroring the join/listen
 * effect ConversationsInboxPage.tsx already runs for its own live refresh. */
export default function NotificationBell() {
  const canSeeConversations = usePermission('native_crm.conversations.view');
  const navigate = useNavigate();
  const qc = useQueryClient();
  const tenantId = useAuthStore((s) => s.user?.tenantId);
  const myUserId = useAuthStore((s) => s.user?._id);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: notifications = [] } = useNotificationsListQuery(canSeeConversations);
  const { data: unreadCount = 0 } = useUnreadCountQuery(canSeeConversations);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  useEffect(() => {
    if (!open) return;
    const onClickAway = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickAway);
    return () => document.removeEventListener('mousedown', onClickAway);
  }, [open]);

  useEffect(() => {
    if (!canSeeConversations || !tenantId) return;
    const socket = getSocket();
    socket.emit('join-conversations', tenantId);
    const refresh = (): void => invalidateNotifications(qc);
    socket.on('handoff:requested', refresh);
    socket.on('handoff:message', refresh);
    return () => {
      socket.off('handoff:requested', refresh);
      socket.off('handoff:message', refresh);
    };
  }, [canSeeConversations, tenantId, qc]);

  if (!canSeeConversations) return null;

  const handleRowClick = (n: AppNotification) => {
    markRead.mutate(n._id);
    setOpen(false);
    if (n.data?.sessionId) navigate(`/crm/conversations/${n.data.sessionId}`);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        title="Notifications"
        className="relative p-2 text-text-muted hover:text-text-primary rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-all duration-150"
      >
        <BellIcon className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-danger-500 text-white text-[10px] font-bold leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-surface-elevated rounded-2xl border border-border shadow-2xl z-50 overflow-hidden">
          <div className="px-4 py-2.5 bg-background border-b border-border flex items-center justify-between">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                className="text-[10px] text-ryze-500 font-medium hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="px-5 py-8 flex flex-col items-center gap-2 text-center">
              <div className="h-10 w-10 rounded-full bg-black/[0.04] dark:bg-white/[0.06] flex items-center justify-center">
                <BellIcon className="h-5 w-5 text-text-muted" />
              </div>
              <p className="text-sm font-medium text-text-primary">No notifications yet</p>
              <p className="text-xs text-text-muted">New conversations and messages will show up here</p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {notifications.map((n) => {
                const unread = isUnread(n, myUserId);
                return (
                  <button
                    key={n._id}
                    onClick={() => handleRowClick(n)}
                    className="w-full px-4 py-3 flex items-start gap-3 text-left border-b border-border last:border-0 hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-colors"
                  >
                    <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${unread ? 'bg-ryze-600' : 'bg-transparent'}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm truncate ${unread ? 'font-semibold text-text-primary' : 'font-medium text-text-muted'}`}>
                        {n.title}
                      </p>
                      <p className="text-xs text-text-muted truncate mt-0.5">{n.body}</p>
                      <p className="text-[10px] text-text-muted mt-1">{timeAgo(n.createdAt)}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
