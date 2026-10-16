import { useState } from 'react';
import { DataTable, ExcelBar, Page, RecordForm, attempt, fmt, useRows } from '../ui';
import { RANK, fieldsOf } from '../lib/registry';

export function InventoryView({ ctx }) {
  const rows = useRows(ctx, 'inventory'); const fields = fieldsOf(ctx.config, 'inventory');
  const [q, setQ] = useState(''); const [form, setForm] = useState(null); // null | {} | row
  const canWrite = RANK[ctx.role] >= 2; const canDel = RANK[ctx.role] >= 3;
  const shown = rows.filter((r) => JSON.stringify(Object.values(r)).toLowerCase().includes(q.toLowerCase()));
  const save = async (v) => {
    const ok = await attempt(() => form.id ? ctx.api.put('inventory', form.id, v) : ctx.api.post('inventory', v), form.id ? 'Item updated' : 'Item added');
    if (ok) setForm(null); return ok;
  };
  const cols = [...fields.map((f) => ({ key: f.key, label: f.label, render: (r) => (f.key === 'qty' && r.reorder != null && r.qty <= r.reorder ? <span className="font-semibold text-red-600">{fmt(r.qty)} ⚠</span> : fmt(r[f.key])) })),
    ...(canWrite ? [{ label: '', render: (r) => <div className="flex gap-1"><button className="btn btn-sm" onClick={() => setForm(r)}>Edit</button>{canDel && <button className="btn btn-sm" onClick={() => confirm(`Delete ${r.name || r.sku}?`) && attempt(() => ctx.api.del('inventory', r.id), 'Deleted')}>🗑</button>}</div> }] : [])];
  return (
    <Page title="Inventory" sub={`${rows.length} items · calculated fields update automatically${canWrite ? '' : ' · read-only for Members'}`}
      actions={<>{canWrite && <button className="btn btn-primary" onClick={() => setForm({})}>+ Add item</button>}</>}>
      <div className="flex gap-3 items-center flex-wrap"><input className="input" style={{ maxWidth: 280 }} placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} /><ExcelBar ctx={ctx} resource="inventory" /></div>
      {form && <RecordForm key={form.id || 'new'} fields={fields} initial={form} submitLabel={form.id ? 'Update' : 'Add item'} onSubmit={save} onCancel={() => setForm(null)} />}
      <DataTable columns={cols} rows={shown} />
    </Page>);
}
