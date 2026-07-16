import { TrashIcon, PlusIcon } from '@heroicons/react/24/outline';
import { splitHours, joinHours } from '../../../modules/native-crm/shared/duration';

/* ── Types (mirror backend IContractServiceLine) ──────────────────────────── */

export interface ScheduleRule {
  frequency: string;
  weekdays?:   number[];
  dayOfMonth?: number | 'last';
  everyNDays?: number;
  dates?:      string[];
}

export interface ContractServiceLine {
  name:            string;
  description?:    string;
  amount:          number | string;
  count:           number | string;
  scheduleRule?:   ScheduleRule;
  durationHours?:  number | string;
  taxPercent?:     number | string;
  discountPercent?: number | string;
  requiredSkill?:  string;
  serviceId?:      string;
}

export const FREQUENCY_OPTIONS: { value: string; label: string }[] = [
  { value: 'once',            label: 'Once' },
  { value: 'daily',           label: 'Daily (every day)' },
  { value: 'weekly',          label: 'Weekly (every week)' },
  { value: 'fortnightly',     label: 'Fortnightly (every 2 weeks)' },
  { value: 'monthly',         label: 'Monthly (every month)' },
  { value: 'bimonthly',       label: 'Bi-Monthly (every 2 months)' },
  { value: 'quarterly',       label: 'Quarterly (every 3 months)' },
  { value: 'halfyearly',      label: 'Half-Yearly (every 6 months)' },
  { value: 'yearly',          label: 'Yearly (every year)' },
  { value: 'custom_interval', label: 'Custom — every N days' },
  { value: 'custom_dates',    label: 'Custom — specific dates' },
];

export const FREQUENCY_LABELS: Record<string, string> = Object.fromEntries(
  FREQUENCY_OPTIONS.map((o) => [o.value, o.label.split(' (')[0]]),
);

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const inp = 'rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent';

export function lineTotal(l: ContractServiceLine): number {
  const gross = (parseFloat(String(l.amount)) || 0) * (parseFloat(String(l.count)) || 1);
  const afterDisc = gross * (1 - (parseFloat(String(l.discountPercent)) || 0) / 100);
  return Math.round(afterDisc * (1 + (parseFloat(String(l.taxPercent)) || 0) / 100) * 100) / 100;
}

interface Props {
  value:    ContractServiceLine[];
  onChange: (lines: ContractServiceLine[]) => void;
  availableServices: any[];
}

