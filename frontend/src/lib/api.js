// Simulated REST backend: /api/:siteId/:resource — JWT, RBAC, site_id scoping, transactions.
// Same contract as the Express + PostgreSQL build (see docs/schema.sql).
import bcrypt from 'bcryptjs';
import { dbGet, dbCommit } from './db';
import { useSession } from './session';
import { signJwt, verifyJwt } from './jwt';
import { MODULES, RANK, STAGES, PRESETS, DEFAULT_THEME, hasModule, fieldsOf, stepsOf, itemKey, evalFormula, validateConfig } from './registry';

export class HttpError extends Error { constructor(status, message, details) { super(message); this.status = status; this.details = details; } }
const fail = (s, m, d) => { throw new HttpError(s, m, d); };
const now = () => new Date().toISOString();
const clone = (o) => structuredClone(o);
const roleName = (n) => Object.keys(RANK).find((k) => RANK[k] === n);

export const RES = {
  inventory: { module: 'inventory', prefix: 'inv', read: 1, create: 2, update: 2, delete: 3 },
  requests: { module: 'request', prefix: 'req', read: 1, create: 1, update: 2, delete: 3 },
  approvals: { module: 'approval', prefix: 'app', read: 1, create: 2, update: 9, delete: 9 },
  assignments: { module: 'assignment', prefix: 'ass', read: 1, create: 2, update: 9, delete: 9 },
  consumption: { module: 'consumption', prefix: 'con', read: 1, create: 1, update: 9, delete: 9 },
  returns: { module: 'returns', prefix: 'ret', read: 1, create: 1, update: 9, delete: 9 },
  repairs: { module: 'repair', prefix: 'rep', read: 1, create: 2, update: 2, delete: 3 },
};
export const EXCEL = { export: 1, import: 2 };

const pub = ({ hash, ...u }) => u;
const siteRole = (u, siteId) => (u.role === 'Admin' ? 'Admin' : u.memberships?.[siteId] || null);
const liveCfg = (site) => site.versions.find((v) => v.v === site.live);

function authenticate(opts) {
  const token = opts.token ?? useSession.getState().token;
  if (!token) fail(401, 'Authentication required');
  const p = verifyJwt(token); if (!p) fail(401, 'Invalid or expired token');
  const user = dbGet().users.find((u) => u.id === p.sub); if (!user) fail(401, 'Unknown user');
  return user;
}
function scope(user, siteId, opts, min = 1) {
  const site = dbGet().sites.find((s) => s.id === siteId); if (!site) fail(404, 'Site not found');
  const role = siteRole(user, siteId); if (!role) fail(403, 'You do not have access to this site');
  if (RANK[role] < min) fail(403, `Requires ${roleName(min)} role (you are ${role})`);
  if (opts.preview && role !== 'Admin') fail(403, 'Preview is Admin only');
  return { site, role, config: opts.preview ? site.draft : liveCfg(site) };
}

// ---- transaction: operate on a clone, commit only on success ----
const tx = (fn) => { const d = clone(dbGet()); const out = fn(d); dbCommit(d); return out; };
const rowsOf = (d, t, siteId) => d.rows[t].filter((r) => r.site_id === siteId);
const getRow = (d, t, siteId, id) => d.rows[t].find((r) => r.id === id && r.site_id === siteId) || fail(404, `${t} "${id}" not found`);
const insert = (d, t, siteId, data) => { const row = { ...data, id: `${RES[t].prefix}_${++d.seq}`, site_id: siteId, createdAt: now() }; d.rows[t].push(row); return row; };
const nextNo = (d, siteId) => `REQ-${String(rowsOf(d, 'requests', siteId).length + 1).padStart(3, '0')}`;
const label = (r) => r.name || r.sku || r.id;
const recalc = (fields, row) => { fields.filter((f) => f.type === 'calc').forEach((f) => { row[f.key] = evalFormula(f.formula, row); }); return row; };

