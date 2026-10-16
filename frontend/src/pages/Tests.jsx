import { useState } from 'react';
import { Page } from '../ui';
import { runIsolationTests } from '../lib/isolation';

export default function Tests() {
  const [res, setRes] = useState(null);
  const pass = res?.filter((r) => r.ok).length;
  return (
    <div className="themed min-h-[calc(100vh-48px)]" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
      <Page title="site_id isolation & RBAC tests" sub="Exercises the browser-local simulated API only; it does not connect to PostgreSQL or verify database isolation â€” your data is untouched. Also available as `npm run test:isolation`."
        actions={<button className="btn btn-primary" onClick={() => setRes(runIsolationTests())}>â–¶ Run all tests</button>}>
        {res && <div className={`card p-3 font-semibold ${pass === res.length ? 'text-green-700' : 'text-red-700'}`}>{pass}/{res.length} passed</div>}
        {res && <div className="card overflow-x-auto"><table className="t"><thead><tr><th></th><th>Group</th><th>Test</th><th>Detail</th></tr></thead><tbody>{res.map((r, i) => <tr key={i}><td>{r.ok ? 'âœ…' : 'âŒ'}</td><td className="text-xs">{r.group}</td><td className="text-xs">{r.name}</td><td className="text-xs muted">{r.ok ? '' : r.detail}</td></tr>)}</tbody></table></div>}
      </Page>
    </div>);
}
