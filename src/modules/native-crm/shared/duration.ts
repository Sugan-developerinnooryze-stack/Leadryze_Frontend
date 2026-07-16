/** Helpers for decimal-hour durations (e.g. 1.5833 = 1 hr 35 min). */

export function splitHours(total: number): { hrs: number; mins: number } {
  const safe = Number.isFinite(total) && total > 0 ? Math.min(total, 24) : 0;
  let hrs  = Math.floor(safe);
  let mins = Math.round((safe - hrs) * 60);
  if (mins === 60) { hrs += 1; mins = 0; }
  return { hrs, mins };
}

export function joinHours(hrs: number, mins: number): number {
  if (hrs >= 24) return 24;
  return hrs + mins / 60;
}

/** "1 hr 35 min", "45 min", "2 hrs", "—" when unset. */
export function formatDuration(total?: number | string | null): string {
  const n = typeof total === 'string' ? parseFloat(total) : total;
  if (!n || !Number.isFinite(n) || n <= 0) return '—';
  const { hrs, mins } = splitHours(n);
  const parts: string[] = [];
  if (hrs)  parts.push(`${hrs} hr${hrs > 1 ? 's' : ''}`);
  if (mins) parts.push(`${mins} min`);
  return parts.join(' ') || '—';
}

/**
 * Convert any stored date value to a local "YYYY-MM-DDTHH:mm" string for
 * <input type="datetime-local">. ISO strings from Mongo are UTC — slicing
 * them directly shows the wrong wall-clock time, so convert via Date.
 */
export function toDatetimeLocal(value: unknown): string {
  if (!value) return '';
  const s = String(value);
  if (s.length === 10) return `${s}T00:00`;            // date-only legacy
  if (s.length === 16 && !s.includes('Z')) return s;   // already local (from the input)
  const d = new Date(s);
  if (isNaN(d.getTime())) return s.slice(0, 16);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "1:00 PM" style local time. */
export function formatClock(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** Availability info returned by the staff-availability endpoint. */
export interface StaffAvailability {
  busy:             boolean;
  allDay?:          boolean;
  availableAfter?:  string | null;
  availableBefore?: string | null;
  conflictingWorkOrder?: { workOrderId?: string; title?: string } | null;
}

/** Short human note: when a busy staff becomes free again. */
export function availabilityNote(info?: StaffAvailability): string {
  if (!info?.busy) return '';
  if (info.allDay || !info.availableAfter) return 'Busy all day — available tomorrow';
  const after = formatClock(info.availableAfter);
  const before = info.availableBefore ? formatClock(info.availableBefore) : '';
  return before
    ? `Busy — available before ${before} or after ${after}`
    : `Busy — available after ${after}`;
}

/** Very short suffix for single-line <option> labels. */
export function availabilityShort(info?: StaffAvailability): string {
  if (!info?.busy) return '';
  if (info.allDay || !info.availableAfter) return ' 🔴 Busy all day';
  return ` 🔴 Busy till ${formatClock(info.availableAfter)}`;
}
