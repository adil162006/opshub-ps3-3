import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { create } from 'zustand';
import { evalFormula, RANK } from './lib/registry';
import { useDB } from './lib/db';

export const useUI = create((set) => ({
  toasts: [],
  push: (kind, msg) => { const id = Math.random(); set((s) => ({ toasts: [...s.toasts, { id, kind, msg }] })); setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 5000); },
}));
export const toast = { ok: (m) => useUI.getState().push('ok', m), err: (m) => useUI.getState().push('err', m) };
export function attempt(fn, okMsg) {
  try { const r = fn(); if (okMsg) toast.ok(okMsg); return r ?? true; }
  catch (e) {
    const det = e.details?.length ? ': ' + e.details.map((x) => (typeof x === 'string' ? x : `row ${x.row}: ${x.message}`)).join(' · ') : '';
    toast.err(`${e.message}${det}`); return false;
  }
}
export function Toaster() {
  const toasts = useUI((s) => s.toasts);
  return <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm">{toasts.map((t) => (
    <div key={t.id} className={`px-4 py-2.5 rounded-lg text-sm shadow-lg text-white ${t.kind === 'ok' ? 'bg-emerald-600' : 'bg-red-600'}`}>{t.msg}</div>))}</div>;
}

const TONES = {
  pending: 'bg-amber-100 text-amber-800', approved: 'bg-green-100 text-green-800', rejected: 'bg-red-100 text-red-800', assigned: 'bg-blue-100 text-blue-800',
  open: 'bg-slate-200 text-slate-700', 'in-repair': 'bg-purple-100 text-purple-800', closed: 'bg-slate-200 text-slate-700', issued: 'bg-sky-100 text-sky-800',
  'in-use': 'bg-indigo-100 text-indigo-800', consumed: 'bg-slate-200 text-slate-700', diagnosis: 'bg-amber-100 text-amber-800', repairing: 'bg-purple-100 text-purple-800',
  testing: 'bg-cyan-100 text-cyan-800', completed: 'bg-green-100 text-green-800', approve: 'bg-green-100 text-green-800', reject: 'bg-red-100 text-red-800',
  good: 'bg-green-100 text-green-800', damaged: 'bg-red-100 text-red-800', High: 'bg-red-100 text-red-800', Normal: 'bg-slate-200 text-slate-700', Low: 'bg-slate-100 text-slate-600',
  Admin: 'bg-rose-100 text-rose-800', Manager: 'bg-amber-100 text-amber-800', Member: 'bg-sky-100 text-sky-800',
};
export const Badge = ({ v }) => <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${TONES[v] || 'bg-slate-100 text-slate-700'}`}>{v}</span>;
export const Page = ({ title, sub, actions, children }) => (
  <div className="p-6 max-w-6xl mx-auto space-y-4">
    <div className="flex items-start justify-between gap-3 flex-wrap"><div><h1 className="text-xl font-semibold">{title}</h1>{sub && <p className="text-sm muted">{sub}</p>}</div><div className="flex gap-2 flex-wrap">{actions}</div></div>
    {children}
  </div>);
export const Stat = ({ label, value, hint }) => <div className="card p-4"><div className="lbl">{label}</div><div className="text-2xl font-semibold tabular-nums">{value}</div>{hint && <div className="text-xs muted mt-1">{hint}</div>}</div>;
export const fmt = (v) => (typeof v === 'number' ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : v ?? '');
export const when = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '');

export function DataTable({ columns, rows, empty = 'Nothing here yet' }) {
  return <div className="card overflow-x-auto"><table className="t"><thead><tr>{columns.map((c) => <th key={c.key || c.label}>{c.label}</th>)}</tr></thead>
    <tbody>{rows.length ? rows.map((r, i) => <tr key={r.id || i}>{columns.map((c) => <td key={c.key || c.label}>{c.render ? c.render(r) : fmt(r[c.key])}</td>)}</tr>)
      : <tr><td colSpan={columns.length} className="muted text-center py-8">{empty}</td></tr>}</tbody></table></div>;
}

// reactive, permission-checked row hook
export function useRows(ctx, res) {
  const rows = useDB((s) => s.rows[res]);
  return useMemo(() => { try { return ctx.api.list(res); } catch { return []; } }, [rows, ctx]); // eslint-disable-line
}
export const itemName = (items, id) => { const i = items.find((x) => x.id === id); return i ? i.name || i.sku : id; };
export const fieldText = (f, row, items = []) => (f.type === 'item' ? itemName(items, row[f.key]) : fmt(row[f.key]));

export function FieldInput({ f, value, onChange, items = [], computed }) {
  const c = { className: 'input', value: value ?? '', onChange: (e) => onChange(e.target.value) };
  if (f.type === 'select') return <select {...c}><option value="">—</option>{(f.options || []).map((o) => <option key={o}>{o}</option>)}</select>;
  if (f.type === 'item') return <select {...c}><option value="">Select item…</option>{items.map((i) => <option key={i.id} value={i.id}>{`${i.name || i.sku} · ${i.qty} in stock`}</option>)}</select>;
  if (f.type === 'calc') return <div className="input tabular-nums" style={{ background: 'rgba(0,0,0,.04)' }}>{fmt(computed)} <span className="muted text-xs">= {f.formula}</span></div>;
  return <input {...c} type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'} step="any" min={f.type === 'number' ? 0 : undefined} />;
}
export function RecordForm({ fields, initial = {}, items, onSubmit, submitLabel = 'Save', onCancel, resetOnSuccess }) {
  const [v, setV] = useState(initial);
  const computed = { ...v }; fields.filter((f) => f.type === 'calc').forEach((f) => { computed[f.key] = evalFormula(f.formula, computed); });
  return (
    <form className="card p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" onSubmit={(e) => { e.preventDefault(); if (onSubmit(v) && resetOnSuccess) setV(initial); }}>
      {fields.map((f) => <div key={f.key}><label className="lbl">{f.label}{f.required && ' *'}</label><FieldInput f={f} value={v[f.key]} items={items} computed={computed[f.key]} onChange={(x) => setV((p) => ({ ...p, [f.key]: x }))} /></div>)}
      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3"><button className="btn btn-primary" type="submit">{submitLabel}</button>{onCancel && <button type="button" className="btn" onClick={onCancel}>Cancel</button>}</div>
    </form>);
}

export function ExcelBar({ ctx, resource }) {
  const canImport = RANK[ctx.role] >= 2 && resource === 'inventory';
  const exportX = () => attempt(() => {
    const { columns, rows, filename } = ctx.api.export(resource);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([columns.map((c) => c.label), ...rows.map((r) => columns.map((c) => r[c.key] ?? ''))]), resource.slice(0, 31));
    XLSX.writeFile(wb, filename);
  }, `Exported ${resource}`);
  const template = () => attempt(() => {
    const { columns } = ctx.api.export(resource); const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([columns.filter((c) => c.key !== 'total').map((c) => c.label)]), 'template'); XLSX.writeFile(wb, `${resource}-template.xlsx`);
  });
  const importX = async (file) => {
    if (!file) return;
    const wb = XLSX.read(await file.arrayBuffer());
    const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
    const { columns } = ctx.api.export(resource);
    const map = Object.fromEntries(columns.flatMap((c) => [[c.label, c.key], [c.key, c.key]]));
    const res = attempt(() => ctx.api.import(resource, json.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [map[k] || k, v])))));
    if (res) toast.ok(`Import complete: ${res.created} created, ${res.updated} updated`);
  };
  return (
    <div className="flex gap-2 flex-wrap items-center">
      <button className="btn" onClick={exportX}>⬇ Export .xlsx</button>
      {resource === 'inventory' && <><button className="btn" onClick={template}>Template</button>
        <label className={`btn ${canImport ? '' : 'opacity-50 cursor-not-allowed'}`} title={canImport ? 'Upsert by SKU, atomic' : 'Import requires Manager or Admin'}>⬆ Import .xlsx{!canImport && ' (Manager+)'}
          <input type="file" accept=".xlsx,.xls,.csv" hidden disabled={!canImport} onChange={(e) => { importX(e.target.files[0]); e.target.value = ''; }} /></label></>}
    </div>);
}
