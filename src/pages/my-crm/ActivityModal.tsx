import { useState, useCallback, useEffect } from 'react';
import {
  XMarkIcon, ChevronLeftIcon,
  ClipboardDocumentListIcon, CalendarDaysIcon, UserGroupIcon,
  ClockIcon, ArrowPathIcon, EnvelopeIcon, PencilSquareIcon,
  MagnifyingGlassIcon, CheckIcon, PhoneIcon, AtSymbolIcon,
  MapPinIcon, VideoCameraIcon, BellIcon,
} from '@heroicons/react/24/outline';
import api from '../../services/api';
import toast from 'react-hot-toast';

/* ── Types ─────────────────────────────────────────────────────────────────── */
export type ActivityType = 'task' | 'event' | 'booking' | 'appointment' | 'schedule' | 'followup' | 'custom';

export interface ActivityDTO {
  _id:          string;
  type:         ActivityType;
  customType?:  string;
  title:        string;
  status:       string;
  priority?:    string;
  startDate?:   string;
  endDate?:     string;
  dueDate?:     string;
  allDay?:      boolean;
  color?:       string;
  location?:    string;
  notes?:       string;
  linkedPerson?: { externalId: string; displayName: string; module: string; channel: string; email?: string; phone?: string };
  fields?:      Record<string, unknown>;
}

interface LinkedPerson {
  externalId:  string;
  displayName: string;
  module:      string;
  channel:     string;
  email?:      string;
  phone?:      string;
}

interface SearchResult {
  id: string;
  channel: string;
  module: string;
  displayName: string;
  data: Record<string, string>;
}

const CHANNEL_COLORS: Record<string, string> = {
  zoho: '#ef4444', hubspot: '#f97316', salesforce: '#3b82f6',
  mysql: '#10b981', postgresql: '#8b5cf6', mongodb: '#22c55e',
};

/* ── Type card config ────────────────────────────────────────────────────── */
const TYPE_CARDS: { type: ActivityType; label: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; color: string; desc: string }[] = [
  { type: 'task',        label: 'Task',        icon: ClipboardDocumentListIcon, color: '#6366f1', desc: 'Action item with due date' },
  { type: 'event',       label: 'Event',       icon: CalendarDaysIcon,          color: '#3b82f6', desc: 'Scheduled event with time' },
  { type: 'booking',     label: 'Booking',     icon: UserGroupIcon,             color: '#10b981', desc: 'Meeting or appointment' },
  { type: 'appointment', label: 'Appointment', icon: ClockIcon,                 color: '#f97316', desc: 'In-person or virtual meet' },
  { type: 'schedule',    label: 'Schedule',    icon: ArrowPathIcon,             color: '#8b5cf6', desc: 'Recurring or timed activity' },
  { type: 'followup',    label: 'Follow-up',   icon: EnvelopeIcon,              color: '#ef4444', desc: 'Email, WhatsApp or call' },
  { type: 'custom',      label: 'Custom',      icon: PencilSquareIcon,          color: '#64748b', desc: 'Define your own type' },
];

export const TYPE_COLORS: Record<ActivityType, string> = {
  task: '#6366f1', event: '#3b82f6', booking: '#10b981',
  appointment: '#f97316', schedule: '#8b5cf6', followup: '#ef4444', custom: '#64748b',
};

const MEETING_TYPES = [
  { value: 'zoom',        label: 'Zoom' },
  { value: 'google_meet', label: 'Google Meet' },
  { value: 'teams',       label: 'Microsoft Teams' },
  { value: 'in_person',   label: 'In Person' },
  { value: 'phone',       label: 'Phone Call' },
  { value: 'other',       label: 'Other' },
];

/* ── Props ───────────────────────────────────────────────────────────────── */
interface ActivityModalProps {
  open:            boolean;
  onClose:         () => void;
  onSaved:         () => void;
  prefillDate?:    string;
  prefillPerson?:  LinkedPerson;
  editActivity?:   ActivityDTO;
}