export default function ContractServiceLinesEditor({ value, onChange, availableServices }: Props) {
  const lines = value ?? [];

  const patch = (i: number, p: Partial<ContractServiceLine>) => {
    onChange(lines.map((l, idx) => (idx === i ? { ...l, ...p } : l)));
  };
  const patchRule = (i: number, p: Partial<ScheduleRule>) => {
    const rule = { frequency: 'once', ...(lines[i].scheduleRule ?? {}), ...p } as ScheduleRule;
    patch(i, { scheduleRule: rule });
  };
  const addLine = () => {
    onChange([...lines, { name: '', amount: 0, count: 1, scheduleRule: { frequency: 'monthly' } }]);
  };
  const removeLine = (i: number) => onChange(lines.filter((_, idx) => idx !== i));

  const grand = lines.reduce((s, l) => s + lineTotal(l), 0);

  return (
    <div className="space-y-3">
      {lines.length === 0 && (
        <p className="text-xs text-gray-400 border border-dashed border-gray-200 rounded-lg px-4 py-6 text-center">
          No services yet — click "Add Service" below. Each service gets its own frequency.
        </p>
      )}

      {lines.map((line, i) => {
        const rule = line.scheduleRule ?? { frequency: 'once' };
        const dur = splitHours(parseFloat(String(line.durationHours)) || 0);
        return (
          <div key={i} className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50/40">
            {/* Row 1: service pick + name + remove */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-400 w-5">{i + 1}.</span>
              <select
                className={`${inp} w-44`}
                value=""
                onChange={(e) => {
                  const svc = availableServices.find((s) => s._id === e.target.value);
                  if (svc) patch(i, { name: svc.name, amount: svc.price ?? svc.amount ?? 0, serviceId: svc.serviceId ?? svc._id });
                }}
              >
                <option value="">Pick service…</option>
                {availableServices.map((s) => (
                  <option key={s._id} value={s._id}>{s.name}</option>
                ))}
              </select>
              <input
                className={`${inp} flex-1`}
                placeholder="Service name"
                value={line.name}
                onChange={(e) => patch(i, { name: e.target.value })}
              />
              <button type="button" onClick={() => removeLine(i)}
                className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0">
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>

            {/* Row 2: qty / price / tax / discount / duration */}
            <div className="grid grid-cols-5 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Qty</label>
                <input type="number" min={1} className={`${inp} w-full`} value={line.count}
                  onChange={(e) => patch(i, { count: e.target.value })} />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Unit Price</label>
                <input type="number" min={0} step="0.01" className={`${inp} w-full`} value={line.amount}
                  onChange={(e) => patch(i, { amount: e.target.value })} />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Tax %</label>
                <input type="number" min={0} step="0.01" className={`${inp} w-full`} value={line.taxPercent ?? ''}
                  onChange={(e) => patch(i, { taxPercent: e.target.value })} />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Discount %</label>
                <input type="number" min={0} step="0.01" className={`${inp} w-full`} value={line.discountPercent ?? ''}
                  onChange={(e) => patch(i, { discountPercent: e.target.value })} />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Duration / visit</label>
                <div className="flex gap-1">
                  <select className={`${inp} flex-1`} value={dur.hrs}
                    onChange={(e) => patch(i, { durationHours: joinHours(parseInt(e.target.value, 10), dur.mins) || '' })}>
                    {Array.from({ length: 13 }, (_, h) => <option key={h} value={h}>{h}h</option>)}
                  </select>
                  <select className={`${inp} flex-1`} value={dur.mins}
                    onChange={(e) => patch(i, { durationHours: joinHours(dur.hrs, parseInt(e.target.value, 10)) || '' })}>
                    {Array.from({ length: 12 }, (_, m) => <option key={m * 5} value={m * 5}>{m * 5}m</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Row 3: frequency rule */}
            <div className="flex flex-wrap items-end gap-3 bg-white border border-brand-100 rounded-lg px-3 py-2.5">
              <div>
                <label className="block text-[10px] font-semibold text-brand-500 uppercase mb-1">Frequency</label>
                <select
                  className={`${inp} w-56`}
                  value={rule.frequency}
                  onChange={(e) => patch(i, { scheduleRule: { frequency: e.target.value } })}
                >
                  {FREQUENCY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {(rule.frequency === 'weekly' || rule.frequency === 'fortnightly') && (
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Days of week</label>
                  <div className="flex gap-1">
                    {WEEKDAYS.map((wd, idx) => {
                      const on = rule.weekdays?.includes(idx) ?? false;
                      return (
                        <button key={wd} type="button"
                          onClick={() => {
                            const cur = rule.weekdays ?? [];
                            patchRule(i, { weekdays: on ? cur.filter((d) => d !== idx) : [...cur, idx] });
                          }}
                          className={`px-2 py-1 rounded-md text-xs font-medium border transition-colors ${
                            on ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                          }`}>
                          {wd}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {['monthly', 'bimonthly', 'quarterly', 'halfyearly', 'yearly'].includes(rule.frequency) && (
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Day of month</label>
                  <select
                    className={`${inp} w-36`}
                    value={String(rule.dayOfMonth ?? '')}
                    onChange={(e) => {
                      const v = e.target.value;
                      patchRule(i, { dayOfMonth: v === '' ? undefined : v === 'last' ? 'last' : parseInt(v, 10) });
                    }}
                  >
                    <option value="">Same as start</option>
                    {Array.from({ length: 31 }, (_, d) => (
                      <option key={d + 1} value={d + 1}>Day {d + 1}</option>
                    ))}
                    <option value="last">Last day</option>
                  </select>
                </div>
              )}

              {rule.frequency === 'custom_interval' && (
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Every N days</label>
                  <input type="number" min={1} className={`${inp} w-28`} value={rule.everyNDays ?? ''}
                    placeholder="e.g. 17"
                    onChange={(e) => patchRule(i, { everyNDays: parseInt(e.target.value, 10) || undefined })} />
                </div>
              )}

              {rule.frequency === 'custom_dates' && (
                <div className="flex-1 min-w-[260px]">
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Specific dates</label>
                  <div className="flex flex-wrap gap-1.5 items-center">
                    {(rule.dates ?? []).map((d, di) => (
                      <span key={di} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-brand-50 text-brand-700 text-xs border border-brand-200">
                        {d}
                        <button type="button" onClick={() => patchRule(i, { dates: (rule.dates ?? []).filter((_, x) => x !== di) })}
                          className="text-brand-400 hover:text-red-500">×</button>
                      </span>
                    ))}
                    <input type="date" className={`${inp}`}
                      onChange={(e) => {
                        if (e.target.value && !(rule.dates ?? []).includes(e.target.value)) {
                          patchRule(i, { dates: [...(rule.dates ?? []), e.target.value].sort() });
                          e.target.value = '';
                        }
                      }} />
                  </div>
                </div>
              )}

              <div className="ml-auto text-right">
                <p className="text-[10px] font-semibold text-gray-400 uppercase mb-0.5">Line total / visit</p>
                <p className="text-sm font-semibold text-gray-800">{lineTotal(line).toFixed(2)}</p>
              </div>
            </div>

            {/* Row 4: description + required skill */}
            <div className="grid grid-cols-3 gap-2">
              <input
                className={`${inp} col-span-2`}
                placeholder="Description (optional)"
                value={line.description ?? ''}
                onChange={(e) => patch(i, { description: e.target.value })}
              />
              <input
                className={inp}
                placeholder="Required skill (e.g. AC Technician)"
                value={line.requiredSkill ?? ''}
                onChange={(e) => patch(i, { requiredSkill: e.target.value })}
              />
            </div>
          </div>
        );
      })}

      <div className="flex items-center justify-between">
        <button type="button" onClick={addLine}
          className="flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700">
          <PlusIcon className="h-4 w-4" /> Add Service
        </button>
        {lines.length > 0 && (
          <p className="text-sm text-gray-500">
            Per-visit total: <span className="font-semibold text-gray-800">{grand.toFixed(2)}</span>
          </p>
        )}
      </div>
    </div>
  );
}
