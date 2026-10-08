import type { ConversationListItem, ConversationStatusTab } from '../../../native-crm/queries/conversations.queries';

const TABS: { key: ConversationStatusTab; label: string }[] = [
  { key: 'waiting', label: 'Waiting' },
  { key: 'mine', label: 'Mine' },
  { key: 'all', label: 'All' },
];

function timeAgo(iso?: string): string {
  if (!iso) return '';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function ConversationList({
  items, isLoading, tab, onTabChange, selectedSessionId, onSelect,
}: {
  items: ConversationListItem[];
  isLoading: boolean;
  tab: ConversationStatusTab;
  onTabChange: (tab: ConversationStatusTab) => void;
  selectedSessionId?: string;
  onSelect: (sessionId: string) => void;
}) {
  return (
    <div className="flex flex-col h-full border-r border-border bg-surface">
      <div className="flex items-center gap-1 px-3 py-2.5 border-b border-border shrink-0">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => onTabChange(t.key)}
            className={`flex-1 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors ${
              tab === t.key
                ? 'bg-ryze-600 text-white'
                : 'text-text-muted hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        {isLoading && <div className="p-4 text-xs text-text-muted">Loading…</div>}
        {!isLoading && items.length === 0 && (
          <div className="p-6 text-center text-xs text-text-muted">No conversations here.</div>
        )}
        {items.map((c) => {
          const active = c.sessionId === selectedSessionId;
          return (
            <button
              key={c.sessionId}
              onClick={() => onSelect(c.sessionId)}
              className={`w-full text-left px-4 py-3 border-b border-border transition-colors ${
                active ? 'bg-ryze-50 dark:bg-ryze-900/20' : 'hover:bg-black/[0.02] dark:hover:bg-white/[0.03]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-text-primary truncate">
                  {c.visitorName || 'Anonymous visitor'}
                </span>
                <span className="text-xs text-text-muted shrink-0">{timeAgo(c.updatedAt)}</span>
              </div>
              <p className="text-xs text-text-muted truncate mt-0.5">
                {c.lastMessage?.content || 'No messages yet'}
              </p>
              <div className="flex items-center gap-1.5 mt-1.5">
                {c.handoffStatus === 'waiting' && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                    Waiting
                  </span>
                )}
                {c.handoffStatus === 'claimed' && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                    {c.assignedToName || 'Claimed'}
                  </span>
                )}
                {(c.handoffStatus === 'none' || !c.handoffStatus) && c.assignedToName && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-black/[0.05] dark:bg-white/[0.08] text-text-muted">
                    Handled by {c.assignedToName}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
