import type { ReactNode } from 'react';

export type FSFieldType =
  | 'text' | 'email' | 'phone' | 'number' | 'select'
  | 'textarea' | 'currency' | 'date' | 'datetime' | 'duration' | 'boolean'
  | 'lookup'
  | 'multilookup'
  | 'multiselect'
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

  lookupModule?:        'customers' | 'sites' | 'teams' | 'staffs' | 'services' | 'categories' | 'workorders' | 'quotations';
  lookupValueField?:    string;
  lookupLabelField?:    string;
  cascadeParentField?:  string;

  withTotals?:          boolean;
  categoryFilterField?: string;
  multilookupValueField?: string;
}

export interface FSColumnDef<T = any> {
  key:          string;
  label:        string;
  render?:      (row: T) => ReactNode;
  exportValue?: (row: T) => string;
  exportOnly?:  boolean;  // hidden in table & column picker; always appended in export
}

export const FS_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active:   { bg: 'bg-green-100', text: 'text-green-700'  },
  inactive: { bg: 'bg-gray-100',  text: 'text-gray-500'   },
  onleave:  { bg: 'bg-amber-100', text: 'text-amber-700'  },
};

export { FSStatusBadge } from './FSStatusBadge';
