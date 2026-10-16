import { useState } from 'react';
import { Page } from '../ui';
import { runIsolationTests } from '../lib/isolation';

export default function Tests() {
  const [res, setRes] = useState(null);
  const pass = res?.filter((r) => r.ok).length;
  return (
    <div className="themed min-h-[calc(100vh-48px)]" style={{ background: '#f6f7fb', color: '#0f172a' }}>
      <Page title="site_id isolation & RBAC tests" sub="Runs against a sandbox copy of the database — your data is untouched. Also available as `npm run test:isolation`."
        actions={<button className="btn btn-primary" onClick={() => setRes(runIsolationTests())}>▶ Run all tests</button>}>
        {res && <div className={`card p-3 font-semibold ${pass === res.length ? 'text-green-700' : 'text-red-700'}`}>{pass}/{res.length} passed</div>}
        {res && <div className="card overflow-x-auto"><table className="t"><thead><tr><th></th><th>Group</th><th>Test</th><th>Detail</th></tr></thead><tbody>{res.map((r, i) => <tr key={i}><td>{r.ok ? '✅' : '❌'}</td><td className="text-xs">{r.group}</td><td className="text-xs">{r.name}</td><td className="text-xs muted">{r.ok ? '' : r.detail}</td></tr>)}</tbody></table></div>}
      </Page>
    </div>);
}
