import { useMemo } from 'react';
import { BusinessEvent, CalendarEventTypeKey } from '../calendar.types';
import {
  WrenchScrewdriverIcon,
  DocumentTextIcon,
  DocumentCheckIcon,
  BanknotesIcon
} from '@heroicons/react/24/outline';

interface Props {
  events: BusinessEvent[];
  eventTypes: Record<CalendarEventTypeKey, boolean>;
  /** The calendar grid's currently-loaded date window (FullCalendar's
   * activeStart/activeEnd) — 'Today's Visits'/'Invoice Due Today' are
   * defined as real-time "as of today" signals, independent of whichever
   * month is being viewed, but `events` only contains records already
   * fetched for the VISIBLE window (Phase 1's date-range-aware fetch, not
   * an unbounded one). When today genuinely isn't in the loaded window
   * (the user navigated to a different month), showing 0 would be a false
   * "nothing today" instead of "not currently loaded" — so these two KPIs
   * show '—' in that case instead, never a fabricated number. */
  viewStart?: Date;
  viewEnd?: Date;
}

const DASH = '—';

export default function CalendarKPI({ events, eventTypes, viewStart, viewEnd }: Props) {
  const todayInView = useMemo(() => {
    if (!viewStart || !viewEnd) return true; // unknown window — don't block the number
    const now = new Date();
    return now >= viewStart && now < viewEnd;
  }, [viewStart, viewEnd]);

  const metrics = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];

    let visitsToday = 0;
    let overdueInvoices = 0;
    let renewalsUpcoming = 0;
    let dueToday = 0;

    events.forEach(ev => {
      const evDate = new Date(ev.start).toISOString().split('T')[0];

      if (ev.module === 'workorder' && evDate === today) {
        visitsToday++;
      }
      if (ev.module === 'invoice' && ev.status === 'overdue') {
        overdueInvoices++;
      }
      if (ev.module === 'contract' && ev.eventType === 'renewal' && new Date(ev.start) > new Date()) {
        renewalsUpcoming++;
      }
      if (ev.module === 'invoice' && evDate === today) {
        // servicesAmountWithTax is Invoice's real total field — the
        // previous `ev.raw.totalAmount` read a field that doesn't exist on
        // this schema at all, so this KPI always silently showed ₹0.
        const total = Number(ev.raw?.servicesAmountWithTax ?? 0);
        const paid  = Number(ev.raw?.paidAmount ?? 0);
        dueToday += Math.max(total - paid, 0);
      }
    });

    return { visitsToday, overdueInvoices, renewalsUpcoming, dueToday };
  }, [events]);

  const cards: { key: CalendarEventTypeKey; label: string; value: string; caption: string; icon: any; iconBg: string; iconColor: string }[] = [
    {
      key: 'workorder', label: "Today's Visits", icon: WrenchScrewdriverIcon,
      iconBg: 'bg-success-500/15', iconColor: 'text-success-700 dark:text-success-500',
      value: !eventTypes.workorder ? DASH : !todayInView ? DASH : String(metrics.visitsToday),
      caption: 'Scheduled',
    },
    {
      key: 'invoice', label: 'Overdue Invoices', icon: DocumentTextIcon,
      iconBg: 'bg-rose-100 dark:bg-rose-500/15', iconColor: 'text-rose-600 dark:text-rose-400',
      value: !eventTypes.invoice ? DASH : String(metrics.overdueInvoices),
      caption: 'Need Attention',
    },
    {
      key: 'contract', label: 'Upcoming Renewals', icon: DocumentCheckIcon,
      iconBg: 'bg-indigo-100 dark:bg-indigo-500/15', iconColor: 'text-indigo-600 dark:text-indigo-400',
      value: !eventTypes.contract ? DASH : String(metrics.renewalsUpcoming),
      caption: 'This Month',
    },
    {
      key: 'invoice', label: 'Invoice Due Today', icon: BanknotesIcon,
      iconBg: 'bg-amber-100 dark:bg-amber-500/15', iconColor: 'text-amber-600 dark:text-amber-400',
      value: !eventTypes.invoice ? DASH : !todayInView ? DASH : `₹${metrics.dueToday.toLocaleString()}`,
      caption: 'Due Today',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
      {cards.map((c, i) => (
        <div key={i} className="bg-surface rounded-xl border border-border p-4 shadow-sm flex items-center gap-3" title={c.value === DASH ? `${c.label} hidden by filter or out of view` : undefined}>
          <div className={`p-2.5 rounded-lg shrink-0 ${c.iconBg} ${c.iconColor}`}>
            <c.icon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-text-muted truncate">{c.label}</p>
            <p className="text-xl font-bold text-text-primary leading-tight">{c.value}</p>
            <p className="text-[11px] text-text-muted">{c.caption}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
