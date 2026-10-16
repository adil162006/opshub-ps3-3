import { MODULES, ORDER, TYPE_LABEL, accepts } from '../lib/registry';
import { Page } from '../ui';

const API = [['POST', '/api/auth/login', 'Public'], ['GET', '/api/auth/me', 'Member'], ['GET', '/api/sites', 'Member'], ['POST', '/api/sites', 'Admin'], ['GET', '/api/sites/:siteId', 'Member (Admin sees drafts/versions)'], ['PUT', '/api/sites/:siteId/draft', 'Admin'], ['POST', '/api/sites/:siteId/publish', 'Admin'], ['POST', '/api/sites/:siteId/rollback', 'Admin'],
  ['GET|POST', '/api/:siteId/inventory', 'Member / Manager'], ['PUT|DELETE', '/api/:siteId/inventory/:id', 'Manager / Admin'], ['GET|POST', '/api/:siteId/requests', 'Member'], ['POST', '/api/:siteId/approvals', 'Manager+ (per chain step)'], ['POST', '/api/:siteId/assignments', 'Manager (transactional)'], ['POST', '/api/:siteId/consumption', 'Member'], ['POST', '/api/:siteId/returns', 'Member'], ['POST|PUT', '/api/:siteId/repairs', 'Manager'],
  ['GET', '/api/:siteId/export/:resource', 'Member'], ['POST', '/api/:siteId/import/inventory', 'Manager'], ['GET|PUT', '/api/:siteId/members', 'Member / Admin'], ['GET|POST|PATCH', '/api/users', 'Admin']];
const SQL = `Canonical schema: backend/src/db/schema/*.js
Migrations: backend/drizzle/*.sql
Apply with: npm --prefix backend run db:migrate

Business tables use site-scoped columns and same-site foreign keys.
PostgreSQL row-level security is pending; API-level site checks are implemented.`;
export default function Catalogue() {
  return (
    <div className="themed min-h-[calc(100vh-48px)]" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
      <Page title="Module catalogue & architecture" sub="13 approved modules as typed nodes. Scope is frozen.">
        <div className="card p-4"><div className="lbl">Architecture</div>
          <div className="flex items-stretch gap-2 flex-wrap text-sm mt-2">{[['Hub', 'JWT login Â· site switcher Â· users Â· catalogue'], ['Builder', 'React Flow canvas Â· typed nodes Â· presets Â· publish / rollback'], ['Renderer + API', 'HTTP API for UUID-backed sites; browser demo for sample data'], ['PostgreSQL', 'site-scoped schema; same-site references; RLS pending']].map(([t, d], i, a) => (
            <div key={t} className="flex items-center gap-2">              <div className="border rounded-xl p-3 w-52" style={{ background: 'var(--secondary)', borderColor: 'var(--border)' }}><b>{t}</b><div className="text-xs muted">{d}</div></div>{i < a.length - 1 && <span className="text-xl">â†’</span>}</div>))}</div>
          <p className="text-xs muted mt-3">UUID-backed sites use the Express API; non-UUID demo sites use browser-local storage.</p></div>
        <div className="card overflow-x-auto"><table className="t"><thead><tr><th>Module</th><th>Group</th><th>Accepts (in)</th><th>Provides (out)</th><th>Resources</th><th>Builder node</th></tr></thead><tbody>
          {ORDER.map((t) => <tr key={t}><td><b>{MODULES[t].icon} {MODULES[t].name}</b><div className="text-xs muted">{MODULES[t].desc}</div></td><td>{MODULES[t].group}</td><td className="text-xs">{accepts(t).map((x) => TYPE_LABEL[x]).join(', ') || 'â€”'}</td><td className="text-xs">{MODULES[t].outputs.map((x) => TYPE_LABEL[x]).join(', ') || 'â€”'}</td><td className="text-xs">{MODULES[t].resources.join(', ') || 'â€”'}</td><td className="font-mono text-xs">{t}</td></tr>)}</tbody></table></div>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="card overflow-x-auto"><table className="t"><thead><tr><th>Method</th><th>Endpoint</th><th>Min role</th></tr></thead><tbody>{API.map(([m, p, r]) => <tr key={p + m}><td className="font-mono text-xs">{m}</td><td className="font-mono text-xs">{p}</td><td className="text-xs">{r}</td></tr>)}</tbody></table></div>
          <div className="card p-4"><div className="lbl">PostgreSQL schema</div><pre className="text-[11px] overflow-auto">{SQL}</pre></div>
        </div>
      </Page>
    </div>);
}
