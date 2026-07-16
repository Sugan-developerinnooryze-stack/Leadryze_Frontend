import { useEffect, useState, FormEvent } from 'react';
import {
  PlusIcon, CheckCircleIcon,
  ArrowPathIcon, TrashIcon,
} from '@heroicons/react/24/outline';
import api from '../../services/api';
import { useAuthStore } from '../../stores/auth.store';
import { useFeatureFlagsStore } from '../../stores/featureFlags.store';
import toast from 'react-hot-toast';
import Modal from '../../components/Modal';

interface Connector {
  _id: string;
  name: string;
  type: string;
  status: 'active' | 'inactive' | 'error';
  syncStatus: 'idle' | 'syncing' | 'success' | 'failed';
  lastSyncAt?: string;
}

// Connectors that auto-discover their own fields — no mapping needed
const AUTO_DISCOVER = new Set(['zoho', 'hubspot', 'salesforce']);

// Default field mapping shown to user for DB/REST connectors
// Key = their column name hint, Value = our schema field
const DEFAULT_MAPPING = `name=full_name\nemail=email\nphone=mobile\ncompany=company_name\nleadSource=source\nstatus=status`;

const CRM_META: Record<string, { icon: string; label: string; color: string; group: string; fields: ConnectorField[] }> = {
  zoho: {
    icon: '🔵', label: 'Zoho CRM', color: 'text-blue-600', group: 'crm',
    fields: [
      { key: 'clientId',     label: 'Client ID',           type: 'text',     placeholder: '1000.XXXXXXXX' },
      { key: 'clientSecret', label: 'Client Secret',       type: 'password', placeholder: '51e6da...' },
      { key: 'authCode',     label: 'Authorization Code',  type: 'password', placeholder: '1000.fcd5...' },
      { key: 'baseUrl',      label: 'API Base URL',        type: 'text',     placeholder: 'https://www.zohoapis.in/crm/v3', defaultValue: 'https://www.zohoapis.in/crm/v3' },
    ],
  },
  hubspot: {
    icon: '🟠', label: 'HubSpot', color: 'text-orange-600', group: 'crm',
    fields: [
      { key: 'accessToken', label: 'Private App Token', type: 'password', placeholder: 'pat-na1-xxxxxxxx' },
    ],
  },
  salesforce: {
    icon: '☁️', label: 'Salesforce', color: 'text-sky-600', group: 'crm',
    fields: [
      { key: 'clientId',     label: 'Consumer Key',    type: 'text',     placeholder: '3MVG97L7...' },
      { key: 'clientSecret', label: 'Consumer Secret', type: 'password', placeholder: '037BAC88...' },
      { key: 'loginUrl',     label: 'Instance URL',    type: 'text',     placeholder: 'https://yourorg.develop.my.salesforce.com' },
    ],
  },
  rest: {
    icon: '🔌', label: 'REST API', color: 'text-gray-600', group: 'custom',
    fields: [
      { key: 'baseUrl', label: 'API Endpoint URL', type: 'text', placeholder: 'https://api.yoursite.com/customers' },
      { key: 'apiKey', label: 'API Key / Bearer Token', type: 'password', placeholder: 'Bearer xxx' },
    ],
  },
  mysql: {
    icon: '🐬', label: 'MySQL', color: 'text-blue-700', group: 'custom',
    fields: [
      { key: 'host',     label: 'Host',     type: 'text',   placeholder: 'db.yoursite.com' },
      { key: 'port',     label: 'Port',     type: 'number', placeholder: '3306', defaultValue: '3306' },
      { key: 'database', label: 'Database', type: 'text',   placeholder: 'myapp_db' },
      { key: 'username', label: 'Username', type: 'text',   placeholder: 'root' },
      { key: 'password', label: 'Password', type: 'password', placeholder: '••••••••' },
    ],
  },
  postgresql: {
    icon: '🐘', label: 'PostgreSQL', color: 'text-indigo-700', group: 'custom',
    fields: [
      { key: 'host',     label: 'Host',     type: 'text',   placeholder: 'db.yoursite.com' },
      { key: 'port',     label: 'Port',     type: 'number', placeholder: '5432', defaultValue: '5432' },
      { key: 'database', label: 'Database', type: 'text',   placeholder: 'myapp_db' },
      { key: 'username', label: 'Username', type: 'text',   placeholder: 'postgres' },
      { key: 'password', label: 'Password', type: 'password', placeholder: '••••••••' },
    ],
  },
  mongodb: {
    icon: '🍃', label: 'MongoDB', color: 'text-green-700', group: 'custom',
    fields: [
      { key: 'uri', label: 'Connection URI', type: 'password', placeholder: 'mongodb+srv://user:pass@cluster.mongodb.net/mydb' },
    ],
  },
};

