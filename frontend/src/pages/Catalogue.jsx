import { MODULES, ORDER, TYPE_LABEL, accepts } from '../lib/registry';
import { Page } from '../ui';

const API = [['POST', '/api/auth/login', 'Public'], ['GET', '/api/auth/me', 'Member'], ['GET', '/api/sites', 'Member'], ['POST', '/api/sites', 'Admin'], ['GET', '/api/sites/:siteId', 'Member (Admin sees drafts/versions)'], ['PUT', '/api/sites/:siteId/draft', 'Admin'], ['POST', '/api/sites/:siteId/publish', 'Admin'], ['POST', '/api/sites/:siteId/rollback', 'Admin'],
['GET|POST', '/api/:siteId/inventory', 'Member / Manager'], ['PUT|DELETE', '/api/:siteId/inventory/:id', 'Manager / Admin'], ['GET|POST', '/api/:siteId/requests', 'Member'], ['POST', '/api/:siteId/approvals', 'Manager+ (per chain step)'], ['POST', '/api/:siteId/assignments', 'Manager (transactional)'], ['POST', '/api/:siteId/consumption', 'Member'], ['POST', '/api/:siteId/returns', 'Member'], ['POST|PUT', '/api/:siteId/repairs', 'Manager'],
['GET', '/api/:siteId/export/:resource', 'Member'], ['POST', '/api/:siteId/import/inventory', 'Manager'], ['GET|PUT', '/api/:siteId/members', 'Member / Admin'], ['GET|POST|PATCH', '/api/users', 'Admin']];
const SQL = `-- every business table carries site_id; RLS enforces it in PostgreSQL
CREATE TABLE sites (id text PRIMARY KEY, slug text UNIQUE NOT NULL, name text NOT NULL,
  draft jsonb NOT NULL, live_version int);
CREATE TABLE site_versions (site_id text REFERENCES sites, v int, config jsonb NOT NULL,
  note text, created_by uuid, created_at timestamptz DEFAULT now(), PRIMARY KEY (site_id, v));
CREATE TABLE users (id uuid PRIMARY KEY, email text UNIQUE, password_hash text, global_role text);
CREATE TABLE site_members (site_id text REFERENCES sites, user_id uuid REFERENCES users,
  role text CHECK (role IN ('Member','Manager','Admin')), PRIMARY KEY (site_id, user_id));
CREATE TABLE inventory (id uuid PRIMARY KEY, site_id text NOT NULL REFERENCES sites,
  data jsonb NOT NULL, qty numeric NOT NULL CHECK (qty >= 0), UNIQUE (site_id, id));
CREATE TABLE requests (id uuid PRIMARY KEY, site_id text NOT NULL REFERENCES sites,
  item_id uuid, status text, step int, data jsonb,
  FOREIGN KEY (site_id, item_id) REFERENCES inventory (site_id, id));  -- same-site refs only
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY site_isolation ON inventory
  USING (site_id = current_setting('app.site_id'));  -- SET LOCAL per request`;
export default function Catalogue() {
  return (
    <div className="themed min-h-[calc(100vh-48px)]" style={{ background: '#f6f7fb', color: '#0f172a' }}>
      <Page title="Module catalogue & architecture" sub="13 approved modules as typed nodes. Scope is frozen.">
        <div className="card p-4"><div className="lbl">Architecture</div>
          <div className="flex items-stretch gap-2 flex-wrap text-sm mt-2">{[['Hub', 'JWT login · site switcher · users · catalogue'], ['Builder', 'React Flow canvas · typed nodes · presets · publish / rollback'], ['Renderer + API', '/api/:siteId/:resource · RBAC · site_id scope · transactions'], ['PostgreSQL', 'site_id on every table · RLS · JSONB site config']].map(([t, d], i, a) => (
            <div key={t} className="flex items-center gap-2"><div className="border rounded-xl p-3 w-52 bg-slate-50"><b>{t}</b><div className="text-xs muted">{d}</div></div>{i < a.length - 1 && <span className="text-xl">→</span>}</div>))}</div>
          <p className="text-xs muted mt-3">This prototype runs the API layer in-browser (localStorage) behind the same REST contract; the schema below is the PostgreSQL target.</p></div>
        <div className="card overflow-x-auto"><table className="t"><thead><tr><th>Module</th><th>Group</th><th>Accepts (in)</th><th>Provides (out)</th><th>Resources</th><th>Builder node</th></tr></thead><tbody>
          {ORDER.map((t) => <tr key={t}><td><b>{MODULES[t].icon} {MODULES[t].name}</b><div className="text-xs muted">{MODULES[t].desc}</div></td><td>{MODULES[t].group}</td><td className="text-xs">{accepts(t).map((x) => TYPE_LABEL[x]).join(', ') || '—'}</td><td className="text-xs">{MODULES[t].outputs.map((x) => TYPE_LABEL[x]).join(', ') || '—'}</td><td className="text-xs">{MODULES[t].resources.join(', ') || '—'}</td><td className="font-mono text-xs">{t}</td></tr>)}</tbody></table></div>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="card overflow-x-auto"><table className="t"><thead><tr><th>Method</th><th>Endpoint</th><th>Min role</th></tr></thead><tbody>{API.map(([m, p, r]) => <tr key={p + m}><td className="font-mono text-xs">{m}</td><td className="font-mono text-xs">{p}</td><td className="text-xs">{r}</td></tr>)}</tbody></table></div>
          <div className="card p-4"><div className="lbl">Data model (PostgreSQL)</div><pre className="text-[11px] overflow-auto">{SQL}</pre></div>
        </div>
      </Page>
    </div>);
}