function cleanRow(fields, body, d, siteId) {
  const out = {}; const errors = [];
  for (const f of fields) {
    if (f.type === 'calc') continue;
    let v = body[f.key];
    if (v === undefined || v === null || v === '') { if (f.required) errors.push(`${f.label} is required`); out[f.key] = f.type === 'number' ? 0 : ''; continue; }
    if (f.type === 'number') { v = Number(v); if (!Number.isFinite(v)) { errors.push(`${f.label} must be a number`); continue; } if (v < 0) errors.push(`${f.label} cannot be negative`); }
    if (f.type === 'select' && f.options?.length && !f.options.includes(v)) errors.push(`${f.label}: invalid option`);
    if (f.type === 'item' && !d.rows.inventory.some((r) => r.id === v && r.site_id === siteId)) errors.push(`${f.label}: unknown item for this site`);
    out[f.key] = v;
  }
  if (errors.length) fail(422, 'Validation failed', errors);
  return recalc(fields, out);
}

// ---- resource handlers ----
const CREATE = {
  inventory: (d, c) => {
    const data = cleanRow(fieldsOf(c.config, 'inventory'), c.body, d, c.siteId);
    if (data.sku !== undefined && rowsOf(d, 'inventory', c.siteId).some((r) => r.sku === data.sku)) fail(409, `SKU ${data.sku} already exists`);
    return insert(d, 'inventory', c.siteId, data);
  },
  requests: (d, c) => {
    const data = cleanRow(fieldsOf(c.config, 'request'), c.body, d, c.siteId);
    return insert(d, 'requests', c.siteId, { ...data, requestNo: nextNo(d, c.siteId), status: hasModule(c.config, 'approval') ? 'pending' : 'open', step: 0, requestedBy: c.user.name });
  },
  approvals: (d, c) => {
    const req = getRow(d, 'requests', c.siteId, c.body.requestId);
    if (req.status !== 'pending') fail(409, `${req.requestNo} is ${req.status}, not pending`);
    const steps = stepsOf(c.config); const need = steps[req.step];
    if (RANK[c.role] < RANK[need]) fail(403, `Step ${req.step + 1} needs ${need} (you are ${c.role})`);
    if (!['approve', 'reject'].includes(c.body.decision)) fail(422, 'decision must be approve or reject');
    const a = insert(d, 'approvals', c.siteId, { requestId: req.id, requestNo: req.requestNo, step: req.step, role: need, decision: c.body.decision, comment: String(c.body.comment || ''), by: c.user.name, at: now() });
    if (c.body.decision === 'reject') req.status = 'rejected';
    else { req.step += 1; if (req.step >= steps.length) req.status = 'approved'; }
    return a;
  },
  assignments: (d, c) => {
    const req = getRow(d, 'requests', c.siteId, c.body.requestId);
    if (!['approved', 'open'].includes(req.status)) fail(409, `${req.requestNo} is ${req.status}; must be approved`);
    const key = itemKey(c.config); if (!key) fail(422, 'Request form has no inventory item field');
    const item = getRow(d, 'inventory', c.siteId, req[key]);
    const qty = Number(c.body.qty ?? req.qty);
    if (!Number.isFinite(qty) || qty <= 0) fail(422, 'Quantity must be positive');
    if (qty > item.qty) fail(409, `Insufficient stock for ${label(item)}: need ${qty}, have ${item.qty}`);
    item.qty -= qty; recalc(fieldsOf(c.config, 'inventory'), item);
    if (c.body._simulateCrash && c.role === 'Admin') fail(500, 'Simulated crash after stock decrement — transaction rolled back');
    const a = insert(d, 'assignments', c.siteId, { requestId: req.id, requestNo: req.requestNo, itemId: item.id, itemName: label(item), qty, remaining: qty, assignee: String(c.body.assignee || req.team || 'Unassigned'), status: 'issued', issuedBy: c.user.name });
    req.status = 'assigned';
    return a;
  },
  consumption: (d, c) => {
    const a = getRow(d, 'assignments', c.siteId, c.body.assignmentId); const qty = Number(c.body.qty);
    if (!Number.isFinite(qty) || qty <= 0) fail(422, 'Quantity must be positive');
    if (qty > a.remaining) fail(409, `Only ${a.remaining} remaining on this assignment`);
    a.remaining -= qty; a.status = a.remaining === 0 ? 'consumed' : 'in-use';
    return insert(d, 'consumption', c.siteId, { assignmentId: a.id, itemName: a.itemName, qty, note: String(c.body.note || ''), date: c.body.date || now().slice(0, 10), by: c.user.name });
  },
  returns: (d, c) => {
    const b = c.body;
    if (b.source === 'assignment') {
      if (!hasModule(c.config, 'assignment')) fail(404, 'Assignment module not enabled');
      const a = getRow(d, 'assignments', c.siteId, b.refId); const qty = Number(b.qty);
      if (!Number.isFinite(qty) || qty <= 0) fail(422, 'Quantity must be positive');
      if (qty > a.remaining) fail(409, `Only ${a.remaining} left to return`);
      a.remaining -= qty; if (a.remaining === 0) a.status = 'closed';
      if (b.condition !== 'damaged') { const it = getRow(d, 'inventory', c.siteId, a.itemId); it.qty += qty; recalc(fieldsOf(c.config, 'inventory'), it); }
      return insert(d, 'returns', c.siteId, { source: 'assignment', refId: a.id, refLabel: `${a.requestNo} · ${a.itemName}`, qty, condition: b.condition === 'damaged' ? 'damaged' : 'good', reason: String(b.reason || ''), resolution: b.condition === 'damaged' ? 'write-off' : 'restocked', by: c.user.name });
    }
    if (b.source === 'repair') {
      if (!hasModule(c.config, 'repair')) fail(404, 'Repair module not enabled');
      const r = getRow(d, 'repairs', c.siteId, b.refId);
      if (r.status !== 'completed') fail(409, 'Only completed repairs can be returned');
      if (!['refund', 'redo', 'replace'].includes(b.resolution)) fail(422, 'resolution must be refund, redo or replace');
      r.returned = true;
      if (b.resolution === 'redo') { r.status = 'repairing'; r.returned = false; const q = d.rows.requests.find((x) => x.id === r.requestId && x.site_id === c.siteId); if (q) q.status = 'in-repair'; }
      return insert(d, 'returns', c.siteId, { source: 'repair', refId: r.id, refLabel: `${r.requestNo} · ${r.device || ''}`, qty: 1, condition: 'good', reason: String(b.reason || ''), resolution: b.resolution, by: c.user.name });
    }
    return fail(422, 'source must be assignment or repair');
  },
  repairs: (d, c) => {
    const req = getRow(d, 'requests', c.siteId, c.body.requestId);
    if (!['approved', 'open'].includes(req.status)) fail(409, `${req.requestNo} is ${req.status}; must be approved`);
    const data = cleanRow(fieldsOf(c.config, 'repair'), c.body, d, c.siteId);
    const r = insert(d, 'repairs', c.siteId, { ...data, requestId: req.id, requestNo: req.requestNo, status: 'diagnosis', technician: c.user.name });
    req.status = 'in-repair';
    return r;
  },
};
const UPDATE = {
  inventory: (d, c, row) => Object.assign(row, cleanRow(fieldsOf(c.config, 'inventory'), { ...row, ...c.body }, d, c.siteId)),
  requests: (d, c, row) => { if (!['pending', 'open'].includes(row.status)) fail(409, 'Only pending requests can be edited'); return Object.assign(row, cleanRow(fieldsOf(c.config, 'request'), { ...row, ...c.body }, d, c.siteId)); },
  repairs: (d, c, row) => {
    if (c.body.status) {
      if (!STAGES.includes(c.body.status)) fail(422, 'Invalid stage');
      row.status = c.body.status;
      const q = d.rows.requests.find((x) => x.id === row.requestId && x.site_id === c.siteId);
      if (q) q.status = c.body.status === 'completed' ? 'closed' : 'in-repair';
    }
    return Object.assign(row, cleanRow(fieldsOf(c.config, 'repair'), { ...row, ...c.body }, d, c.siteId));
  },
};

