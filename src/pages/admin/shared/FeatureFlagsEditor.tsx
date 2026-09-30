import type { ComponentType } from 'react';
import { Toggle } from './Toggle';
import { EnforcedBadge } from './StatusBadge';
import { AdminCard, AdminCardHeader } from './AdminCard';
import type { FeatureFlags } from '../../../stores/featureFlags.store';

export interface FlagItem { key: keyof FeatureFlags; label: string; enforced: boolean; note?: string }
export interface FlagGroup { group: string; desc: string; icon: ComponentType<{ className?: string }>; items: FlagItem[] }

/** Shared toggle-list renderer behind both the per-tenant Controls tab and
 * the Platform Defaults page — same groups shape, same visual row, just a
 * different current-values object and save target per caller. `readOnly`
 * is for a tenant on accessConfigMode:'default': shows what's currently
 * effective (inherited from the template) without letting it be edited
 * here — switch to Customize on the Controls tab to edit. */
export function FeatureFlagsEditor({
  groups, flags, onChange, readOnly,
}: {
  groups: FlagGroup[];
  flags: Record<string, boolean>;
  onChange: (key: keyof FeatureFlags, val: boolean) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="space-y-5">
      {groups.map((grp) => (
        <AdminCard key={grp.group}>
          <AdminCardHeader icon={grp.icon} title={grp.group} description={grp.desc} />
          <div className="divide-y divide-border">
            {grp.items.map(({ key, label, enforced, note }) => (
              <div key={key} className="px-6 py-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-text-primary">{label}</span>
                    <EnforcedBadge enforced={enforced} />
                  </div>
                  <Toggle label={label} on={flags[key] !== false} onChange={(v) => onChange(key, v)} disabled={readOnly} />
                </div>
                {note && <p className="text-xs text-text-muted mt-1">{note}</p>}
              </div>
            ))}
          </div>
        </AdminCard>
      ))}
    </div>
  );
}
