import { FS_STATUS_COLORS } from './types';

export function FSStatusBadge({ value }: { value: string }) {
  const c = FS_STATUS_COLORS[value] ?? { bg: 'bg-gray-100', text: 'text-gray-600' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${c.bg} ${c.text}`}>
      {value.replace(/_/g, ' ')}
    </span>
  );
}
