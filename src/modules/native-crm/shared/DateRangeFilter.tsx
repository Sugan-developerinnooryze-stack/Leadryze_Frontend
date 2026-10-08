import { useEffect, useRef, useState } from 'react';
import { CalendarDaysIcon, ChevronDownIcon, XMarkIcon } from '@heroicons/react/24/outline';

/** Matches the backend's own DateRangeKey (see shared/date-range.ts) minus
 * 6months/1year — this filter is deliberately scoped to the 4 presets +
 * custom that record-list pages need, not the fuller dashboard KPI set. */
export type ListDateRange = 'today' | 'week' | 'month' | '3months' | 'custom';

const PRESETS: { key: ListDateRange; label: string }[] = [
  { key: 'today',   label: 'Today' },
  { key: 'week',    label: 'This Week' },
  { key: 'month',   label: 'This Month' },
  { key: '3months', label: 'Last 3 Months' },
];

function formatShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export interface DateRangeFilterValue {
  range?:    ListDateRange;
  dateFrom?: string;
  dateTo?:   string;
}

interface DateRangeFilterProps {
  value: DateRangeFilterValue;
  onChange: (value: DateRangeFilterValue) => void;
}

/** Server-driven date filter for record-list pages (Quotations, Work
 * Orders, Contracts, Invoices, ...) — filters by each record's own
 * createdAt, entirely via the list API's ?range/dateFrom/dateTo params
 * (backend/src/modules/native-crm/shared/date-range.ts). No client-side
 * filtering of an already-fetched page: every preset re-queries the
 * server, so pagination/totals stay correct. */
export default function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  const [open, setOpen]           = useState(false);
  const [draftFrom, setDraftFrom] = useState(value.dateFrom ?? '');
  const [draftTo, setDraftTo]     = useState(value.dateTo ?? '');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickAway = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickAway);
    return () => document.removeEventListener('mousedown', onClickAway);
  }, []);

  useEffect(() => {
    setDraftFrom(value.dateFrom ?? '');
    setDraftTo(value.dateTo ?? '');
  }, [value.dateFrom, value.dateTo]);

  const isActive = !!value.range;
  const label = !isActive
    ? 'Date'
    : value.range === 'custom'
      ? (value.dateFrom && value.dateTo ? `${formatShort(value.dateFrom)} – ${formatShort(value.dateTo)}` : 'Custom Range')
      : PRESETS.find((p) => p.key === value.range)?.label ?? 'Date';

  const applyCustom = () => {
    if (!draftFrom || !draftTo || draftFrom > draftTo) return;
    onChange({ range: 'custom', dateFrom: draftFrom, dateTo: draftTo });
    setOpen(false);
  };

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange({});
    setDraftFrom('');
    setDraftTo('');
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 pl-3 pr-2.5 py-2 text-xs font-medium rounded-lg border transition-colors ${
          isActive
            ? 'border-ryze-400 bg-ryze-50 dark:bg-ryze-500/10 text-ryze-700 dark:text-ryze-400'
            : 'border-border text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
        }`}
      >
        <CalendarDaysIcon className={`h-3.5 w-3.5 ${isActive ? 'text-ryze-500' : 'text-text-muted'}`} />
        {label}
        {isActive ? (
          <XMarkIcon
            className="h-3.5 w-3.5 text-ryze-500 hover:text-ryze-700 dark:hover:text-ryze-300"
            onClick={clear}
          />
        ) : (
          <ChevronDownIcon className={`h-3.5 w-3.5 text-text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-surface border border-border shadow-lg z-30 overflow-hidden">
          <div className="p-1.5">
            {PRESETS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => { onChange({ range: opt.key }); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-[13px] rounded-lg transition-colors ${
                  value.range === opt.key
                    ? 'bg-ryze-600/10 text-ryze-600 dark:text-ryze-400 font-semibold'
                    : 'text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="border-t border-border p-3">
            <p className={`text-[13px] font-medium mb-2 ${value.range === 'custom' ? 'text-ryze-600 dark:text-ryze-400' : 'text-text-primary'}`}>
              Custom Range
            </p>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={draftFrom}
                max={draftTo || undefined}
                onChange={(e) => setDraftFrom(e.target.value)}
                className="flex-1 min-w-0 rounded-lg border border-border bg-background px-2 py-1.5 text-[12px] text-text-primary outline-none focus:border-ryze-500"
              />
              <span className="text-text-muted text-xs shrink-0">to</span>
              <input
                type="date"
                value={draftTo}
                min={draftFrom || undefined}
                onChange={(e) => setDraftTo(e.target.value)}
                className="flex-1 min-w-0 rounded-lg border border-border bg-background px-2 py-1.5 text-[12px] text-text-primary outline-none focus:border-ryze-500"
              />
            </div>
            <button
              type="button"
              onClick={applyCustom}
              disabled={!draftFrom || !draftTo || draftFrom > draftTo}
              className="mt-2.5 w-full py-1.5 rounded-lg bg-ryze-600 text-white text-[12px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-ryze-700 transition-colors"
            >
              Apply
            </button>
          </div>

          {isActive && (
            <button
              type="button"
              onClick={(e) => { clear(e); setOpen(false); }}
              className="w-full text-center py-2 text-[12px] font-medium text-text-muted hover:text-text-primary border-t border-border transition-colors"
            >
              Clear filter — show all time
            </button>
          )}
        </div>
      )}
    </div>
  );
}
