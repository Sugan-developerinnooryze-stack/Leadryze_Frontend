import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../../stores/auth.store';
import toast from 'react-hot-toast';
import api from '../../services/api';
import {
  PlusIcon, TrashIcon, PencilIcon, CheckIcon, XMarkIcon,
  ChatBubbleLeftRightIcon, ClockIcon, ChevronDownIcon, ChevronUpIcon,
  UserGroupIcon, ShieldCheckIcon, KeyIcon, LockClosedIcon,
  EyeIcon, EyeSlashIcon,
} from '@heroicons/react/24/outline';

/* ── section wrapper ──────────────────────────────────────────────────── */
function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <div className="mb-5">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-500 mt-0.5">{description}</p>
      </div>
      {children}
    </div>
  );
}

/* ── field row ────────────────────────────────────────────────────────── */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

/* ── Q&A pair types ───────────────────────────────────────────────────── */
interface QnAPair { _id: string; question: string; answer: string; category: string; isActive: boolean; }

/* ── Q&A Training Panel ───────────────────────────────────────────────── */
function BotTrainingPanel() {
  const [pairs, setPairs]       = useState<QnAPair[]>([]);
  const [loading, setLoading]   = useState(true);
  const [editId, setEditId]     = useState<string | null>(null);
  const [newQ, setNewQ]         = useState('');
  const [newA, setNewA]         = useState('');
  const [newCat, setNewCat]     = useState('general');
  const [editQ, setEditQ]       = useState('');
  const [editA, setEditA]       = useState('');
  const [saving, setSaving]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/v1/bot/qna');
      setPairs(res.data.data ?? []);
    } catch { toast.error('Failed to load Q&A pairs'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const addPair = async () => {
    if (!newQ.trim() || !newA.trim()) { toast.error('Question and answer are required'); return; }
    setSaving(true);
    try {
      await api.post('/api/v1/bot/qna', { question: newQ.trim(), answer: newA.trim(), category: newCat });
      setNewQ(''); setNewA(''); setNewCat('general');
      await load();
      toast.success('Q&A pair added — the AI will now use this answer');
    } catch { toast.error('Failed to add Q&A pair'); }
    finally { setSaving(false); }
  };

  const saveEdit = async (id: string) => {
    setSaving(true);
    try {
      await api.put(`/api/v1/bot/qna/${id}`, { question: editQ.trim(), answer: editA.trim() });
      setEditId(null);
      await load();
      toast.success('Updated');
    } catch { toast.error('Failed to update'); }
    finally { setSaving(false); }
  };

  const deletePair = async (id: string) => {
    if (!window.confirm('Delete this Q&A pair?')) return;
    try {
      await api.delete(`/api/v1/bot/qna/${id}`);
      await load();
      toast.success('Deleted');
    } catch { toast.error('Failed to delete'); }
  };

  const startEdit = (p: QnAPair) => { setEditId(p._id); setEditQ(p.question); setEditA(p.answer); };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Bot Training — Q&amp;A Pairs</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Add question &amp; answer pairs to train the AI chatbot. When a user asks something matching a question here, the AI will reply with your exact answer — no guessing.
        </p>
      </div>

      {/* Add new pair */}
      <div className="card space-y-3">
        <p className="text-sm font-semibold text-gray-700">Add New Q&amp;A</p>
        <input
          className="input"
          placeholder="Question — e.g. What is the price of 2GB RAM?"
          value={newQ}
          onChange={(e) => setNewQ(e.target.value)}
        />
        <textarea
          className="input"
          rows={3}
          placeholder="Answer — e.g. The 2GB RAM is priced at ₹1,200 including taxes."
          value={newA}
          onChange={(e) => setNewA(e.target.value)}
        />
        <div className="flex items-center gap-3">
          <select className="input w-40" value={newCat} onChange={(e) => setNewCat(e.target.value)}>
            <option value="general">General</option>
            <option value="pricing">Pricing</option>
            <option value="product">Product</option>
            <option value="support">Support</option>
            <option value="policy">Policy</option>
          </select>
          <button className="btn-primary flex items-center gap-2" onClick={addPair} disabled={saving}>
            <PlusIcon className="h-4 w-4" />
            {saving ? 'Saving…' : 'Add Q&A Pair'}
          </button>
        </div>
      </div>

      {/* Pairs list */}
      <div className="space-y-2">
        {loading ? (
          [0,1,2].map((i) => <div key={i} className="h-20 rounded-xl bg-gray-100 animate-pulse" />)
        ) : pairs.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <ChatBubbleLeftRightIcon className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No Q&amp;A pairs yet. Add your first one above.</p>
          </div>
        ) : (
          pairs.map((p) => (
            <div key={p._id} className="card border border-gray-200">
              {editId === p._id ? (
                <div className="space-y-2">
                  <input className="input text-sm" value={editQ} onChange={(e) => setEditQ(e.target.value)} />
                  <textarea className="input text-sm" rows={2} value={editA} onChange={(e) => setEditA(e.target.value)} />
                  <div className="flex gap-2">
                    <button className="btn-primary text-xs flex items-center gap-1" onClick={() => saveEdit(p._id)} disabled={saving}>
                      <CheckIcon className="h-3.5 w-3.5" /> Save
                    </button>
                    <button className="btn-secondary text-xs flex items-center gap-1" onClick={() => setEditId(null)}>
                      <XMarkIcon className="h-3.5 w-3.5" /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-brand-100 text-brand-700 capitalize">{p.category}</span>
                    </div>
                    <p className="text-sm font-medium text-gray-800">Q: {p.question}</p>
                    <p className="text-sm text-gray-600 mt-1">A: {p.answer}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => startEdit(p)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button onClick={() => deletePair(p._id)} className="p-1.5 rounded hover:bg-red-50 text-red-400">
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ── Chat History Panel ───────────────────────────────────────────────── */
interface ChatMessage { role: 'user' | 'assistant'; content: string; timestamp: string; }
interface ChatSessionRow {
  _id: string; sessionId: string; visitorName?: string; visitorEmail?: string;
  channel: string; escalated: boolean; messages: ChatMessage[]; createdAt: string; updatedAt: string;
}

function ChatHistoryPanel() {
  const [sessions, setSessions]   = useState<ChatSessionRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [expanded, setExpanded]   = useState<string | null>(null);
  const [page, setPage]           = useState(1);
  const [total, setTotal]         = useState(0);
  const perPage = 20;

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await api.get(`/api/v1/bot/chat-history?page=${p}&limit=${perPage}`);
      setSessions(res.data.data.sessions ?? []);
      setTotal(res.data.data.total ?? 0);
    } catch { toast.error('Failed to load chat history'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(page); }, [load, page]);

  const toggle = (id: string) => setExpanded((e) => (e === id ? null : id));

  const relTime = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Chat History</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Every conversation from your AI chatbot — {total} sessions total. Click a session to read the messages.
        </p>
      </div>

      {loading ? (
        [0,1,2,3].map((i) => <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />)
      ) : sessions.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <ClockIcon className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No chat sessions yet. Conversations will appear here once users start chatting.</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {sessions.map((s) => (
              <div key={s._id} className="card border border-gray-200">
                <button className="w-full flex items-center gap-3 text-left" onClick={() => toggle(s._id)}>
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${s.escalated ? 'bg-red-100 text-red-600' : 'bg-brand-100 text-brand-700'}`}>
                    {s.visitorName?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-800 truncate">{s.visitorName || 'Anonymous'}</p>
                      {s.escalated && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">Escalated</span>}
                    </div>
                    <p className="text-xs text-gray-400">{s.messages.length} messages · {relTime(s.updatedAt)}</p>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    {s.visitorEmail && <span className="text-xs text-gray-400 hidden sm:block">{s.visitorEmail}</span>}
                    {expanded === s._id
                      ? <ChevronUpIcon className="h-4 w-4 text-gray-400" />
                      : <ChevronDownIcon className="h-4 w-4 text-gray-400" />}
                  </div>
                </button>

                {expanded === s._id && (
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-2 max-h-80 overflow-y-auto">
                    {s.messages.map((m, i) => (
                      <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] px-3 py-2 rounded-lg text-xs ${m.role === 'user' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
                          {m.content}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {total > perPage && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-gray-500">{total} total sessions</p>
              <div className="flex gap-2">
                <button className="btn-secondary text-xs" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</button>
                <span className="text-xs text-gray-500 flex items-center">Page {page}</span>
                <button className="btn-secondary text-xs" disabled={page * perPage >= total} onClick={() => setPage(p => p + 1)}>Next</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── Users Panel ──────────────────────────────────────────────────────── */
interface RoleRow { _id: string; name: string; isSystem: boolean; }
interface UserRow {
  _id: string; email: string; firstName: string; lastName: string;
  role: string; isActive: boolean; lastLogin?: string;
  roleId?: RoleRow;
}

function UsersPanel() {
  const [users, setUsers]       = useState<UserRow[]>([]);
  const [roles, setRoles]       = useState<RoleRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [resetModal, setResetModal]     = useState<{ id: string; name: string } | null>(null);
  const [resetPwd, setResetPwd]         = useState('');
  const [resetConfirmPwd, setResetConfirmPwd] = useState('');
  const [resetShowPwd, setResetShowPwd]       = useState(false);
  const [resetShowConfirm, setResetShowConfirm] = useState(false);
  const [saving, setSaving]       = useState(false);

  const [newEmail, setNewEmail]     = useState('');
  const [newFirst, setNewFirst]     = useState('');
  const [newLast, setNewLast]       = useState('');
  const [newRole, setNewRole]       = useState('AGENT');
  const [newRoleId, setNewRoleId]   = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [uRes, rRes] = await Promise.all([
        api.get('/api/v1/users?limit=50'),
        api.get('/api/v1/roles'),
      ]);
      setUsers(uRes.data.data ?? []);
      setRoles(rRes.data.data ?? []);
    } catch { toast.error('Failed to load users'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const inviteUser = async () => {
    if (!newEmail.trim() || !newFirst.trim() || !newLast.trim()) {
      toast.error('Email, first name and last name are required'); return;
    }
    setSaving(true);
    try {
      await api.post('/api/v1/users', {
        email: newEmail.trim(), firstName: newFirst.trim(), lastName: newLast.trim(),
        role: newRole, roleId: newRoleId || undefined,
      });
      toast.success('User invited — welcome email sent');
      setNewEmail(''); setNewFirst(''); setNewLast(''); setNewRole('AGENT'); setNewRoleId('');
      setShowInvite(false);
      await load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Failed to invite user');
    } finally { setSaving(false); }
  };

  const deactivate = async (id: string) => {
    if (!window.confirm('Deactivate this user? They will not be able to log in.')) return;
    try {
      await api.delete(`/api/v1/users/${id}`);
      toast.success('User deactivated');
      await load();
    } catch { toast.error('Failed to deactivate user'); }
  };

  const doResetPwd = async () => {
    if (!resetPwd || resetPwd.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    if (resetPwd !== resetConfirmPwd) { toast.error('Passwords do not match'); return; }
    if (!resetModal) return;
    setSaving(true);
    try {
      await api.post(`/api/v1/users/${resetModal.id}/reset-password`, { password: resetPwd });
      toast.success(`Password reset for ${resetModal.name}`);
      setResetModal(null); setResetPwd(''); setResetConfirmPwd('');
    } catch { toast.error('Failed to reset password'); }
    finally { setSaving(false); }
  };

  const getAvatarColor = (email: string) => {
    const colors = ['bg-blue-500','bg-violet-500','bg-emerald-500','bg-orange-500','bg-pink-500','bg-teal-500','bg-indigo-500','bg-amber-500'];
    let h = 0;
    for (const c of email) h = c.charCodeAt(0) + ((h << 5) - h);
    return colors[Math.abs(h) % colors.length];
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Members', value: users.length,                        color: 'text-gray-900' },
            { label: 'Active',        value: users.filter(u => u.isActive).length,  color: 'text-emerald-600' },
            { label: 'Deactivated',   value: users.filter(u => !u.isActive).length, color: 'text-red-500' },
            { label: 'Roles',         value: roles.length,                          color: 'text-brand-600' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-200 p-4">
              <p className="text-xs text-gray-400 font-medium">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Team Members</h2>
          <p className="text-sm text-gray-500">Invite and manage workspace members.</p>
        </div>
        <button
          onClick={() => setShowInvite(v => !v)}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors"
        >
          <PlusIcon className="h-4 w-4" /> Invite Member
        </button>
      </div>

      {/* Invite form */}
      {showInvite && (
        <div className="bg-brand-50 border border-brand-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <UserGroupIcon className="h-5 w-5 text-brand-600" />
            <p className="text-sm font-semibold text-gray-900">Invite New Team Member</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">First Name *</label>
              <input className="input text-sm" placeholder="First name" value={newFirst} onChange={e => setNewFirst(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Last Name *</label>
              <input className="input text-sm" placeholder="Last name" value={newLast} onChange={e => setNewLast(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Email Address *</label>
            <input className="input text-sm" type="email" placeholder="team@company.com" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Role Type</label>
              <select className="input text-sm" value={newRole} onChange={e => setNewRole(e.target.value)}>
                <option value="MANAGER">Manager</option>
                <option value="AGENT">Agent</option>
                <option value="USER">User</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Permission Role</label>
              <select className="input text-sm" value={newRoleId} onChange={e => setNewRoleId(e.target.value)}>
                <option value="">— Auto-assign from type —</option>
                {roles.map(r => <option key={r._id} value={r._id}>{r.name}{r.isSystem ? ' (system)' : ''}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={inviteUser} disabled={saving}
              className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors">
              {saving ? 'Sending…' : 'Send Invitation'}
            </button>
            <button onClick={() => setShowInvite(false)}
              className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* User cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0,1,2].map(i => <div key={i} className="h-40 rounded-2xl bg-gray-100 animate-pulse" />)}
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200 text-gray-400">
          <UserGroupIcon className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No team members yet</p>
          <p className="text-xs mt-1">Invite your first member using the button above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.map(u => (
            <div key={u._id} className={`bg-white rounded-2xl border flex flex-col gap-4 p-5 ${u.isActive ? 'border-gray-200' : 'border-gray-100 opacity-55'}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`h-11 w-11 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 ${getAvatarColor(u.email)}`}>
                    {(u.firstName[0] ?? '').toUpperCase()}{(u.lastName[0] ?? '').toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 text-sm leading-snug">{u.firstName} {u.lastName}</p>
                    <p className="text-xs text-gray-400 truncate max-w-[140px]">{u.email}</p>
                  </div>
                </div>
                <span className={`h-2.5 w-2.5 rounded-full shrink-0 mt-1 ${u.isActive ? 'bg-emerald-400' : 'bg-gray-300'}`} title={u.isActive ? 'Active' : 'Deactivated'} />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 font-medium capitalize">{u.role.toLowerCase()}</span>
                {u.roleId && <span className="text-xs px-2.5 py-1 rounded-lg bg-brand-100 text-brand-700 font-medium">{u.roleId.name}</span>}
              </div>
              <div className="flex items-center gap-2 pt-1 border-t border-gray-100 mt-auto">
                <button
                  onClick={() => { setResetModal({ id: u._id, name: `${u.firstName} ${u.lastName}` }); setResetPwd(''); }}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors"
                >
                  <KeyIcon className="h-3.5 w-3.5" /> Reset PW
                </button>
                {u.isActive && (
                  <button onClick={() => deactivate(u._id)}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2 border border-red-200 rounded-lg text-red-500 hover:bg-red-50 transition-colors">
                    <TrashIcon className="h-3.5 w-3.5" /> Deactivate
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reset password modal */}
      {resetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => { setResetModal(null); setResetPwd(''); setResetConfirmPwd(''); }}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                <KeyIcon className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Reset Password</h3>
                <p className="text-xs text-gray-500">{resetModal.name}</p>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">New Password <span className="text-gray-400">(min 8 chars)</span></label>
              <div className="relative">
                <input
                  type={resetShowPwd ? 'text' : 'password'}
                  className="input pr-10"
                  placeholder="Enter new password"
                  value={resetPwd}
                  onChange={e => setResetPwd(e.target.value)}
                  autoFocus
                />
                <button type="button"
                  onClick={() => setResetShowPwd(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                  {resetShowPwd ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Confirm New Password</label>
              <div className="relative">
                <input
                  type={resetShowConfirm ? 'text' : 'password'}
                  className={`input pr-10 ${resetConfirmPwd && resetConfirmPwd !== resetPwd ? 'border-red-400 focus:ring-red-400' : ''}`}
                  placeholder="Re-enter new password"
                  value={resetConfirmPwd}
                  onChange={e => setResetConfirmPwd(e.target.value)}
                />
                <button type="button"
                  onClick={() => setResetShowConfirm(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                  {resetShowConfirm ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                </button>
              </div>
              {resetConfirmPwd && resetConfirmPwd !== resetPwd && (
                <p className="text-[11px] text-red-500 mt-1">Passwords do not match</p>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={doResetPwd} disabled={saving}
                className="flex-1 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors">
                {saving ? 'Resetting…' : 'Reset Password'}
              </button>
              <button onClick={() => { setResetModal(null); setResetPwd(''); setResetConfirmPwd(''); }}
                className="flex-1 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Roles Panel ──────────────────────────────────────────────────────── */
interface RoleDetail { _id: string; name: string; description: string; isSystem: boolean; userCount?: number; }

const ROLE_GRADIENTS = [
  'from-blue-500 to-blue-600', 'from-violet-500 to-violet-600',
  'from-emerald-500 to-emerald-600', 'from-orange-500 to-orange-600',
  'from-pink-500 to-pink-600', 'from-indigo-500 to-indigo-600',
  'from-teal-500 to-teal-600', 'from-amber-500 to-amber-600',
];

function RolesPanel() {
  const [roles, setRoles]         = useState<RoleDetail[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editRole, setEditRole]   = useState<RoleDetail | null>(null);
  const [name, setName]           = useState('');
  const [desc, setDesc]           = useState('');
  const [saving, setSaving]       = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/v1/roles');
      setRoles(res.data.data ?? []);
    } catch { toast.error('Failed to load roles'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const createRole = async () => {
    if (!name.trim()) { toast.error('Role name is required'); return; }
    setSaving(true);
    try {
      await api.post('/api/v1/roles', { name: name.trim(), description: desc.trim() });
      toast.success('Role created');
      setName(''); setDesc(''); setShowCreate(false);
      await load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Failed to create role');
    } finally { setSaving(false); }
  };

  const saveEdit = async () => {
    if (!editRole || !name.trim()) return;
    setSaving(true);
    try {
      await api.put(`/api/v1/roles/${editRole._id}`, { name: name.trim(), description: desc.trim() });
      toast.success('Role updated');
      setEditRole(null);
      await load();
    } catch { toast.error('Failed to update role'); }
    finally { setSaving(false); }
  };

  const cloneRole = async (role: RoleDetail) => {
    try {
      await api.post(`/api/v1/roles/${role._id}/clone`, { name: `${role.name} (Copy)` });
      toast.success(`Cloned "${role.name}"`);
      await load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Failed to clone role');
    }
  };

  const deleteRole = async (role: RoleDetail) => {
    if (role.isSystem) { toast.error('System roles cannot be deleted'); return; }
    if (!window.confirm(`Delete role "${role.name}"? Users assigned to it will lose their role.`)) return;
    try {
      await api.delete(`/api/v1/roles/${role._id}`);
      toast.success('Role deleted');
      await load();
    } catch { toast.error('Failed to delete role'); }
  };

  const startEdit = (r: RoleDetail) => { setEditRole(r); setName(r.name); setDesc(r.description); setShowCreate(false); };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Roles</h2>
          <p className="text-sm text-gray-500">Create and manage roles. Assign permissions per role in the Permissions tab.</p>
        </div>
        <button
          onClick={() => { setShowCreate(v => !v); setEditRole(null); setName(''); setDesc(''); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors"
        >
          <PlusIcon className="h-4 w-4" /> New Role
        </button>
      </div>

      {/* Create / Edit form */}
      {(showCreate || editRole) && (
        <div className="bg-brand-50 border border-brand-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheckIcon className="h-5 w-5 text-brand-600" />
            <p className="text-sm font-semibold text-gray-900">{editRole ? `Edit: ${editRole.name}` : 'Create New Role'}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Role Name *</label>
            <input className="input text-sm" placeholder="e.g. Sales Manager, Support Agent" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Description</label>
            <input className="input text-sm" placeholder="Brief description of this role's responsibilities" value={desc} onChange={e => setDesc(e.target.value)} />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={editRole ? saveEdit : createRole} disabled={saving}
              className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors">
              {saving ? 'Saving…' : editRole ? 'Save Changes' : 'Create Role'}
            </button>
            <button onClick={() => { setShowCreate(false); setEditRole(null); }}
              className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Role cards grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0,1,2].map(i => <div key={i} className="h-48 rounded-2xl bg-gray-100 animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {roles.map((r, idx) => (
            <div key={r._id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden flex flex-col">
              {/* Gradient header */}
              <div className={`bg-gradient-to-r ${ROLE_GRADIENTS[idx % ROLE_GRADIENTS.length]} p-5`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="h-10 w-10 bg-white/20 rounded-xl flex items-center justify-center">
                    {r.isSystem
                      ? <LockClosedIcon className="h-5 w-5 text-white" />
                      : <ShieldCheckIcon className="h-5 w-5 text-white" />}
                  </div>
                  {r.isSystem && (
                    <span className="text-[10px] font-semibold bg-white/25 text-white px-2 py-0.5 rounded-full uppercase tracking-wide">System</span>
                  )}
                </div>
                <h3 className="text-white font-bold text-base leading-snug">{r.name}</h3>
                <p className="text-white/70 text-xs mt-0.5 line-clamp-1">{r.description || 'No description'}</p>
              </div>
              {/* Card body */}
              <div className="p-4 flex flex-col gap-4 flex-1">
                <div className="flex items-center gap-1.5">
                  <UserGroupIcon className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-500">{r.userCount ?? 0} member{r.userCount !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center gap-2 mt-auto">
                  <button onClick={() => startEdit(r)}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
                    <PencilIcon className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button onClick={() => cloneRole(r)}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
                    <PlusIcon className="h-3.5 w-3.5" /> Clone
                  </button>
                  {!r.isSystem && (
                    <button onClick={() => deleteRole(r)}
                      className="flex items-center justify-center text-xs py-2 px-2.5 border border-red-200 rounded-lg text-red-500 hover:bg-red-50 transition-colors">
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Native CRM Permissions Panel ────────────────────────────────────── */
const PII_MODULES = [
  { key: 'customers', label: 'Customers', fields: 'Phone, Email, Address, GST, PAN' },
  { key: 'leads',     label: 'Leads',     fields: 'Phone, Email, Address, WhatsApp' },
  { key: 'contacts',  label: 'Contacts',  fields: 'Phone, Email' },
  { key: 'staffs',    label: 'Staff',     fields: 'Phone, Email' },
  { key: 'sites',     label: 'Sites',     fields: 'Address, Phone' },
];

interface PermRow { _id: string; key: string; module: string; resource: string; action: string; label: string; scope: string; }
interface AssignedPerm { key: string; }

function NativeCRMPermissionsPanel() {
  const [roles, setRoles]             = useState<RoleDetail[]>([]);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [allPerms, setAllPerms]       = useState<Record<string, PermRow[]>>({});
  const [assigned, setAssigned]       = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed]     = useState<Set<string>>(new Set());
  const [saving, setSaving]           = useState(false);
  const [piiConfig, setPiiConfig]     = useState<Array<{ module: string; viewRoles: string[] }>>([]);
  const [piiSaving, setPiiSaving]     = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/api/v1/roles'),
      api.get('/api/v1/permissions?group=1'),
      api.get('/api/v1/native-crm/fs-settings'),
    ]).then(([rolesRes, permsRes, settingsRes]) => {
      const roleList: RoleDetail[] = rolesRes.data.data ?? [];
      setRoles(roleList);
      if (roleList.length) setSelectedRole(roleList[0]._id);
      const grouped: Record<string, PermRow[]> = permsRes.data.data ?? {};
      const filtered: Record<string, PermRow[]> = {};
      ['native_crm', 'fs'].forEach(m => { if (grouped[m]) filtered[m] = grouped[m]; });
      setAllPerms(filtered);
      setPiiConfig(settingsRes.data.data?.piiConfig ?? []);
    }).catch(() => toast.error('Failed to load Native CRM permissions'));
  }, []);

  useEffect(() => {
    if (!selectedRole) return;
    api.get(`/api/v1/roles/${selectedRole}/permissions`)
      .then(r => setAssigned(new Set((r.data.data ?? []).map((p: AssignedPerm) => p.key))))
      .catch(() => toast.error('Failed to load role permissions'));
  }, [selectedRole]);

  const toggle = (key: string) => setAssigned(prev => {
    const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s;
  });

  const toggleModule = (keys: string[]) => {
    const allOn = keys.every(k => assigned.has(k));
    setAssigned(prev => {
      const s = new Set(prev);
      keys.forEach(k => allOn ? s.delete(k) : s.add(k));
      return s;
    });
  };

  const savePermissions = async () => {
    if (!selectedRole) return;
    setSaving(true);
    try {
      const role = roles.find(r => r._id === selectedRole);
      await api.put(`/api/v1/roles/${selectedRole}/permissions`, { permissions: [...assigned] });
      toast.success(`Permissions saved for ${role?.name ?? 'role'}`);
    } catch { toast.error('Failed to save permissions'); }
    finally { setSaving(false); }
  };

  const savePII = async () => {
    setPiiSaving(true);
    try {
      await api.put('/api/v1/native-crm/fs-settings', { piiConfig });
      toast.success('PII settings saved');
    } catch { toast.error('Failed to save PII settings'); }
    finally { setPiiSaving(false); }
  };

  const togglePIIManager = (module: string) => {
    setPiiConfig(prev => {
      const others = prev.filter(p => p.module !== module);
      const current = prev.find(p => p.module === module);
      const existingRoles = current?.viewRoles ?? [];
      const newRoles = existingRoles.includes('MANAGER')
        ? existingRoles.filter(r => r !== 'MANAGER')
        : [...existingRoles, 'MANAGER'];
      return [...others, { module, viewRoles: newRoles }];
    });
  };

  const MOD_LABELS: Record<string, string> = { native_crm: 'Native CRM', fs: 'Field Service' };
  const selectedRoleObj = roles.find(r => r._id === selectedRole);

  return (
    <div className="flex gap-5 min-h-[600px]">
      {/* Left: role selector */}
      <div className="w-52 shrink-0 flex flex-col gap-2">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-1 mb-1">Select Role</p>
        {roles.map((role, idx) => (
          <button
            key={role._id}
            onClick={() => setSelectedRole(role._id)}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl border text-left transition-all ${
              selectedRole === role._id
                ? 'bg-brand-50 border-brand-200 shadow-sm'
                : 'bg-white border-gray-200 hover:bg-gray-50'
            }`}
          >
            <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${ROLE_GRADIENTS[idx % ROLE_GRADIENTS.length]} flex items-center justify-center shrink-0`}>
              {role.isSystem ? <LockClosedIcon className="h-4 w-4 text-white" /> : <ShieldCheckIcon className="h-4 w-4 text-white" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-medium truncate ${selectedRole === role._id ? 'text-brand-700' : 'text-gray-800'}`}>{role.name}</p>
              <p className="text-[10px] text-gray-400">{role.isSystem ? 'system role' : 'custom role'}</p>
            </div>
            {selectedRole === role._id && <div className="h-2 w-2 rounded-full bg-brand-500 shrink-0" />}
          </button>
        ))}
      </div>

      {/* Right: permission matrix + PII */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            {selectedRoleObj && (
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-gray-900">{selectedRoleObj.name}</h2>
                {selectedRoleObj.isSystem && <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">system</span>}
              </div>
            )}
            <p className="text-xs text-gray-400 mt-0.5">Showing Native CRM and Field Service permissions only.</p>
          </div>
          <button onClick={savePermissions} disabled={saving || !selectedRole}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors shrink-0">
            <CheckIcon className="h-4 w-4" />
            {saving ? 'Saving…' : 'Save Permissions'}
          </button>
        </div>

        {/* Module accordions */}
        {Object.keys(allPerms).length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200 text-gray-400">
            <KeyIcon className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No Native CRM or Field Service permissions found. They appear after the app starts.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {Object.keys(allPerms).sort().map(mod => {
              const perms = allPerms[mod] ?? [];
              const byResource: Record<string, PermRow[]> = {};
              for (const p of perms) {
                if (!byResource[p.resource]) byResource[p.resource] = [];
                byResource[p.resource].push(p);
              }
              const resources = Object.keys(byResource).sort();
              const allModKeys = perms.map(p => p.key);
              const checkedCount = allModKeys.filter(k => assigned.has(k)).length;
              const allChecked = checkedCount === allModKeys.length;
              const isOpen = !collapsed.has(mod);
              const availActions = Array.from(new Set(perms.map(p => p.action)))
                .sort((a, b) => {
                  const ai = ACTION_ORDER.indexOf(a), bi = ACTION_ORDER.indexOf(b);
                  return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
                });
              const modColor = MOD_COLOR[mod] ?? 'bg-gray-100 text-gray-600 border-gray-200';

              return (
                <div key={mod} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3 bg-gray-50/60">
                    <button onClick={() => setCollapsed(prev => { const s = new Set(prev); isOpen ? s.add(mod) : s.delete(mod); return s; })}
                      className="flex-1 flex items-center gap-3 text-left min-w-0">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wide border ${modColor}`}>
                        {MOD_LABELS[mod] ?? mod}
                      </span>
                      <span className="text-xs text-gray-400 shrink-0">
                        {checkedCount === 0 ? 'None granted' : allChecked ? 'All granted' : `${checkedCount}/${allModKeys.length}`}
                      </span>
                      {checkedCount > 0 && !allChecked && (
                        <div className="max-w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${(checkedCount / allModKeys.length) * 100}%` }} />
                        </div>
                      )}
                      <ChevronDownIcon className={`h-4 w-4 text-gray-400 ml-auto transition-transform duration-150 ${isOpen ? '' : '-rotate-90'}`} />
                    </button>
                    <button onClick={() => toggleModule(allModKeys)}
                      className={`text-[11px] font-medium px-2.5 py-1 rounded-lg border shrink-0 transition-colors ${
                        allChecked
                          ? 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'
                          : 'bg-brand-50 border-brand-200 text-brand-600 hover:bg-brand-100'
                      }`}>
                      {allChecked ? 'Clear all' : 'Grant all'}
                    </button>
                  </div>

                  {isOpen && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-gray-100 bg-white">
                            <th className="text-left py-2 pl-5 pr-4 font-medium text-gray-400 w-44">Resource</th>
                            {availActions.map(a => (
                              <th key={a} className="text-center py-2 px-3 font-medium text-gray-400 capitalize whitespace-nowrap">{a}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {resources.map(res => {
                            const resPerms = byResource[res];
                            const resKeys = resPerms.map(p => p.key);
                            const allResChecked = resKeys.every(k => assigned.has(k));
                            return (
                              <tr key={res} className="hover:bg-gray-50/60 transition-colors">
                                <td className="py-2.5 pl-5 pr-4">
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={allResChecked} onChange={() => toggleModule(resKeys)}
                                      className="h-3.5 w-3.5 rounded border-gray-300 text-brand-600 cursor-pointer" />
                                    <span className="truncate max-w-[130px] text-gray-700 font-medium">{res}</span>
                                  </label>
                                </td>
                                {availActions.map(action => {
                                  const perm = resPerms.find(p => p.action === action);
                                  return (
                                    <td key={action} className="text-center py-2.5 px-3">
                                      {perm ? (
                                        <input type="checkbox" checked={assigned.has(perm.key)} onChange={() => toggle(perm.key)}
                                          className="h-4 w-4 text-brand-600 rounded border-gray-300 cursor-pointer" />
                                      ) : (
                                        <span className="text-gray-200 text-base select-none">·</span>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* PII Field Visibility */}
        <div className="mt-2 pt-6 border-t border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">PII &amp; Field Visibility</h3>
          <p className="text-xs text-gray-400 mb-4">
            Controls which roles can view sensitive fields (phone, email, address, GST, PAN) in the Default Company.
            Admins always see unmasked values. For per-branch settings, use FS Settings → Permission tab.
          </p>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/60 border-b border-gray-100">
                <tr>
                  <th className="text-left text-xs font-medium text-gray-400 px-5 py-2.5">Module</th>
                  <th className="text-left text-xs font-medium text-gray-400 px-4 py-2.5">Fields Protected</th>
                  <th className="text-left text-xs font-medium text-gray-400 px-4 py-2.5">Managers Can View</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {PII_MODULES.map(piiMod => {
                  const cfg = piiConfig.find(p => p.module === piiMod.key);
                  const on = cfg?.viewRoles?.includes('MANAGER') ?? false;
                  return (
                    <tr key={piiMod.key} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-5 py-3 font-medium text-gray-800 text-sm">{piiMod.label}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">{piiMod.fields}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => togglePIIManager(piiMod.key)}
                          className={`relative inline-flex h-5 w-9 rounded-full transition-colors duration-150 ${on ? 'bg-indigo-500' : 'bg-gray-200'}`}>
                          <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-150 ${on ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button onClick={savePII} disabled={piiSaving}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
            <CheckIcon className="h-4 w-4" />
            {piiSaving ? 'Saving…' : 'Save PII Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Permission Matrix Panel ──────────────────────────────────────────── */

// Logical CRUD order for action columns — not alphabetical
const ACTION_ORDER = ['view', 'create', 'edit', 'delete', 'export', 'import', 'assign', 'configure', 'sync', 'manage', 'use'];

const MOD_COLOR: Record<string, string> = {
  analytics:  'bg-amber-100 text-amber-700 border-amber-200',
  bot:        'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200',
  campaigns:  'bg-purple-100 text-purple-700 border-purple-200',
  connector:  'bg-blue-100 text-blue-700 border-blue-200',
  customers:  'bg-orange-100 text-orange-700 border-orange-200',
  knowledge:  'bg-rose-100 text-rose-700 border-rose-200',
  logs:       'bg-gray-100 text-gray-600 border-gray-200',
  native_crm: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  fs:         'bg-sky-100 text-sky-700 border-sky-200',
  roles:      'bg-violet-100 text-violet-700 border-violet-200',
  settings:   'bg-slate-100 text-slate-600 border-slate-200',
  templates:  'bg-indigo-100 text-indigo-700 border-indigo-200',
  users:      'bg-teal-100 text-teal-700 border-teal-200',
};

function PermissionMatrixPanel() {
  const [roles, setRoles]               = useState<RoleDetail[]>([]);
  const [selectedRole, setSelectedRole] = useState('');
  const [allUsers, setAllUsers]         = useState<UserRow[]>([]);
  const [selectedUser, setSelectedUser] = useState('all');
  const [allPerms, setAllPerms]         = useState<Record<string, PermRow[]>>({});
  const [assigned, setAssigned]         = useState<Set<string>>(new Set());
  const [loading, setLoading]           = useState(false);
  const [saving, setSaving]             = useState(false);
  const [collapsedMods, setCollapsedMods] = useState<Set<string>>(new Set());

  // Load roles + all users + permissions on mount
  useEffect(() => {
    Promise.all([
      api.get('/api/v1/roles'),
      api.get('/api/v1/users?limit=100'),
      api.get('/api/v1/permissions?group=1'),
    ]).then(([rRes, uRes, pRes]) => {
      const roleList: RoleDetail[] = rRes.data.data ?? [];
      setRoles(roleList);
      setAllUsers(uRes.data.data ?? []);
      setAllPerms(pRes.data.data ?? {});
      if (roleList.length) setSelectedRole(roleList[0]._id);
    }).catch(() => toast.error('Failed to load permissions data'));
  }, []);

  // Load assigned permissions when selected role changes
  useEffect(() => {
    if (!selectedRole) return;
    setSelectedUser('all');
    setLoading(true);
    api.get(`/api/v1/roles/${selectedRole}/permissions`).then(r => {
      const perms: AssignedPerm[] = r.data.data ?? [];
      setAssigned(new Set(perms.map(p => p.key)));
    }).catch(() => toast.error('Failed to load permissions'))
    .finally(() => setLoading(false));
  }, [selectedRole]);

  const roleUsers = allUsers.filter(u => u.roleId?._id === selectedRole);
  const selectedRoleObj = roles.find(r => r._id === selectedRole);
  const selectedUserObj = selectedUser !== 'all' ? allUsers.find(u => u._id === selectedUser) : null;

  const toggle = (key: string) => {
    setAssigned(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleModule = (keys: string[]) => {
    const allOn = keys.every(k => assigned.has(k));
    setAssigned(prev => {
      const next = new Set(prev);
      for (const k of keys) { if (allOn) next.delete(k); else next.add(k); }
      return next;
    });
  };

  const toggleCollapse = (mod: string) => {
    setCollapsedMods(prev => {
      const next = new Set(prev);
      if (next.has(mod)) next.delete(mod); else next.add(mod);
      return next;
    });
  };

  const save = async () => {
    if (!selectedRole) return;
    setSaving(true);
    try {
      await api.put(`/api/v1/roles/${selectedRole}/permissions`, { permissions: [...assigned] });
      toast.success(`Permissions saved for ${selectedRoleObj?.name ?? 'role'}`);
    } catch { toast.error('Failed to save permissions'); }
    finally { setSaving(false); }
  };

  const moduleGroups = Object.keys(allPerms).sort();

  return (
    <div className="flex gap-5 min-h-[600px]">
      {/* Left: role selector */}
      <div className="w-52 shrink-0 flex flex-col gap-2">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-1 mb-1">Select Role</p>
        {roles.map((r, idx) => (
          <button
            key={r._id}
            onClick={() => setSelectedRole(r._id)}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl border text-left transition-all ${
              selectedRole === r._id
                ? 'bg-brand-50 border-brand-200 shadow-sm'
                : 'bg-white border-gray-200 hover:bg-gray-50'
            }`}
          >
            <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${ROLE_GRADIENTS[idx % ROLE_GRADIENTS.length]} flex items-center justify-center shrink-0`}>
              {r.isSystem ? <LockClosedIcon className="h-4 w-4 text-white" /> : <ShieldCheckIcon className="h-4 w-4 text-white" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-medium truncate ${selectedRole === r._id ? 'text-brand-700' : 'text-gray-800'}`}>{r.name}</p>
              <p className="text-[10px] text-gray-400">{allUsers.filter(u => u.roleId?._id === r._id).length} user(s)</p>
            </div>
            {selectedRole === r._id && <div className="h-2 w-2 rounded-full bg-brand-500 shrink-0" />}
          </button>
        ))}
      </div>

      {/* Right: permission matrix */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Top bar */}
        <div className="flex items-start justify-between gap-4">
          <div>
            {selectedRoleObj && (
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-gray-900">{selectedRoleObj.name}</h2>
                {selectedRoleObj.isSystem && <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">system</span>}
              </div>
            )}
            <p className="text-xs text-gray-400 mt-0.5">Changes apply to the entire role — all users with this role are affected.</p>
          </div>
          <button onClick={save} disabled={saving || !selectedRole}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors shrink-0">
            <CheckIcon className="h-4 w-4" />
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>

        {/* User context selector */}
        <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 px-4 py-3">
          <UserGroupIcon className="h-4 w-4 text-gray-400 shrink-0" />
          <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)}
            disabled={roleUsers.length === 0}
            className="flex-1 text-sm text-gray-700 bg-transparent border-none outline-none cursor-pointer">
            <option value="all">
              {roleUsers.length > 0
                ? `All ${roleUsers.length} user(s) in this role will be affected`
                : 'No users assigned to this role yet'}
            </option>
            {roleUsers.map(u => (
              <option key={u._id} value={u._id}>{u.firstName} {u.lastName} — {u.email}</option>
            ))}
          </select>
          {selectedUserObj && (
            <span className="text-xs text-brand-600 font-medium shrink-0">Context: {selectedUserObj.firstName}</span>
          )}
        </div>

        {/* Collapse / expand all */}
        {!loading && moduleGroups.length > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">{assigned.size} permissions granted · {moduleGroups.length} modules</span>
            <button onClick={() => setCollapsedMods(new Set(moduleGroups))}
              className="text-xs text-gray-400 hover:text-gray-700 underline underline-offset-2">Collapse all</button>
            <button onClick={() => setCollapsedMods(new Set())}
              className="text-xs text-gray-400 hover:text-gray-700 underline underline-offset-2">Expand all</button>
          </div>
        )}

        {/* Module accordions */}
        {loading ? (
          <div className="space-y-3">
            {[0,1,2,3].map(i => <div key={i} className="h-14 rounded-xl bg-gray-100 animate-pulse" />)}
          </div>
        ) : moduleGroups.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200 text-gray-400">
            <KeyIcon className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No permissions seeded yet. They appear on startup and after connector sync.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {moduleGroups.map(mod => {
              const perms = allPerms[mod] ?? [];
              const byResource: Record<string, PermRow[]> = {};
              for (const p of perms) {
                if (!byResource[p.resource]) byResource[p.resource] = [];
                byResource[p.resource].push(p);
              }
              const resources = Object.keys(byResource).sort();
              const allModuleKeys = perms.map(p => p.key);
              const checkedCount = allModuleKeys.filter(k => assigned.has(k)).length;
              const availActions = Array.from(new Set(perms.map(p => p.action)))
                .sort((a, b) => {
                  const ai = ACTION_ORDER.indexOf(a);
                  const bi = ACTION_ORDER.indexOf(b);
                  return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
                });
              const isCollapsed = collapsedMods.has(mod);
              const allChecked = checkedCount === allModuleKeys.length;
              const modColor = MOD_COLOR[mod] ?? 'bg-gray-100 text-gray-600 border-gray-200';

              return (
                <div key={mod} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  {/* Module header */}
                  <div className="flex items-center gap-3 px-4 py-3 bg-gray-50/60">
                    <button onClick={() => toggleCollapse(mod)} className="flex-1 flex items-center gap-3 text-left min-w-0">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wide border ${modColor}`}>{mod}</span>
                      <span className="text-xs text-gray-400 shrink-0">
                        {checkedCount === 0 ? 'None granted' : checkedCount === allModuleKeys.length ? 'All granted' : `${checkedCount}/${allModuleKeys.length}`}
                      </span>
                      {checkedCount > 0 && checkedCount < allModuleKeys.length && (
                        <div className="max-w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${(checkedCount / allModuleKeys.length) * 100}%` }} />
                        </div>
                      )}
                      <ChevronDownIcon className={`h-4 w-4 text-gray-400 ml-auto transition-transform duration-150 ${isCollapsed ? '-rotate-90' : ''}`} />
                    </button>
                    <button
                      onClick={() => toggleModule(allModuleKeys)}
                      className={`text-[11px] font-medium px-2.5 py-1 rounded-lg border shrink-0 transition-colors ${
                        allChecked
                          ? 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'
                          : 'bg-brand-50 border-brand-200 text-brand-600 hover:bg-brand-100'
                      }`}
                    >
                      {allChecked ? 'Clear all' : 'Grant all'}
                    </button>
                  </div>

                  {/* Resource rows */}
                  {!isCollapsed && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-gray-100 bg-white">
                            <th className="text-left py-2 pl-5 pr-4 font-medium text-gray-400 w-44">Resource</th>
                            {availActions.map(a => (
                              <th key={a} className="text-center py-2 px-3 font-medium text-gray-400 capitalize whitespace-nowrap">{a}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {resources.map(res => {
                            const resPems = byResource[res];
                            const resKeys = resPems.map(p => p.key);
                            const allResChecked = resKeys.every(k => assigned.has(k));
                            return (
                              <tr key={res} className="hover:bg-gray-50/60 transition-colors group">
                                <td className="py-2.5 pl-5 pr-4">
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={allResChecked} onChange={() => toggleModule(resKeys)}
                                      className="h-3.5 w-3.5 rounded border-gray-300 text-brand-600 cursor-pointer" />
                                    <span className="truncate max-w-[130px] text-gray-700 font-medium">{res}</span>
                                  </label>
                                </td>
                                {availActions.map(action => {
                                  const perm = resPems.find(p => p.action === action);
                                  return (
                                    <td key={action} className="text-center py-2.5 px-3">
                                      {perm ? (
                                        <input type="checkbox" checked={assigned.has(perm.key)} onChange={() => toggle(perm.key)}
                                          className="h-4 w-4 text-brand-600 rounded border-gray-300 cursor-pointer" />
                                      ) : (
                                        <span className="text-gray-200 text-base select-none">·</span>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

type SettingsTab = 'general' | 'bot-training' | 'chat-history' | 'users' | 'roles' | 'permissions' | 'native-crm';

const BASE_TABS: { id: SettingsTab; label: string }[] = [
  { id: 'general',      label: 'General' },
  { id: 'bot-training', label: 'Bot Training' },
  { id: 'chat-history', label: 'Chat History' },
];
const ADMIN_TABS: { id: SettingsTab; label: string }[] = [
  { id: 'users',       label: 'Users' },
  { id: 'roles',       label: 'Roles' },
  { id: 'permissions', label: 'Permissions' },
  { id: 'native-crm',  label: 'Native CRM' },
];

export default function SettingsPage() {
  const { user, fetchMe } = useAuthStore();
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'TENANT_ADMIN';
  const tabs = isAdmin ? [...BASE_TABS, ...ADMIN_TABS] : BASE_TABS;
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  /* Profile state */
  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName,  setLastName]  = useState(user?.lastName ?? '');
  const [savingProfile, setSavingProfile] = useState(false);

  /* Company state */
  const [companyName, setCompanyName] = useState('');
  const [timezone,    setTimezone]    = useState('Asia/Kolkata');
  const [savingCompany, setSavingCompany] = useState(false);

  /* AI Agent state */
  const [agentName,    setAgentName]    = useState('LeadBot');
  const [language,     setLanguage]     = useState('en');
  const [instructions, setInstructions] = useState('');
  const [savingAI, setSavingAI] = useState(false);

  /* Change Password state */
  const [currentPwd,   setCurrentPwd]   = useState('');
  const [newPwd,       setNewPwd]       = useState('');
  const [confirmPwd,   setConfirmPwd]   = useState('');
  const [savingPwd,    setSavingPwd]    = useState(false);

  /* ── Save profile ──────────────────────────────────────────────────── */
  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      await api.put('/api/v1/auth/profile', { firstName, lastName });
      await fetchMe();
      toast.success('Profile updated');
    } catch { toast.error('Failed to save profile'); }
    finally { setSavingProfile(false); }
  };

  /* ── Save company ──────────────────────────────────────────────────── */
  const saveCompany = async () => {
    if (!user?.tenantId) return;
    setSavingCompany(true);
    try {
      await api.put(`/api/v1/tenants/${user.tenantId}`, {
        ...(companyName && { name: companyName }),
        settings: { timezone },
      });
      toast.success('Company settings updated');
    } catch { toast.error('Failed to save company settings'); }
    finally { setSavingCompany(false); }
  };

  /* ── Change Password ──────────────────────────────────────────────── */
  const changePassword = async () => {
    if (!currentPwd || !newPwd || !confirmPwd) {
      toast.error('All password fields are required');
      return;
    }
    if (newPwd.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    if (newPwd !== confirmPwd) {
      toast.error('New passwords do not match');
      return;
    }
    setSavingPwd(true);
    try {
      await api.put('/api/v1/auth/change-password', { currentPassword: currentPwd, newPassword: newPwd });
      toast.success('Password changed successfully');
      setCurrentPwd('');
      setNewPwd('');
      setConfirmPwd('');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Failed to change password');
    } finally { setSavingPwd(false); }
  };

  /* ── Save AI config ────────────────────────────────────────────────── */
  const saveAI = async () => {
    if (!user?.tenantId) return;
    setSavingAI(true);
    try {
      await api.put(`/api/v1/tenants/${user.tenantId}`, {
        aiConfig: { agentName, language, systemPrompt: instructions },
      });
      toast.success('AI agent settings saved');
    } catch { toast.error('Failed to save AI settings'); }
    finally { setSavingAI(false); }
  };

  return (
    <div className={`space-y-6 ${['users','roles','permissions','native-crm'].includes(activeTab) ? '' : 'max-w-3xl'}`}>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your profile, company, AI agent, and bot training.</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === t.id
                ? 'text-brand-600 border-b-2 border-brand-600 bg-brand-50/60'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Non-general tabs */}
      {activeTab === 'bot-training' && <BotTrainingPanel />}
      {activeTab === 'chat-history' && <ChatHistoryPanel />}
      {activeTab === 'users' && isAdmin && <UsersPanel />}
      {activeTab === 'roles' && isAdmin && <RolesPanel />}
      {activeTab === 'permissions' && isAdmin && <PermissionMatrixPanel />}
      {activeTab === 'native-crm' && isAdmin && <NativeCRMPermissionsPanel />}

      {/* General tab */}
      {activeTab === 'general' && (<>

      {/* ── 1. My Profile ──────────────────────────────────────────── */}
      <Section title="My Profile" description="Update your personal name shown across the platform.">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="First Name">
              <input className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" />
            </Field>
            <Field label="Last Name">
              <input className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" />
            </Field>
          </div>
          <Field label="Email">
            <input className="input bg-gray-50 cursor-not-allowed" value={user?.email ?? ''} readOnly />
          </Field>
          <div className="pt-1">
            <button className="btn-primary" onClick={saveProfile} disabled={savingProfile}>
              {savingProfile ? 'Saving…' : 'Save Profile'}
            </button>
          </div>
        </div>
      </Section>

      {/* ── 2. Company ─────────────────────────────────────────────── */}
      <Section title="Company Settings" description="Your company details. Created automatically when you signed up.">
        <div className="space-y-4">
          <Field label="Company Name">
            <input className="input" value={companyName} onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Innooryze Pvt Ltd" />
          </Field>
          <Field label="Timezone">
            <select className="input" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
              <option value="Asia/Kolkata">India (IST +5:30)</option>
              <option value="Asia/Singapore">Singapore (SGT +8)</option>
              <option value="Asia/Dubai">Dubai (GST +4)</option>
              <option value="Europe/London">London (GMT)</option>
              <option value="America/New_York">New York (EST)</option>
              <option value="America/Los_Angeles">Los Angeles (PST)</option>
            </select>
          </Field>
          <div className="pt-1">
            <button className="btn-primary" onClick={saveCompany} disabled={savingCompany}>
              {savingCompany ? 'Saving…' : 'Save Company Settings'}
            </button>
          </div>
        </div>
      </Section>

      {/* ── 3. AI Agent ────────────────────────────────────────────── */}
      <Section title="AI Agent" description="Configure how your AI assistant talks to your leads.">
        <div className="space-y-4">
          <Field label="Agent Name">
            <input className="input" value={agentName} onChange={(e) => setAgentName(e.target.value)} placeholder="e.g. LeadBot, Aria, Max" />
          </Field>
          <Field label="Response Language">
            <select className="input" value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="en">English</option>
              <option value="hi">Hindi</option>
              <option value="ta">Tamil</option>
              <option value="te">Telugu</option>
              <option value="ms">Bahasa Malaysia</option>
              <option value="zh">Chinese (Simplified)</option>
              <option value="ar">Arabic</option>
            </select>
          </Field>
          <Field label="Custom Instructions">
            <textarea className="input" rows={4} value={instructions} onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g. Always respond in a friendly tone. Focus on real estate leads. If user asks for pricing, say 'I'll connect you with our team.'" />
            <p className="text-xs text-gray-400 mt-1">Tell the AI how to behave — tone, focus area, what to avoid.</p>
          </Field>
          <div className="pt-1">
            <button className="btn-primary" onClick={saveAI} disabled={savingAI}>
              {savingAI ? 'Saving…' : 'Save AI Settings'}
            </button>
          </div>
        </div>
      </Section>

      {/* ── 4. Change Password ─────────────────────────────────────────── */}
      <Section title="Change Password" description="Update your login password. You will need your current password to confirm.">
        <div className="space-y-4">
          <Field label="Current Password">
            <input type="password" className="input" value={currentPwd}
              onChange={(e) => setCurrentPwd(e.target.value)}
              placeholder="Enter your current password" autoComplete="current-password" />
          </Field>
          <Field label="New Password">
            <input type="password" className="input" value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              placeholder="Minimum 8 characters" autoComplete="new-password" />
          </Field>
          <Field label="Confirm New Password">
            <input type="password" className="input" value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
              placeholder="Repeat new password" autoComplete="new-password" />
          </Field>
          <button className="btn-primary" onClick={changePassword} disabled={savingPwd}>
            {savingPwd ? 'Saving…' : 'Update Password'}
          </button>
        </div>
      </Section>

      {/* ── Account info (read-only) ────────────────────────────────── */}
      <Section title="Account" description="Your current account role and plan.">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 bg-brand-100 rounded-full flex items-center justify-center shrink-0">
            <span className="text-brand-700 font-bold">{user?.firstName?.[0]?.toUpperCase()}</span>
          </div>
          <div className="flex-1">
            <p className="font-semibold text-gray-900">{user?.firstName} {user?.lastName}</p>
            <p className="text-sm text-gray-500">{user?.email}</p>
          </div>
          <span className="badge badge-blue">{user?.role}</span>
        </div>
      </Section>
      </>)}
    </div>
  );
}
