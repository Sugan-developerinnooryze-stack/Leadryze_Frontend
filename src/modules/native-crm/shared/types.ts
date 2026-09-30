import type { ReactNode } from 'react';

export type FSFieldType =
  | 'text' | 'email' | 'phone' | 'number' | 'select'
  | 'textarea' | 'currency' | 'date' | 'datetime' | 'duration' | 'boolean'
  | 'lookup'
  | 'multilookup'
  | 'multiselect'
  | 'emaillist'
  | 'phonelist'
  | 'servicelines'
  | 'branch-select';

export interface FSFieldDef {
  key:                  string;
  label:                string;
  type:                 FSFieldType;
  required?:            boolean;
  options?:             string[];
  placeholder?:         string;
  filterOnly?:          boolean;

  lookupModule?:        'customers' | 'sites' | 'teams' | 'staffs' | 'services' | 'categories' | 'workorders' | 'quotations' | 'invoices' | 'users';
  lookupValueField?:    string;
  lookupLabelField?:    string;
  cascadeParentField?:  string;

  withTotals?:          boolean;
  categoryFilterField?: string;
  multilookupValueField?: string;

  // Renders a small "Same as X" button next to the label that copies another
  // field's current value in on click — the field stays a normal editable
  // input afterward, so the user can still type over it by hand.
  copyFromKey?:         string;
  copyFromLabel?:       string;
}

export interface FSColumnDef<T = any> {
  key:          string;
  label:        string;
  render?:      (row: T) => ReactNode;
  exportValue?: (row: T) => string;
  exportOnly?:  boolean;  // hidden in table & column picker; always appended in export
}

export const FS_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active:   { bg: 'bg-success-500/15', text: 'text-success-700 dark:text-success-500' },
  inactive: { bg: 'bg-black/[0.06] dark:bg-white/[0.08]', text: 'text-text-muted' },
  onleave:  { bg: 'bg-amber-100 dark:bg-amber-500/15', text: 'text-amber-700 dark:text-amber-400' },
};

export { FSStatusBadge } from './FSStatusBadge';
