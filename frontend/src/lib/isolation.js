// site_id isolation + RBAC + transaction test-suite. Runs against a sandbox copy of the DB.
import { apiSync, RES } from './api';
import { dbGet, dbCommit } from './db';
import { signJwt } from './jwt';
import { hasModule, fieldsOf } from './registry';

const call = (method, url, body, token, opts = {}) => {
  try { return { ok: true, status: 200, data: apiSync(method, url, body, { token, ...opts }) }; }
  catch (e) { return { ok: false, status: e.status ?? 500, message: e.message }; }
};
const sampleBody = (fields, tag) => Object.fromEntries(fields.filter((f) => f.type !== 'calc' && f.type !== 'item').map((f) => [f.key, f.type === 'number' ? 1 : f.type === 'select' ? f.options?.[0] ?? '' : f.key === 'sku' ? `ISO-${tag}` : 'x']));

export function runIsolationTests() {
  const snap = dbGet(); dbCommit(structuredClone(snap));
  const out = [];
  const T = (group, name, fn) => {
    try { const r = fn(); out.push({ group, name, ok: r === true || r?.ok === true, detail: r?.detail ?? (r === true ? '' : String(r)) }); }
    catch (e) { out.push({ group, name, ok: false, detail: e.message }); }
  };
  try {
    // temp principals: independent of whatever users exist
    const sites = dbGet().sites.map((s) => ({ id: s.id, slug: s.slug, cfg: s.versions.find((v) => v.v === s.live) }));
    const withInv = sites.filter((s) => hasModule(s.cfg, 'inventory'));
    const A = withInv[0]; const B = withInv[1] || withInv[0];
    const d0 = structuredClone(dbGet());
    d0.users.push({ id: 'tmp_admin', name: 'Tmp Admin', email: 'tmp1', hash: '', role: 'Admin', memberships: {} },
      { id: 'tmp_mgrA', name: 'Tmp ManagerA', email: 'tmp2', hash: '', role: 'User', memberships: { [A.id]: 'Manager' } },
      { id: 'tmp_memB', name: 'Tmp MemberB', email: 'tmp3', hash: '', role: 'User', memberships: { [B.id]: 'Member' } });
    dbCommit(d0);
    const admin = signJwt({ sub: 'tmp_admin' }); const mgrA = signJwt({ sub: 'tmp_mgrA' }); const memB = signJwt({ sub: 'tmp_memB' });
    const resIn = (s) => Object.entries(RES).filter(([, d]) => hasModule(s.cfg, d.module)).map(([k]) => k);

    // 1. list isolation
    sites.forEach((s) => resIn(s).forEach((r) => T('List scoping', `GET /api/${s.slug}/${r} returns only its own rows`, () => {
      const res = call('GET', `/api/${s.id}/${r}`, null, admin);
      const expected = dbGet().rows[r].filter((x) => x.site_id === s.id).length;
      return { ok: res.ok && res.data.every((x) => x.site_id === s.id) && res.data.length === expected, detail: res.message || `${res.data?.length} rows vs ${expected}` };
    })));

    // 2. cross-site by id
    sites.forEach((X) => sites.filter((Y) => Y.id !== X.id).forEach((Y) => resIn(Y).forEach((r) => {
      const foreign = dbGet().rows[r].find((x) => x.site_id === X.id); if (!foreign) return;
      ['GET', 'PUT', 'DELETE'].forEach((m) => T('Cross-site by id', `${m} ${X.slug} row via /${Y.slug}/${r}/:id → denied`, () => {
        const res = call(m, `/api/${Y.id}/${r}/${foreign.id}`, m === 'PUT' ? {} : null, admin);
        const immutable = m !== 'GET' && RES[r][m === 'PUT' ? 'update' : 'delete'] > 3;
        return { ok: !res.ok && (res.status === 404 || (immutable && res.status === 403)), detail: `got ${res.status}` };
      }));
    })));

    // 3. forged site_id
    T('Write scoping', 'Forged site_id/id in POST body is ignored', () => {
      const body = { ...sampleBody(fieldsOf(A.cfg, 'inventory'), 'FORGE'), site_id: B.id, id: 'inv_hack' };
      const res = call('POST', `/api/${A.id}/inventory`, body, admin);
      return { ok: res.ok && res.data.site_id === A.id && res.data.id !== 'inv_hack', detail: res.message || res.data?.site_id };
    });
    T('Write scoping', 'Calculated field is server-computed (TOTAL = QTY × PRICE)', () => {
      const res = call('POST', `/api/${A.id}/inventory`, { ...sampleBody(fieldsOf(A.cfg, 'inventory'), 'CALC'), qty: 7, price: 3, total: 999 }, admin);
      return { ok: res.ok && res.data.total === 21, detail: res.message || `total=${res.data?.total}` };
    });
    T('Write scoping', 'Schema validation rejects bad number / missing required', () => {
      const res = call('POST', `/api/${A.id}/inventory`, { sku: 'BAD', qty: 'abc' }, admin);
      return { ok: !res.ok && res.status === 422, detail: `got ${res.status}` };
    });

    // 4. reference isolation
    const reqSite = sites.find((s) => hasModule(s.cfg, 'request') && fieldsOf(s.cfg, 'request').some((f) => f.type === 'item'));
    if (reqSite) {
      const key = fieldsOf(reqSite.cfg, 'request').find((f) => f.type === 'item').key;
      const foreignItem = dbGet().rows.inventory.find((i) => i.site_id !== reqSite.id);
      if (foreignItem) T('Reference scoping', 'Request referencing another site’s inventory item → 422', () => {
        const res = call('POST', `/api/${reqSite.id}/requests`, { ...sampleBody(fieldsOf(reqSite.cfg, 'request'), 'R'), [key]: foreignItem.id, qty: 1 }, admin);
        return { ok: !res.ok && res.status === 422, detail: `got ${res.status}` };
      });
      const foreignReq = dbGet().rows.requests.find((r) => r.site_id !== reqSite.id);
      if (foreignReq && hasModule(reqSite.cfg, 'assignment')) T('Reference scoping', 'Assigning another site’s request → 404', () => {
        const res = call('POST', `/api/${reqSite.id}/assignments`, { requestId: foreignReq.id }, admin);
        return { ok: !res.ok && res.status === 404, detail: `got ${res.status}` };
      });
    }

    // 5. authN / authZ
    T('Auth & RBAC', 'No token → 401', () => ({ ok: call('GET', `/api/${A.id}/inventory`, null, null).status === 401 }));
    T('Auth & RBAC', 'Tampered token → 401', () => ({ ok: call('GET', `/api/${A.id}/inventory`, null, admin + 'x').status === 401 }));
    T('Auth & RBAC', 'Non-member cannot read another site → 403', () => ({ ok: call('GET', `/api/${B.id}/inventory`, null, mgrA).status === (A.id === B.id ? 200 : 403) }));
    T('Auth & RBAC', 'Member cannot create inventory → 403', () => ({ ok: call('POST', `/api/${B.id}/inventory`, sampleBody(fieldsOf(B.cfg, 'inventory'), 'M'), memB).status === 403 }));
    T('Auth & RBAC', 'Manager cannot delete (Admin only) → 403', () => {
      const row = dbGet().rows.inventory.find((r) => r.site_id === A.id);
      return { ok: call('DELETE', `/api/${A.id}/inventory/${row.id}`, null, mgrA).status === 403 };
    });
    T('Auth & RBAC', 'Manager cannot open Preview or edit site → 403', () => ({ ok: call('GET', `/api/${A.id}/inventory`, null, mgrA, { preview: true }).status === 403 && call('PUT', `/api/sites/${A.id}/draft`, { draft: { nodes: [] } }, mgrA).status === 403 }));
    T('Auth & RBAC', 'Non-admin cannot list users → 403', () => ({ ok: call('GET', '/api/users', null, mgrA).status === 403 }));
    const lacking = sites.find((s) => !hasModule(s.cfg, 'repair'));
    if (lacking) T('Modules', 'Disabled module endpoint → 404 (no restart needed to enable)', () => ({ ok: call('GET', `/api/${lacking.id}/repairs`, null, admin).status === 404 }));

    // 6. transactions
    const asg = sites.find((s) => hasModule(s.cfg, 'assignment'));
    if (asg) {
      const key = fieldsOf(asg.cfg, 'request').find((f) => f.type === 'item')?.key;
      const item = dbGet().rows.inventory.find((i) => i.site_id === asg.id);
      const mkReq = (qty) => { const d = structuredClone(dbGet()); const id = `req_tx${++d.seq}`; d.rows.requests.push({ id, site_id: asg.id, requestNo: 'REQ-TX', [key]: item.id, qty, status: 'approved', step: 9, createdAt: '' }); dbCommit(d); return id; };
      T('Transactions', 'Crash mid-assignment rolls back stock + request + assignment', () => {
        const id = mkReq(1); const before = dbGet().rows.inventory.find((i) => i.id === item.id).qty; const n = dbGet().rows.assignments.length;
        const res = call('POST', `/api/${asg.id}/assignments`, { requestId: id, _simulateCrash: true }, admin);
        const after = dbGet().rows.inventory.find((i) => i.id === item.id).qty;
        return { ok: !res.ok && before === after && dbGet().rows.assignments.length === n && dbGet().rows.requests.find((r) => r.id === id).status === 'approved', detail: `stock ${before}→${after}` };
      });
      T('Transactions', 'Insufficient stock → 409, nothing written', () => {
        const id = mkReq(10 ** 6); const before = dbGet().rows.inventory.find((i) => i.id === item.id).qty;
        const res = call('POST', `/api/${asg.id}/assignments`, { requestId: id }, admin);
        return { ok: res.status === 409 && dbGet().rows.inventory.find((i) => i.id === item.id).qty === before, detail: `got ${res.status}` };
      });
      T('Transactions', 'Successful assignment decrements stock exactly once', () => {
        const id = mkReq(2); const before = dbGet().rows.inventory.find((i) => i.id === item.id).qty;
        const res = call('POST', `/api/${asg.id}/assignments`, { requestId: id }, admin);
        const dup = call('POST', `/api/${asg.id}/assignments`, { requestId: id }, admin);
        return { ok: res.ok && dbGet().rows.inventory.find((i) => i.id === item.id).qty === before - 2 && dup.status === 409, detail: res.message };
      });
    }

    // 7. Excel
    T('Excel', 'Export is scoped to the site', () => {
      const res = call('GET', `/api/${A.id}/export/inventory`, null, mgrA);
      return { ok: res.ok && res.data.rows.length === dbGet().rows.inventory.filter((r) => r.site_id === A.id).length, detail: res.message };
    });
    T('Excel', 'Member may export (own site)', () => ({ ok: call('GET', `/api/${B.id}/export/inventory`, null, memB).ok }));
    T('Excel', 'Member import → 403', () => ({ ok: call('POST', `/api/${B.id}/import/inventory`, { rows: [] }, memB).status === 403 }));
    T('Excel', 'Export of another site → 403', () => ({ ok: A.id === B.id || call('GET', `/api/${B.id}/export/inventory`, null, mgrA).status === 403 }));
    T('Excel', 'Import is atomic (one bad row → zero rows written)', () => {
      const n = dbGet().rows.inventory.length;
      const good = { ...sampleBody(fieldsOf(A.cfg, 'inventory'), 'IMP1') }; const bad = { sku: 'IMP2', qty: 'oops' };
      const res = call('POST', `/api/${A.id}/import/inventory`, { rows: [good, bad] }, mgrA);
      return { ok: res.status === 422 && dbGet().rows.inventory.length === n, detail: `got ${res.status}` };
    });
    T('Excel', 'Import upserts by SKU for Manager', () => {
      const ex = dbGet().rows.inventory.find((r) => r.site_id === A.id);
      const res = call('POST', `/api/${A.id}/import/inventory`, { rows: [{ ...ex, qty: 5 }, sampleBody(fieldsOf(A.cfg, 'inventory'), 'IMP3')] }, mgrA);
      return { ok: res.ok && res.data.updated === 1 && res.data.created === 1, detail: res.message };
    });
  } finally { dbCommit(snap); }
  return out;
}
