import {
  UserPlusIcon, BriefcaseIcon, ClipboardDocumentListIcon,
  TrashIcon, ArrowPathIcon, PencilIcon, CheckCircleIcon, PaperClipIcon,
  LockClosedIcon, LockOpenIcon, UserIcon, ClockIcon,
} from '@heroicons/react/24/outline';
import type { FC, SVGProps } from 'react';

type HeroIcon = FC<SVGProps<SVGSVGElement> & { className?: string }>;

const ACTION_CONFIG: Record<string, { icon: HeroIcon; bg: string; color: string; label: string }> = {
  created: {
    icon: UserPlusIcon,
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    color: 'text-emerald-600 dark:text-emerald-400',
    label: 'Created',
  },
  updated: {
    icon: PencilIcon,
    bg: 'bg-blue-500/10 dark:bg-blue-500/20',
    color: 'text-blue-600 dark:text-blue-400',
    label: 'Updated',
  },
  deleted: {
    icon: TrashIcon,
    bg: 'bg-rose-500/10 dark:bg-rose-500/20',
    color: 'text-rose-600 dark:text-rose-400',
    label: 'Deleted',
  },
  status_changed: {
    icon: ArrowPathIcon,
    bg: 'bg-amber-500/10 dark:bg-amber-500/20',
    color: 'text-amber-600 dark:text-amber-400',
    label: 'Status Changed',
  },
  stage_changed: {
    icon: ArrowPathIcon,
    bg: 'bg-violet-500/10 dark:bg-violet-500/20',
    color: 'text-violet-600 dark:text-violet-400',
    label: 'Stage Changed',
  },
  note_added: {
    icon: ClipboardDocumentListIcon,
    bg: 'bg-indigo-500/10 dark:bg-indigo-500/20',
    color: 'text-indigo-600 dark:text-indigo-400',
    label: 'Note Added',
  },
  assigned: {
    icon: UserIcon,
    bg: 'bg-teal-500/10 dark:bg-teal-500/20',
    color: 'text-teal-600 dark:text-teal-400',
    label: 'Assigned',
  },
  reassigned: {
    icon: UserIcon,
    bg: 'bg-teal-500/10 dark:bg-teal-500/20',
    color: 'text-teal-600 dark:text-teal-400',
    label: 'Reassigned',
  },
  converted: {
    icon: CheckCircleIcon,
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    color: 'text-emerald-600 dark:text-emerald-400',
    label: 'Converted',
  },
  uploaded: {
    icon: PaperClipIcon,
    bg: 'bg-sky-500/10 dark:bg-sky-500/20',
    color: 'text-sky-600 dark:text-sky-400',
    label: 'Uploaded',
  },
  locked: {
    icon: LockClosedIcon,
    bg: 'bg-slate-500/10 dark:bg-slate-500/20',
    color: 'text-slate-600 dark:text-slate-400',
    label: 'Locked',
  },
  unlocked: {
    icon: LockOpenIcon,
    bg: 'bg-slate-500/10 dark:bg-slate-500/20',
    color: 'text-slate-600 dark:text-slate-400',
    label: 'Unlocked',
  },
};

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface ActivityTimelineItemProps {
  action: string;
  description: string;
  createdAt: string;
}

export default function ActivityTimelineItem({ action, description, createdAt }: ActivityTimelineItemProps) {
  const cfg = ACTION_CONFIG[action] ?? {
    icon: BriefcaseIcon,
    bg: 'bg-ryze-600/10',
    color: 'text-ryze-600 dark:text-ryze-400',
    label: 'Activity',
  };
  const Icon = cfg.icon;

  // Enhance technical descriptions like "Lead BLR05080-LEAD-0012 created" into readable presentation
  const isTechnicalCode = /(?:[A-Z0-9]+-[A-Z0-9]+-[0-9]+)/.test(description);

  return (
    <div className="flex items-center justify-between gap-3 py-2.5 px-2 rounded-xl hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <span className={`h-8 w-8 rounded-xl ${cfg.bg} ${cfg.color} flex items-center justify-center shrink-0 shadow-xs`}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-text-primary truncate">
            {description}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] font-medium text-text-muted capitalize">
              {cfg.label}
            </span>
            {isTechnicalCode && (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/[0.04] dark:bg-white/[0.06] text-text-muted">
                Record
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 text-[11px] text-text-muted shrink-0 tabular-nums font-medium">
        <ClockIcon className="h-3 w-3" />
        <span>{relativeTime(createdAt)}</span>
      </div>
    </div>
  );
}
