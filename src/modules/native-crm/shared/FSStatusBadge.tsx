import { FS_STATUS_COLORS } from './types';

export function FSStatusBadge({ value }: { value: string }) {
  const c = FS_STATUS_COLORS[value] ?? { bg: 'bg-black/[0.06] dark:bg-white/[0.08]', text: 'text-text-muted' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${c.bg} ${c.text}`}>
      {value.replace(/_/g, ' ')}
    </span>
  );
}
