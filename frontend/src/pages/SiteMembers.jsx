import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, DataTable, Page, toast } from '../ui';
import { ROLES } from '../lib/registry';
import {
  addSiteUser,
  deleteSiteUser,
  getSiteUsers,
  siteMembersQueryKey,
  updateSiteUser,
} from '../api/users.api';

const ROLE_DESIGNATIONS = {
  Member: ['Technician', 'Field Technician', 'Store Associate', 'Repair Technician', 'Warehouse Staff'],
  Manager: ['Supervisor', 'Store Keeper', 'Service Manager', 'Distribution Manager', 'Workshop Lead'],
  Admin: ['Site Administrator', 'Operations Head', 'Unit Manager'],
};

function DesignationSelect({ role, value, onChange }) {
  const options = ROLE_DESIGNATIONS[role] || [];
  return (
    <label>
      <span className="lbl">Designation</span>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select designation…</option>
        {options.map((d) => <option key={d} value={d}>{d}</option>)}
      </select>
    </label>
  );
}

export default function SiteMembers({ ctx }) {
  const queryClient = useQueryClient();
  const siteId = ctx.site.id;
  const isSiteAdmin = ctx.role === 'Admin';
  const [form, setForm] = useState({ name: '', email: '', role: 'Member', designation: '' });
  const membersQuery = useQuery({
    queryKey: siteMembersQueryKey(siteId),
    queryFn: () => getSiteUsers(siteId),
  });
  const refreshMembers = () => queryClient.invalidateQueries({ queryKey: siteMembersQueryKey(siteId) });
  const addMutation = useMutation({
    mutationFn: (input) => addSiteUser(siteId, input),
    onSuccess: async (result) => {
      toast.ok(result.initialPasswordSent
        ? 'User added. They can verify their phone when they first sign in.'
        : 'Existing user added to this site; invitation sent.');
      setForm({ name: '', email: '', role: 'Member', designation: '' });
      await refreshMembers();
    },
    onError: (error) => toast.err(errorMessage(error)),
  });
  const updateMutation = useMutation({
    mutationFn: ({ userId, role }) => updateSiteUser(siteId, userId, role),
    onSuccess: async () => {
      toast.ok('Site role updated.');
      await refreshMembers();
    },
    onError: (error) => {
      toast.err(errorMessage(error));
      refreshMembers();
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (userId) => deleteSiteUser(siteId, userId),
    onSuccess: async () => {
      toast.ok('User removed from this site.');
      await refreshMembers();
    },
    onError: (error) => toast.err(errorMessage(error)),
  });
  const members = membersQuery.data?.users || [];

  return (
    <Page title="Members" sub="Manage this site's members and roles. New accounts get access only to this site; existing accounts keep their other site memberships.">
      {ctx.user?.isHubAdmin && (
        <form
          className="card p-4 grid sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end"
          onSubmit={(event) => {
            event.preventDefault();
            addMutation.mutate({ name: form.designation ? `${form.name} · ${form.designation}` : form.name, email: form.email, role: form.role });
          }}
        >
          <label><span className="lbl">Name</span><input className="input" required maxLength={160} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          <label><span className="lbl">Email</span><input className="input" type="email" required maxLength={320} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
          <label><span className="lbl">Site role</span><select className="input" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value, designation: '' })}>{ROLES.map((role) => <option key={role}>{role}</option>)}</select></label>
          <DesignationSelect role={form.role} value={form.designation} onChange={(d) => setForm({ ...form, designation: d })} />
          <button className="btn btn-primary" type="submit" disabled={addMutation.isPending}>
            {addMutation.isPending ? 'Adding…' : 'Add to site'}
          </button>
          <p className="text-xs muted sm:col-span-2 lg:col-span-5">An existing account is added to this site. New users set up phone verification when they first sign in.</p>
        </form>
      )}
      {isSiteAdmin && !ctx.user?.isHubAdmin && <p className="text-xs muted">Only global administrators can create accounts. You can still manage roles for existing site members.</p>}
      {membersQuery.isLoading && <p className="muted">Loading site members…</p>}
      {membersQuery.isError && <p role="alert" className="text-sm text-red-400">{errorMessage(membersQuery.error)}</p>}
      {!membersQuery.isLoading && !membersQuery.isError && (
        <DataTable
          rows={members}
          columns={[
            { key: 'name', label: 'Name', render: (member) => {
              const [displayName, designation] = member.name.split(' · ');
              return <div><div className="font-medium">{displayName}</div>{designation && <div className="text-xs muted">{designation}</div>}</div>;
            } },
            { key: 'email', label: 'Email' },
            { key: 'phoneNumber', label: 'Phone' },
            { label: 'Phone verification', render: (member) => member.isVerified ? <Badge v="Verified" /> : <span className="text-amber-400">Not verified</span> },
            {
              label: 'Site role',
              render: (member) => isSiteAdmin ? (
                <select
                  className="input min-w-32"
                  value={member.role}
                  disabled={updateMutation.isPending}
                  aria-label={`Role for ${member.name}`}
                  onChange={(event) => {
                    const role = event.target.value;
                    if (member.role === 'Admin' && !window.confirm(`Change ${member.name}'s site Admin role?`)) {
                      refreshMembers();
                      return;
                    }
                    updateMutation.mutate({ userId: member.id, role });
                  }}
                >
                  {ROLES.map((role) => <option key={role}>{role}</option>)}
                </select>
              ) : <Badge v={member.role} />,
            },
            { label: 'Status', render: (member) => member.isActive ? 'Active' : <span className="text-amber-400">Inactive</span> },
            ...(isSiteAdmin ? [{
              label: 'Actions',
              render: (member) => (
                <button
                  className="btn btn-sm"
                  type="button"
                  disabled={deleteMutation.isPending}
                  onClick={() => {
                    if (window.confirm(`Remove ${member.name} from this site? Their account and other site access will remain.`)) {
                      deleteMutation.mutate(member.id);
                    }
                  }}
                >
                  Remove
                </button>
              ),
            }] : []),
          ]}
        />
      )}
      {!isSiteAdmin && <p className="text-xs muted">Only site Admins can add users or change site roles.</p>}
    </Page>
  );
}