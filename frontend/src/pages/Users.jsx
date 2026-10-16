import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, Page, toast } from '../ui';
import { getSites, SITES_QUERY_KEY } from '../api/site.api';
import {
  createUser,
  deleteUser,
  getUsers,
  GLOBAL_USERS_QUERY_KEY,
  updateUser,
} from '../api/users.api';
import { ROLES } from '../lib/registry';

const emptyForm = () => ({ name: '', email: '', password: '', role: 'User', memberships: {} });
const membershipsForForm = (memberships = []) => Object.fromEntries(
  memberships.map(({ siteId, role }) => [siteId, role]),
);
const toMembershipList = (memberships) => Object.entries(memberships)
  .filter(([, role]) => role)
  .map(([siteId, role]) => ({ siteId, role }));
const errorMessage = (error) => error.response?.data?.message || error.response?.data?.error || error.message;

function SiteRoleFields({ sites, memberships, disabled, onChange }) {
  return sites.map((site) => (
    <label key={site.id} className="block min-w-32">
      <span className="lbl">{site.name}</span>
      <select
        className="input"
        value={memberships[site.id] || ''}
        disabled={disabled}
        onChange={(event) => onChange(site.id, event.target.value)}
      >
        <option value="">No access</option>
        {ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
      </select>
    </label>
  ));
}

export default function Users() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const usersQuery = useQuery({
    queryKey: [...GLOBAL_USERS_QUERY_KEY, page],
    queryFn: () => getUsers(page),
  });
  const sitesQuery = useQuery({ queryKey: SITES_QUERY_KEY, queryFn: getSites });
  const sites = sitesQuery.data || [];
  const users = usersQuery.data?.users || [];
  const pagination = usersQuery.data?.pagination;

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: GLOBAL_USERS_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: SITES_QUERY_KEY }),
    ]);
  };
  const addMutation = useMutation({
    mutationFn: createUser,
    onSuccess: async () => {
      toast.ok('User created. Account invitation sent.');
      setForm(emptyForm());
      setPage(1);
      await invalidate();
    },
    onError: (error) => toast.err(errorMessage(error)),
  });
  const updateMutation = useMutation({
    mutationFn: ({ userId, input }) => updateUser(userId, input),
    onSuccess: async () => {
      toast.ok('User and site access updated.');
      setEditingId(null);
      setEditForm(null);
      await invalidate();
    },
    onError: (error) => toast.err(errorMessage(error)),
  });
  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: async () => {
      toast.ok('User deleted.');
      await invalidate();
    },
    onError: (error) => toast.err(errorMessage(error)),
  });

  const changeMembership = (stateSetter) => (siteId, role) => stateSetter((current) => ({
    ...current,
    memberships: { ...current.memberships, [siteId]: role },
  }));

  const beginEdit = (user) => {
    setEditingId(user.id);
    setEditForm({
      name: user.name,
      email: user.email,
      password: '',
      role: user.isHubAdmin ? 'Admin' : 'User',
      memberships: membershipsForForm(user.memberships),
    });
  };

  const submitEdit = () => {
    if (!editForm.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editForm.email.trim())) {
      toast.err('Enter a valid name and email address.');
      return;
    }
    if (editForm.password && editForm.password.length < 12) {
      toast.err('New passwords must be at least 12 characters.');
      return;
    }
    const input = {
      name: editForm.name,
      email: editForm.email,
      role: editForm.role,
      memberships: editForm.role === 'Admin' ? [] : toMembershipList(editForm.memberships),
    };
    if (editForm.password) input.password = editForm.password;
    updateMutation.mutate({ userId: editingId, input });
  };

  return (
    <div className="themed min-h-[calc(100vh-48px)]" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
      <Page title="Users (global)" sub="Create accounts, set global administrator access, and maintain each user's site roles.">
        {sitesQuery.isError && <p role="alert" className="text-sm text-red-400">{errorMessage(sitesQuery.error)}</p>}
        <form
          className="card p-4 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            addMutation.mutate({
              name: form.name,
              email: form.email,
              password: form.password,
              role: form.role,
              memberships: form.role === 'Admin' ? [] : toMembershipList(form.memberships),
            });
          }}
        >
          <h2 className="font-semibold">Add user</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <label><span className="lbl">Name</span><input className="input" required maxLength={160} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
            <label><span className="lbl">Email</span><input className="input" type="email" required maxLength={320} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
            <label><span className="lbl">Temporary password</span><input className="input" type="password" required minLength={12} autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
            <label><span className="lbl">Global role</span><select className="input" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}><option value="User">User</option><option value="Admin">Global Admin</option></select></label>
          </div>
          {form.role !== 'Admin' && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <SiteRoleFields
                sites={sites}
                memberships={form.memberships}
                disabled={sitesQuery.isLoading}
                onChange={changeMembership(setForm)}
              />
            </div>
          )}
          <button className="btn btn-primary" type="submit" disabled={addMutation.isPending || sitesQuery.isLoading || sitesQuery.isError}>
            {addMutation.isPending ? 'Creating…' : 'Add user'}
          </button>
        </form>

        {usersQuery.isLoading && <p className="muted">Loading users…</p>}
        {usersQuery.isError && <p role="alert" className="text-sm text-red-400">{errorMessage(usersQuery.error)}</p>}
        {!usersQuery.isLoading && !usersQuery.isError && (
          <>
            <div className="card overflow-x-auto">
              <table className="t">
                <thead>
                  <tr><th>User</th><th>Global role</th>{sites.map((site) => <th key={site.id}>{site.name}</th>)}<th>Actions</th></tr>
                </thead>
                <tbody>
                  {users.map((user) => {
                    const editing = editingId === user.id && editForm;
                    const memberships = membershipsForForm(user.memberships);
                    return (
                      <tr key={user.id}>
                        <td>
                          {editing ? (
                            <div className="min-w-48 space-y-2">
                              <input aria-label="Name" className="input" required value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} />
                              <input aria-label="Email" className="input" type="email" required value={editForm.email} onChange={(event) => setEditForm({ ...editForm, email: event.target.value })} />
                              <input aria-label="New password (optional)" className="input" type="password" minLength={12} placeholder="New password (optional)" autoComplete="new-password" value={editForm.password} onChange={(event) => setEditForm({ ...editForm, password: event.target.value })} />
                            </div>
                          ) : (
                            <div><div className="font-medium">{user.name}</div><div className="text-xs muted">{user.email}</div>{!user.isActive && <span className="text-xs text-amber-400">Inactive</span>}</div>
                          )}
                        </td>
                        <td>
                          {editing ? (
                            <select
                              className="input min-w-32"
                              value={editForm.role}
                              onChange={(event) => setEditForm({
                                ...editForm,
                                role: event.target.value,
                                memberships: event.target.value === 'Admin' ? {} : editForm.memberships,
                              })}
                            >
                              <option value="User">User</option><option value="Admin">Global Admin</option>
                            </select>
                          ) : user.isHubAdmin ? <Badge v="Global Admin" /> : 'User'}
                        </td>
                        {sites.map((site) => (
                          <td key={site.id}>
                            {editing && editForm.role !== 'Admin' ? (
                              <select
                                aria-label={`${site.name} role for ${user.name}`}
                                className="input min-w-32"
                                value={editForm.memberships[site.id] || ''}
                                onChange={(event) => changeMembership(setEditForm)(site.id, event.target.value)}
                              >
                                <option value="">No access</option>
                                {ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
                              </select>
                            ) : user.isHubAdmin ? <Badge v="Admin" /> : memberships[site.id] || 'No access'}
                          </td>
                        ))}
                        <td>
                          {!user.isHubAdmin && (
                            editing ? (
                              <div className="flex gap-1">
                                <button className="btn btn-sm btn-primary" type="button" disabled={updateMutation.isPending} onClick={submitEdit}>Save</button>
                                <button className="btn btn-sm" type="button" onClick={() => { setEditingId(null); setEditForm(null); }}>Cancel</button>
                              </div>
                            ) : (
                              <div className="flex gap-1">
                                <button className="btn btn-sm" type="button" onClick={() => beginEdit(user)}>Edit</button>
                                <button className="btn btn-sm" type="button" disabled={deleteMutation.isPending} onClick={() => {
                                  if (window.confirm(`Delete ${user.name}'s account and all site memberships?`)) deleteMutation.mutate(user.id);
                                }}>Delete</button>
                              </div>
                            )
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {!users.length && <tr><td colSpan={sites.length + 3} className="muted text-center py-8">No users found.</td></tr>}
                </tbody>
              </table>
            </div>
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-end gap-3 text-sm">
                <span className="muted">Page {pagination.page} of {pagination.totalPages}</span>
                <button className="btn btn-sm" type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button>
                <button className="btn btn-sm" type="button" disabled={page >= pagination.totalPages} onClick={() => setPage((current) => current + 1)}>Next</button>
              </div>
            )}
          </>
        )}
      </Page>
    </div>
  );
}
