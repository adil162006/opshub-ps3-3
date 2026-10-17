import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { create } from 'zustand';
import { evalFormula, RANK } from './lib/registry';
import { exportReport, importInventory } from './api/reports.api';

export const useUI = create((set) => ({
  toasts: [],
  push: (kind, msg) => { const id = Math.random(); set((s) => ({ toasts: [...s.toasts, { id, kind, msg }] })); setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 5000); },
}));
export const toast = { ok: (m) => useUI.getState().push('ok', m), err: (m) => useUI.getState().push('err', m) };
function showFailure(e) {
  const det = e.response?.data?.details?.length ? ': ' + e.response.data.details.map((x) => (typeof x === 'string' ? x : `row ${x.row}: ${x.message}`)).join(' · ') : '';
  toast.err(`${e.response?.data?.message || e.response?.data?.error || e.message}${det}`);
}
export function attempt(fn, okMsg) {
  try {
    const result = fn();
    if (result && typeof result.then === 'function') {
      return result.then((value) => { if (okMsg) toast.ok(okMsg); return value ?? true; }).catch((error) => { showFailure(error); return false; });
    }
    if (okMsg) toast.ok(okMsg);
    return result ?? true;
  } catch (e) {
    showFailure(e);
    return false;
  }
}
export async function attemptAsync(fn, okMsg) {
  try {
    const result = await fn();
    if (okMsg) toast.ok(okMsg);
    return result ?? true;
  } catch (e) {
    showFailure(e);
    return false;
  }
}
export function Toaster() {
  const toasts = useUI((s) => s.toasts);
  return <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm">{toasts.map((t) => (
    <div key={t.id} className={`px-4 py-2.5 rounded-lg text-sm shadow-lg text-white ${t.kind === 'ok' ? 'bg-emerald-600' : 'bg-red-600'}`}>{t.msg}</div>))}</div>;
}

const TONES = {
  pending:   'bg-amber-400/15 text-amber-300',
  approved:  'bg-emerald-400/15 text-emerald-300',
  rejected:  'bg-red-400/15 text-red-300',
  assigned:  'bg-blue-400/15 text-blue-300',
  open:      'bg-slate-400/15 text-slate-300',
  'in-repair': 'bg-purple-400/15 text-purple-300',
  closed:    'bg-slate-400/10 text-slate-400',
  issued:    'bg-sky-400/15 text-sky-300',
  'in-use':  'bg-indigo-400/15 text-indigo-300',
  consumed:  'bg-slate-400/10 text-slate-400',
  diagnosis: 'bg-amber-400/15 text-amber-300',
  repairing: 'bg-purple-400/15 text-purple-300',
  testing:   'bg-cyan-400/15 text-cyan-300',
  completed: 'bg-emerald-400/15 text-emerald-300',
  approve:   'bg-emerald-400/15 text-emerald-300',
  reject:    'bg-red-400/15 text-red-300',
  good:      'bg-emerald-400/15 text-emerald-300',
  damaged:   'bg-red-400/15 text-red-300',
  High:      'bg-red-400/15 text-red-300',
  Normal:    'bg-slate-400/15 text-slate-300',
  Low:       'bg-slate-400/10 text-slate-400',
  Admin:     'bg-amber-400/20 text-amber-300',
  Manager:   'bg-emerald-400/15 text-emerald-300',
  Member:    'bg-sky-400/15 text-sky-300',
};
export const Badge = ({ v }) => <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${TONES[v] || 'bg-slate-400/15 text-slate-300'}`}>{v}</span>;

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
  const siteId = ctx.site?.id;
  const query = useQuery({
    queryKey: ['site-data', siteId, res],
    queryFn: () => ctx.api.list(res),
    enabled: !!ctx.api.remote && !!siteId,
  });
  return query.data || [];
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
  const [saving, setSaving] = useState(false);
  const computed = { ...v }; fields.filter((f) => f.type === 'calc').forEach((f) => { computed[f.key] = evalFormula(f.formula, computed); });
  return (
    <form className="card p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" onSubmit={async (e) => { e.preventDefault(); if (saving) return; setSaving(true); try { if (await onSubmit(v) && resetOnSuccess) setV(initial); } finally { setSaving(false); } }}>
      {fields.map((f) => <div key={f.key}><label className="lbl">{f.label}{f.required && ' *'}</label><FieldInput f={f} value={v[f.key]} items={items} computed={computed[f.key]} onChange={(x) => setV((p) => ({ ...p, [f.key]: x }))} /></div>)}
      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3"><button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : submitLabel}</button>{onCancel && <button type="button" className="btn" onClick={onCancel}>Cancel</button>}</div>
    </form>);
}

export function ExcelBar({ ctx, resource }) {
  const canImport = RANK[ctx.role] >= 2 && resource === 'inventory';
  const exportX = async () => attemptAsync(async () => {
    const { blob, filename } = await exportReport(ctx.site.id, resource);
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
    anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
    return true;
  }, `Exported ${resource}`);
  const template = () => attempt(() => {
    const columns = ctx.config.nodes.find((node) => node.data.type === 'inventory')?.data.config?.fields || [];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([columns.filter((field) => field.type !== 'calc').map((field) => field.label || field.key)]), 'template'); XLSX.writeFile(wb, `${resource}-template.xlsx`);
  });
  const importX = async (file) => {
    if (!file) return;
    const result = await attemptAsync(() => importInventory(ctx.site.id, file));
    if (result && typeof result === 'object') toast.ok(`Import complete: ${result.created} created, ${result.updated} updated`);
  };
  return (
    <div className="flex gap-2 flex-wrap items-center">
      <button className="btn" onClick={exportX}>⬇ Export .xlsx</button>
      {resource === 'inventory' && <><button className="btn" onClick={template}>Template</button>
        <label className={`btn ${canImport ? '' : 'opacity-50 cursor-not-allowed'}`} title={canImport ? 'Upsert by SKU, atomic' : 'Import requires Manager or Admin'}>⬆ Import .xlsx{!canImport && ' (Manager+)'}
          <input type="file" accept=".xlsx,.xls,.csv" hidden disabled={!canImport} onChange={(e) => { importX(e.target.files[0]); e.target.value = ''; }} /></label></>}
    </div>);
}