// ---- Excel ----
const base = (keys) => keys.map((k) => ({ key: k, label: k.replace(/([A-Z])/g, ' $1').replace(/^./, (x) => x.toUpperCase()) }));
export function columnsFor(resource, cfg) {
  const fc = (t) => fieldsOf(cfg, t).map((f) => ({ key: f.key, label: f.label }));
  switch (resource) {
    case 'inventory': return fc('inventory');
    case 'requests': return [...base(['requestNo']), ...fc('request'), ...base(['status', 'requestedBy', 'createdAt'])];
    case 'approvals': return base(['requestNo', 'step', 'role', 'decision', 'comment', 'by', 'at']);
    case 'assignments': return base(['requestNo', 'itemName', 'qty', 'remaining', 'assignee', 'status', 'issuedBy', 'createdAt']);
    case 'consumption': return base(['itemName', 'qty', 'note', 'date', 'by']);
    case 'returns': return base(['source', 'refLabel', 'qty', 'condition', 'resolution', 'reason', 'by', 'createdAt']);
    case 'repairs': return [...base(['requestNo']), ...fc('repair'), ...base(['status', 'technician'])];
    default: return [];
  }
}
function exportRoute(user, siteId, resource, opts) {
  const { config, role } = scope(user, siteId, opts, EXCEL.export);
  const def = RES[resource] || fail(404, 'Unknown resource');
  if (!hasModule(config, def.module)) fail(404, `Module not enabled: ${MODULES[def.module].name}`);
  const slug = dbGet().sites.find((s) => s.id === siteId).slug;
  return { columns: columnsFor(resource, config), rows: rowsOf(dbGet(), resource, siteId).map(clone), filename: `${slug}-${resource}-${now().slice(0, 10)}.xlsx`, role };
}
function importRoute(user, siteId, resource, body, opts) {
  const { config } = scope(user, siteId, opts, EXCEL.import);
  if (resource !== 'inventory') fail(400, 'Import is supported for inventory');
  if (!hasModule(config, 'inventory')) fail(404, 'Inventory module not enabled');
  if (!Array.isArray(body.rows)) fail(422, 'rows[] required');
  return tx((d) => {
    const fields = fieldsOf(config, 'inventory'); const errors = []; let created = 0; let updated = 0;
    body.rows.forEach((r, i) => {
      try {
        const data = cleanRow(fields, r, d, siteId);
        const ex = data.sku !== undefined ? rowsOf(d, 'inventory', siteId).find((x) => x.sku === data.sku) : null;
        if (ex) { Object.assign(ex, data); updated++; } else { insert(d, 'inventory', siteId, data); created++; }
      } catch (e) { errors.push({ row: i + 2, message: e.details ? e.details.join('; ') : e.message }); }
    });
    if (errors.length) fail(422, 'Import rejected — no rows were written', errors);
    return { created, updated };
  });
}

