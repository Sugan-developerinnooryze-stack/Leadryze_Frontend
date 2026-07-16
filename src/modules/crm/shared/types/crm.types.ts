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
  type:         'text' | 'email' | 'phone' | 'number' | 'date' | 'datetime' | 'select' | 'textarea' | 'currency';
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
}
