import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { getSocket } from '../../../../services/socket';
import { useAuthStore } from '../../../../stores/auth.store';
import { useConversationsListQuery, useConversationQuery, type ConversationStatusTab } from '../../../native-crm/queries/conversations.queries';
import ConversationList from './ConversationList';
import ConversationThread from './ConversationThread';
import ConversationContextPanel from './ConversationContextPanel';

/** The "Connect with an expert" live inbox — 3 columns: the shared claim
 * queue (Waiting/Mine/All), the open thread, and visitor/Lead context.
 * Joins the tenant-wide conversations room once for the page's lifetime
 * (gated server-side on native_crm.conversations.view — see server.ts's
 * join-conversations handler) so the Waiting queue updates with no
 * refresh, matching the "WhatsApp-like" real-time requirement this feature
 * was built for. */
export default function ConversationsInboxPage() {
  const { sessionId: routeSessionId } = useParams<{ sessionId?: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const tenantId = useAuthStore((s) => s.user?.tenantId);
  const [tab, setTab] = useState<ConversationStatusTab>('waiting');
  const [selectedSessionId, setSelectedSessionId] = useState<string | undefined>(routeSessionId);

  const { data, isLoading } = useConversationsListQuery(tab);
  const { data: conversation } = useConversationQuery(selectedSessionId);

  useEffect(() => {
    if (routeSessionId) setSelectedSessionId(routeSessionId);
  }, [routeSessionId]);

  useEffect(() => {
    if (!tenantId) return;
    const socket = getSocket();
    socket.emit('join-conversations', tenantId);
    const refreshList = (): void => { qc.invalidateQueries({ queryKey: ['native-crm', 'conversations', 'list'] }); };
    socket.on('handoff:requested', refreshList);
    socket.on('handoff:claimed', refreshList);
    socket.on('handoff:message', refreshList);
    socket.on('handoff:closed', refreshList);
    return () => {
      socket.off('handoff:requested', refreshList);
      socket.off('handoff:claimed', refreshList);
      socket.off('handoff:message', refreshList);
      socket.off('handoff:closed', refreshList);
    };
  }, [tenantId, qc]);

  const selectConversation = (sessionId: string): void => {
    setSelectedSessionId(sessionId);
    navigate(`/crm/conversations/${sessionId}`, { replace: true });
  };

  return (
    <div className="h-[calc(100vh-4rem)] grid" style={{ gridTemplateColumns: '320px 1fr 280px' }}>
      <ConversationList
        items={data?.items ?? []}
        isLoading={isLoading}
        tab={tab}
        onTabChange={setTab}
        selectedSessionId={selectedSessionId}
        onSelect={selectConversation}
      />
      {selectedSessionId ? (
        <ConversationThread sessionId={selectedSessionId} />
      ) : (
        <div className="flex items-center justify-center text-sm text-text-muted bg-background">
          Select a conversation to view the thread.
        </div>
      )}
      <ConversationContextPanel conversation={conversation} />
    </div>
  );
}
