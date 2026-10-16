import { Link, useParams } from 'react-router-dom';
import { apiSync } from '../lib/api';
import { useDB } from '../lib/db';
import { connectionType, DEFAULT_THEME, defaultConfig, itemRequestFields, MODULES, repairRequestFields } from '../lib/registry';
import { attempt } from '../ui';

const FEATURES = [
  { key: 'inventory', label: 'Inventory', modules: ['inventory'] },
  { key: 'repairs', label: 'Repairs', modules: ['request', 'approval', 'repair'] },
  { key: 'distribution', label: 'Material distribution', modules: ['inventory', 'request', 'approval', 'assignment', 'assignmentUi', 'consumption'] },
];
const FEATURE_BY_SITE = { 'central-stores': 'inventory', 'service-centre': 'repairs', distribution: 'distribution' };
const REQUIRED_EDGES = [
  ['auth', 'shell'], ['shell', 'inventory'], ['shell', 'request'], ['inventory', 'request'],
  ['request', 'approval'], ['approval', 'repair'], ['approval', 'assignment'],
  ['inventory', 'assignment'], ['assignment', 'assignmentUi'], ['assignment', 'consumption'],
];
const makeNode = (type, index) => ({
  id: `${type}-1`, type: 'module', position: { x: 80 + (index % 3) * 260, y: 80 + Math.floor(index / 3) * 150 },
  data: { type, label: MODULES[type].name, config: defaultConfig(type) },
});

function createDraft(site, enabled, theme) {
  const required = new Set(['auth', 'shell']);
  FEATURES.filter((f) => enabled[f.key]).forEach((f) => f.modules.forEach((type) => required.add(type)));
  const existing = new Map(site.draft.nodes.map((n) => [n.data.type, n]));
  const nodes = [...required].map((type, i) => {
    const prior = existing.get(type);
    if (prior) return prior;
    const node = makeNode(type, i);
    if (type === 'request') {
      node.data.config.fields = enabled.distribution ? itemRequestFields() : repairRequestFields();
    }
    return node;
  });
  const nodeByType = new Map(nodes.map((node) => [node.data.type, node]));
  const edges = REQUIRED_EDGES.flatMap(([source, target]) => {
    if (!nodeByType.has(source) || !nodeByType.has(target)) return [];
    const type = connectionType(source, target);
    if (!type) return [];
    return [{
      id: `e-${source}-1-${target}-1`, source: `${source}-1`, target: `${target}-1`,
      label: type === 'layout' ? 'Layout' : type[0].toUpperCase() + type.slice(1), animated: true,
    }];
  });
  return { nodes, edges, theme: { ...DEFAULT_THEME, ...theme } };
}

export function FocusedBuilderIndex() {
  const sites = useDB((s) => s.sites);
  return (
    <main className="themed min-h-[calc(100vh-48px)] p-6" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
      <div className="max-w-4xl mx-auto space-y-4">
        <div><h1 className="text-xl font-semibold">OpsHub Builder</h1><p className="text-sm muted">Choose a site to enable or disable its module and update its theme.</p></div>
        <div className="grid md:grid-cols-3 gap-3">{sites.map((site) => (
          <Link key={site.id} to={`/builder/${site.slug}`} className="card p-4 hover:shadow">
            <div className="font-semibold">{site.name}</div>
            <div className="text-sm muted mt-1">Configure modules and theme</div>
          </Link>))}</div>
      </div>
    </main>);
}

export function FocusedBuilder() {
  const { slug } = useParams();
  const site = useDB((s) => s.sites.find((entry) => entry.slug === slug));
  if (!site) return <main className="p-10">Site not found.</main>;

  const types = new Set(site.draft.nodes.map((node) => node.data.type));
  const enabled = {
    inventory: FEATURE_BY_SITE[slug] === 'inventory' && types.has('inventory'),
    repairs: FEATURE_BY_SITE[slug] === 'repairs' && types.has('request') && types.has('approval') && types.has('repair'),
    distribution: FEATURE_BY_SITE[slug] === 'distribution' && types.has('assignment') && types.has('consumption'),
  };
  const siteFeatures = FEATURES.filter((feature) => feature.key === FEATURE_BY_SITE[slug]);
  const theme = { ...DEFAULT_THEME, ...site.draft.theme };
  const publish = () => attempt(() => {
    const draft = createDraft(site, enabled, theme);
    apiSync('PUT', `/api/sites/${site.id}/draft`, { draft });
    apiSync('POST', `/api/sites/${site.id}/publish`, { note: 'Updated modules or theme' });
    return true;
  }, 'Changes published');
  const updateTheme = (key, value) => {
    const draft = { ...site.draft, theme: { ...theme, [key]: value } };
    attempt(() => apiSync('PUT', `/api/sites/${site.id}/draft`, { draft }), 'Theme saved as draft');
  };
  const toggleFeature = (feature, checked) => {
    const next = { ...enabled, [feature]: checked };
    const draft = createDraft(site, next, theme);
    attempt(() => apiSync('PUT', `/api/sites/${site.id}/draft`, { draft }), `${siteFeatures.find((entry) => entry.key === feature).label} draft updated`);
  };

  return (
    <main className="themed min-h-[calc(100vh-48px)] p-6" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div><h1 className="text-xl font-semibold">{site.name} Builder</h1><p className="text-sm muted">Enable modules and adjust the site theme.</p></div>
          <div className="flex gap-2"><Link className="btn" to={`/s/${site.slug}`}>Open site</Link><button className="btn btn-primary" onClick={publish}>Publish changes</button></div>
        </div>
        <section className="card p-4 space-y-3">
          <h2 className="font-semibold">Modules</h2>
          {siteFeatures.map((feature) => <label key={feature.key} className="flex items-center justify-between gap-3 border rounded-lg p-3">
            <span><span className="font-medium">{feature.label}</span><span className="block text-xs muted">Enables the related site workflow</span></span>
            <input type="checkbox" checked={enabled[feature.key]} onChange={(e) => toggleFeature(feature.key, e.target.checked)} aria-label={`Enable ${feature.label}`} />
          </label>)}
        </section>
        <section className="card p-4 space-y-3">
          <h2 className="font-semibold">Theme</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <label><span className="lbl">Primary color</span><input className="input h-10 p-1" type="color" value={theme.primary} onChange={(e) => updateTheme('primary', e.target.value)} /></label>
            <label><span className="lbl">Accent color</span><input className="input h-10 p-1" type="color" value={theme.accent} onChange={(e) => updateTheme('accent', e.target.value)} /></label>
            <label><span className="lbl">Mode</span><select className="input" value={theme.mode} onChange={(e) => updateTheme('mode', e.target.value)}><option value="light">Light</option><option value="dark">Dark</option></select></label>
            <label><span className="lbl">Layout</span><select className="input" value={theme.layout} onChange={(e) => updateTheme('layout', e.target.value)}><option value="sidebar">Sidebar</option><option value="topbar">Top bar</option></select></label>
          </div>
        </section>
        <p className="text-xs muted">Module and theme edits are saved as drafts. Publish changes to apply them to the live site.</p>
      </div>
    </main>);
}
