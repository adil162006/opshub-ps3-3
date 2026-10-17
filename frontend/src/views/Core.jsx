import { Link } from 'react-router-dom';
import { Badge, DataTable, Page, Stat, fmt, useRows, when } from '../ui';
import { RANK, ROLES, hasModule, pagesOf, resourcesOf } from '../lib/registry';
import { RES } from '../lib/resources';

export function Dashboard({ ctx }) {
  const inv = useRows(ctx, 'inventory'); const req = useRows(ctx, 'requests'); const asg = useRows(ctx, 'assignments');
  const rep = useRows(ctx, 'repairs'); const con = useRows(ctx, 'consumption');
  const tiles = [];
  if (hasModule(ctx.config, 'inventory')) {
    tiles.push(['SKUs', inv.length]); tiles.push(['Stock value', fmt(inv.reduce((a, r) => a + (r.total ?? r.qty * r.price ?? 0), 0))]);
    tiles.push(['Low stock', inv.filter((r) => r.reorder != null && r.qty <= r.reorder).length, 'at or below reorder level']);
  }
  if (hasModule(ctx.config, 'request')) { tiles.push(['Pending requests', req.filter((r) => r.status === 'pending').length]); tiles.push(['Ready for fulfillment', req.filter((r) => ['approved', 'open'].includes(r.status)).length]); }
  if (hasModule(ctx.config, 'assignment')) tiles.push(['Active assignments', asg.filter((a) => a.remaining > 0).length]);
  if (hasModule(ctx.config, 'consumption')) tiles.push(['Units consumed', con.reduce((a, r) => a + r.qty, 0)]);
  if (hasModule(ctx.config, 'repair')) { tiles.push(['Repairs in progress', rep.filter((r) => r.status !== 'completed').length]); tiles.push(['Repair revenue', fmt(rep.reduce((a, r) => a + (r.total || 0), 0))]); }
  const pages = pagesOf(ctx.config).filter((p) => p.path);
  return (
    <Page title={`${ctx.site.name}`} sub={`Signed in as ${ctx.user.name} · ${ctx.role} · release v${ctx.site.live}${ctx.preview ? ' (draft preview)' : ''}`}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{tiles.map(([l, v, h]) => <Stat key={l} label={l} value={v} hint={h} />)}</div>
      <div className="card p-4"><div className="lbl">Enabled modules (pages generated from site config)</div>
        <div className="flex gap-2 flex-wrap mt-2">{pages.map((p) => <Link key={p.path} to={`${ctx.base}/${p.path}`} className="btn">{p.icon} {p.title}</Link>)}</div></div>
      {hasModule(ctx.config, 'request') && <><h2 className="font-semibold pt-2">Recent requests</h2>
        <DataTable rows={[...req].reverse().slice(0, 5)} columns={[{ key: 'requestNo', label: 'No' }, { key: 'requestedBy', label: 'By' }, { label: 'Status', render: (r) => <Badge v={r.status} /> }, { label: 'Created', render: (r) => when(r.createdAt) }]} /></>}
    </Page>);
}

export function Access({ ctx }) {
  const letters = (d, role) => ['read', 'create', 'update', 'delete'].map((k) => (RANK[role] >= d[k] ? k[0].toUpperCase() : '·')).join('');
  const resources = resourcesOf(ctx.config);
  return (
    <Page title="Access & RBAC" sub="Authentication module — roles are enforced by the API for every request.">
      <div className="grid md:grid-cols-2 gap-3">
        <div className="card p-4 text-sm space-y-1"><div className="lbl">Session</div><div>User: <b>{ctx.user.name}</b> ({ctx.user.email})</div><div>Role on this site: <Badge v={ctx.role} /></div><div>Global role: <b>{ctx.user.role}</b></div>
          <div className="lbl pt-2">Session storage</div><div>Authentication is held in a server-issued HttpOnly cookie.</div></div>
        <div className="card p-4 text-sm"><div className="lbl">Role ladder</div>
          <ul className="list-disc ml-5 space-y-1"><li><b>Public</b> — login page only; every /api/:siteId call returns 401.</li><li><b>Member</b> — read, create requests/consumption/returns, export Excel.</li><li><b>Manager</b> — edit inventory, approve, assign, run repairs, import Excel.</li><li><b>Admin</b> — everything + builder, users, delete, preview/publish/rollback.</li></ul></div>
      </div>
      <div className="card overflow-x-auto"><table className="t"><thead><tr><th>Resource</th><th>Public</th>{ROLES.map((r) => <th key={r}>{r}</th>)}</tr></thead><tbody>
        {resources.map((r) => <tr key={r}><td className="font-medium">{r}</td><td className="muted">····</td>{ROLES.map((role) => <td key={role} className="font-mono">{letters(RES[r], role)}</td>)}</tr>)}
        <tr><td className="font-medium">excel</td><td className="muted">··</td>{ROLES.map((role) => <td key={role} className="font-mono">{RANK[role] >= 1 ? 'X' : '·'}{RANK[role] >= 2 ? 'I' : '·'}</td>)}</tr>
      </tbody></table><div className="text-xs muted p-3">R=read C=create U=update D=delete · X=export I=import</div></div>
    </Page>);
}
