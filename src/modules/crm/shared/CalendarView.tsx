import { useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import type { CrmRecord } from './types/crm.types';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function chipTime(r: CrmRecord, dateField: string): string | null {
  const raw = r[dateField];
  if (!raw) return null;
  const d = new Date(raw as string);
  return isNaN(d.getTime()) ? null : d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

export default function CalendarView({
  records, dateField, iconColor, displayName, onOpenRecord,
}: {
  records: CrmRecord[];
  dateField: string;
  iconColor: string;
  displayName: (r: CrmRecord) => string;
  onOpenRecord: (r: CrmRecord) => void;
}) {
  const [cursor, setCursor] = useState(() => new Date());

  const year  = cursor.getFullYear();
  const month = cursor.getMonth();
  const today = new Date();

  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const gridStart    = new Date(year, month, 1 - startWeekday);

  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });

  const recordsByDay = (day: Date) =>
    records.filter((r) => {
      const raw = r[dateField];
      if (!raw) return false;
      const d = new Date(raw as string);
      return !isNaN(d.getTime()) && sameDay(d, day);
    });

  return (
    <div className="flex flex-col h-full p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-800">
          {cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCursor(new Date(year, month - 1, 1))}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => setCursor(new Date())}
            className="px-2.5 py-1 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Today
          </button>
          <button
            onClick={() => setCursor(new Date(year, month + 1, 1))}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-t border-l border-gray-200 flex-1 min-h-0">
        {WEEKDAYS.map((wd) => (
          <div key={wd} className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide text-center py-1.5 border-r border-b border-gray-200 bg-gray-50">
            {wd}
          </div>
        ))}
        {cells.map((day, i) => {
          const inMonth = day.getMonth() === month;
          const isToday = sameDay(day, today);
          const dayRecords = recordsByDay(day);
          return (
            <div
              key={i}
              className={`border-r border-b border-gray-200 p-1.5 min-h-[90px] overflow-hidden ${inMonth ? 'bg-white' : 'bg-gray-50/60'}`}
            >
              <span className={`text-xs inline-flex items-center justify-center h-5 w-5 rounded-full ${
                isToday ? 'bg-blue-600 text-white font-semibold' : inMonth ? 'text-gray-600' : 'text-gray-300'
              }`}>
                {day.getDate()}
              </span>
              <div className="mt-1 space-y-1">
                {dayRecords.slice(0, 3).map((r) => {
                  const time = chipTime(r, dateField);
                  const related = typeof r.relatedLabel === 'string' ? r.relatedLabel : null;
                  return (
                    <button
                      key={r._id}
                      onClick={() => onOpenRecord(r)}
                      className="w-full text-left text-[11px] leading-tight px-1.5 py-1 rounded truncate hover:opacity-80 transition-opacity text-white"
                      style={{ backgroundColor: iconColor }}
                      title={`${displayName(r)}${time ? ` · ${time}` : ''}${related ? ` · ${related}` : ''}`}
                    >
                      <span className="block truncate font-medium">{displayName(r)}</span>
                      {(time || related) && (
                        <span className="block truncate text-[9px] opacity-80">
                          {[time, related].filter(Boolean).join(' · ')}
                        </span>
                      )}
                    </button>
                  );
                })}
                {dayRecords.length > 3 && (
                  <p className="text-[10px] text-gray-400 px-1">+{dayRecords.length - 3} more</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