interface ConnectorField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'number';
  placeholder?: string;
  defaultValue?: string;
}

export default function ConnectorsPage() {
  const user  = useAuthStore((s) => s.user);
  const flags = useFeatureFlagsStore((s) => s.flags);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalType, setModalType] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [connName, setConnName] = useState('');
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [fieldMapping, setFieldMapping] = useState(DEFAULT_MAPPING); // "ourField=theirColumn" lines

  const fetchConnectors = () => {
    if (!user?.tenantId) return;
    api
      .get(`/api/v1/connectors?tenantId=${user.tenantId}`)
      .then((r) => setConnectors(r.data.data ?? []))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { fetchConnectors(); }, [user?.tenantId]);

  const openModal = (type: string) => {
    const meta = CRM_META[type];
    const defaults: Record<string, string> = {};
    meta.fields.forEach((f) => { defaults[f.key] = f.defaultValue ?? ''; });
    setFormValues(defaults);
    setConnName(meta.label);
    setFieldMapping(DEFAULT_MAPPING);
    setModalType(type);
  };

  /* Parse "ourField=theirColumn" textarea into mapping object */
  const parseMappingText = (text: string): Record<string, string> => {
    const map: Record<string, string> = {};
    text.split('\n').forEach((line) => {
      const [our, their] = line.split('=').map((s) => s.trim());
      if (our && their) map[our] = their;
    });
    return map;
  };

  const handleConnect = async (e: FormEvent) => {
    e.preventDefault();
    if (!modalType) return;
    setSaving(true);
    try {
      // CRMs that auto-discover fields don't need a user mapping
      const customerFields = AUTO_DISCOVER.has(modalType) ? {} : parseMappingText(fieldMapping);
      await api.post('/api/v1/connectors', {
        name: connName, type: modalType,
        config: formValues,
        mapping: { customerFields },
      });
      toast.success(`${CRM_META[modalType].label} connected!`);
      setModalType(null);
      fetchConnectors();
    } catch {
      toast.error('Failed to save connector');
    } finally {
      setSaving(false);
    }
  };

  const testConnector = async (id: string) => {
    setTestingId(id);
    try {
      const res = await api.post(`/api/v1/connectors/${id}/test`);
      if (res.data.data?.success) toast.success('Connection test passed ✓');
      else toast.error('Test failed — check credentials');
    } catch {
      toast.error('Connection test failed');
    } finally {
      setTestingId(null);
    }
  };

  const syncConnector = async (id: string) => {
    setSyncingId(id);
    try {
      await api.post(`/api/v1/connectors/${id}/sync`);
      toast.success('Sync started — data will update in a few minutes');
      // Refresh connector card after short delay to pick up the syncing status
      setTimeout(fetchConnectors, 1500);
    } catch {
      toast.error('Failed to start sync');
    } finally {
      setSyncingId(null);
    }
  };

  const deleteConnector = async (id: string) => {
    try {
      await api.delete(`/api/v1/connectors/${id}`);
      toast.success('Connector disconnected successfully');
      setConnectors((prev) => prev.filter((c) => c._id !== id));
    } catch {
      toast.error('Failed to disconnect — please try again');
    } finally {
      setDeleteConfirmId(null);
    }
  };


  const ConnectorCard = ({ type, meta }: { type: string; meta: typeof CRM_META[string] }) => {
    const connector = connectors.find((c) => c.type === type);
    const isConnected = !!connector;
    return (
      <div className="card flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{meta.icon}</span>
          <div className="flex-1 min-w-0">
            <h3 className={`font-semibold text-sm ${meta.color}`}>{meta.label}</h3>
            {isConnected ? (
              <div className="flex items-center gap-1 mt-0.5">
                <CheckCircleIcon className="h-3 w-3 text-green-500" />
                <span className="text-xs text-green-600 font-medium">
                  {connector.lastSyncAt ? `Synced ${new Date(connector.lastSyncAt).toLocaleDateString()}` : 'Connected'}
                </span>
              </div>
            ) : (
              <span className="text-xs text-gray-400">Not connected</span>
            )}
          </div>
        </div>

        {isConnected && connector ? (
          <div className="flex flex-col gap-2">
            <button className="btn-primary w-full text-sm gap-2"
              onClick={() => syncConnector(connector._id)} disabled={syncingId === connector._id}>
              <ArrowPathIcon className={`h-4 w-4 ${syncingId === connector._id ? 'animate-spin' : ''}`} />
              {syncingId === connector._id ? 'Syncing…' : 'Sync Now'}
            </button>
            <button className="btn-secondary w-full text-sm"
              onClick={() => testConnector(connector._id)} disabled={testingId === connector._id}>
              {testingId === connector._id ? 'Testing…' : 'Test'}
            </button>
            <button className="flex items-center justify-center gap-2 w-full text-sm text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg py-2 transition-colors"
              onClick={() => setDeleteConfirmId(connector._id)}>
              <TrashIcon className="h-4 w-4" /> Disconnect
            </button>
          </div>
        ) : (
          <button className="btn-primary w-full text-sm gap-2" onClick={() => openModal(type)}>
            <PlusIcon className="h-4 w-4" /> Connect
          </button>
        )}
      </div>
    );
  };

  const crmEntries    = Object.entries(CRM_META).filter(([type, m]) => m.group === 'crm'    && flags[`connector_${type}` as keyof typeof flags] !== false);
  const customEntries = Object.entries(CRM_META).filter(([type, m]) => m.group === 'custom' && flags[`connector_${type}` as keyof typeof flags] !== false);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Connectors</h1>
        <p className="text-sm text-gray-500">Connect any data source — AI reads all customer data automatically</p>
      </div>

      {/* How it works */}
      <div className="bg-gradient-to-r from-brand-50 to-blue-50 border border-brand-100 rounded-2xl p-5">
        <h3 className="font-semibold text-brand-700 mb-3">How it works — same flow for every connector</h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-sm text-gray-600">
          {[
            ['1. Connect', 'Link your CRM, DB, or REST API'],
            ['2. Auto Sync', 'All records pulled — known fields mapped, extra fields auto-captured'],
            ['3. AI Reads', 'AI knows every customer — name, history, status, custom fields'],
            ['4. Auto Actions', 'AI sends emails, WhatsApp, follow-ups based on your data'],
          ].map(([step, desc]) => (
            <div key={step} className="flex items-start gap-2">
              <span className="font-bold text-brand-600 shrink-0">{step}</span>
              <span>{desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CRM section */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">CRM Platforms</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {crmEntries.map(([type, meta]) => <ConnectorCard key={type} type={type} meta={meta} />)}
        </div>
      </div>

      {/* Custom DB section */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Your Own Database / API</p>
        <p className="text-xs text-gray-400 mb-3">
          Connect any database or REST endpoint. You define which column = which field once — AI handles the rest automatically.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {customEntries.map(([type, meta]) => <ConnectorCard key={type} type={type} meta={meta} />)}
        </div>
      </div>

      {isLoading && (
        <div className="animate-pulse grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(7)].map((_, i) => <div key={i} className="card h-28 bg-gray-100" />)}
        </div>
      )}

      {/* Connect Modal */}
      {modalType && (
        <Modal open={true} title={`Connect ${CRM_META[modalType].label}`} onClose={() => setModalType(null)}>
          <form onSubmit={handleConnect} className="space-y-4">
            <div>
              <label className="label">Connection Name</label>
              <input className="input" value={connName} onChange={(e) => setConnName(e.target.value)} required />
            </div>

            {/* Zoho: paste JSON shortcut */}
            {modalType === 'zoho' && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2">
                <p className="text-xs font-semibold text-blue-700">
                  Paste the JSON file downloaded from Zoho API Console → Self Client → Generate Code
                </p>
                <textarea
                  className="input font-mono text-xs leading-relaxed"
                  rows={4}
                  placeholder={'{\n  "client_id": "1000.xxx",\n  "client_secret": "51e6...",\n  "code": "1000.fcd5..."\n}'}
                  onChange={(e) => {
                    try {
                      const json = JSON.parse(e.target.value);
                      if (json.client_id || json.client_secret || json.code) {
                        setFormValues((p) => ({
                          ...p,
                          clientId:     json.client_id     || p.clientId,
                          clientSecret: json.client_secret || p.clientSecret,
                          authCode:     json.code          || p.authCode,
                        }));
                      }
                    } catch { /* not valid json yet, ignore */ }
                  }}
                />
                <p className="text-xs text-blue-500">Fields below will auto-fill when you paste valid JSON above</p>
              </div>
            )}

            {CRM_META[modalType].fields.map((field) => (
              <div key={field.key}>
                <label className="label">{field.label}</label>
                <input
                  className="input font-mono text-sm"
                  type={field.type === 'number' ? 'number' : field.type === 'password' ? 'password' : 'text'}
                  placeholder={field.placeholder}
                  value={formValues[field.key] ?? ''}
                  onChange={(e) => setFormValues((p) => ({ ...p, [field.key]: e.target.value }))}
                  required={['password', 'text'].includes(field.type)}
                />
              </div>
            ))}

            {/* Field mapping — only for non-auto-discover connectors */}
            {!AUTO_DISCOVER.has(modalType) && (
              <div>
                <label className="label">
                  Field Mapping
                  <span className="text-gray-400 font-normal ml-1">— our field = your column name</span>
                </label>
                <textarea
                  className="input font-mono text-xs leading-relaxed"
                  rows={8}
                  value={fieldMapping}
                  onChange={(e) => setFieldMapping(e.target.value)}
                  placeholder="name=full_name&#10;email=email&#10;phone=mobile&#10;company=company_name"
                />
                <p className="text-xs text-gray-400 mt-1">
                  One mapping per line. Format: <code className="bg-gray-100 px-1 rounded">ourField=yourColumnName</code>.
                  Any column not listed here is auto-captured as extra data and appears in the Columns picker.
                </p>
                {['mysql', 'postgresql'].includes(modalType) && (
                  <div className="mt-2 bg-gray-50 rounded-lg p-3 text-xs text-gray-500 space-y-1">
                    <p className="font-medium text-gray-600">Add table name to mapping:</p>
                    <code className="block">__table=customers</code>
                    <p className="text-gray-400">Replace <em>customers</em> with your actual table name.</p>
                  </div>
                )}
                {modalType === 'mongodb' && (
                  <div className="mt-2 bg-gray-50 rounded-lg p-3 text-xs text-gray-500 space-y-1">
                    <p className="font-medium text-gray-600">Add collection name to mapping:</p>
                    <code className="block">__collection=customers</code>
                  </div>
                )}
              </div>
            )}

            {/* Hints per CRM type */}
            {modalType === 'zoho' && (
              <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700 space-y-1">
                <p className="font-semibold">Zoho auto-discovers all fields — no mapping needed.</p>
                <p>API Console → Self Client → scope: <code className="bg-blue-100 px-1 rounded">ZohoCRM.modules.ALL</code></p>
              </div>
            )}
            {modalType === 'hubspot' && (
              <div className="bg-orange-50 rounded-xl p-3 text-xs text-orange-700 space-y-1">
                <p className="font-semibold">HubSpot auto-discovers all contact properties — no mapping needed.</p>
                <p>Settings → Integrations → Private Apps → create with <code className="bg-orange-100 px-1 rounded">crm.objects.contacts.read</code></p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setModalType(null)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Connecting…' : 'Save & Connect'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Disconnect Confirmation Modal */}
      {deleteConfirmId && (
        <Modal open={true} title="Disconnect Connector" onClose={() => setDeleteConfirmId(null)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              The connector will be disconnected and will stop syncing. Your existing CRM data is <strong>kept safely</strong> — if you reconnect this connector later, only new changes will be synced (no full re-import needed).
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setDeleteConfirmId(null)}>
                Cancel
              </button>
              <button type="button" className="btn-danger" onClick={() => deleteConnector(deleteConfirmId)}>
                <TrashIcon className="h-4 w-4" /> Yes, Disconnect
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