// ---- members ----
function memberRoutes(user, siteId, method, uid, body, opts) {
  const { config, role } = scope(user, siteId, opts, 1);
  if (!hasModule(config, 'users')) fail(404, 'User Management module not enabled');
  if (method === 'GET') return dbGet().users.filter((u) => u.role === 'Admin' || u.memberships?.[siteId]).map((u) => ({ ...pub(u), siteRole: siteRole(u, siteId) }));
  if (method === 'PUT') {
    if (role !== 'Admin') fail(403, 'Requires Admin role');
    return tx((d) => { const u = d.users.find((x) => x.id === uid) || fail(404, 'User not found'); u.memberships = u.memberships || {}; if (body.role) { if (!RANK[body.role]) fail(422, 'Invalid role'); u.memberships[siteId] = body.role; } else delete u.memberships[siteId]; return pub(u); });
  }
  return fail(405, 'Method not allowed');
}

function resourceRoutes(method, siteId, resource, id, action, body, opts) {
  const user = authenticate(opts);
  if (resource === 'members') return memberRoutes(user, siteId, method, id, body, opts);
  if (resource === 'export') return exportRoute(user, siteId, id, opts);
  if (resource === 'import') return importRoute(user, siteId, id, body, opts);
  const def = RES[resource] || fail(404, 'Unknown resource');
  const { config, role } = scope(user, siteId, opts, def.read);
  if (!hasModule(config, def.module)) fail(404, `Module "${MODULES[def.module].name}" is not enabled on this site`);
  const need = (k) => { if (RANK[role] < def[k]) fail(403, `${k} on ${resource} requires ${def[k] > 3 ? 'no one (immutable)' : roleName(def[k])} (you are ${role})`); };
  const ctx = { siteId, user, role, config, body: body || {} };
  if (method === 'GET') {
    const d = dbGet();
    return id ? clone(getRow(d, resource, siteId, id)) : rowsOf(d, resource, siteId);
  }
  if (method === 'POST') { need('create'); return tx((d) => clone(CREATE[resource](d, ctx))); }
  if (method === 'PUT') { need('update'); return tx((d) => clone(UPDATE[resource](d, ctx, getRow(d, resource, siteId, id)))); }
  if (method === 'DELETE') {
    need('delete');
    return tx((d) => {
      const row = getRow(d, resource, siteId, id);
      if (resource === 'inventory' && d.rows.assignments.some((a) => a.itemId === id && a.site_id === siteId)) fail(409, 'Item is referenced by assignments');
      d.rows[resource] = d.rows[resource].filter((r) => r !== row); return { deleted: id };
    });
  }
  return fail(405, 'Method not allowed');
}

