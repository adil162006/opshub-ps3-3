import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge, DataTable, ExcelBar, Page, Stat, fmt, useRows } from '../ui';
import { columnsFor } from '../lib/api';
import { RANK, hasModule, resourcesOf } from '../lib/registry';
import { analyticsQueryKey, getAnalytics } from '../api/analytics.api';
import { isUuid } from '../utils/uuid';

const sum = (rows, kf, vf) => { const m = {}; rows.forEach((r) => { const k = kf(r) || 'n/a'; m[k] = (m[k] || 0) + vf(r); }); return Object.entries(m).map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 })); };
const Chart = ({ title, children }) => <div className="card p-4"><div className="lbl">{title}</div><div style={{ height: 240 }}><ResponsiveContainer>{children}</ResponsiveContainer></div></div>;

export function AnalyticsView({ ctx }) {
  const siteId = ctx.site?.id;
  const analyticsQuery = useQuery({
    queryKey: analyticsQueryKey(siteId),
    queryFn: () => getAnalytics(siteId),
    enabled: isUuid(siteId),
  });
  const remote = analyticsQuery.data?.data;

  const inv = useRows(ctx, 'inventory'); const req = useRows(ctx, 'requests'); const asg = useRows(ctx, 'assignments');
  const con = useRows(ctx, 'consumption'); const rep = useRows(ctx, 'repairs'); const ret = useRows(ctx, 'returns');
  const p = ctx.theme.primary; const a = ctx.theme.accent; const pal = [p, a, '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
  const m = (t) => hasModule(ctx.config, t);
  const low = inv.filter((r) => r.reorder != null && r.qty <= r.reorder);
  const trend = sum(con, (r) => r.date, (r) => r.qty).sort((x, y) => x.name.localeCompare(y.name));

  const stockValue = remote?.inventory ? fmt(remote.inventory.stockValue) : fmt(inv.reduce((s, r) => s + (r.total || 0), 0));
  const lowCount = remote?.inventory ? remote.inventory.lowStockCount : low.length;
  const reqCount = remote?.requests ? remote.requests.count : req.length;
  const reqHint = remote?.requests ? `${remote.requests.pending} pending` : `${req.filter((r) => r.status === 'pending').length} pending`;
  const repRevenue = remote?.repairs ? fmt(remote.repairs.revenue) : fmt(rep.reduce((s, r) => s + (r.total || 0), 0));
  const retCount = remote?.returns ? remote.returns.count : ret.length;

  const catData = remote?.inventory?.stockByCategory || sum(inv, (r) => r.category, (r) => r.total || 0);
  const reorderData = remote?.inventory?.reorderLevels || [...inv].sort((x, y) => x.qty / (x.reorder || 1) - y.qty / (y.reorder || 1)).slice(0, 8);
  const reqData = remote?.requests?.byStatus || sum(req, (r) => r.status, () => 1);
  const asgData = remote?.assignments || Object.values(asg.reduce((o, x) => { (o[x.assignee] = o[x.assignee] || { name: x.assignee, issued: 0, remaining: 0 }); o[x.assignee].issued += x.qty; o[x.assignee].remaining += x.remaining; return o; }, {}));
  const conData = remote?.consumption || trend;
  const repData = remote?.repairs?.byStage || sum(rep, (r) => r.status, () => 1);
  const lowStockRows = remote?.inventory?.lowStock || low;

  return (
    <Page title="Analytics" sub="Charts are generated from whichever modules this site has enabled.">
      {analyticsQuery.isFetching && isUuid(siteId) && (
        <div className="text-xs muted animate-pulse mb-1">Updating analytics…</div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {m('inventory') && <><Stat label="Stock value" value={stockValue} /><Stat label="Low-stock SKUs" value={lowCount} /></>}
        {m('request') && <Stat label="Requests" value={reqCount} hint={reqHint} />}
        {m('repair') && <Stat label="Repair revenue" value={repRevenue} />}
        {m('returns') && <Stat label="Returns" value={retCount} />}
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        {m('inventory') && <Chart title="Stock value by category"><BarChart data={catData}><CartesianGrid strokeDasharray="3 3" opacity={.3} /><XAxis dataKey="name" fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Bar dataKey="value" fill={p} radius={[4, 4, 0, 0]} /></BarChart></Chart>}
        {m('inventory') && <Chart title="Quantity vs reorder level (lowest 8)"><BarChart data={reorderData}><CartesianGrid strokeDasharray="3 3" opacity={.3} /><XAxis dataKey="sku" fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Bar dataKey="qty" fill={p} /><Bar dataKey="reorder" fill={a} /></BarChart></Chart>}
        {m('request') && <Chart title="Requests by status"><PieChart><Pie data={reqData} dataKey="value" nameKey="name" label outerRadius={85}>{pal.map((c, i) => <Cell key={i} fill={c} />)}</Pie><Tooltip /></PieChart></Chart>}
        {m('assignment') && <Chart title="Issued vs remaining by assignee"><BarChart data={asgData}><CartesianGrid strokeDasharray="3 3" opacity={.3} /><XAxis dataKey="name" fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Bar dataKey="issued" fill={p} /><Bar dataKey="remaining" fill={a} /></BarChart></Chart>}
        {m('consumption') && <Chart title="Consumption over time"><LineChart data={conData}><CartesianGrid strokeDasharray="3 3" opacity={.3} /><XAxis dataKey="name" fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Line dataKey="value" stroke={p} strokeWidth={2} /></LineChart></Chart>}
        {m('repair') && <Chart title="Repairs by stage"><BarChart data={repData}><CartesianGrid strokeDasharray="3 3" opacity={.3} /><XAxis dataKey="name" fontSize={11} /><YAxis allowDecimals={false} fontSize={11} /><Tooltip /><Bar dataKey="value" fill={a} radius={[4, 4, 0, 0]} /></BarChart></Chart>}
      </div>
      {lowStockRows.length > 0 && <><h2 className="font-semibold">Low stock</h2><DataTable rows={lowStockRows} columns={[{ key: 'sku', label: 'SKU' }, { key: 'name', label: 'Name' }, { key: 'qty', label: 'Qty' }, { key: 'reorder', label: 'Reorder at' }]} /></>}
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
