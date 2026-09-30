import {
  UserPlusIcon, BriefcaseIcon, ClipboardDocumentListIcon,
  TrashIcon, ArrowPathIcon, PencilIcon, CheckCircleIcon, PaperClipIcon,
  LockClosedIcon, LockOpenIcon, UserIcon,
} from '@heroicons/react/24/outline';
import type { FC, SVGProps } from 'react';

type HeroIcon = FC<SVGProps<SVGSVGElement> & { className?: string }>;

const ACTION_ICON: Record<string, HeroIcon> = {
  created: UserPlusIcon,
  updated: PencilIcon,
  deleted: TrashIcon,
  status_changed: ArrowPathIcon,
  stage_changed: ArrowPathIcon,
  note_added: ClipboardDocumentListIcon,
  assigned: UserIcon,
  reassigned: UserIcon,
  converted: CheckCircleIcon,
  uploaded: PaperClipIcon,
  locked: LockClosedIcon,
  unlocked: LockOpenIcon,
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
  const Icon = ACTION_ICON[action] ?? BriefcaseIcon;
  return (
    <div className="flex items-start gap-3 py-2.5">
      <span className="h-6 w-6 rounded-full bg-ryze-600/10 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="h-3.5 w-3.5 text-ryze-600 dark:text-ryze-400" />
      </span>
      <div className="min-w-0">
        <p className="text-sm text-text-primary">{description}</p>
        <p className="text-[11px] text-text-muted mt-0.5">{relativeTime(createdAt)}</p>
      </div>
    </div>
  );
}
