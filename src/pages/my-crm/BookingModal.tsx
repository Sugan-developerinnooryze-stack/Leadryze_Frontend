import { useState, useEffect, FormEvent } from 'react';
import { XMarkIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import api from '../../services/api';

const COLORS = [
  '#6366f1', '#ef4444', '#f97316', '#eab308',
  '#22c55e', '#14b8a6', '#3b82f6', '#a855f7',
];

interface LinkedRecord {
  channel: string; module: string; externalId: string; displayName: string;
}

interface BookingFormData {
  title: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  description: string;
  color: string;
  location: string;
  linkedRecord?: LinkedRecord;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  initialDate?: string;
  initialEnd?: string;
  editEvent?: { id: string } & Partial<BookingFormData>;
  prefillLinkedRecord?: LinkedRecord;
}

export default function BookingModal({ open, onClose, onSaved, initialDate, initialEnd, editEvent, prefillLinkedRecord }: Props) {
  const [form, setForm] = useState<BookingFormData>({
    title: '', startDate: '', endDate: '', allDay: false,
    description: '', color: '#6366f1', location: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<LinkedRecord[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editEvent) {
      setForm({
        title:       editEvent.title || '',
        startDate:   editEvent.startDate || '',
        endDate:     editEvent.endDate || '',
        allDay:      editEvent.allDay ?? false,
        description: editEvent.description || '',
        color:       editEvent.color || '#6366f1',
        location:    editEvent.location || '',
        linkedRecord: editEvent.linkedRecord,
      });
    } else {
      setForm({
        title: '', description: '', location: '',
        color: '#6366f1', allDay: false,
        startDate: initialDate || toLocalDateTimeString(new Date()),
        endDate:   initialEnd  || toLocalDateTimeString(new Date(Date.now() + 60 * 60 * 1000)),
        linkedRecord: prefillLinkedRecord,
      });
    }
    setError('');
    setSearch('');
    setSearchResults([]);
  }, [open, editEvent, initialDate, initialEnd, prefillLinkedRecord]);

  function toLocalDateTimeString(d: Date) {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  async function handleSearch(q: string) {
    setSearch(q);
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await api.get('/api/v1/crm/search', { params: { q, limit: 6 } });
      setSearchResults((res.data.data || []).map((r: { channel: string; module: string; displayName: string; data?: Record<string, unknown> }) => ({
        channel:     r.channel,
        module:      r.module,
        externalId:  String((r.data as Record<string, unknown>)?._id || ''),
        displayName: r.displayName,
      })));
    } catch { setSearchResults([]); }
    finally { setSearching(false); }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.startDate) {
      setError('Title and start date are required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        startDate: new Date(form.startDate).toISOString(),
        endDate:   form.endDate ? new Date(form.endDate).toISOString() : undefined,
      };
      if (editEvent?.id) {
        await api.put(`/api/v1/calendar/events/${editEvent.id}`, payload);
      } else {
        await api.post('/api/v1/calendar/events', payload);
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to save event');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            {editEvent ? 'Edit Booking' : 'New Booking'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Title *</label>
            <input
              type="text" required
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Meeting title, appointment..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {/* All Day toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, allDay: !f.allDay }))}
              className={`relative w-10 h-5 rounded-full transition-colors ${form.allDay ? 'bg-brand-600' : 'bg-gray-200'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.allDay ? 'translate-x-5' : ''}`} />
            </button>
            <span className="text-sm text-gray-700">All Day</span>
          </div>

          {/* Start / End */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Start *</label>
              <input
                type={form.allDay ? 'date' : 'datetime-local'} required
                value={form.allDay ? form.startDate.slice(0, 10) : form.startDate}
                onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">End</label>
              <input
                type={form.allDay ? 'date' : 'datetime-local'}
                value={form.allDay ? form.endDate.slice(0, 10) : form.endDate}
                onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Notes, agenda..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Location</label>
            <input
              type="text"
              value={form.location}
              onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
              placeholder="Office, Zoom link, address..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {/* Color */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Color</label>
            <div className="flex gap-2">
              {COLORS.map(c => (
                <button
                  key={c} type="button"
                  onClick={() => setForm(f => ({ ...f, color: c }))}
                  className={`w-7 h-7 rounded-full transition-transform hover:scale-110 ${form.color === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Link to CRM Record */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Link to CRM Record (optional)</label>
            {form.linkedRecord ? (
              <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 text-sm">
                <span className="flex-1 truncate">{form.linkedRecord.displayName} · {form.linkedRecord.module}</span>
                <button type="button" onClick={() => setForm(f => ({ ...f, linkedRecord: undefined }))} className="text-gray-400 hover:text-gray-600">
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  type="text" value={search}
                  onChange={e => handleSearch(e.target.value)}
                  placeholder="Search contacts, deals..."
                  className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                {searching && <span className="absolute right-3 top-2.5 text-xs text-gray-400">...</span>}
                {searchResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {searchResults.map((r, i) => (
                      <button key={i} type="button"
                        onClick={() => { setForm(f => ({ ...f, linkedRecord: r })); setSearch(''); setSearchResults([]); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                      >
                        <span className="truncate flex-1">{r.displayName}</span>
                        <span className="text-xs text-gray-400 shrink-0">{r.module}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-60 transition-colors">
              {saving ? 'Saving...' : editEvent ? 'Save Changes' : 'Create Booking'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
