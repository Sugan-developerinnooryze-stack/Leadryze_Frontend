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
  /** The backend field is a real string[] (e.g. Meeting.attendees) — the
   * form still edits it as one comma-separated text input (simplest UX for
   * a short list of names), but RecordDrawer needs to join the array for
   * display and split it back on save so the payload matches what the
   * schema actually validates against. */
  isArray?:     boolean;
  /** System-managed display field (e.g. assignedStaffName/teamName/source,
   * populated server-side by round robin/reassignment) — shown as a table
   * column when tableCol:true, but never rendered as an editable input in
   * the generic RecordDrawer, so a user can't accidentally overwrite a
   * value that's meant to change only through the dedicated
   * assignment/reassignment flow. */
  hideInForm?:  boolean;
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
