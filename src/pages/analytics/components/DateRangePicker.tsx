import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, ChevronDown, Check, AlertCircle } from 'lucide-react';
import { format, subDays, subMonths, subYears, startOfDay, endOfDay, isValid } from 'date-fns';

export interface DateFilterState {
  preset: string;
  startDate?: string;
  endDate?: string;
}

interface DateRangePickerProps {
  filter: DateFilterState;
  onChange: (filter: DateFilterState) => void;
  periodLabel?: string;
}

export const PRESETS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'this_week', label: 'This Week' },
  { id: 'this_month', label: 'This Month' },
  { id: 'bimonthly', label: 'Bimonthly (Last 2 Months)' },
  { id: 'quarterly', label: 'Quarterly (Last 3 Months)' },
  { id: 'last_6_months', label: 'Last 6 Months' },
  { id: 'last_1_year', label: 'Last 1 Year' },
  { id: 'custom', label: 'Custom Date' },
] as const;

export function computeClientPresetRange(preset: string, customStart?: string, customEnd?: string): string {
  const now = new Date();
  let s: Date;
  let e: Date = endOfDay(now);

  switch (preset) {
    case 'today':
      s = startOfDay(now);
      e = endOfDay(now);
      break;
    case 'yesterday':
      s = startOfDay(subDays(now, 1));
      e = endOfDay(subDays(now, 1));
      break;
    case 'this_week':
    case '7d':
    case 'week':
      s = startOfDay(subDays(now, 7));
      e = endOfDay(now);
      break;
    case 'this_month':
    case '30d':
    case 'month':
      s = startOfDay(subMonths(now, 1));
      e = endOfDay(now);
      break;
    case 'bimonthly':
    case '60d':
      s = startOfDay(subMonths(now, 2));
      e = endOfDay(now);
      break;
    case 'quarterly':
    case '90d':
    case 'this_quarter':
      s = startOfDay(subMonths(now, 3));
      e = endOfDay(now);
      break;
    case 'last_6_months':
    case '180d':
    case '6m':
      s = startOfDay(subMonths(now, 6));
      e = endOfDay(now);
      break;
    case 'last_1_year':
    case '1y':
    case '365d':
    case 'this_year':
      s = startOfDay(subYears(now, 1));
      e = endOfDay(now);
      break;
    case 'custom':
      if (customStart && isValid(new Date(customStart))) {
        s = startOfDay(new Date(customStart));
      } else {
        s = startOfDay(subMonths(now, 1));
      }
      if (customEnd && isValid(new Date(customEnd))) {
        e = endOfDay(new Date(customEnd));
      } else {
        e = endOfDay(now);
      }
      break;
    default:
      s = startOfDay(subMonths(now, 1));
      e = endOfDay(now);
  }

  const isSameDay = format(s, 'yyyy-MM-dd') === format(e, 'yyyy-MM-dd');
  return isSameDay
    ? format(s, 'MMM d, yyyy')
    : `${format(s, 'MMM d, yyyy')} – ${format(e, 'MMM d, yyyy')}`;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({ filter, onChange, periodLabel }) => {
  const [isOpen, setIsOpen] = useState(false);
  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');
  const defaultStartStr = format(subMonths(now, 1), 'yyyy-MM-dd');

  const [customStart, setCustomStart] = useState(filter.startDate || defaultStartStr);
  const [customEnd, setCustomEnd] = useState(filter.endDate || todayStr);
  const [isCustomMode, setIsCustomMode] = useState(filter.preset === 'custom');

  useEffect(() => {
    if (filter.startDate) setCustomStart(filter.startDate);
    if (filter.endDate) setCustomEnd(filter.endDate);
    setIsCustomMode(filter.preset === 'custom');
  }, [filter.preset, filter.startDate, filter.endDate]);

  const activePreset = useMemo(() => {
    return (
      PRESETS.find((p) => p.id === filter.preset) ||
      (filter.preset === '7d' ? PRESETS[2] : filter.preset === '30d' ? PRESETS[3] : PRESETS[3])
    );
  }, [filter.preset]);

  const displayRange = useMemo(() => {
    if (periodLabel) return periodLabel;
    return computeClientPresetRange(filter.preset, filter.startDate, filter.endDate);
  }, [periodLabel, filter.preset, filter.startDate, filter.endDate]);

  // Validation: prevent end date earlier than start date
  const isDateRangeInvalid = useMemo(() => {
    if (!customStart || !customEnd) return true;
    return customStart > customEnd;
  }, [customStart, customEnd]);

  const handleSelectPreset = (presetId: string) => {
    if (presetId === 'custom') {
      setIsCustomMode(true);
    } else {
      setIsCustomMode(false);
      onChange({ preset: presetId });
      setIsOpen(false);
    }
  };

  const handleApplyCustom = () => {
    if (isDateRangeInvalid) return;
    onChange({
      preset: 'custom',
      startDate: customStart,
      endDate: customEnd,
    });
    setIsOpen(false);
  };

  return (
    <div className="flex items-center gap-2">
      <div className="relative inline-block text-left">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-xl border border-border bg-surface text-text-primary hover:bg-black/[0.02] dark:hover:bg-white/[0.04] transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-ryze-500/20"
          aria-haspopup="true"
          aria-expanded={isOpen}
        >
          <Calendar className="w-4 h-4 text-ryze-600" />
          <span>{activePreset.label}</span>
          <ChevronDown className="w-4 h-4 text-text-muted" />
        </button>

        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-surface border border-border shadow-xl z-50 p-2 space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-text-muted px-2 pt-1 pb-1">
                Select Reporting Period
              </div>

              <div className="space-y-0.5">
                {PRESETS.map((p) => {
                  const isSelected = filter.preset === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectPreset(p.id)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs font-medium rounded-lg text-left transition-colors ${
                        isSelected
                          ? 'bg-ryze-500/10 text-ryze-600 font-semibold'
                          : 'text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                      }`}
                    >
                      <span>{p.label}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-ryze-600 shrink-0" />}
                    </button>
                  );
                })}
              </div>

              {/* Custom Date Inputs Section */}
              {isCustomMode && (
                <div className="pt-2 mt-1 border-t border-border space-y-2 px-1">
                  <div className="text-[11px] font-semibold text-text-muted">
                    Custom Date Range
                  </div>

                  <div className="space-y-1.5">
                    <div>
                      <label className="block text-[10px] uppercase font-semibold text-text-muted mb-0.5">
                        From Date
                      </label>
                      <input
                        type="date"
                        value={customStart}
                        max={customEnd || todayStr}
                        onChange={(e) => setCustomStart(e.target.value)}
                        className="input py-1 px-2 text-xs w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-semibold text-text-muted mb-0.5">
                        To Date
                      </label>
                      <input
                        type="date"
                        value={customEnd}
                        min={customStart}
                        onChange={(e) => setCustomEnd(e.target.value)}
                        className="input py-1 px-2 text-xs w-full"
                      />
                    </div>
                  </div>

                  {isDateRangeInvalid && (
                    <div className="flex items-center gap-1 text-[11px] font-medium text-rose-500 bg-rose-50 dark:bg-rose-950/30 px-2 py-1 rounded">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>End date cannot be earlier than start date</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleApplyCustom}
                    disabled={isDateRangeInvalid}
                    className="w-full py-1.5 text-xs font-semibold rounded-lg bg-ryze-600 text-white hover:bg-ryze-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Apply Custom Range
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Active Date Range Display Pill */}
      <div
        className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border border-border bg-surface text-text-muted shadow-sm select-none"
        title="Active reporting range for all tabs and exports"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-ryze-500" />
        <span>{displayRange}</span>
      </div>
    </div>
  );
};
