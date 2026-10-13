/**
 * Shared date and datetime formatters (LR-UI-004)
 * Ensures unified, non-ambiguous date formatting across all lists, detail views,
 * audit logs, and related tabs throughout the entire application.
 *
 * Date standard: "09 Oct 2026"
 * Datetime standard: "09 Oct 2026, 03:00 PM"
 */

export function formatDate(d: string | Date | number | undefined | null): string {
  if (!d) return '—';
  const dateObj = typeof d === 'string' || typeof d === 'number' ? new Date(d) : d;
  if (isNaN(dateObj.getTime())) return typeof d === 'string' ? d : '—';
  return dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(d: string | Date | number | undefined | null): string {
  if (!d) return '—';
  const dateObj = typeof d === 'string' || typeof d === 'number' ? new Date(d) : d;
  if (isNaN(dateObj.getTime())) return typeof d === 'string' ? d : '—';
  return dateObj.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}
