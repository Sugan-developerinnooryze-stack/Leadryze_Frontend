import type { OptionGroup } from '../../../modules/native-crm/shared/GroupedSearchableSelect';

/** Which of BUILT_IN_MODULES (AutomationRulesPage.tsx) belongs to which
 * category header — everything else (custom:<slug>) falls into its own
 * "Custom Modules" group. A plain lookup table, not derived from anything
 * dynamic, since the built-in module set itself is fixed code, same as
 * BUILT_IN_MODULES right next to it. */
const CRM_MODULE_KEYS = new Set(['lead', 'deal', 'task', 'ticket', 'customer']);

export function groupModules(modules: { key: string; label: string }[]): OptionGroup[] {
  const crm: { key: string; label: string }[] = [];
  const fieldService: { key: string; label: string }[] = [];
  const custom: { key: string; label: string }[] = [];
  for (const m of modules) {
    if (m.key.startsWith('custom:')) custom.push(m);
    else if (CRM_MODULE_KEYS.has(m.key)) crm.push(m);
    else fieldService.push(m);
  }
  const groups: OptionGroup[] = [];
  if (crm.length) groups.push({ label: 'CRM', options: crm });
  if (fieldService.length) groups.push({ label: 'Field Service', options: fieldService });
  if (custom.length) groups.push({ label: 'Custom Modules', options: custom });
  return groups;
}
