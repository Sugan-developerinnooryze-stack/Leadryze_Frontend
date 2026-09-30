import { useEffect, useRef, useState } from 'react';
import { ChevronDownIcon, CalendarDaysIcon } from '@heroicons/react/24/outline';

export type DashboardRange = 'today' | 'week' | 'month' | '3months' | '6months' | '1year' | 'custom';

const PRESETS: { key: Exclude<DashboardRange, 'custom'>; label: string }[] = [
  { key: 'today',   label: 'Today' },
  { key: 'week',    label: 'This Week' },
  { key: 'month',   label: 'This Month' },
  { key: '3months', label: 'Last 3 Months' },
  { key: '6months', label: 'Last 6 Months' },
  { key: '1year',   label: 'Last 1 Year' },
];

function formatShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

interface DateRangeSwitcherProps {
  value: DashboardRange;
  customFrom?: string;
  customTo?: string;
  onChange: (range: DashboardRange, customFrom?: string, customTo?: string) => void;
}

export default function DateRangeSwitcher({ value, customFrom, customTo, onChange }: DateRangeSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(customFrom ?? '');
  const [draftTo, setDraftTo] = useState(customTo ?? '');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickAway = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickAway);
    return () => document.removeEventListener('mousedown', onClickAway);
  }, []);

  const label = value === 'custom'
    ? (customFrom && customTo ? `${formatShort(customFrom)} – ${formatShort(customTo)}` : 'Custom Range')
    : PRESETS.find((p) => p.key === value)?.label ?? 'This Month';

  const applyCustom = () => {
    if (!draftFrom || !draftTo || draftFrom > draftTo) return;
    onChange('custom', draftFrom, draftTo);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-xl bg-black/[0.04] dark:bg-white/[0.06] text-text-primary hover:bg-black/[0.06] dark:hover:bg-white/[0.09] transition-colors"
      >
        <CalendarDaysIcon className="h-3.5 w-3.5 text-text-muted" />
        {label}
        <ChevronDownIcon className={`h-3.5 w-3.5 text-text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-surface border border-border shadow-lg z-30 overflow-hidden">
          <div className="p-1.5">
            {PRESETS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => { onChange(opt.key); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-[13px] rounded-lg transition-colors ${
                  value === opt.key
                    ? 'bg-ryze-600/10 text-ryze-600 dark:text-ryze-400 font-semibold'
                    : 'text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="border-t border-border p-3">
            <p className={`text-[13px] font-medium mb-2 ${value === 'custom' ? 'text-ryze-600 dark:text-ryze-400' : 'text-text-primary'}`}>
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
        </div>
      )}
    </div>
  );
}
