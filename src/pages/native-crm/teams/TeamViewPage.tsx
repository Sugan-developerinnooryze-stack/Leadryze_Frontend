import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeftIcon, UserGroupIcon, UserPlusIcon, XMarkIcon, EyeIcon,
  UserPlusIcon as LeadIcon, CalendarDaysIcon, UsersIcon,
} from '@heroicons/react/24/outline';
import { useTeamQuery } from '../../../modules/native-crm/queries/teams.queries';
import { useStaffsListQuery, useStaffUpdate } from '../../../modules/native-crm/queries/staffs.queries';
import { useUsersListQuery } from '../../../modules/native-crm/queries/users.queries';
import { useServicesListQuery } from '../../../modules/native-crm/queries/services.queries';
import { FSStatusBadge } from '../../../modules/native-crm/shared/types';
import api from '../../../services/api';

/** This team's OWN real numbers — computed server-side from this team's own
 * active staff roster, not from whoever happens to be logged in viewing the
 * page. Correct and understandable for any viewer (a Tenant Admin browsing
 * every team, or the team's own Supervisor). */
function useTeamStats(teamId: string) {
  return useQuery({
    queryKey: ['native-crm', 'teams', teamId, 'stats'],
    queryFn: () => api.get(`/api/v1/native-crm/teams/${teamId}/stats`).then((r) => r.data.data as { staffCount: number; leads: number; meetings: number; customers: number }),
    enabled: !!teamId,
    staleTime: 30_000,
  });
}

