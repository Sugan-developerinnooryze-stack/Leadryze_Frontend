// No avatar/initials component existed anywhere in this frontend before
// this (confirmed by repo-wide search) — built here, calendar-scoped, for
// showing a Work Order's assigned staff at a glance. Promote to a shared
// location only once a second real consumer needs it.

const PALETTE = [
  'bg-ryze-500',   'bg-success-500', 'bg-amber-500', 'bg-rose-500',
  'bg-indigo-500', 'bg-teal-500',    'bg-purple-500', 'bg-sky-500',
];

function colorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const SIZE_CLASSES: Record<'xs' | 'sm' | 'md', string> = {
  xs: 'h-5 w-5 text-[9px]',
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-8 w-8 text-xs',
};

export default function Avatar({ name, size = 'sm', title }: { name: string; size?: 'xs' | 'sm' | 'md'; title?: string }) {
  return (
    <span
      title={title ?? name}
      className={`inline-flex items-center justify-center rounded-full font-semibold text-white shrink-0 ${SIZE_CLASSES[size]} ${colorForName(name)}`}
    >
      {initialsOf(name)}
    </span>
  );
}
