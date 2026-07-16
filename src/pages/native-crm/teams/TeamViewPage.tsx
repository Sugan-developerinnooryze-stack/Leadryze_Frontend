import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon, UserGroupIcon, UserPlusIcon, XMarkIcon, EyeIcon,
} from '@heroicons/react/24/outline';
import { useTeamQuery } from '../../../modules/native-crm/queries/teams.queries';
import { useStaffsListQuery, useStaffUpdate } from '../../../modules/native-crm/queries/staffs.queries';
import { FSStatusBadge } from '../../../modules/native-crm/shared/types';

function InfoRow({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 py-2 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500 w-40 shrink-0">{label}</span>
      <span className="text-sm text-gray-900 font-medium">{value ?? '—'}</span>
    </div>
  );
}

export default function TeamViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showAssign, setShowAssign] = useState(false);
  const [assigning,  setAssigning]  = useState<string | null>(null);

  const { data: team, isLoading } = useTeamQuery(id ?? '');
  // Members = staff whose teamId points at this team
  const { data: membersData }  = useStaffsListQuery({ page: 1, limit: 500, teamId: id });
  // All staff — for the assign panel (client-filtered to those not in this team)
  const { data: allStaffData } = useStaffsListQuery({ page: 1, limit: 500 });
  const updateStaff = useStaffUpdate();

  if (isLoading) return (
    <div className="flex items-center justify-center h-full">
      <div className="flex gap-2">{[0, 1, 2].map(i => <span key={i} className="h-2.5 w-2.5 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}</div>
    </div>
  );

  if (!team) return <div className="flex items-center justify-center h-full text-gray-400">Team not found.</div>;

  const members = membersData?.items ?? [];
  const unassigned = (allStaffData?.items ?? []).filter((s: any) => {
    const tid = typeof s.teamId === 'object' ? s.teamId?._id : s.teamId;
    return tid !== id;
  });

  const handleAssign = async (staff: any) => {
    setAssigning(staff._id);
    try { await updateStaff.mutateAsync({ id: staff._id, data: { teamId: id } }); }
    finally { setAssigning(null); }
  };

  const handleRemove = async (staff: any) => {
    setAssigning(staff._id);
    try { await updateStaff.mutateAsync({ id: staff._id, data: { teamId: null } }); }
    finally { setAssigning(null); }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-6 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => navigate('/native-crm/teams')}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
            <ArrowLeftIcon className="h-4 w-4" /> Back to Teams
          </button>
        </div>

        <div className="flex items-start gap-4">
          <div className="h-16 w-16 rounded-2xl bg-teal-100 flex items-center justify-center shrink-0 border border-teal-200">
            <UserGroupIcon className="h-8 w-8 text-teal-600" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">{team.name}</h1>
            <div className="flex flex-wrap gap-x-6 gap-y-2 mt-2 text-sm text-gray-600">
              {team.teamId && <p><strong>ID:</strong> {team.teamId}</p>}
              <p><strong>Members:</strong> {members.length}</p>
              {team.description && <p><strong>Description:</strong> {team.description}</p>}
            </div>
          </div>
          <div className="shrink-0">
            <FSStatusBadge value={team.status ?? 'active'} />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
        {/* Team details */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden max-w-4xl">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-700">Team Details</h3>
          </div>
          <div className="px-6 py-4">
            <InfoRow label="Team ID"     value={team.teamId} />
            <InfoRow label="Name"        value={team.name} />
            <InfoRow label="Description" value={team.description} />
            <InfoRow label="Status"      value={<FSStatusBadge value={team.status ?? 'active'} />} />
            <InfoRow label="Created"     value={team.createdAt ? new Date(team.createdAt).toLocaleString() : undefined} />
          </div>
        </div>

        {/* Members */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden max-w-4xl">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">Assigned Staff ({members.length})</h3>
            <button
              onClick={() => setShowAssign((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-medium hover:bg-brand-700 transition-colors"
            >
              <UserPlusIcon className="h-4 w-4" />
              {showAssign ? 'Close' : 'Add Member'}
            </button>
          </div>

          {/* Assign panel */}
          {showAssign && (
            <div className="px-6 py-4 border-b border-gray-100 bg-brand-50/40">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Available staff</p>
              {unassigned.length === 0 ? (
                <p className="text-sm text-gray-400">All staff are already in this team.</p>
              ) : (
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {unassigned.map((s: any) => (
                    <div key={s._id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white transition-colors">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{[s.firstName, s.lastName].filter(Boolean).join(' ')}</p>
                        <p className="text-xs text-gray-400">{s.staffId}{s.role ? ` · ${s.role}` : ''}</p>
                      </div>
                      <button
                        onClick={() => handleAssign(s)}
                        disabled={assigning === s._id}
                        className="px-3 py-1 rounded-lg text-xs font-medium border border-brand-300 text-brand-600 hover:bg-brand-50 disabled:opacity-50 transition-colors"
                      >
                        {assigning === s._id ? 'Adding…' : 'Add'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Members list */}
          {members.length === 0 ? (
            <div className="px-6 py-10 text-center text-gray-400">
              <UserGroupIcon className="h-10 w-10 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No staff assigned to this team yet.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Staff ID</th>
                  <th className="px-6 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                  <th className="px-6 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
                  <th className="px-6 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-6 py-2.5 w-24"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {members.map((s: any) => (
                  <tr key={s._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3 text-xs font-mono text-gray-500">{s.staffId}</td>
                    <td className="px-6 py-3 font-medium text-gray-800">
                      {[s.firstName, s.lastName].filter(Boolean).join(' ')}
                    </td>
                    <td className="px-6 py-3 text-gray-600">{s.role ?? '—'}</td>
                    <td className="px-6 py-3"><FSStatusBadge value={s.status ?? 'active'} /></td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => navigate(`/native-crm/staffs/${s._id}`)}
                          title="View staff"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleRemove(s)}
                          disabled={assigning === s._id}
                          title="Remove from team"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                        >
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
