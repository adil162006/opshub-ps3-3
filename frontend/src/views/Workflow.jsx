import { useState } from 'react';
import { Badge, DataTable, Page, RecordForm, attempt, fieldText, fmt, useRows, when } from '../ui';
import { RANK, fieldsOf, hasModule, itemKey, stepsOf } from '../lib/registry';

const summary = (fields, r, items) => fields.filter((f) => f.type !== 'calc' && r[f.key] !== '' && r[f.key] != null).map((f) => `${f.label}: ${fieldText(f, r, items)}`).join(' · ');

export function RequestView({ ctx }) {
  const fields = fieldsOf(ctx.config, 'request'); const items = useRows(ctx, 'inventory'); const rows = useRows(ctx, 'requests');
  const [open, setOpen] = useState(false); const [st, setSt] = useState('');
  const shown = rows.filter((r) => !st || r.status === st).reverse();
  const steps = stepsOf(ctx.config);
  return (
    <Page title="Requests" sub={steps.length ? `Approval chain: ${steps.join(' → ')}` : 'No approval module connected'} actions={<button className="btn btn-primary" onClick={() => setOpen(!open)}>+ New request</button>}>
      {open && <RecordForm fields={fields} items={items} submitLabel="Submit request" resetOnSuccess onSubmit={(v) => attempt(() => ctx.api.post('requests', v), 'Request submitted')} onCancel={() => setOpen(false)} />}
      <select className="input" style={{ maxWidth: 200 }} value={st} onChange={(e) => setSt(e.target.value)}><option value="">All statuses</option>{['pending', 'approved', 'rejected', 'assigned', 'in-repair', 'closed'].map((s) => <option key={s}>{s}</option>)}</select>
      <DataTable rows={shown} columns={[{ key: 'requestNo', label: 'No' }, ...fields.filter((f) => f.type !== 'calc').map((f) => ({ label: f.label, render: (r) => fieldText(f, r, items) })),
        { label: 'Status', render: (r) => <><Badge v={r.status} />{r.status === 'pending' && steps.length > 1 && <span className="text-xs muted ml-2">step {r.step + 1}/{steps.length}</span>}</> }, { key: 'requestedBy', label: 'By' }]} />
    </Page>);
}

export function ApprovalView({ ctx }) {
  const fields = fieldsOf(ctx.config, 'request'); const items = useRows(ctx, 'inventory'); const reqs = useRows(ctx, 'requests'); const apps = useRows(ctx, 'approvals');
  const steps = stepsOf(ctx.config); const [c, setC] = useState({});
  const pending = reqs.filter((r) => r.status === 'pending');
  const decide = (r, decision) => attempt(() => ctx.api.post('approvals', { requestId: r.id, decision, comment: c[r.id] || '' }), decision === 'approve' ? 'Approved' : 'Rejected');
  return (
    <Page title="Approvals" sub={`Chain: ${steps.map((s, i) => `${i + 1}. ${s}`).join(' → ')}`}>
      {pending.length === 0 && <div className="card p-6 muted text-center">No requests awaiting approval 🎉</div>}
      <div className="grid md:grid-cols-2 gap-3">{pending.map((r) => {
        const need = steps[r.step]; const can = RANK[ctx.role] >= RANK[need];
        return (<div key={r.id} className="card p-4 space-y-2">
          <div className="flex justify-between"><b>{r.requestNo}</b><span className="text-xs muted">{r.requestedBy} · {when(r.createdAt)}</span></div>
          <div className="text-sm">{summary(fields, r, items)}</div>
          <div className="flex gap-1 items-center flex-wrap">{steps.map((s, i) => <span key={i} className={`text-xs px-2 py-0.5 rounded-full ${i < r.step ? 'bg-green-100 text-green-800' : i === r.step ? 'bg-amber-100 text-amber-800 font-semibold' : 'bg-slate-100 text-slate-500'}`}>{i < r.step ? '✓ ' : ''}{i + 1}. {s}</span>)}</div>
          <input className="input" placeholder="Comment (optional)" value={c[r.id] || ''} onChange={(e) => setC({ ...c, [r.id]: e.target.value })} />
          <div className="flex gap-2"><button className="btn btn-primary" disabled={!can} title={can ? '' : `Needs ${need}`} onClick={() => decide(r, 'approve')}>Approve</button><button className="btn" disabled={!can} onClick={() => decide(r, 'reject')}>Reject</button>{!can && <span className="text-xs muted self-center">Needs {need}</span>}</div>
        </div>);
      })}</div>
      <h2 className="font-semibold">Decision log</h2>
      <DataTable rows={[...apps].reverse()} columns={[{ key: 'requestNo', label: 'Request' }, { label: 'Step', render: (a) => `${a.step + 1} · ${a.role}` }, { label: 'Decision', render: (a) => <Badge v={a.decision} /> }, { key: 'comment', label: 'Comment' }, { key: 'by', label: 'By' }, { label: 'When', render: (a) => when(a.at) }]} />
    </Page>);
}

