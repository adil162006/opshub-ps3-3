import { useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, { Background, Controls, Handle, MiniMap, Position, ReactFlowProvider, addEdge, useEdgesState, useNodesState, useReactFlow } from 'reactflow';
import 'reactflow/dist/style.css';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDB } from '../lib/db';
import { apiSync } from '../lib/api';
import { MODULES, ORDER, PRESETS, ROLES, TYPE_LABEL, accepts, connectionType, defaultConfig, validateConfig, validateFormula } from '../lib/registry';
import { Badge, attempt, toast, when } from '../ui';

function ModuleNode({ data, selected }) {
  const m = MODULES[data.type]; const bad = data.issues?.length;
  return (
    <div className="rounded-xl shadow-md px-3 py-2 w-52" style={{ background: 'var(--card)', border: `2px solid ${selected ? 'oklch(0.82 0.16 85)' : bad ? 'var(--destructive)' : 'var(--border)'}`, color: 'var(--foreground)' }}>
      <Handle type="target" position={Position.Left} /><Handle type="source" position={Position.Right} />
      <div className="flex items-center gap-2"><span className="text-lg">{m.icon}</span><div className="text-sm font-semibold leading-tight">{m.name}</div></div>
      <div className="text-[10px] mt-1" style={{ color: 'var(--muted-foreground)' }}>in: {accepts(data.type).map((t) => TYPE_LABEL[t]).join(', ') || '—'}</div>
      <div className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>out: {m.outputs.map((t) => TYPE_LABEL[t]).join(', ') || '—'}</div>
      {bad ? <div className="text-[10px] mt-1" style={{ color: 'var(--destructive)' }}>⚠ {data.issues[0]}</div> : <div className="text-[10px] mt-1" style={{ color: 'var(--success)' }}>✓ inputs satisfied</div>}
    </div>);
}
const nodeTypes = { module: ModuleNode };
const strip = ({ id, type, position, data }) => ({ id, type, position, data });
const stripE = ({ id, source, target, label, animated }) => ({ id, source, target, label, animated });

