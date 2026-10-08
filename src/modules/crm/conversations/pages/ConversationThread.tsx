import { useEffect, useRef, useState, FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowUturnLeftIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { getSocket } from '../../../../services/socket';
import { useAuthStore } from '../../../../stores/auth.store';
import { usePermission } from '../../../../hooks/usePermission';
import {
  useConversationQuery, useClaimConversation, useReplyToConversation, useHandbackConversation,
} from '../../../native-crm/queries/conversations.queries';

interface ThreadMessage { role: string; content: string; timestamp: string; }

function errMsg(err: unknown, fallback: string): string {
  const axiosMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return axiosMsg || fallback;
}

/** The open thread — joins this ONE session's Socket.IO room for as long as
 * it's open (see server.ts's join-session handler) and simply re-fetches on
 * any live event rather than hand-splicing socket payloads into local
 * state; an admin inbox doesn't need the widget's own optimistic-render
 * posture, and this keeps the thread's displayed state always exactly what
 * the database has. */
export default function ConversationThread({ sessionId }: { sessionId: string }) {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const { data: conversation, isLoading } = useConversationQuery(sessionId);
  const claim = useClaimConversation();
  const reply = useReplyToConversation();
  const handback = useHandbackConversation();
  const canClaim    = usePermission('native_crm.conversations.claim');
  const canReply    = usePermission('native_crm.conversations.reply');
  const canHandback = usePermission('native_crm.conversations.handback');
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const socket = getSocket();
    socket.emit('join-session', sessionId);
    const onLiveEvent = (payload?: { sessionId?: string }): void => {
      if (payload?.sessionId && payload.sessionId !== sessionId) return;
      qc.invalidateQueries({ queryKey: ['native-crm', 'conversations', sessionId] });
      qc.invalidateQueries({ queryKey: ['native-crm', 'conversations', 'list'] });
    };
    socket.on('handoff:message', onLiveEvent);
    socket.on('handoff:claimed', onLiveEvent);
    socket.on('handoff:closed', onLiveEvent);
    return () => {
      socket.off('handoff:message', onLiveEvent);
      socket.off('handoff:claimed', onLiveEvent);
      socket.off('handoff:closed', onLiveEvent);
    };
  }, [sessionId, qc]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation?.messages?.length]);

  if (isLoading || !conversation) {
    return <div className="flex-1 flex items-center justify-center text-sm text-text-muted">Loading conversation…</div>;
  }

  const isMine      = conversation.handoffStatus === 'claimed' && String(conversation.assignedToUserId) === String(user?._id);
  const isWaiting   = conversation.handoffStatus === 'waiting';
  const isHandedBack = conversation.handoffStatus === 'none' && !!conversation.assignedToUserId;
  const wasMine     = isHandedBack && String(conversation.assignedToUserId) === String(user?._id);

  const submit = (e: FormEvent): void => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || reply.isPending) return;
    setDraft('');
    reply.mutate({ sessionId, content: text });
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-border bg-surface shrink-0">
        <div>
          <p className="text-sm font-semibold text-text-primary">{conversation.visitorName || 'Anonymous visitor'}</p>
          <p className="text-xs text-text-muted">{conversation.visitorEmail || conversation.visitorPhone || conversation.channel}</p>
        </div>
        <div className="flex items-center gap-2">
          {isWaiting && canClaim && (
            <button
              onClick={() => claim.mutate(sessionId)}
              disabled={claim.isPending}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-ryze-600 text-white hover:bg-ryze-700 disabled:opacity-50"
            >
              Assign to me
            </button>
          )}
          {isMine && canHandback && (
            <button
              onClick={() => handback.mutate(sessionId)}
              disabled={handback.isPending}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-border text-text-primary hover:bg-black/[0.03] dark:hover:bg-white/[0.05] inline-flex items-center gap-1"
            >
              <ArrowUturnLeftIcon className="h-3.5 w-3.5" /> Hand back to AI
            </button>
          )}
        </div>
      </div>

      {(claim.isError || reply.isError || handback.isError) && (
        <div className="px-5 py-2 text-xs text-red-600 bg-red-50 border-b border-red-100 shrink-0">
          {claim.isError && errMsg(claim.error, 'Could not claim this conversation.')}
          {reply.isError && errMsg(reply.error, 'Could not send that reply.')}
          {handback.isError && errMsg(handback.error, 'Could not hand back to the AI.')}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
        {((conversation.messages ?? []) as ThreadMessage[]).map((m, i) => {
          if (m.role === 'system') {
            return (
              <div key={i} className="text-center">
                <span className="text-xs text-text-muted bg-black/[0.03] dark:bg-white/[0.05] px-2.5 py-1 rounded-full">
                  {m.content}
                </span>
              </div>
            );
          }
          const fromVisitor = m.role === 'user';
          return (
            <div key={i} className={`flex ${fromVisitor ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 shadow-sm ${
                fromVisitor
                  ? 'bg-surface border border-border text-text-primary rounded-bl-sm'
                  : 'bg-gradient-to-br from-ryze-600 to-ryze-700 text-white rounded-br-sm'
              }`}>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.content}</p>
                <p className={`text-[10px] mt-1 ${fromVisitor ? 'text-text-muted' : 'text-white/70'}`}>
                  {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={submit} className="flex items-center gap-2 px-4 py-3 border-t border-border bg-surface shrink-0">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={!isMine || !canReply}
          placeholder={
            isMine ? 'Type a reply…'
            : isWaiting ? 'Assign this conversation to yourself to reply'
            : wasMine ? "You handed this back to the AI — it'll return here if the visitor asks for a person again"
            : isHandedBack ? `Handled by ${conversation.assignedToName ?? 'another team member'}, now back with the AI`
            : 'This conversation is not assigned to you'
          }
          className="flex-1 px-4 py-2.5 text-sm rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-ryze-300 disabled:opacity-50 bg-background text-text-primary"
        />
        <button
          type="submit"
          disabled={!isMine || !canReply || !draft.trim() || reply.isPending}
          className="h-10 w-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-ryze-600 to-ryze-700 text-white disabled:opacity-40 shrink-0"
        >
          <PaperAirplaneIcon className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