export function AssignmentView({ ctx }) {
  const reqs = useRows(ctx, 'requests'); const items = useRows(ctx, 'inventory'); const asg = useRows(ctx, 'assignments');
  const key = itemKey(ctx.config); const fields = fieldsOf(ctx.config, 'request');
  const [f, setF] = useState({}); const [crash, setCrash] = useState(false);
  const ready = reqs.filter((r) => r.status === 'approved'); const canAssign = RANK[ctx.role] >= 2;
  return (
    <Page title="Material Assignment" sub="Approved requests → issue stock. Stock decrement + request status + assignment row commit in one transaction.">
      {ctx.role === 'Admin' && <label className="text-xs flex items-center gap-2"><input type="checkbox" checked={crash} onChange={(e) => setCrash(e.target.checked)} /> Simulate crash after stock decrement (demo: verify rollback)</label>}
      {ready.length === 0 && <div className="card p-6 muted text-center">No approved requests waiting for assignment.</div>}
      <div className="grid md:grid-cols-2 gap-3">{ready.map((r) => {
        const item = items.find((i) => i.id === r[key]); const qty = f[r.id]?.qty ?? r.qty; const short = item && qty > item.qty;
        return (<div key={r.id} className="card p-4 space-y-2">
          <div className="flex justify-between"><b>{r.requestNo}</b><Badge v={r.priority || 'Normal'} /></div>
          <div className="text-sm">{summary(fields, r, items)}</div>
          <div className={`text-sm ${short ? 'text-red-600 font-semibold' : 'muted'}`}>Available: {item ? fmt(item.qty) : '—'} {short && '· insufficient'}</div>
          <div className="grid grid-cols-2 gap-2"><div><label className="lbl">Qty</label><input className="input" type="number" min="1" value={qty} onChange={(e) => setF({ ...f, [r.id]: { ...f[r.id], qty: e.target.value } })} /></div>
            <div><label className="lbl">Assign to</label><input className="input" value={f[r.id]?.assignee ?? r.team ?? ''} onChange={(e) => setF({ ...f, [r.id]: { ...f[r.id], assignee: e.target.value } })} /></div></div>
          <button className="btn btn-primary" disabled={!canAssign} onClick={() => attempt(() => ctx.api.post('assignments', { requestId: r.id, qty, assignee: f[r.id]?.assignee ?? r.team, _simulateCrash: crash }), 'Assigned — stock decremented')}>Assign & decrement stock</button>
        </div>);
      })}</div>
      <h2 className="font-semibold">Assignments</h2>
      <DataTable rows={[...asg].reverse()} columns={[{ key: 'requestNo', label: 'Request' }, { key: 'itemName', label: 'Item' }, { key: 'qty', label: 'Issued' }, { key: 'remaining', label: 'Remaining' }, { key: 'assignee', label: 'Assignee' }, { label: 'Status', render: (a) => <Badge v={a.status} /> }, { key: 'issuedBy', label: 'By' }]} />
    </Page>);
}

export function AssignmentCards({ ctx }) {
  const asg = useRows(ctx, 'assignments'); const [who, setWho] = useState('');
  const people = [...new Set(asg.map((a) => a.assignee))];
  return (
    <Page title="Field View" sub="What each team has in hand and how much is left.">
      <select className="input" style={{ maxWidth: 240 }} value={who} onChange={(e) => setWho(e.target.value)}><option value="">All teams</option>{people.map((p) => <option key={p}>{p}</option>)}</select>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{asg.filter((a) => !who || a.assignee === who).map((a) => {
        const used = a.qty - a.remaining;
        return (<div key={a.id} className="card p-4 space-y-2"><div className="flex justify-between"><b>{a.itemName}</b><Badge v={a.status} /></div>
          <div className="text-sm muted">{a.assignee} · {a.requestNo}</div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}><div className="h-full" style={{ width: `${(used / a.qty) * 100}%`, background: 'var(--accent)' }} /></div>
          <div className="text-sm tabular-nums">{used} used · <b>{a.remaining} left</b> of {a.qty}</div></div>);
      })}</div>
    </Page>);
}

