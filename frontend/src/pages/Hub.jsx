import { Link } from 'react-router-dom';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge, DataTable, Page, Stat, fmt } from '../ui';
import { useDB } from '../lib/db';
import { useCurrentUser } from '../lib/session';
import { apiSync } from '../lib/api';
import { MODULES } from '../lib/registry';

const tryList = (id, r) => { try { return apiSync('GET', `/api/${id}/${r}`); } catch { return null; } };
export default function Hub() {
  useDB((s) => s.rows); useDB((s) => s.sites);
  const user = useCurrentUser(); const sites = apiSync('GET', '/api/sites');
  const stats = sites.map((s) => {
    const inv = tryList(s.id, 'inventory'); const req = tryList(s.id, 'requests'); const rep = tryList(s.id, 'repairs');
    return { ...s, items: inv?.length ?? '—', value: inv ? inv.reduce((a, r) => a + (r.total || 0), 0) : null, pending: req ? req.filter((r) => r.status === 'pending').length : '—', repairs: rep ? rep.filter((r) => r.status !== 'completed').length : '—' };
  });
  return (
    <div className="themed min-h-[calc(100vh-48px)]" style={{ background: '#f6f7fb', color: '#0f172a' }}>
      <Page title={`Welcome, ${user.name.split(' ')[0]}`} sub={`${sites.length} operations site${sites.length === 1 ? '' : 's'} on one codebase — each with its own theme, modules, data and workflow.`}>
        <div className="grid md:grid-cols-3 gap-4">{stats.map((s) => (
          <div key={s.id} className="card overflow-hidden">
            <div className="h-2" style={{ background: s.theme.primary }} />
            <div className="p-4 space-y-3">
              <div className="flex justify-between items-start"><div><div className="font-semibold text-lg">{s.name}</div><div className="text-sm muted">{s.description}</div></div><Badge v={s.role} /></div>
              <div className="flex flex-wrap gap-1">{s.moduleTypes.map((t) => <span key={t} title={MODULES[t].name} className="text-xs px-1.5 py-0.5 rounded bg-slate-100">{MODULES[t].icon} {MODULES[t].page?.title || t}</span>)}</div>
              <div className="flex items-center justify-between"><span className="text-xs muted">/{s.slug} · release v{s.live} · {s.theme.layout} layout</span><Link className="btn btn-primary" to={`/s/${s.slug}`}>Open →</Link></div>
            </div></div>))}</div>
        <h2 className="font-semibold pt-2">Combined view across units</h2>
        <div className="grid md:grid-cols-3 gap-3"><Stat label="Sites" value={sites.length} /><Stat label="Total stock value" value={fmt(stats.reduce((a, s) => a + (s.value || 0), 0))} /><Stat label="Pending requests (all units)" value={stats.reduce((a, s) => a + (typeof s.pending === 'number' ? s.pending : 0), 0)} /></div>
        <div className="grid md:grid-cols-2 gap-3">
          <DataTable rows={stats} columns={[{ key: 'name', label: 'Unit' }, { key: 'items', label: 'SKUs' }, { label: 'Stock value', render: (s) => (s.value == null ? '—' : fmt(s.value)) }, { key: 'pending', label: 'Pending' }, { key: 'repairs', label: 'Open repairs' }]} />
          <div className="card p-4"><div className="lbl">Stock value by unit</div><div style={{ height: 180 }}><ResponsiveContainer><BarChart data={stats.filter((s) => s.value != null).map((s) => ({ name: s.name, value: s.value }))}><XAxis dataKey="name" fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Bar dataKey="value" fill="#4f46e5" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></div>
        </div>
      </Page>
    </div>);
}
