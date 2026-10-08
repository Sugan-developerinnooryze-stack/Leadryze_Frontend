import { MODULE_COLORS } from '../calendar-status';
import { useModuleAccess } from '../calendar-access';
import type { CalendarEventTypeKey } from '../calendar.types';

const ITEMS: { key: CalendarEventTypeKey; label: string }[] = [
  { key: 'invoice',   label: 'Invoice' },
  { key: 'contract',  label: 'Contract' },
  { key: 'quotation', label: 'Quotation' },
];

/** Lives in the filter panel (not above the calendar grid) — colors sourced
 * from the same MODULE_COLORS map everything else on the calendar reads
 * from, so the legend can never visually drift from what's actually drawn. */
export default function CalendarLegend() {
  const { canView } = useModuleAccess();
  const showWorkOrder = canView('workorder');
  const visible = ITEMS.filter((i) => canView(i.key));
  if (!showWorkOrder && visible.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 text-xs text-text-muted">
      {showWorkOrder && (
        <>
          <span className="inline-flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${MODULE_COLORS.workorder.dot}`} />
            Work Order — Assigned
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full border-2 border-success-500 bg-transparent" />
            Work Order — Unassigned
          </span>
        </>
      )}
      {visible.map(({ key, label }) => (
        <span key={key} className="inline-flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${MODULE_COLORS[key].dot}`} />
          {label}
        </span>
      ))}
    </div>
  );
}
