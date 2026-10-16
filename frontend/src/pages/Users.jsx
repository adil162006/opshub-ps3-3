import { useState } from 'react';
import { Badge, DataTable, Page, attempt } from '../ui';
import { useDB } from '../lib/db';
import { apiSync } from '../lib/api';
import { ROLES } from '../lib/registry';

export default function Users() {
  useDB((s) => s.users); const sites = useDB((s) => s.sites);
  let users = []; try { users = apiSync('GET', '/api/users'); } catch { /* */ }
  const [f, setF] = useState({ name: '', email: '', password: '', role: 'User' });
  const setM = (u, siteId, role) => { const m = { ...u.memberships }; if (role) m[siteId] = role; else delete m[siteId]; attempt(() => apiSync('PATCH', `/api/users/${u.id}`, { memberships: m }), 'Access updated'); };
  return (
    <div className="themed min-h-[calc(100vh-48px)]" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
      <Page title="Users (global)" sub="One identity, per-site roles. Passwords stored as bcrypt hashes.">
        <form className="card p-4 grid sm:grid-cols-5 gap-3" onSubmit={(e) => { e.preventDefault(); if (attempt(() => apiSync('POST', '/api/users', f), 'User created')) setF({ name: '', email: '', password: '', role: 'User' }); }}>
          {['name', 'email', 'password'].map((k) => <div key={k}><label className="lbl">{k}</label><input className="input" type={k === 'password' ? 'password' : 'text'} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>)}
          <div><label className="lbl">Global role</label><select className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}><option value="User">User</option><option value="Admin">Admin</option></select></div>
          <div className="flex items-end"><button className="btn btn-primary">Add user</button></div>
        </form>
        <DataTable rows={users} columns={[{ key: 'name', label: 'Name' }, { key: 'email', label: 'Email' }, { label: 'Global', render: (u) => (u.role === 'Admin' ? <Badge v="Admin" /> : 'User') },
          ...sites.map((s) => ({ label: s.name, render: (u) => (u.role === 'Admin' ? <span className="muted text-xs">all (Admin)</span> : <select className="input" style={{ width: 110 }} value={u.memberships?.[s.id] || ''} onChange={(e) => setM(u, s.id, e.target.value)}><option value="">No access</option>{ROLES.map((r) => <option key={r}>{r}</option>)}</select>) }))]} />
      </Page>
    </div>);
}
