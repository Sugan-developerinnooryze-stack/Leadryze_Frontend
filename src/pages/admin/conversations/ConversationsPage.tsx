import { useEffect, useState, useCallback } from 'react';
import { ArrowPathIcon, ChatBubbleLeftRightIcon, XMarkIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { authService } from '../../../services/auth.service';
import { AdminCard, AdminEmptyState, AdminErrorState } from '../shared/AdminCard';

interface ConversationListItem {
  sessionId: string; tenantId: string; tenantName: string;
  visitorName?: string; visitorEmail?: string; visitorPhone?: string;
  channel: string; escalated: boolean; messageCount: number; lastActivityAt: string;
}
interface ConversationMessageTrace {
  actionType?: string; summary?: string;
  responseSource?: string; responseConfidence?: number;
  promptTokens?: number; completionTokens?: number; totalTokens?: number; estimatedCostUsd?: number;
  stageTimingsMs?: { guardrails: number; rag: number; llm: number };
  toolCalls?: Array<{ name: string; ok: boolean; ms: number }>;
}
interface ConversationMessage {
  role: 'user' | 'assistant' | 'staff' | 'system';
  content: string;
  timestamp: string;
  trace: ConversationMessageTrace | null;
  metadata?: { staffName?: string };
}
interface ConversationDetail {
  sessionId: string; tenantId: string; tenantName: string;
  visitorName?: string; visitorEmail?: string; visitorPhone?: string;
  channel: string; escalated: boolean; messages: ConversationMessage[];
}

const sourceBadge = (source?: string) => {
  if (source === 'product_catalog') return 'bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/20';
  if (source === 'booking') return 'bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-500/20';
  if (source === 'website_rag') return 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20';
  return 'bg-black/[0.04] dark:bg-white/[0.06] text-text-muted border-border';
};

export default function ConversationsPage() {
  const [items, setItems] = useState<ConversationListItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [escalatedFilter, setEscalatedFilter] = useState<'' | 'true' | 'false'>('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(false);
    try {
      const params: Record<string, string> = { page: String(page), limit: '20' };
      if (escalatedFilter) params.escalated = escalatedFilter;
      const res = await authService.adminGetConversations(params);
      setItems(res.data.data.items ?? []);
      setTotalPages(res.data.data.totalPages ?? 1);
    } catch { setError(true); toast.error('Failed to load conversations'); }
    finally { setLoading(false); }
  }, [page, escalatedFilter]);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (sessionId: string) => {
    setSelectedId(sessionId);
    setDetailLoading(true);
    try {
      const res = await authService.adminGetConversationDetail(sessionId);
      setDetail(res.data.data);
    } catch { toast.error('Failed to load conversation detail'); }
    finally { setDetailLoading(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-text-primary">AI Conversation Inspector</h1>
          <p className="text-sm text-text-muted mt-0.5">Every widget conversation, with the technical trace behind each reply.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={escalatedFilter}
            onChange={(e) => { setPage(1); setEscalatedFilter(e.target.value as '' | 'true' | 'false'); }}
            className="text-xs bg-surface border border-border rounded-lg px-3 py-2 text-text-primary"
          >
            <option value="">All conversations</option>
            <option value="true">Escalated only</option>
            <option value="false">Not escalated</option>
          </select>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface border border-border text-xs text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06] disabled:opacity-50 transition-colors">
            <ArrowPathIcon className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <AdminErrorState description="Couldn't load conversations." onRetry={load} />
      ) : (
        <AdminCard>
          {!loading && items.length === 0 ? (
            <AdminEmptyState icon={ChatBubbleLeftRightIcon} title="No conversations found" />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-black/[0.015] dark:bg-white/[0.02] border-b border-border text-text-muted text-xs uppercase tracking-wider">
                  {['Tenant', 'Visitor', 'Channel', 'Messages', 'Escalated', 'Last Activity'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading && items.length === 0
                  ? [0, 1, 2].map((i) => (
                      <tr key={i}><td colSpan={6} className="px-4 py-3"><div className="h-4 bg-black/[0.06] dark:bg-white/[0.08] rounded animate-pulse w-3/4" /></td></tr>
                    ))
                  : items.map((c) => (
                      <tr key={c.sessionId} onClick={() => openDetail(c.sessionId)} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.03] cursor-pointer">
                        <td className="px-4 py-3 text-text-primary font-medium">{c.tenantName}</td>
                        <td className="px-4 py-3 text-text-primary">{c.visitorName || c.visitorEmail || '—'}</td>
                        <td className="px-4 py-3 text-text-muted capitalize">{c.channel}</td>
                        <td className="px-4 py-3 text-text-muted tabular-nums">{c.messageCount}</td>
                        <td className="px-4 py-3">
                          {c.escalated
                            ? <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">Escalated</span>
                            : <span className="text-xs text-text-muted">—</span>}
                        </td>
                        <td className="px-4 py-3 text-text-muted text-xs">{new Date(c.lastActivityAt).toLocaleString()}</td>
                      </tr>
                    ))
                }
              </tbody>
            </table>
          )}
        </AdminCard>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
            className="px-3 py-1.5 rounded-lg border border-border text-xs text-text-muted hover:bg-black/[0.04] dark:hover:bg-white/[0.06] disabled:opacity-40">Previous</button>
          <span className="text-xs text-text-muted">Page {page} of {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
            className="px-3 py-1.5 rounded-lg border border-border text-xs text-text-muted hover:bg-black/[0.04] dark:hover:bg-white/[0.06] disabled:opacity-40">Next</button>
        </div>
      )}

      {selectedId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setSelectedId(null)}>
          <div className="bg-surface-elevated border border-border rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-surface-elevated border-b border-border px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h3 className="text-sm font-semibold text-text-primary">{detail?.tenantName ?? '...'} — {detail?.visitorName || detail?.visitorEmail || 'Anonymous visitor'}</h3>
                <p className="text-xs text-text-muted">{detail?.channel} · {selectedId}</p>
              </div>
              <button onClick={() => setSelectedId(null)} aria-label="Close" className="text-text-muted hover:text-text-primary"><XMarkIcon className="h-5 w-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              {detailLoading ? (
                <div className="flex justify-center py-12">
                  <ArrowPathIcon className="h-5 w-5 animate-spin text-text-muted" />
                </div>
              ) : (detail?.messages ?? []).map((m, i) => (
                m.role === 'system' ? (
                  <div key={i} className="flex justify-center">
                    <span className="text-[11px] text-text-muted bg-black/[0.03] dark:bg-white/[0.05] px-2.5 py-1 rounded-full">{m.content}</span>
                  </div>
                ) : (
                <div key={i} className={`rounded-xl p-4 ${
                  m.role === 'user' ? 'bg-black/[0.02] dark:bg-white/[0.03] ml-8'
                  : m.role === 'staff' ? 'bg-emerald-600/[0.06] border border-emerald-600/20 mr-8'
                  : 'bg-ryze-600/[0.06] border border-ryze-600/20 mr-8'
                }`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                      {m.role === 'user' ? 'Visitor' : m.role === 'staff' ? (m.metadata?.staffName || 'Staff') : 'AI'}
                    </span>
                    <span className="text-[11px] text-text-muted">{new Date(m.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-sm text-text-primary whitespace-pre-wrap">{m.content}</p>
                  {m.trace && (m.trace.responseSource || m.trace.toolCalls?.length || m.trace.totalTokens != null) && (
                    <div className="mt-3 pt-3 border-t border-border flex flex-wrap items-center gap-2 text-[11px]">
                      {m.trace.responseSource && (
                        <span className={`px-2 py-0.5 rounded-full border ${sourceBadge(m.trace.responseSource)}`}>
                          {m.trace.responseSource} {m.trace.responseConfidence != null ? `· ${Math.round(m.trace.responseConfidence * 100)}%` : ''}
                        </span>
                      )}
                      {m.trace.toolCalls?.map((t, ti) => (
                        <span key={ti} className={`px-2 py-0.5 rounded-full border ${t.ok ? 'bg-success-500/10 text-success-700 dark:text-success-500 border-success-500/20' : 'bg-danger-500/10 text-danger-700 dark:text-danger-500 border-danger-500/20'}`}>
                          {t.name} ({t.ms}ms)
                        </span>
                      ))}
                      {m.trace.totalTokens != null && (
                        <span className="text-text-muted tabular-nums">{m.trace.totalTokens} tokens · ${(m.trace.estimatedCostUsd ?? 0).toFixed(5)}</span>
                      )}
                      {m.trace.stageTimingsMs && (
                        <span className="text-text-muted tabular-nums">guardrails {m.trace.stageTimingsMs.guardrails}ms · rag {m.trace.stageTimingsMs.rag}ms · llm {m.trace.stageTimingsMs.llm}ms</span>
                      )}
                    </div>
                  )}
                </div>
                )
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
