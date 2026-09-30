import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';

interface ServiceLine {
  name:        string;
  description?: string;
  amount:      number;
  count:       number;
}

interface Props {
  value:             ServiceLine[];
  onChange:          (lines: ServiceLine[]) => void;
  availableServices: any[];
  withTotals?:       boolean;
  discount?:         number;
  gstPercentage?:    number;
}

const BLANK: ServiceLine = { name: '', description: '', amount: 0, count: 1 };

export default function ServiceLinesEditor({ value, onChange, availableServices, withTotals, discount = 0, gstPercentage = 0 }: Props) {
  const lines = value.length > 0 ? value : [];

  const addLine = () => onChange([...lines, { ...BLANK }]);

  const removeLine = (i: number) => onChange(lines.filter((_, j) => j !== i));

  const updateLine = (i: number, patch: Partial<ServiceLine>) => {
    const next = lines.map((l, j) => j === i ? { ...l, ...patch } : l);
    onChange(next);
  };

  const handleServicePick = (i: number, svcId: string) => {
    const svc = availableServices.find(s => s._id === svcId || s.serviceId === svcId);
    if (svc) {
      updateLine(i, { name: svc.name ?? '', amount: svc.price ?? 0 });
    }
  };

  const subtotal   = lines.reduce((s, l) => s + (Number(l.amount) || 0) * (Number(l.count) || 1), 0);
  const discAmt    = subtotal * (discount / 100);
  const afterDisc  = subtotal - discAmt;
  const taxAmt     = afterDisc * (gstPercentage / 100);
  const grandTotal = afterDisc + taxAmt;

  const fmt = (n: number) => n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const base  = 'w-full rounded bg-surface border border-border px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-ryze-400';
  const th    = 'px-2 py-1.5 text-left text-xs font-medium text-text-muted uppercase tracking-wider bg-background';
  const td    = 'px-2 py-1.5 align-top';

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[560px] text-xs">
          <thead>
            <tr>
              <th className={`${th} w-48`}>Service</th>
              <th className={th}>Description</th>
              <th className={`${th} w-14`}>Qty</th>
              <th className={`${th} w-24`}>Unit Price</th>
              <th className={`${th} w-20 text-right`}>Line Total</th>
              <th className={`${th} w-8`}></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {lines.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-xs text-text-muted">
                  No lines yet — click "Add line" below
                </td>
              </tr>
            )}
            {lines.map((line, i) => (
              <tr key={i} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                <td className={td}>
                  <select
                    value=""
                    onChange={e => handleServicePick(i, e.target.value)}
                    className={base}
                  >
                    <option value="">Pick service…</option>
                    {availableServices.map(s => (
                      <option key={s._id} value={s._id}>{s.name}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={line.name}
                    onChange={e => updateLine(i, { name: e.target.value })}
                    placeholder="Name"
                    className={`${base} mt-1`}
                  />
                </td>
                <td className={td}>
                  <input
                    type="text"
                    value={line.description ?? ''}
                    onChange={e => updateLine(i, { description: e.target.value })}
                    placeholder="Description"
                    className={base}
                  />
                </td>
                <td className={td}>
                  <input
                    type="number"
                    min={1}
                    value={line.count}
                    onChange={e => updateLine(i, { count: parseFloat(e.target.value) || 1 })}
                    className={base}
                  />
                </td>
                <td className={td}>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={line.amount}
                    onChange={e => updateLine(i, { amount: parseFloat(e.target.value) || 0 })}
                    className={base}
                  />
                </td>
                <td className={`${td} text-right font-medium text-text-primary`}>
                  {fmt((Number(line.amount) || 0) * (Number(line.count) || 1))}
                </td>
                <td className={td}>
                  <button
                    type="button"
                    onClick={() => removeLine(i)}
                    className="p-1 text-text-muted hover:text-danger-500 transition-colors"
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={addLine}
        className="flex items-center gap-1.5 text-xs text-ryze-600 hover:text-ryze-700 dark:text-ryze-400 dark:hover:text-ryze-300 font-medium"
      >
        <PlusIcon className="h-3.5 w-3.5" />
        Add line
      </button>

      {lines.length > 0 && (
        <div className="ml-auto w-56 space-y-1 text-xs">
          <div className="flex justify-between text-text-muted">
            <span>Subtotal</span>
            <span className="font-medium">{fmt(subtotal)}</span>
          </div>
          {withTotals && (
            <>
              {discount > 0 && (
                <div className="flex justify-between text-text-muted">
                  <span>Discount ({discount}%)</span>
                  <span>−{fmt(discAmt)}</span>
                </div>
              )}
              {gstPercentage > 0 && (
                <div className="flex justify-between text-text-muted">
                  <span>GST ({gstPercentage}%)</span>
                  <span>+{fmt(taxAmt)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-1 font-semibold text-text-primary">
                <span>Total</span>
                <span>{fmt(grandTotal)}</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