// ---- sites ----
function siteView(user, site, opts) {
  const role = siteRole(user, site.id); if (!role) fail(403, 'You do not have access to this site');
  if (opts.preview && role !== 'Admin') fail(403, 'Preview is Admin only');
  const live = liveCfg(site);
  const out = { site: { id: site.id, slug: site.slug, name: site.name, description: site.description, live: site.live }, role, config: opts.preview ? site.draft : live };
  if (role === 'Admin') Object.assign(out, { draft: site.draft, versions: site.versions, deploys: site.deploys });
  return out;
}
function siteRoutes(method, sid, action, body, opts) {
  const user = authenticate(opts); const db = dbGet();
  if (!sid) {
    if (method === 'GET') return db.sites.filter((s) => siteRole(user, s.id)).map((s) => ({ id: s.id, slug: s.slug, name: s.name, description: s.description, live: s.live, role: siteRole(user, s.id), theme: liveCfg(s).theme, moduleTypes: liveCfg(s).nodes.map((n) => n.data.type) }));
    if (method === 'POST') {
      if (user.role !== 'Admin') fail(403, 'Requires Admin role');
      const slug = String(body.slug || '').toLowerCase();
      if (!/^[a-z0-9-]{2,40}$/.test(slug)) fail(422, 'Slug must be 2–40 chars: a-z, 0-9, dash');
      if (db.sites.some((s) => s.slug === slug)) fail(409, 'Slug already in use');
      if (!body.name) fail(422, 'Name required');
      const p = (PRESETS[body.preset] || PRESETS['Inventory Starter'])(); const theme = { ...DEFAULT_THEME };
      return tx((d) => {
        const id = `site_${++d.seq}`; const cfg = { nodes: p.nodes, edges: p.edges, theme };
        d.sites.push({ id, slug, name: body.name, description: body.description || '', live: 1, draft: clone(cfg), versions: [{ v: 1, at: now(), by: user.name, note: `Created from ${body.preset || 'Inventory Starter'}`, ...clone(cfg) }], deploys: [{ id: `dep_${id}_1`, action: 'publish', version: 1, at: now(), by: user.name, note: 'Created' }] });
        return { id, slug };
      });
    }
    return fail(405, 'Method not allowed');
  }
  const site = db.sites.find((s) => s.id === sid) || fail(404, 'Site not found');
  if (!action && method === 'GET') return siteView(user, site, opts);
  if (siteRole(user, sid) !== 'Admin') fail(403, 'Requires Admin role');
  if (action === 'draft' && method === 'PUT') {
    if (!body.draft?.nodes) fail(422, 'draft required');
    return tx((d) => { d.sites.find((s) => s.id === sid).draft = clone(body.draft); return { saved: true }; });
  }
  if (action === 'publish' && method === 'POST') {
    const { errors } = validateConfig(site.draft); if (errors.length) fail(422, 'Draft is invalid — fix before publishing', errors);
    return tx((d) => {
      const s = d.sites.find((x) => x.id === sid); const v = Math.max(...s.versions.map((x) => x.v)) + 1;
      s.versions.push({ v, at: now(), by: user.name, note: body.note || '', ...clone(s.draft) }); s.live = v;
      s.deploys.push({ id: `dep_${sid}_${++d.seq}`, action: 'publish', version: v, at: now(), by: user.name, note: body.note || '' });
      return { version: v };
    });
  }
  if (action === 'rollback' && method === 'POST') {
    const target = site.versions.find((v) => v.v === Number(body.version)) || fail(404, 'Version not found');
    return tx((d) => {
      const s = d.sites.find((x) => x.id === sid); s.live = target.v;
      s.draft = clone({ nodes: target.nodes, edges: target.edges, theme: target.theme });
      s.deploys.push({ id: `dep_${sid}_${++d.seq}`, action: 'rollback', version: target.v, at: now(), by: user.name, note: `Rolled back to v${target.v}` });
      return { version: target.v };
    });
  }
  return fail(404, 'Not found');
}

