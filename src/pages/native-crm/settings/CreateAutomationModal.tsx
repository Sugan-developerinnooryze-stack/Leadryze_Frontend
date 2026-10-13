import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  XMarkIcon, ArrowLeftIcon, PlusCircleIcon, ArrowPathIcon,
  ArrowsRightLeftIcon, TrashIcon, ClockIcon, LinkIcon,
} from '@heroicons/react/24/outline';
import type { AutomationTriggerType } from '../../../modules/native-crm/queries/automation-rules.queries';
import { useEveryModule, useStageCapableModules } from './AutomationRulesPage';
import { groupModules } from './automation-module-groups';
import GroupedSearchableSelect from '../../../modules/native-crm/shared/GroupedSearchableSelect';

type TriggerChoice = AutomationTriggerType | 'webhook';

const TRIGGER_CHOICES: { value: TriggerChoice; label: string; hint: string; icon: typeof PlusCircleIcon }[] = [
  { value: 'record_created', label: 'Record Created',  hint: 'A new record is created',       icon: PlusCircleIcon },
  { value: 'record_updated', label: 'Record Updated',  hint: 'A field on a record changes',    icon: ArrowPathIcon },
  { value: 'status_changed', label: 'Status Changed',  hint: 'A record moves to another stage', icon: ArrowsRightLeftIcon },
  { value: 'record_deleted', label: 'Record Deleted',  hint: 'A record is removed',             icon: TrashIcon },
  { value: 'scheduled',      label: 'Schedule',        hint: 'Checked on a recurring timer',   icon: ClockIcon },
  { value: 'webhook',        label: 'Webhook',         hint: 'An external system calls in',    icon: LinkIcon },
];

// Only these trigger types need a module picked up front — 'scheduled'
// configures its own "watch which records" module inline on the canvas
// (alongside the cron/filter fields it also needs there), and 'webhook' has
// no module at all. Asking for a module here for those two would just be a
// second, confusingly duplicate picker before the one the canvas already has.
const NEEDS_MODULE_UP_FRONT = new Set<TriggerChoice>(['record_created', 'record_updated', 'status_changed', 'record_deleted']);

/** Trigger-first "Create Automation" picker — step 1 picks what starts the
 * automation, step 2 (when relevant) picks which module, then both are
 * passed to the builder as query params to pre-seed its auto-added Trigger
 * node, the same way ?templateId= already pre-seeds a whole template.
 * Every automation created this way is a real AutomationFlow — the
 * Simple-vs-Advanced split is retired from this entry point entirely (see
 * the plan); AutomationFlow can already do everything the old Simple Mode
 * could. */
export default function CreateAutomationModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [trigger, setTrigger] = useState<TriggerChoice | null>(null);
  const [module, setModule] = useState('');
  const EVERY_MODULE = useEveryModule();
  const STAGE_CAPABLE = useStageCapableModules();

  const moduleOptions = trigger === 'status_changed' ? STAGE_CAPABLE : EVERY_MODULE;
  const moduleGroups = groupModules(moduleOptions);
  const needsModule = trigger ? NEEDS_MODULE_UP_FRONT.has(trigger) : false;
  const canContinue = trigger && (!needsModule || !!module);

  const handleContinue = () => {
    if (!trigger) return;
    const params = new URLSearchParams({ triggerType: trigger });
    if (needsModule && module) params.set('module', module);
    navigate(`/native-crm/settings/automation-flows/new?${params.toString()}`);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-surface-elevated rounded-2xl shadow-2xl w-full max-w-lg p-6">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              {trigger && (
                <button onClick={() => setTrigger(null)} className="p-1.5 -ml-1.5 rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-text-muted">
                  <ArrowLeftIcon className="h-4 w-4" />
                </button>
              )}
              <h2 className="text-lg font-semibold text-text-primary">
                {!trigger ? 'What should start this automation?' : 'Which records?'}
              </h2>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-text-muted">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {!trigger ? (
            <div className="grid grid-cols-2 gap-2.5 mt-4">
              {TRIGGER_CHOICES.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.value}
                    onClick={() => setTrigger(t.value)}
                    className="flex flex-col items-start gap-1.5 p-3.5 rounded-xl border border-border bg-background hover:border-ryze-300 dark:hover:border-ryze-700 hover:bg-ryze-600/5 transition-colors text-left"
                  >
                    <Icon className="h-5 w-5 text-ryze-600 dark:text-ryze-400" />
                    <span className="text-sm font-semibold text-text-primary">{t.label}</span>
                    <span className="text-[11px] text-text-muted leading-tight">{t.hint}</span>
                  </button>
                );
              })}
            </div>
          ) : needsModule ? (
            <div className="mt-4">
              <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wide">Module</label>
              <GroupedSearchableSelect groups={moduleGroups} value={module} onChange={setModule} placeholder="Select a module…" />
            </div>
          ) : (
            <p className="text-xs text-text-muted mt-4">
              {trigger === 'scheduled'
                ? "You'll pick which records and how often to check right on the canvas."
                : "You'll get a webhook URL to send events to right on the canvas."}
            </p>
          )}

          <div className="flex gap-3 mt-6">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm font-medium text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors">
              Cancel
            </button>
            {trigger && (
              <button onClick={handleContinue} disabled={!canContinue}
                className="flex-1 px-4 py-2.5 bg-ryze-600 hover:bg-ryze-700 disabled:opacity-50 rounded-lg text-sm font-medium text-white transition-colors">
                Continue
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