function FieldsEditor({ fields, onChange }) {
  const upd = (i, p) => onChange(fields.map((f, j) => (j === i ? { ...f, ...p } : f)));
  return (
    <div className="space-y-2">{fields.map((f, i) => {
      const err = f.type === 'calc' ? validateFormula(f.formula || '', fields.map((x) => x.key).filter((k) => k !== f.key)) : null;
      return (
        <div key={i} className="border rounded-lg p-2 space-y-1">
          <div className="flex gap-1"><input className="input" placeholder="Label" value={f.label} onChange={(e) => upd(i, { label: e.target.value })} /><input className="input" placeholder="key" value={f.key} onChange={(e) => upd(i, { key: e.target.value })} /></div>
          <div className="flex gap-1 items-center"><select className="input" value={f.type} onChange={(e) => upd(i, { type: e.target.value })}>{['text', 'number', 'select', 'date', 'item', 'calc'].map((t) => <option key={t}>{t}</option>)}</select>
            <label className="text-xs flex items-center gap-1"><input type="checkbox" disabled={f.type === 'calc'} checked={!!f.required} onChange={(e) => upd(i, { required: e.target.checked })} />req</label>
            <button className="btn btn-sm" onClick={() => onChange(fields.filter((_, j) => j !== i))}>✕</button></div>
          {f.type === 'select' && <input className="input" placeholder="Options, comma separated" value={f.optionsText ?? (f.options || []).join(', ')} onChange={(e) => upd(i, { optionsText: e.target.value, options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />}
          {f.type === 'calc' && <><input className="input font-mono" placeholder="e.g. qty * price" value={f.formula || ''} onChange={(e) => upd(i, { formula: e.target.value })} />{err && <div className="text-xs text-red-600">{err}</div>}</>}
        </div>);
    })}
      <button className="btn btn-sm" onClick={() => onChange([...fields, { key: `field${fields.length + 1}`, label: 'New field', type: 'text' }])}>+ Add field</button></div>);
}

function Canvas({ site }) {
  const nav = useNavigate(); const rf = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState(site.draft.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(site.draft.edges);
  const [theme, setTheme] = useState(site.draft.theme);
  const [tab, setTab] = useState('config'); const [note, setNote] = useState(''); const [preset, setPreset] = useState(Object.keys(PRESETS)[0]); const [saved, setSaved] = useState(true);
  const cfg = useMemo(() => ({ nodes: nodes.map(strip), edges: edges.map(stripE), theme }), [nodes, edges, theme]);
  const v = useMemo(() => validateConfig(cfg), [cfg]);
  const shown = useMemo(() => nodes.map((n) => ({ ...n, data: { ...n.data, issues: v.byNode[n.id] || [] } })), [nodes, v]);
  const sel = nodes.find((n) => n.selected);
  const first = useRef(true); const cfgRef = useRef(cfg); const dirty = useRef(false);
  cfgRef.current = cfg;
  const save = () => { if (!dirty.current) return; dirty.current = false; attempt(() => apiSync('PUT', `/api/sites/${site.id}/draft`, { draft: cfgRef.current })); setSaved(true); };
  useEffect(() => { if (first.current) { first.current = false; return undefined; } dirty.current = true; setSaved(false); const t = setTimeout(save, 500); return () => clearTimeout(t); }, [cfg]); // eslint-disable-line
  useEffect(() => () => save(), []); // eslint-disable-line

  const patch = (id, p) => setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...p } } : n)));
  const patchCfg = (id, p) => setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, config: { ...n.data.config, ...p } } } : n)));
  const addModule = (type, pos) => {
    if (nodes.some((n) => n.data.type === type)) return toast.err(`${MODULES[type].name} is already on the canvas`);
    const i = nodes.length;
    setNodes((ns) => [...ns, { id: `${type}-1`, type: 'module', position: pos || { x: 40 + (i % 4) * 250, y: 360 + Math.floor(i / 4) * 130 }, data: { type, label: MODULES[type].name, config: defaultConfig(type) } }]);
  };
  const removeModule = (id) => { setNodes((ns) => ns.filter((n) => n.id !== id)); setEdges((es) => es.filter((e) => e.source !== id && e.target !== id)); };
  const onConnect = (c) => {
    const s = nodes.find((n) => n.id === c.source); const t = nodes.find((n) => n.id === c.target);
    const type = connectionType(s.data.type, t.data.type);
    if (!type) return toast.err(`Can’t connect ${MODULES[s.data.type].name} → ${MODULES[t.data.type].name}. ${MODULES[t.data.type].name} accepts: ${accepts(t.data.type).map((x) => TYPE_LABEL[x]).join(', ') || 'nothing'}.`);
    if (edges.some((e) => e.source === c.source && e.target === c.target)) return undefined;
    return setEdges((es) => addEdge({ ...c, id: `e-${c.source}-${c.target}`, label: TYPE_LABEL[type], animated: true }, es));
  };
  const applyPreset = () => { if (!confirm(`Replace the canvas with "${preset}"?`)) return; const p = PRESETS[preset](); setNodes(p.nodes); setEdges(p.edges); setTimeout(() => rf.fitView({ padding: 0.2 }), 60); };
  const publish = () => { dirty.current = true; save(); attempt(() => apiSync('POST', `/api/sites/${site.id}/publish`, { note }), 'Published — live site updated, no restart'); setNote(''); };
  const rollback = (ver) => {
    if (!attempt(() => apiSync('POST', `/api/sites/${site.id}/rollback`, { version: ver }), `Rolled back to v${ver}`)) return;
    const t = site.versions.find((x) => x.v === ver); setNodes(structuredClone(t.nodes)); setEdges(structuredClone(t.edges)); setTheme(t.theme);
  };
  const typesOf = (ver) => new Set(ver.nodes.map((n) => n.data.type));
  const diff = (ver, i, arr) => { const prev = arr[i + 1]; if (!prev) return []; const a = typesOf(ver); const b = typesOf(prev); return [...[...a].filter((t) => !b.has(t)).map((t) => `+${MODULES[t].page?.title || t}`), ...[...b].filter((t) => !a.has(t)).map((t) => `−${MODULES[t].page?.title || t}`)]; };
  const versions = [...site.versions].sort((a, b) => b.v - a.v);
  const T = ({ k, children }) => <button onClick={() => setTab(k)} className="px-3 py-1.5 text-sm" style={{ borderBottom: tab === k ? '2px solid oklch(0.82 0.16 85)' : '2px solid transparent', color: tab === k ? 'var(--foreground)' : 'var(--muted-foreground)', fontWeight: tab === k ? 600 : 400 }}>{children}</button>;
  const th = (k, val) => setTheme((t) => ({ ...t, [k]: val }));

  return (
    <div className="themed flex" style={{ height: 'calc(100vh - 48px)', background: 'var(--background)', color: 'var(--foreground)' }}>
      <aside className="w-56 shrink-0 p-3 overflow-y-auto" style={{ borderRight: '1px solid var(--border)', background: 'var(--card)' }}>
        <div className="lbl">Module palette</div><p className="text-[11px] muted mb-2">Drag onto canvas or click. 13 approved modules.</p>
        {['Core', 'Stock', 'Workflow', 'Tracking', 'Insight'].map((g) => (
          <div key={g} className="mb-3"><div className="text-[10px] font-semibold uppercase mb-1" style={{ color: 'var(--muted-foreground)', letterSpacing: '0.08em' }}>{g}</div>
            {ORDER.filter((t) => MODULES[t].group === g).map((t) => { const used = nodes.some((n) => n.data.type === t); return (
              <div key={t} draggable={!used} onDragStart={(e) => e.dataTransfer.setData('application/opshub', t)} onClick={() => !used && addModule(t)} title={MODULES[t].desc}
                className={`text-sm px-2 py-1.5 rounded-lg mb-1 transition-colors ${used ? 'opacity-40' : 'cursor-grab'}`} style={{ border: '1px solid var(--border)', background: used ? 'transparent' : 'var(--secondary)' }}>{MODULES[t].icon} {MODULES[t].name}</div>); })}</div>))}
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-3 py-2 flex items-center gap-2 flex-wrap text-sm" style={{ borderBottom: '1px solid var(--border)', background: 'var(--card)' }}>
          <b>{site.name}</b><span className="muted">/{site.slug}</span>
          <select className="input" style={{ width: 150 }} value={preset} onChange={(e) => setPreset(e.target.value)}>{Object.keys(PRESETS).map((p) => <option key={p}>{p}</option>)}</select><button className="btn btn-sm" onClick={applyPreset}>Load preset</button>
          <span className={`px-2 py-0.5 rounded-full text-xs ${v.errors.length ? 'bg-red-400/15 text-red-300' : 'bg-emerald-400/15 text-emerald-300'}`}>{v.errors.length ? `${v.errors.length} issue${v.errors.length > 1 ? 's' : ''}` : 'Valid'}</span>
          <span className="text-xs muted">{saved ? 'Draft saved' : 'Saving…'}</span>
          <div className="ml-auto flex gap-2"><button className="btn" onClick={() => { dirty.current = true; save(); nav(`/preview/${site.slug}`); }}>👁 Preview draft</button><Link className="btn" to={`/s/${site.slug}`}>Open live ↗</Link></div>
        </div>
        <div className="flex-1" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const t = e.dataTransfer.getData('application/opshub'); if (t) addModule(t, rf.screenToFlowPosition({ x: e.clientX, y: e.clientY })); }}>
          <ReactFlow nodes={shown} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} fitView fitViewOptions={{ padding: 0.2 }} deleteKeyCode={['Backspace', 'Delete']}>
            <Background gap={18} /><Controls /><MiniMap pannable zoomable />
          </ReactFlow>
        </div>
      </div>
      <aside className="w-80 shrink-0 flex flex-col" style={{ borderLeft: '1px solid var(--border)', background: 'var(--card)' }}>
        <div className="flex border-b"><T k="config">Config</T><T k="theme">Theme</T><T k="releases">Releases</T></div>
        <div className="p-3 overflow-y-auto flex-1 space-y-3 text-sm">
          {tab === 'config' && (sel ? (
            <>
              <div className="flex items-center gap-2"><span className="text-xl">{MODULES[sel.data.type].icon}</span><b>{MODULES[sel.data.type].name}</b></div>
              <p className="text-xs muted">{MODULES[sel.data.type].desc}</p>
              <div><label className="lbl">Label</label><input className="input" value={sel.data.label} onChange={(e) => patch(sel.id, { label: e.target.value })} /></div>
              {sel.data.config?.fields && <div><label className="lbl">Fields & calculated fields</label><FieldsEditor fields={sel.data.config.fields} onChange={(fields) => patchCfg(sel.id, { fields })} /></div>}
              {sel.data.type === 'approval' && (
                <div><label className="lbl">Approval chain (no developer needed)</label>
                  {(sel.data.config.steps || ['Manager']).map((s, i, arr) => <div key={i} className="flex gap-1 mb-1 items-center"><span className="text-xs w-12">Step {i + 1}</span><select className="input" value={s} onChange={(e) => patchCfg(sel.id, { steps: arr.map((x, j) => (j === i ? e.target.value : x)) })}>{ROLES.slice(1).map((r) => <option key={r}>{r}</option>)}</select>{arr.length > 1 && <button className="btn btn-sm" onClick={() => patchCfg(sel.id, { steps: arr.filter((_, j) => j !== i) })}>✕</button>}</div>)}
                  {(sel.data.config.steps || []).length < 4 && <button className="btn btn-sm" onClick={() => patchCfg(sel.id, { steps: [...(sel.data.config.steps || ['Manager']), 'Admin'] })}>+ Add step</button>}</div>)}
              {v.byNode[sel.id]?.map((m) => <div key={m} className="text-xs text-red-600">⚠ {m}</div>)}
              <button className="btn btn-sm" onClick={() => removeModule(sel.id)}>Remove module</button>
            </>) : (
            <>
              <p className="muted text-xs">Select a module to configure it. Connect nodes by dragging from one handle to another — links are typed, so e.g. Approval needs a Request.</p>
              <div className="lbl">Validation</div>
              {v.errors.length ? v.errors.map((e) => <div key={e} className="text-xs" style={{ color: 'var(--destructive)' }}>⚠ {e}</div>) : <div className="text-xs" style={{ color: 'var(--success)' }}>✓ Ready to publish</div>}
            </>))}
          {tab === 'theme' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2"><div><label className="lbl">Primary</label><input type="color" className="input h-9 p-1" value={theme.primary} onChange={(e) => th('primary', e.target.value)} /></div><div><label className="lbl">Accent</label><input type="color" className="input h-9 p-1" value={theme.accent} onChange={(e) => th('accent', e.target.value)} /></div></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="lbl">Layout</label><select className="input" value={theme.layout} onChange={(e) => th('layout', e.target.value)}><option>sidebar</option><option>topbar</option></select></div>
                <div><label className="lbl">Mode</label><select className="input" value={theme.mode} onChange={(e) => th('mode', e.target.value)}><option>light</option><option>dark</option></select></div>
                <div><label className="lbl">Font</label><select className="input" value={theme.font} onChange={(e) => th('font', e.target.value)}><option>Inter</option><option>serif</option><option>mono</option></select></div>
                <div><label className="lbl">Density</label><select className="input" value={theme.density} onChange={(e) => th('density', e.target.value)}><option>comfortable</option><option>compact</option></select></div></div>
              <div><label className="lbl">Corner radius: {theme.radius}px</label><input type="range" min="0" max="24" className="w-full" value={theme.radius} onChange={(e) => th('radius', Number(e.target.value))} /></div>
            </div>)}
          {tab === 'releases' && (
            <div className="space-y-3">
              <div className="space-y-2"><label className="lbl">Publish draft as v{Math.max(...site.versions.map((x) => x.v)) + 1}</label><input className="input" placeholder="Release note" value={note} onChange={(e) => setNote(e.target.value)} />
                <button className="btn btn-primary w-full justify-center" disabled={v.errors.length > 0} onClick={publish}>🚀 Publish to live</button>{v.errors.length > 0 && <div className="text-xs text-red-600">Fix {v.errors.length} issue(s) first.</div>}</div>
              <div className="lbl">Versions</div>
              {versions.map((ver, i, arr) => (
                <div key={ver.v} className="border rounded-lg p-2 text-xs space-y-1"><div className="flex justify-between items-center"><b>v{ver.v}</b>{ver.v === site.live ? <Badge v="live" /> : <button className="btn btn-sm" onClick={() => rollback(ver.v)}>Rollback</button>}</div>
                  <div>{ver.note || '—'}</div><div className="muted">{ver.by} · {when(ver.at)}</div><div className="flex gap-1 flex-wrap">{diff(ver, i, arr).map((d) => <span key={d} className={`px-1.5 rounded ${d[0] === '+' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{d}</span>)}</div></div>))}
              <div className="lbl">Deploy history</div>
              <ul className="text-xs space-y-1">{[...site.deploys].reverse().map((d) => <li key={d.id}>{d.action === 'rollback' ? '↩️' : '🚀'} <b>v{d.version}</b> {d.action} · {d.by} · <span className="muted">{when(d.at)}</span></li>)}</ul>
            </div>)}
        </div>
      </aside>
    </div>);
}

export function BuilderEditor() {
  const { slug } = useParams(); const site = useDB((s) => s.sites.find((x) => x.slug === slug));
  if (!site) return <div className="p-10" style={{ color: 'var(--foreground)' }}>Site not found</div>;
  return <ReactFlowProvider><Canvas key={site.id} site={site} /></ReactFlowProvider>;
}

export function BuilderIndex() {
  const sites = useDB((s) => s.sites); const nav = useNavigate();
  const [f, setF] = useState({ name: '', slug: '', preset: Object.keys(PRESETS)[0] });
  return (
    <div className="themed min-h-[calc(100vh-48px)] p-6" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
      <div className="max-w-4xl mx-auto space-y-4">
        <h1 className="text-xl font-semibold">Site builder</h1>
        <div className="grid md:grid-cols-3 gap-3">{sites.map((s) => <Link key={s.id} to={`/builder/${s.slug}`} className="card p-4 hover:shadow"><div className="font-semibold">{s.name}</div><div className="text-xs muted">/{s.slug} · live v{s.live} · {s.draft.nodes.length} modules</div></Link>)}</div>
        <form className="card p-4 grid sm:grid-cols-4 gap-3" onSubmit={(e) => { e.preventDefault(); const r = attempt(() => apiSync('POST', '/api/sites', f), 'Site created'); if (r) nav(`/builder/${r.slug}`); }}>
          <div><label className="lbl">New site name</label><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div><label className="lbl">Slug</label><input className="input" value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value })} /></div>
          <div><label className="lbl">Start from</label><select className="input" value={f.preset} onChange={(e) => setF({ ...f, preset: e.target.value })}>{Object.keys(PRESETS).map((p) => <option key={p}>{p}</option>)}</select></div>
          <div className="flex items-end"><button className="btn btn-primary">Create site</button></div>
        </form>
      </div>
    </div>);
}
