export interface CrmRecord {
  _id:       string;
  tenantId:  string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

export interface CrmPageMeta {
  total:      number;
  page:       number;
  totalPages: number;
}

export interface CrmListResponse<T> {
  data: T[];
  meta: CrmPageMeta;
}

export interface CrmStats {
  total:    number;
  byStatus: Record<string, number>;
}

export interface FieldConfig {
  key:          string;
  label:        string;
  /** 'staffSelect' renders a dropdown of the tenant's NativeStaff, storing
   * their staffId (not a Mongo _id) — same human-readable-ID convention
   * Custom Module relationship fields use. */
  type:         'text' | 'email' | 'phone' | 'number' | 'date' | 'datetime' | 'select' | 'textarea' | 'currency' | 'staffSelect';
  required?:    boolean;
  options?:     string[];
  placeholder?: string;
  tableCol?:    boolean;
  sortable?:    boolean;
  section?:     string;
  searchable?:  boolean;
}

export interface ModulePageConfig {
  label:         string;
  labelSingular: string;
  apiBase:       string;
  statusField?:  string;
  fields:        FieldConfig[];
  /** Alternate view alongside the default table, toggled from the "Table
   * view" dropdown — 'kanban' groups records into columns by statusField;
   * 'calendar' plots them on a month grid by calendarDateField. Omit for
   * modules that only ever need the table. */
  altView?:           'kanban' | 'calendar';
  altViewLabel?:      string;
  calendarDateField?: string;
  /** Records whose own natural date field should be checked by an "Upcoming"
   * quick-filter (e.g. 'date' for Calls, 'startDate' for Meetings). Omit for
   * modules with no natural due-date-like field. */
  upcomingDateField?: string;
  /** When set, clicking a record's name navigates to a dedicated detail page
   * instead of opening the generic RecordDrawer (Contacts/Companies only,
   * today) — the drawer remains available via the row's Edit action either
   * way. */
  detailRoute?: (id: string) => string;
  /** When set, this module's status/stage options come from the tenant's
   * own configurable pipeline (native-crm/pipeline-config) instead of the
   * static `options` array on the statusField — omit for modules not yet
   * migrated to tenant-configurable stages, which keep today's static list. */
  pipelineModule?: 'lead' | 'deal' | 'task' | 'ticket' | 'quotation' | 'workorder' | 'contract' | 'invoice';
}