function InfoRow({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 py-2 border-b border-border last:border-0">
      <span className="text-sm text-text-muted w-40 shrink-0">{label}</span>
      <span className="text-sm text-text-primary font-medium">{value ?? '—'}</span>
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
  // team.managerUserId/serviceIds come back as raw ids (no backend populate) —
  // resolved to display names client-side, same convention this page already
  // uses for staff (fetched as a flat list, matched by id in render).
  const { data: usersData }    = useUsersListQuery({ limit: 200 });
  const { data: servicesData } = useServicesListQuery({ page: 1, limit: 200 });
  const manager = (usersData?.items ?? []).find((u) => u._id === team?.managerUserId);
  const teamServiceIds: string[] = (team?.serviceIds ?? []).map((s: any) => (typeof s === 'object' ? s._id : s));
  const teamServices = (servicesData?.items ?? []).filter((s: any) => teamServiceIds.includes(s._id));

  const { data: teamStats } = useTeamStats(id ?? '');

  if (isLoading) return (
    <div className="flex items-center justify-center h-full">
      <div className="flex gap-2">{[0, 1, 2].map(i => <span key={i} className="h-2.5 w-2.5 rounded-full bg-ryze-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}</div>
    </div>
  );

  if (!team) return <div className="flex items-center justify-center h-full text-text-muted">Team not found.</div>;

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
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Header */}
      <div className="bg-surface border-b border-border px-8 py-6 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => navigate('/native-crm/teams')}
            className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors">
            <ArrowLeftIcon className="h-4 w-4" /> Back to Teams
          </button>
        </div>

        <div className="flex items-start gap-4">
          <div className="h-16 w-16 rounded-2xl bg-teal-100 dark:bg-teal-500/15 flex items-center justify-center shrink-0 border border-teal-200 dark:border-teal-500/30">
            <UserGroupIcon className="h-8 w-8 text-teal-600 dark:text-teal-400" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-text-primary">{team.name}</h1>
            <div className="flex flex-wrap gap-x-6 gap-y-2 mt-2 text-sm text-text-muted">
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
        <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden max-w-4xl">
          <div className="px-6 py-4 border-b border-border bg-black/[0.015] dark:bg-white/[0.02]">
            <h3 className="text-sm font-semibold text-text-primary">Team Details</h3>
          </div>
          <div className="px-6 py-4">
            <InfoRow label="Team ID"     value={team.teamId} />
            <InfoRow label="Name"        value={team.name} />
            <InfoRow label="Description" value={team.description} />
            <InfoRow label="Status"      value={<FSStatusBadge value={team.status ?? 'active'} />} />
            <InfoRow label="Supervisor"  value={manager ? [manager.firstName, manager.lastName].filter(Boolean).join(' ') || manager.email : 'Not assigned'} />
            <InfoRow label="Services Handled" value={teamServices.length ? teamServices.map((s: any) => s.name).join(', ') : undefined} />
            <InfoRow label="Created"     value={team.createdAt ? new Date(team.createdAt).toLocaleString() : undefined} />
          </div>
        </div>

        {/* This team's own activity — real counts for exactly this team's
            staff, not whoever's logged in viewing the page. */}
        <div className="max-w-4xl">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Team Activity</p>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Leads',     value: teamStats?.leads,     Icon: LeadIcon,         color: 'text-violet-600',  bg: 'bg-violet-50' },
              { label: 'Meetings',  value: teamStats?.meetings,  Icon: CalendarDaysIcon, color: 'text-sky-600',     bg: 'bg-sky-50'    },
              { label: 'Customers', value: teamStats?.customers, Icon: UsersIcon,        color: 'text-emerald-600', bg: 'bg-emerald-50' },
            ].map((s) => (
              <div key={s.label} className={`rounded-xl border border-border shadow-sm p-4 flex items-center gap-3 ${s.bg}`}>
                <s.Icon className={`h-6 w-6 shrink-0 ${s.color}`} />
                <div>
                  <p className="text-xs text-text-muted">{s.label}</p>
                  <p className={`text-xl font-bold ${s.color}`}>{s.value ?? '—'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Members */}
        <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden max-w-4xl">
          <div className="px-6 py-4 border-b border-border bg-black/[0.015] dark:bg-white/[0.02] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">Assigned Staff ({members.length})</h3>
            <button
              onClick={() => setShowAssign((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ryze-600 text-white text-xs font-medium hover:bg-ryze-700 transition-colors"
            >
              <UserPlusIcon className="h-4 w-4" />
              {showAssign ? 'Close' : 'Add Member'}
            </button>
          </div>

          {/* Assign panel */}
          {showAssign && (
            <div className="px-6 py-4 border-b border-border bg-ryze-600/10/40">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">Available staff</p>
              {unassigned.length === 0 ? (
                <p className="text-sm text-text-muted">All staff are already in this team.</p>
              ) : (
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {unassigned.map((s: any) => (
                    <div key={s._id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-surface transition-colors">
                      <div>
                        <p className="text-sm font-medium text-text-primary">{[s.firstName, s.lastName].filter(Boolean).join(' ')}</p>
                        <p className="text-xs text-text-muted">{s.staffId}{s.role ? ` · ${s.role}` : ''}</p>
                      </div>
                      <button
                        onClick={() => handleAssign(s)}
                        disabled={assigning === s._id}
                        className="px-3 py-1 rounded-lg text-xs font-medium border border-ryze-300 dark:border-ryze-700 text-ryze-600 dark:text-ryze-400 hover:bg-ryze-600/10 disabled:opacity-50 transition-colors"
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
            <div className="px-6 py-10 text-center text-text-muted">
              <UserGroupIcon className="h-10 w-10 mx-auto mb-2 text-text-muted" />
              <p className="text-sm">No staff assigned to this team yet.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-background border-b border-border">
                <tr>
                  <th className="px-6 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">Staff ID</th>
                  <th className="px-6 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">Name</th>
                  <th className="px-6 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">Role</th>
                  <th className="px-6 py-2.5 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">Status</th>
                  <th className="px-6 py-2.5 w-24"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {members.map((s: any) => (
                  <tr key={s._id} className="hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors">
                    <td className="px-6 py-3 text-xs font-mono text-text-muted">{s.staffId}</td>
                    <td className="px-6 py-3 font-medium text-text-primary">
                      {[s.firstName, s.lastName].filter(Boolean).join(' ')}
                    </td>
                    <td className="px-6 py-3 text-text-muted">{s.role ?? '—'}</td>
                    <td className="px-6 py-3"><FSStatusBadge value={s.status ?? 'active'} /></td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => navigate(`/native-crm/staffs/${s._id}`)}
                          title="View staff"
                          className="p-1.5 rounded-lg text-text-muted hover:text-ryze-600 dark:hover:text-ryze-400 hover:bg-ryze-600/10 transition-colors"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleRemove(s)}
                          disabled={assigning === s._id}
                          title="Remove from team"
                          className="p-1.5 rounded-lg text-text-muted hover:text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
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