/* ── Step 1 — Type selection ─────────────────────────────────────────────── */
function StepType({ onSelect }: { onSelect: (t: ActivityType, custom?: string) => void }) {
  const [customLabel, setCustomLabel] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  return (
    <div className="p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-1">What would you like to create?</h2>
      <p className="text-sm text-gray-500 mb-5">Choose an activity type to get started</p>
      <div className="grid grid-cols-2 gap-3">
        {TYPE_CARDS.map(({ type, label, icon: Icon, color, desc }) => {
          if (type === 'custom') {
            return (
              <button key="custom" onClick={() => setShowCustomInput(true)}
                className="flex items-start gap-3 p-3.5 border-2 border-dashed border-gray-200 rounded-xl hover:border-gray-300 hover:bg-gray-50 text-left transition-colors">
                <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: `${color}18` }}>
                  <Icon className="h-4 w-4" style={{ color }} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-gray-700">{label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                </div>
              </button>
            );
          }
          return (
            <button key={type} onClick={() => onSelect(type)}
              className="flex items-start gap-3 p-3.5 border-2 border-gray-100 rounded-xl hover:border-blue-200 hover:bg-blue-50/30 text-left transition-all group">
              <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: `${color}18` }}>
                <Icon className="h-4 w-4" style={{ color }} />
              </span>
              <div>
                <p className="text-sm font-semibold text-gray-700 group-hover:text-gray-900">{label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
              </div>
            </button>
          );
        })}
      </div>
      {showCustomInput && (
        <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
          <p className="text-sm font-medium text-gray-700 mb-2">Custom type name</p>
          <div className="flex gap-2">
            <input autoFocus type="text" value={customLabel} onChange={e => setCustomLabel(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && customLabel.trim()) onSelect('custom', customLabel.trim()); }}
              placeholder="e.g. Site Visit, Proposal, Review..."
              className="flex-1 text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
            <button onClick={() => { if (customLabel.trim()) onSelect('custom', customLabel.trim()); }}
              disabled={!customLabel.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg disabled:opacity-50 hover:bg-brand-700 transition-colors">
              Create
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Step 2 — Person selection ───────────────────────────────────────────── */
function StepPerson({ onSelect, onSkip }: {
  onSelect: (p: LinkedPerson) => void;
  onSkip: () => void;
}) {
  const [q, setQ]               = useState('');
  const [results, setResults]   = useState<SearchResult[]>([]);
  const [loading, setLoading]   = useState(false);
  const [selected, setSelected] = useState<LinkedPerson | null>(null);

  const search = useCallback(async (val: string) => {
    if (val.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await api.get('/api/v1/crm/search', { params: { q: val, limit: 8 } });
      setResults(res.data.data?.results || []);
    } catch { setResults([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(q), 300);
    return () => clearTimeout(t);
  }, [q, search]);

  function pick(r: SearchResult) {
    const p: LinkedPerson = {
      externalId:  r.data._id || r.id,
      displayName: r.displayName,
      module:      r.module,
      channel:     r.channel,
      email:       r.data.email || r.data.Email,
      phone:       r.data.phone || r.data.Phone || r.data.mobile || r.data.Mobile,
    };
    setSelected(p);
    setResults([]);
    setQ(r.displayName);
  }

  return (
    <div className="p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-1">Link to a CRM person</h2>
      <p className="text-sm text-gray-500 mb-5">Search contacts, leads, or accounts from your connected CRM</p>
      <div className="relative mb-4">
        <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
        <input autoFocus type="text" value={q}
          onChange={e => { setQ(e.target.value); setSelected(null); }}
          placeholder="Search contacts, leads, accounts..."
          className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500" />
        {loading && <div className="absolute right-3 top-3 w-4 h-4 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />}
      </div>
      {results.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-lg mb-4 max-h-52 overflow-y-auto">
          {results.map(r => (
            <button key={`${r.channel}-${r.module}-${r.id}`} onClick={() => pick(r)}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left transition-colors border-b border-gray-50 last:border-0">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: CHANNEL_COLORS[r.channel] || '#64748b' }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{r.displayName}</p>
                <p className="text-xs text-gray-400">{r.module} · {r.channel}</p>
              </div>
            </button>
          ))}
        </div>
      )}
      {selected && (
        <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl mb-4">
          <CheckIcon className="h-4 w-4 text-green-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-800">{selected.displayName}</p>
            <p className="text-xs text-gray-500">{selected.module} · {selected.channel}</p>
            {selected.email && <p className="text-xs text-gray-400">{selected.email}</p>}
            {selected.phone && <p className="text-xs text-gray-400">{selected.phone}</p>}
          </div>
          <button onClick={() => { setSelected(null); setQ(''); }} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      )}
      <div className="flex gap-3 mt-6">
        <button onClick={onSkip}
          className="flex-1 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
          Skip (no person)
        </button>
        <button onClick={() => selected ? onSelect(selected) : onSkip()}
          className="flex-1 py-2.5 text-sm font-medium text-white bg-brand-600 rounded-xl hover:bg-brand-700 transition-colors">
          {selected ? 'Continue →' : 'Skip →'}
        </button>
      </div>
    </div>
  );
}

/* ── Contact info card ───────────────────────────────────────────────────── */
function ContactCard({ person }: { person: LinkedPerson }) {
  return (
    <div className="flex items-start gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl mb-1">
      <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center shrink-0 text-brand-700 font-bold text-sm">
        {person.displayName.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">{person.displayName}</p>
        <p className="text-xs text-gray-400 mb-1">{person.module} · {person.channel}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-0.5">
          {person.email && (
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <AtSymbolIcon className="h-3 w-3 shrink-0" />
              <span className="truncate max-w-[160px]">{person.email}</span>
            </span>
          )}
          {person.phone && (
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <PhoneIcon className="h-3 w-3 shrink-0" />
              {person.phone}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Step 3 — Dynamic form per activity type ─────────────────────────────── */
function StepForm({ type, customType, person, prefillDate, editActivity, onSubmit, loading }: {
  type:          ActivityType;
  customType?:   string;
  person?:       LinkedPerson;
  prefillDate?:  string;
  editActivity?: ActivityDTO;
  onSubmit:      (data: Record<string, unknown>, notify: { email: boolean; sms: boolean }) => void;
  loading:       boolean;
}) {
  const ef = editActivity?.fields as Record<string, unknown> | undefined;

  const [form, setForm] = useState<Record<string, unknown>>(() => ({
    title:       editActivity?.title || '',
    status:      editActivity?.status || 'pending',
    priority:    editActivity?.priority || 'medium',
    startDate:   editActivity?.startDate?.slice(0, 16) || prefillDate || '',
    endDate:     editActivity?.endDate?.slice(0, 16) || '',
    dueDate:     editActivity?.dueDate?.slice(0, 10) || '',
    allDay:      editActivity?.allDay || false,
    location:    editActivity?.location || '',
    notes:       editActivity?.notes || '',
    color:       editActivity?.color || TYPE_COLORS[type] || '#6366f1',
    // type-specific fields (stored in `fields`)
    meetingType: ef?.meetingType || 'zoom',
    meetingLink: ef?.meetingLink || '',
    duration:    ef?.duration || '60',
    repeat:      ef?.repeat || 'none',
    channel:     ef?.channel || 'email',
    message:     ef?.message || '',
    attendees:   ef?.attendees || '',
    bookingRef:  ef?.bookingRef || '',
  }));

  const [notifyEmail, setNotifyEmail] = useState(false);
  const [notifySms,   setNotifySms]   = useState(false);

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  // Auto-compute end date from start + duration for appointment/booking
  function applyDuration(start: string, mins: string) {
    if (!start) return;
    const d = new Date(start);
    d.setMinutes(d.getMinutes() + parseInt(mins, 10));
    const pad = (n: number) => String(n).padStart(2, '0');
    set('endDate', `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
  }

  function handleDurationChange(mins: string) {
    set('duration', mins);
    if (form.startDate) applyDuration(form.startDate as string, mins);
  }

  function handleStartChange(val: string) {
    set('startDate', val);
    if ((type === 'appointment' || type === 'booking') && form.duration) {
      applyDuration(val, form.duration as string);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fields: Record<string, unknown> = {};
    if (type === 'booking' || type === 'appointment' || type === 'event') {
      fields.meetingType = form.meetingType;
      fields.meetingLink = form.meetingLink;
    }
    if (type === 'appointment' || type === 'booking') {
      fields.duration = form.duration;
    }
    if (type === 'booking') {
      fields.attendees  = form.attendees;
      fields.bookingRef = form.bookingRef;
    }
    if (type === 'schedule') fields.repeat = form.repeat;
    if (type === 'followup') { fields.channel = form.channel; fields.message = form.message; }
    onSubmit({ ...form, fields }, { email: notifyEmail, sms: notifySms });
  }

  const inp = 'w-full text-sm px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white';
  const sel = inp + ' appearance-none';
  const lbl = 'block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide';
  const row = 'grid grid-cols-2 gap-3';

  const isVirtual = ['zoom', 'google_meet', 'teams', 'other'].includes(form.meetingType as string);
  const hasNotify = !!(person?.email || person?.phone);

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">

      {/* Linked person card */}
      {person && <ContactCard person={person} />}

      {/* Title */}
      <div>
        <label className={lbl}>Title *</label>
        <input autoFocus required type="text"
          value={String(form.title || '')}
          onChange={e => set('title', e.target.value)}
          placeholder={`${type === 'custom' ? (customType || 'Activity') : type} title...`}
          className={inp} />
      </div>

      {/* ── Date / time fields by type ── */}
      {(type === 'event' || type === 'schedule') && (
        <>
          {type === 'event' && (
            <div className="flex items-center gap-3">
              <button type="button"
                onClick={() => set('allDay', !form.allDay)}
                className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${form.allDay ? 'bg-brand-600' : 'bg-gray-200'}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.allDay ? 'translate-x-5' : ''}`} />
              </button>
              <span className="text-sm text-gray-700">All day event</span>
            </div>
          )}
          <div className={row}>
            <div>
              <label className={lbl}>Start *</label>
              <input type={form.allDay ? 'date' : 'datetime-local'} required
                value={form.allDay ? String(form.startDate || '').slice(0, 10) : String(form.startDate || '')}
                onChange={e => set('startDate', e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>End</label>
              <input type={form.allDay ? 'date' : 'datetime-local'}
                value={form.allDay ? String(form.endDate || '').slice(0, 10) : String(form.endDate || '')}
                onChange={e => set('endDate', e.target.value)} className={inp} />
            </div>
          </div>
        </>
      )}

      {(type === 'booking' || type === 'appointment') && (
        <>
          <div className={row}>
            <div>
              <label className={lbl}>Start *</label>
              <input type="datetime-local" required
                value={String(form.startDate || '')}
                onChange={e => handleStartChange(e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>Duration</label>
              <select value={String(form.duration || '60')} onChange={e => handleDurationChange(e.target.value)} className={sel}>
                <option value="15">15 min</option>
                <option value="30">30 min</option>
                <option value="45">45 min</option>
                <option value="60">1 hour</option>
                <option value="90">1.5 hours</option>
                <option value="120">2 hours</option>
                <option value="180">3 hours</option>
              </select>
            </div>
          </div>
          <div className={row}>
            <div>
              <label className={lbl}>End (auto)</label>
              <input type="datetime-local" value={String(form.endDate || '')} onChange={e => set('endDate', e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>Status</label>
              <select value={String(form.status || 'pending')} onChange={e => set('status', e.target.value)} className={sel}>
                <option value="pending">Pending</option>
                <option value="in_progress">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </>
      )}

      {(type === 'task' || type === 'followup' || type === 'custom') && (
        <div>
          <label className={lbl}>Due Date</label>
          <input type="date" value={String(form.dueDate || '')} onChange={e => set('dueDate', e.target.value)} className={inp} />
        </div>
      )}

      {/* ── Meeting type + location/link ── */}
      {(type === 'booking' || type === 'appointment' || type === 'event') && (
        <div className={row}>
          <div>
            <label className={lbl}>Meeting Type</label>
            <select value={String(form.meetingType || 'zoom')} onChange={e => set('meetingType', e.target.value)} className={sel}>
              {MEETING_TYPES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>
              {isVirtual ? <span className="flex items-center gap-1"><VideoCameraIcon className="h-3 w-3 inline" /> Meeting Link</span>
                         : <span className="flex items-center gap-1"><MapPinIcon className="h-3 w-3 inline" /> Location</span>}
            </label>
            <input type="text"
              value={isVirtual ? String(form.meetingLink || '') : String(form.location || '')}
              onChange={e => isVirtual ? set('meetingLink', e.target.value) : set('location', e.target.value)}
              placeholder={isVirtual ? 'https://zoom.us/j/...' : 'Office, address...'}
              className={inp} />
          </div>
        </div>
      )}

      {/* In-person location (separate row when virtual already has link) */}
      {(type === 'event') && !isVirtual && (
        <div>
          <label className={lbl}><MapPinIcon className="h-3 w-3 inline mr-1" />Location</label>
          <input type="text" value={String(form.location || '')} onChange={e => set('location', e.target.value)}
            placeholder="Office, venue, address..." className={inp} />
        </div>
      )}

      {/* ── Booking-specific ── */}
      {type === 'booking' && (
        <div className={row}>
          <div>
            <label className={lbl}>No. of Attendees</label>
            <input type="number" min="1" value={String(form.attendees || '')} onChange={e => set('attendees', e.target.value)}
              placeholder="2" className={inp} />
          </div>
          <div>
            <label className={lbl}>Booking Reference</label>
            <input type="text" value={String(form.bookingRef || '')} onChange={e => set('bookingRef', e.target.value)}
              placeholder="BK-2026-001" className={inp} />
          </div>
        </div>
      )}

      {/* ── Task / Custom — priority + status ── */}
      {(type === 'task' || type === 'custom') && (
        <div className={row}>
          <div>
            <label className={lbl}>Priority</label>
            <select value={String(form.priority || 'medium')} onChange={e => set('priority', e.target.value)} className={sel}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div>
            <label className={lbl}>Status</label>
            <select value={String(form.status || 'pending')} onChange={e => set('status', e.target.value)} className={sel}>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      )}

      {/* ── Schedule — repeat ── */}
      {type === 'schedule' && (
        <div className={row}>
          <div>
            <label className={lbl}>Repeat</label>
            <select value={String(form.repeat || 'none')} onChange={e => set('repeat', e.target.value)} className={sel}>
              <option value="none">No repeat</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Bi-weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div>
            <label className={lbl}>Status</label>
            <select value={String(form.status || 'pending')} onChange={e => set('status', e.target.value)} className={sel}>
              <option value="pending">Pending</option>
              <option value="in_progress">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      )}

      {/* ── Follow-up — channel + message ── */}
      {type === 'followup' && (
        <>
          <div className={row}>
            <div>
              <label className={lbl}>Channel</label>
              <select value={String(form.channel || 'email')} onChange={e => set('channel', e.target.value)} className={sel}>
                <option value="email">Email</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="phone">Phone Call</option>
                <option value="sms">SMS</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Priority</label>
              <select value={String(form.priority || 'medium')} onChange={e => set('priority', e.target.value)} className={sel}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>
          <div>
            <label className={lbl}>Message / Notes</label>
            <textarea rows={3} value={String(form.message || '')} onChange={e => set('message', e.target.value)}
              placeholder="Follow-up message or talking points..."
              className={inp} />
          </div>
        </>
      )}

      {/* ── Notes (all types) ── */}
      <div>
        <label className={lbl}>Notes</label>
        <textarea rows={2} value={String(form.notes || '')} onChange={e => set('notes', e.target.value)}
          placeholder="Additional notes..." className={inp} />
      </div>

      {/* ── Color ── */}
      <div>
        <label className={lbl}>Color</label>
        <div className="flex gap-2">
          {['#6366f1','#ef4444','#f97316','#eab308','#22c55e','#14b8a6','#3b82f6','#a855f7'].map(c => (
            <button key={c} type="button" onClick={() => set('color', c)}
              className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
              style={{ backgroundColor: c, borderColor: form.color === c ? '#1e293b' : 'transparent' }} />
          ))}
        </div>
      </div>

      {/* ── Notification toggles (only when linked person has contact) ── */}
      {hasNotify && (
        <div className="border border-gray-200 rounded-xl p-3 bg-gray-50 space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <BellIcon className="h-4 w-4 text-gray-400" />
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Send Notification</span>
          </div>
          {person?.email && (
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={notifyEmail} onChange={e => setNotifyEmail(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
              <span className="text-sm text-gray-700">
                Email confirmation to <span className="font-medium text-gray-900">{person.email}</span>
              </span>
            </label>
          )}
          {person?.phone && (
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={notifySms} onChange={e => setNotifySms(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
              <span className="text-sm text-gray-700">
                WhatsApp/SMS to <span className="font-medium text-gray-900">{person.phone}</span>
              </span>
            </label>
          )}
        </div>
      )}

      <button type="submit" disabled={loading}
        className="w-full py-3 text-sm font-semibold text-white rounded-xl transition-colors disabled:opacity-50"
        style={{ backgroundColor: TYPE_COLORS[type] || '#6366f1' }}>
        {loading
          ? 'Saving...'
          : editActivity
            ? `Update ${type === 'custom' ? (customType || 'Activity') : type}`
            : `Create ${type === 'custom' ? (customType || 'Activity') : type}`}
      </button>
    </form>
  );
}

/* ── Main modal ──────────────────────────────────────────────────────────── */
export default function ActivityModal({
  open, onClose, onSaved, prefillDate, prefillPerson, editActivity,
}: ActivityModalProps) {
  const isEdit = !!editActivity;

  const [step,       setStep]       = useState<1 | 2 | 3>(isEdit ? 3 : 1);
  const [selType,    setSelType]    = useState<ActivityType>(editActivity?.type || 'task');
  const [customType, setCustomType] = useState(editActivity?.customType || '');
  const [selPerson,  setSelPerson]  = useState<LinkedPerson | undefined>(editActivity?.linkedPerson || prefillPerson);
  const [saving,     setSaving]     = useState(false);

  useEffect(() => {
    if (open) {
      setStep(isEdit ? 3 : 1);
      setSelType(editActivity?.type || 'task');
      setCustomType(editActivity?.customType || '');
      setSelPerson(editActivity?.linkedPerson || prefillPerson);
      setSaving(false);
    }
  }, [open]);

  if (!open) return null;

  function handleTypeSelect(t: ActivityType, custom?: string) {
    setSelType(t);
    setCustomType(custom || '');
    setStep(2);
  }

  function handlePersonSelect(p: LinkedPerson) {
    setSelPerson(p);
    setStep(3);
  }

  async function handleFormSubmit(data: Record<string, unknown>, notify: { email: boolean; sms: boolean }) {
    setSaving(true);
    try {
      const payload = { ...data, type: selType, customType: customType || undefined, linkedPerson: selPerson || undefined };
      let activityId: string | undefined;

      if (isEdit) {
        await api.put(`/api/v1/activities/${editActivity!._id}`, payload);
        activityId = editActivity!._id;
      } else {
        const res = await api.post('/api/v1/activities', payload);
        activityId = res.data?.data?._id || res.data?._id;
      }

      // Send notifications if requested
      if (activityId && (notify.email || notify.sms)) {
        try {
          await api.post(`/api/v1/activities/${activityId}/notify`, {
            sendEmail: notify.email,
            sendSms:   notify.sms,
          });
          const sent = [notify.email && 'email', notify.sms && 'WhatsApp/SMS'].filter(Boolean).join(' & ');
          toast.success(`Saved! ${sent} confirmation sent.`);
        } catch {
          toast.success('Saved! (notification failed — check Brevo/Twilio config)');
        }
      } else {
        toast.success(isEdit ? 'Activity updated' : 'Activity created');
      }

      onSaved();
      onClose();
    } catch {
      toast.error('Failed to save activity');
      setSaving(false);
    }
  }

  const typeCard    = TYPE_CARDS.find(c => c.type === selType);
  const accentColor = TYPE_COLORS[selType] || '#6366f1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">

        <div className="h-1" style={{ backgroundColor: accentColor }} />

        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 shrink-0">
          {step > 1 && !isEdit && (
            <button onClick={() => setStep(s => (s - 1) as 1 | 2 | 3)} className="text-gray-400 hover:text-gray-600 transition-colors">
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
          )}
          <div className="flex-1">
            {step >= 2 && (
              <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-0.5">
                <span className="font-medium" style={{ color: accentColor }}>
                  {customType || (typeCard?.label || selType)}
                </span>
                {selPerson && step === 3 && (
                  <><span>·</span><span className="truncate max-w-[160px]">{selPerson.displayName}</span></>
                )}
              </div>
            )}
            <h3 className="text-sm font-bold text-gray-900">
              {isEdit ? `Edit ${customType || typeCard?.label || selType}` :
               step === 1 ? 'New Activity' :
               step === 2 ? 'Link to CRM person' :
               `${customType || typeCard?.label || selType} details`}
            </h3>
          </div>
          {!isEdit && (
            <div className="flex items-center gap-1.5 mr-1">
              {([1, 2, 3] as const).map(s => (
                <span key={s} className={`w-2 h-2 rounded-full transition-colors ${step >= s ? 'bg-brand-600' : 'bg-gray-200'}`} />
              ))}
            </div>
          )}
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {step === 1 && <StepType onSelect={handleTypeSelect} />}
          {step === 2 && (
            <StepPerson
              onSelect={handlePersonSelect}
              onSkip={() => { setSelPerson(undefined); setStep(3); }}
            />
          )}
          {step === 3 && (
            <StepForm
              type={selType}
              customType={customType}
              person={selPerson}
              prefillDate={prefillDate}
              editActivity={editActivity}
              onSubmit={handleFormSubmit}
              loading={saving}
            />
          )}
        </div>
      </div>
    </div>
  );
}
