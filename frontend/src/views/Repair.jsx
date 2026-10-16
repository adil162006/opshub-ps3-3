import { useState } from 'react';
import { Badge, Page, RecordForm, attempt, fmt, useRows } from '../ui';
import { RANK, STAGES, fieldsOf } from '../lib/registry';

export function RepairView({ ctx }) {
  const fields = fieldsOf(ctx.config, 'repair'); const reqs = useRows(ctx, 'requests'); const reps = useRows(ctx, 'repairs');
  const [form, setForm] = useState(null); // {req} | {row}
  const can = RANK[ctx.role] >= 2; const waiting = reqs.filter((r) => r.status === 'approved');
  const keys = fields.map((f) => f.key);
  const start = (req) => setForm({ req, initial: Object.fromEntries(Object.entries(req).filter(([k]) => keys.includes(k))) });
  const save = async (v) => {
    const ok = await attempt(() => form.row ? ctx.api.put('repairs', form.row.id, v) : ctx.api.post('repairs', { ...v, requestId: form.req.id }), form.row ? 'Repair updated' : 'Repair started');
    if (ok) setForm(null); return ok;
  };
  const move = (r, dir) => attempt(() => ctx.api.put('repairs', r.id, { status: STAGES[STAGES.indexOf(r.status) + dir] }));
  return (
    <Page title="PCB Repair" sub="Approved requests become repair jobs. Move cards across the board.">
      {waiting.length > 0 && <div className="card p-4"><div className="lbl">Approved — awaiting repair</div><div className="flex flex-wrap gap-2 mt-2">{waiting.map((r) => <button key={r.id} disabled={!can} className="btn" onClick={() => start(r)}>{r.requestNo} · {r.device || r.title || ''} → Start</button>)}</div></div>}
      {form && <RecordForm key={form.row?.id || form.req?.id} fields={fields} initial={form.row || form.initial} submitLabel={form.row ? 'Update' : 'Start repair'} onSubmit={save} onCancel={() => setForm(null)} />}
      <div className="grid md:grid-cols-4 gap-3">{STAGES.map((st) => (
        <div key={st} className="card p-3 space-y-2" style={{ minHeight: 180 }}>
          <div className="flex justify-between items-center"><div className="lbl !mb-0">{st}</div><span className="text-xs muted">{reps.filter((r) => r.status === st).length}</span></div>
          {reps.filter((r) => r.status === st).map((r) => (
            <div key={r.id} className="border rounded-lg p-2 text-sm space-y-1" style={{ borderColor: 'var(--border)' }}>
              <div className="flex justify-between"><b>{r.requestNo}</b>{r.returned && <Badge v="returned" />}</div>
              {fields.filter((f) => f.type !== 'calc').slice(0, 2).map((f) => <div key={f.key} className="text-xs">{f.label}: {fmt(r[f.key])}</div>)}
              {fields.filter((f) => f.type === 'calc').map((f) => <div key={f.key} className="text-xs font-semibold">{f.label}: {fmt(r[f.key])}</div>)}
              {can && <div className="flex gap-1 pt-1"><button className="btn btn-sm" disabled={STAGES.indexOf(st) === 0} onClick={() => move(r, -1)}>‹</button><button className="btn btn-sm" onClick={() => setForm({ row: r })}>Edit</button><button className="btn btn-sm" disabled={STAGES.indexOf(st) === STAGES.length - 1} onClick={() => move(r, 1)}>›</button></div>}
            </div>))}
        </div>))}</div>
    </Page>);
}
