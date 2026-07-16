import { useEffect, useState, FormEvent } from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';
import api from '../../services/api';
import { useAuthStore } from '../../stores/auth.store';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import Modal from '../../components/Modal';

interface Campaign {
  _id: string;
  name: string;
  type: string;
  status: string;
  channel: string;
  stats: { sent: number; delivered: number; replied: number };
  createdAt: string;
}

const STATUS_BADGE: Record<string, string> = {
  draft: 'badge-gray',
  active: 'badge-green',
  paused: 'badge-yellow',
  completed: 'badge-blue',
};

const EMPTY = { name: '', type: 'broadcast', channel: 'whatsapp', description: '' };

export default function CampaignsPage() {
  const user = useAuthStore((s) => s.user);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const fetchCampaigns = () => {
    if (!user?.tenantId) return;
    api
      .get(`/api/v1/campaigns?tenantId=${user.tenantId}`)
      .then((r) => setCampaigns(r.data.data ?? []))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { fetchCampaigns(); }, [user?.tenantId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/api/v1/campaigns', {
        name: form.name,
        type: form.type,
        channel: form.channel,
        description: form.description,
        status: 'draft',
        stats: { sent: 0, delivered: 0, replied: 0, converted: 0 },
      });
      toast.success('Campaign created!');
      setShowModal(false);
      setForm(EMPTY);
      fetchCampaigns();
    } catch {
      toast.error('Failed to create campaign');
    } finally {
      setSaving(false);
    }
  };

  const f = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
        <button className="btn-primary gap-2" onClick={() => setShowModal(true)}>
          <PlusIcon className="h-4 w-4" /> New Campaign
        </button>
      </div>

      {isLoading ? (
        <div className="animate-pulse grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => <div key={i} className="card h-40 bg-gray-100" />)}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-gray-400 mb-4">No campaigns yet. Create your first campaign!</p>
          <button className="btn-primary gap-2" onClick={() => setShowModal(true)}>
            <PlusIcon className="h-4 w-4" /> New Campaign
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map((c) => (
            <div key={c._id} className="card hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-gray-900 truncate">{c.name}</h3>
                <span className={`ml-2 shrink-0 badge ${STATUS_BADGE[c.status] || 'badge-gray'} capitalize`}>
                  {c.status}
                </span>
              </div>
              <div className="flex gap-2 mb-4">
                <span className="badge badge-blue capitalize">{c.type}</span>
                <span className="badge badge-gray capitalize">{c.channel}</span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center border-t border-gray-100 pt-4">
                {([['Sent', c.stats?.sent ?? 0], ['Delivered', c.stats?.delivered ?? 0], ['Replied', c.stats?.replied ?? 0]] as [string, number][]).map(([label, val]) => (
                  <div key={label}>
                    <p className="text-lg font-bold text-gray-900">{val}</p>
                    <p className="text-xs text-gray-500">{label}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-3">
                Created {format(new Date(c.createdAt), 'dd MMM yyyy')}
              </p>
            </div>
          ))}
        </div>
      )}

      <Modal open={showModal} title="New Campaign" onClose={() => { setShowModal(false); setForm(EMPTY); }}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Campaign Name *</label>
            <input className="input" placeholder="e.g. June WhatsApp Blast" value={form.name} onChange={f('name')} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Type</label>
              <select className="input" value={form.type} onChange={f('type')}>
                <option value="broadcast">Broadcast</option>
                <option value="drip">Drip Sequence</option>
                <option value="reengagement">Re-engagement</option>
                <option value="followup">Follow-up</option>
              </select>
            </div>
            <div>
              <label className="label">Channel</label>
              <select className="input" value={form.channel} onChange={f('channel')}>
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
                <option value="sms">SMS</option>
                <option value="instagram">Instagram</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Description <span className="text-gray-400 font-normal">(optional)</span></label>
            <textarea className="input" rows={3} placeholder="What is this campaign about?" value={form.description} onChange={f('description')} />
          </div>
          <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-700">
            Campaign will be saved as <strong>Draft</strong>. You can activate it after adding a message template.
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={() => { setShowModal(false); setForm(EMPTY); }}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Creating…' : 'Create Campaign'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
