import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import {
  UserGroupIcon, UserPlusIcon, CalendarDaysIcon, UsersIcon,
  ShieldCheckIcon, ChevronRightIcon, ChevronDownIcon, PlusIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';
import { useUsersListQuery } from '../../../modules/native-crm/queries/users.queries';
import { useTeamsListQuery, useTeamCreate } from '../../../modules/native-crm/queries/teams.queries';
import { useStaffsListQuery, useStaffCreate } from '../../../modules/native-crm/queries/staffs.queries';
import api from '../../../services/api';

interface TeamStats { staffCount: number; leads: number; meetings: number; customers: number; }

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

/** Inline "+ Create a team for this person" — used only when a supervisor
 * has zero teams yet. Pre-fills managerUserId so the round-robin/assignment
 * chain (Supervisor -> Team -> Staff) can be set up start to finish without
 * ever leaving this page. */
function CreateTeamInline({ managerUserId, onCreated }: { managerUserId: string; onCreated: () => void }) {
  const [open, setOpen]   = useState(false);
  const [name, setName]   = useState('');
  const createTeam = useTeamCreate();

  const submit = async () => {
    if (!name.trim()) return;
    await createTeam.mutateAsync({ name: name.trim(), status: 'active', managerUserId, source: 'supervisor_flow' });
    setName('');
    setOpen(false);
    onCreated();
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
      >
        <PlusIcon className="h-3.5 w-3.5" /> Create a team for this person
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setOpen(false); }}
        placeholder="Team name, e.g. Cardiology Team"
        className="flex-1 px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-400"
      />
      <button
        onClick={submit}
        disabled={!name.trim() || createTeam.isPending}
        className="px-2.5 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-medium hover:bg-brand-700 disabled:opacity-50"
      >
        {createTeam.isPending ? '…' : 'Create'}
      </button>
      <button onClick={() => setOpen(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
    </div>
  );
}

/** Inline "+ Add staff" — creates a real Staff record already linked to
 * this team, so round robin has someone to actually rotate through. */
function AddStaffInline({ teamId, onCreated }: { teamId: string; onCreated: () => void }) {
  const [open, setOpen]         = useState(false);
  const [firstName, setFirst]   = useState('');
  const [lastName, setLast]     = useState('');
  const createStaff = useStaffCreate();

  const submit = async () => {
    if (!firstName.trim() || !lastName.trim()) return;
    await createStaff.mutateAsync({ firstName: firstName.trim(), lastName: lastName.trim(), teamId, status: 'active', source: 'supervisor_flow' });
    setFirst(''); setLast(''); setOpen(false);
    onCreated();
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 mt-2"
      >
        <PlusIcon className="h-3.5 w-3.5" /> Add staff to this team
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1.5 mt-2">
      <input
        autoFocus
        value={firstName}
        onChange={(e) => setFirst(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setOpen(false); }}
        placeholder="First name"
        className="w-24 px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-400"
      />
      <input
        value={lastName}
        onChange={(e) => setLast(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setOpen(false); }}
        placeholder="Last name"
        className="w-24 px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-400"
      />
      <button
        onClick={submit}
        disabled={!firstName.trim() || !lastName.trim() || createStaff.isPending}
        className="px-2.5 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-medium hover:bg-brand-700 disabled:opacity-50"
      >
        {createStaff.isPending ? '…' : 'Add'}
      </button>
      <button onClick={() => setOpen(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
    </div>
  );
}

/** One managed team, expandable in place to show its real staff roster (who
 * round robin will actually rotate through) plus a way to add more staff —
 * all without navigating away from the Supervisors page. */
function TeamRoster({ team, onOpenTeam }: { team: any; onOpenTeam: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const qc = useQueryClient();
  const { data: staffData, isLoading } = useStaffsListQuery({ page: 1, limit: 100, teamId: team._id });
  const staff = staffData?.items ?? [];
  const activeStaff = staff.filter((s: any) => (s.status ?? 'active') === 'active');

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['native-crm', 'staffs'] });
    qc.invalidateQueries({ queryKey: ['native-crm', 'teams', team._id, 'stats'] });
  };

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition-colors text-left"
      >
        {expanded ? <ChevronDownIcon className="h-3.5 w-3.5 text-gray-400 shrink-0" /> : <ChevronRightIcon className="h-3.5 w-3.5 text-gray-400 shrink-0" />}
        <span className="text-sm font-medium text-gray-800 truncate flex-1">{team.name}</span>
        <span className="text-[11px] text-gray-400 shrink-0">{isLoading ? '…' : `${activeStaff.length} staff`}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-3 pt-1 bg-gray-50/60 border-t border-gray-100">
          {isLoading ? (
            <p className="text-xs text-gray-400 py-2">Loading staff…</p>
          ) : activeStaff.length === 0 ? (
            <p className="text-xs text-gray-400 py-1.5">No staff on this team yet — add someone so round robin has a real roster to rotate through.</p>
          ) : (
            <ul className="space-y-1 py-1.5">
              {activeStaff.map((s: any) => (
                <li key={s._id} className="flex items-center gap-2 text-xs text-gray-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                  {[s.firstName, s.lastName].filter(Boolean).join(' ')}
                  {s.role && <span className="text-gray-400">· {s.role}</span>}
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center justify-between mt-1">
            <AddStaffInline teamId={team._id} onCreated={refresh} />
            <button
              onClick={() => onOpenTeam(team._id)}
              className="inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-brand-600 transition-colors"
            >
              Full team page <ArrowTopRightOnSquareIcon className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SupervisorCard({
  supervisor, teams, onOpenTeam, onDataChanged,
}: {
  supervisor: { _id: string; email: string; firstName?: string; lastName?: string };
  teams: any[];
  onOpenTeam: (id: string) => void;
  onDataChanged: () => void;
}) {
  const name = [supervisor.firstName, supervisor.lastName].filter(Boolean).join(' ') || supervisor.email;

  // One real per-team stats fetch per managed team, run in parallel and
  // summed below — useQueries (not a manual child-per-team component) is
  // what correctly re-renders this card as each team's numbers resolve,
  // since a supervisor can manage anywhere from 0 to several teams.
  const statQueries = useQueries({
    queries: teams.map((t) => ({
      queryKey: ['native-crm', 'teams', t._id, 'stats'],
      queryFn: () => api.get(`/api/v1/native-crm/teams/${t._id}/stats`).then((r) => r.data.data as TeamStats),
      staleTime: 30_000,
    })),
  });
  const totals = statQueries.reduce(
    (acc, q) => {
      const s = q.data as TeamStats | undefined;
      if (!s) return acc;
      return { staffCount: acc.staffCount + s.staffCount, leads: acc.leads + s.leads, meetings: acc.meetings + s.meetings, customers: acc.customers + s.customers };
    },
    { staffCount: 0, leads: 0, meetings: 0, customers: 0 },
  );

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="p-5 flex items-start gap-3 border-b border-gray-100">
        <div className="h-11 w-11 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm shrink-0">
          {initials(name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900 truncate">{name}</p>
          <p className="text-xs text-gray-400 truncate">{supervisor.email}</p>
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full bg-indigo-50 text-indigo-600 shrink-0">
          <ShieldCheckIcon className="h-3.5 w-3.5" /> Supervisor
        </span>
      </div>

      {/* Teams managed — expandable in place, or a quick way to create the first one */}
      <div className="px-5 py-4">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
          {teams.length === 0 ? 'No teams assigned' : teams.length === 1 ? 'Manages 1 team' : `Manages ${teams.length} teams`}
        </p>
        {teams.length === 0 ? (
          <CreateTeamInline managerUserId={supervisor._id} onCreated={onDataChanged} />
        ) : (
          <div className="space-y-1.5">
            {teams.map((t) => (
              <TeamRoster key={t._id} team={t} onOpenTeam={onOpenTeam} />
            ))}
          </div>
        )}
      </div>

      {/* Stats */}
      {teams.length > 0 && (
        <div className="px-5 pb-5 grid grid-cols-4 gap-2">
          {[
            { label: 'Staff',     value: totals.staffCount, Icon: UserGroupIcon,    color: 'text-gray-600'    },
            { label: 'Leads',     value: totals.leads,      Icon: UserPlusIcon,     color: 'text-violet-600'  },
            { label: 'Meetings',  value: totals.meetings,   Icon: CalendarDaysIcon, color: 'text-sky-600'     },
            { label: 'Customers', value: totals.customers,  Icon: UsersIcon,        color: 'text-emerald-600' },
          ].map((s) => (
            <div key={s.label} className="rounded-lg bg-gray-50 px-2 py-2.5 text-center">
              <s.Icon className={`h-4 w-4 mx-auto mb-1 ${s.color}`} />
              <p className={`text-base font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-gray-400">{s.label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** A "Supervisors" view of the same Team/Staff/User data already managed
 * elsewhere — nothing new is stored here. A supervisor is simply a User
 * (Settings -> Users) who's been picked as a Team's "Supervisor" field; this
 * page lists every such person with their team(s), lets you create a team
 * and add staff to it right here (Supervisor -> Team -> Staff, start to
 * finish, no page-hopping), and shows real activity numbers. This exact
 * chain — an active Team with real active Staff — is what the AI widget's
 * round-robin booking rotates through, so a supervisor with no team, or a
 * team with no staff, has nobody for round robin to assign to yet. */
export default function SupervisorsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: usersData, isLoading: usersLoading } = useUsersListQuery({ limit: 200 });
  const { data: teamsData, isLoading: teamsLoading }  = useTeamsListQuery({ page: 1, limit: 200 });

  const isLoading = usersLoading || teamsLoading;
  const supervisors = (usersData?.items ?? []).filter((u) => u.role === 'MANAGER');
  const teams = teamsData?.items ?? [];

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ['native-crm', 'teams'] });
    qc.invalidateQueries({ queryKey: ['native-crm', 'staffs'] });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex gap-2">{[0, 1, 2].map((i) => <span key={i} className="h-2.5 w-2.5 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-hidden">
      <div className="bg-white border-b border-gray-200 px-8 py-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-indigo-100 flex items-center justify-center shrink-0 border border-indigo-200">
            <ShieldCheckIcon className="h-6 w-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Supervisors</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Everyone managing a team. Create a team and add staff right here — this is exactly what your AI widget's round-robin
              booking uses to decide who gets assigned each new appointment.
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 md:p-8">
        {supervisors.length === 0 ? (
          <div className="max-w-lg mx-auto text-center py-16">
            <ShieldCheckIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-700 font-semibold">No supervisors yet</p>
            <p className="text-sm text-gray-400 mt-1.5">
              Create a user with the "Manager" role from Settings → Users, then come back here to give them a team and staff.
            </p>
            <button
              onClick={() => navigate('/settings')}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium transition-colors"
            >
              Go to Settings → Users
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 max-w-7xl">
            {supervisors.map((sup) => (
              <SupervisorCard
                key={sup._id}
                supervisor={sup}
                teams={teams.filter((t: any) => t.managerUserId === sup._id)}
                onOpenTeam={(id) => navigate(`/native-crm/teams/${id}`)}
                onDataChanged={refreshAll}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
