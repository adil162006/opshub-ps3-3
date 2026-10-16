import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge, DataTable, ExcelBar, Page, Stat, fmt, useRows } from '../ui';
import { columnsFor } from '../lib/api';
import { RANK, hasModule, resourcesOf } from '../lib/registry';

const sum = (rows, kf, vf) => { const m = {}; rows.forEach((r) => { const k = kf(r) || 'n/a'; m[k] = (m[k] || 0) + vf(r); }); return Object.entries(m).map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 })); };
const Chart = ({ title, children }) => <div className="card p-4"><div className="lbl">{title}</div><div style={{ height: 240 }}><ResponsiveContainer>{children}</ResponsiveContainer></div></div>;

export function AnalyticsView({ ctx }) {
  const inv = useRows(ctx, 'inventory'); const req = useRows(ctx, 'requests'); const asg = useRows(ctx, 'assignments');
  const con = useRows(ctx, 'consumption'); const rep = useRows(ctx, 'repairs'); const ret = useRows(ctx, 'returns');
  const p = ctx.theme.primary; const a = ctx.theme.accent; const pal = [p, a, '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
  const m = (t) => hasModule(ctx.config, t);
  const low = inv.filter((r) => r.reorder != null && r.qty <= r.reorder);
  const trend = sum(con, (r) => r.date, (r) => r.qty).sort((x, y) => x.name.localeCompare(y.name));
  return (
    <Page title="Analytics" sub="Charts are generated from whichever modules this site has enabled.">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {m('inventory') && <><Stat label="Stock value" value={fmt(inv.reduce((s, r) => s + (r.total || 0), 0))} /><Stat label="Low-stock SKUs" value={low.length} /></>}
        {m('request') && <Stat label="Requests" value={req.length} hint={`${req.filter((r) => r.status === 'pending').length} pending`} />}
        {m('repair') && <Stat label="Repair revenue" value={fmt(rep.reduce((s, r) => s + (r.total || 0), 0))} />}
        {m('returns') && <Stat label="Returns" value={ret.length} />}
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        {m('inventory') && <Chart title="Stock value by category"><BarChart data={sum(inv, (r) => r.category, (r) => r.total || 0)}><CartesianGrid strokeDasharray="3 3" opacity={.3} /><XAxis dataKey="name" fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Bar dataKey="value" fill={p} radius={[4, 4, 0, 0]} /></BarChart></Chart>}
        {m('inventory') && <Chart title="Quantity vs reorder level (lowest 8)"><BarChart data={[...inv].sort((x, y) => x.qty / (x.reorder || 1) - y.qty / (y.reorder || 1)).slice(0, 8)}><CartesianGrid strokeDasharray="3 3" opacity={.3} /><XAxis dataKey="sku" fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Bar dataKey="qty" fill={p} /><Bar dataKey="reorder" fill={a} /></BarChart></Chart>}
        {m('request') && <Chart title="Requests by status"><PieChart><Pie data={sum(req, (r) => r.status, () => 1)} dataKey="value" nameKey="name" label outerRadius={85}>{pal.map((c, i) => <Cell key={i} fill={c} />)}</Pie><Tooltip /></PieChart></Chart>}
        {m('assignment') && <Chart title="Issued vs remaining by assignee"><BarChart data={Object.values(asg.reduce((o, x) => { (o[x.assignee] = o[x.assignee] || { name: x.assignee, issued: 0, remaining: 0 }); o[x.assignee].issued += x.qty; o[x.assignee].remaining += x.remaining; return o; }, {}))}><CartesianGrid strokeDasharray="3 3" opacity={.3} /><XAxis dataKey="name" fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Bar dataKey="issued" fill={p} /><Bar dataKey="remaining" fill={a} /></BarChart></Chart>}
        {m('consumption') && <Chart title="Consumption over time"><LineChart data={trend}><CartesianGrid strokeDasharray="3 3" opacity={.3} /><XAxis dataKey="name" fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Line dataKey="value" stroke={p} strokeWidth={2} /></LineChart></Chart>}
        {m('repair') && <Chart title="Repairs by stage"><BarChart data={sum(rep, (r) => r.status, () => 1)}><CartesianGrid strokeDasharray="3 3" opacity={.3} /><XAxis dataKey="name" fontSize={11} /><YAxis allowDecimals={false} fontSize={11} /><Tooltip /><Bar dataKey="value" fill={a} radius={[4, 4, 0, 0]} /></BarChart></Chart>}
      </div>
      {low.length > 0 && <><h2 className="font-semibold">Low stock</h2><DataTable rows={low} columns={[{ key: 'sku', label: 'SKU' }, { key: 'name', label: 'Name' }, { key: 'qty', label: 'Qty' }, { key: 'reorder', label: 'Reorder at' }]} /></>}
    </Page>);
}

export function ReportsView({ ctx }) {
  const resources = resourcesOf(ctx.config); const [res, setRes] = useState(resources[0]);
  const rows = useRows(ctx, res); let cols = []; try { cols = columnsFor(res, ctx.config); } catch { /* none */ }
  return (
    <Page title="Reports & Excel" sub="Export: Member and above · Import: Manager and above (inventory, atomic upsert by SKU)." actions={<Badge v={ctx.role} />}>
      <div className="flex gap-3 flex-wrap items-center"><select className="input" style={{ maxWidth: 220 }} value={res} onChange={(e) => setRes(e.target.value)}>{resources.map((r) => <option key={r}>{r}</option>)}</select><ExcelBar ctx={ctx} resource={res} />
        {RANK[ctx.role] < 2 && <span className="text-xs muted">Import disabled for your role</span>}</div>
      <DataTable rows={rows.slice(0, 50)} columns={cols.map((c) => ({ key: c.key, label: c.label }))} empty="No rows" />
      <p className="text-xs muted">Showing {Math.min(rows.length, 50)} of {rows.length} rows.</p>
    </Page>);
}