export function ConsumptionView({ ctx }) {
  const asg = useRows(ctx, 'assignments'); const log = useRows(ctx, 'consumption');
  const [f, setF] = useState({ assignmentId: '', qty: '', note: '' });
  const open = asg.filter((a) => a.remaining > 0); const sel = open.find((a) => a.id === f.assignmentId);
  return (
    <Page title="Consumption Tracking" sub="Log material used in the field against an assignment.">
      <form className="card p-4 grid sm:grid-cols-4 gap-3" onSubmit={(e) => { e.preventDefault(); if (attempt(() => ctx.api.post('consumption', f), 'Usage logged')) setF({ assignmentId: '', qty: '', note: '' }); }}>
        <div className="sm:col-span-2"><label className="lbl">Assignment</label><select className="input" value={f.assignmentId} onChange={(e) => setF({ ...f, assignmentId: e.target.value })}><option value="">Select…</option>{open.map((a) => <option key={a.id} value={a.id}>{a.requestNo} · {a.itemName} · {a.assignee} ({a.remaining} left)</option>)}</select></div>
        <div><label className="lbl">Qty used{sel && ` (max ${sel.remaining})`}</label><input className="input" type="number" min="1" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} /></div>
        <div><label className="lbl">Note</label><input className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
        <div className="sm:col-span-4"><button className="btn btn-primary">Log consumption</button></div>
      </form>
      <DataTable rows={[...log].reverse()} columns={[{ key: 'date', label: 'Date' }, { key: 'itemName', label: 'Item' }, { key: 'qty', label: 'Qty' }, { key: 'note', label: 'Note' }, { key: 'by', label: 'By' }]} />
    </Page>);
}

export function ReturnsView({ ctx }) {
  const asg = useRows(ctx, 'assignments'); const reps = useRows(ctx, 'repairs'); const rets = useRows(ctx, 'returns');
  const hasA = hasModule(ctx.config, 'assignment'); const hasR = hasModule(ctx.config, 'repair');
  const [f, setF] = useState({ source: hasA ? 'assignment' : 'repair', refId: '', qty: '', condition: 'good', resolution: 'refund', reason: '' });
  const refs = f.source === 'assignment' ? asg.filter((a) => a.remaining > 0) : reps.filter((r) => r.status === 'completed' && !r.returned);
  return (
    <Page title="Return Management" sub={hasA ? 'Good-condition returns go back into stock automatically.' : 'Customer returns of completed repairs.'}>
      <form className="card p-4 grid sm:grid-cols-4 gap-3" onSubmit={(e) => { e.preventDefault(); if (attempt(() => ctx.api.post('returns', f), 'Return recorded')) setF({ ...f, refId: '', qty: '', reason: '' }); }}>
        {hasA && hasR && <div><label className="lbl">Source</label><select className="input" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value, refId: '' })}><option value="assignment">Assigned material</option><option value="repair">Repaired device</option></select></div>}
        <div className="sm:col-span-2"><label className="lbl">Record</label><select className="input" value={f.refId} onChange={(e) => setF({ ...f, refId: e.target.value })}><option value="">Select…</option>
          {refs.map((r) => <option key={r.id} value={r.id}>{f.source === 'assignment' ? `${r.requestNo} · ${r.itemName} (${r.remaining} out)` : `${r.requestNo} · ${r.device}`}</option>)}</select></div>
        {f.source === 'assignment' ? <><div><label className="lbl">Qty</label><input className="input" type="number" min="1" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} /></div>
          <div><label className="lbl">Condition</label><select className="input" value={f.condition} onChange={(e) => setF({ ...f, condition: e.target.value })}><option value="good">Good (restock)</option><option value="damaged">Damaged (write-off)</option></select></div></>
          : <div><label className="lbl">Resolution</label><select className="input" value={f.resolution} onChange={(e) => setF({ ...f, resolution: e.target.value })}><option>refund</option><option>redo</option><option>replace</option></select></div>}
        <div className="sm:col-span-2"><label className="lbl">Reason</label><input className="input" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></div>
        <div className="sm:col-span-4"><button className="btn btn-primary">Record return</button></div>
      </form>
      <DataTable rows={[...rets].reverse()} columns={[{ key: 'source', label: 'Source' }, { key: 'refLabel', label: 'Record' }, { key: 'qty', label: 'Qty' }, { label: 'Condition', render: (r) => <Badge v={r.condition} /> }, { key: 'resolution', label: 'Resolution' }, { key: 'reason', label: 'Reason' }, { key: 'by', label: 'By' }]} />
    </Page>);
}