// ---- users ----
function userRoutes(method, uid, body, opts) {
  const user = authenticate(opts); if (user.role !== 'Admin') fail(403, 'Requires Admin role');
  if (method === 'GET') return dbGet().users.map(pub);
  if (method === 'POST') {
    if (!body.name || !body.email || !body.password) fail(422, 'name, email, password required');
    if (dbGet().users.some((u) => u.email.toLowerCase() === String(body.email).toLowerCase())) fail(409, 'Email already registered');
    return tx((d) => { const u = { id: `user_${++d.seq}`, name: body.name, email: String(body.email).toLowerCase(), hash: bcrypt.hashSync(body.password, 6), role: body.role === 'Admin' ? 'Admin' : 'User', memberships: body.memberships || {} }; d.users.push(u); return pub(u); });
  }
  if (method === 'PATCH') {
    return tx((d) => {
      const u = d.users.find((x) => x.id === uid) || fail(404, 'User not found');
      if (body.name) u.name = body.name;
      if (body.role) { if (u.id === user.id && body.role !== 'Admin') fail(409, 'You cannot demote yourself'); u.role = body.role === 'Admin' ? 'Admin' : 'User'; }
      if (body.memberships) u.memberships = body.memberships;
      if (body.password) u.hash = bcrypt.hashSync(body.password, 6);
      return pub(u);
    });
  }
  return fail(405, 'Method not allowed');
}

function authRoutes(method, action, body, opts) {
  if (action === 'login' && method === 'POST') {
    const u = dbGet().users.find((x) => x.email === String(body.email || '').trim().toLowerCase());
    if (!u || !bcrypt.compareSync(String(body.password || ''), u.hash)) fail(401, 'Invalid email or password');
    return { token: signJwt({ sub: u.id, role: u.role }), user: pub(u) };
  }
  if (action === 'me') return pub(authenticate(opts));
  return fail(404, 'Not found');
}

export function apiSync(method, url, body = {}, opts = {}) {
  const [path] = url.split('?'); const seg = path.split('/').filter(Boolean);
  if (seg[0] !== 'api') fail(404, 'Not found');
  const [, a, b, c, d] = seg; body = body || {};
  if (a === 'auth') return authRoutes(method, b, body, opts);
  if (a === 'sites') return siteRoutes(method, b, c, body, opts);
  if (a === 'users') return userRoutes(method, b, body, opts);
  return resourceRoutes(method, a, b, c, d, body, opts);
}
export const api = async (method, url, body, opts) => apiSync(method, url, body, opts);

export function makeApi(siteId, preview = false) {
  const o = { preview }; const b = `/api/${siteId}`;
  return {
    list: (r) => apiSync('GET', `${b}/${r}`, null, o),
    post: (r, body) => apiSync('POST', `${b}/${r}`, body, o),
    put: (r, id, body) => apiSync('PUT', `${b}/${r}/${id}`, body, o),
    del: (r, id) => apiSync('DELETE', `${b}/${r}/${id}`, null, o),
    export: (r) => apiSync('GET', `${b}/export/${r}`, null, o),
    import: (r, rows) => apiSync('POST', `${b}/import/${r}`, { rows }, o),
    members: () => apiSync('GET', `${b}/members`, null, o),
    setMember: (uid, role) => apiSync('PUT', `${b}/members/${uid}`, { role }, o),
  };
}
