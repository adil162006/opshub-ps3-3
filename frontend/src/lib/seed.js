import bcrypt from 'bcryptjs';
import { PRESETS, DEFAULT_THEME, itemRequestFields, repairRequestFields } from './registry';

const ago = (d, h = 0) => new Date(Date.now() - d * 864e5 - h * 36e5).toISOString();
const day = (d) => ago(d).slice(0, 10);

export function buildSeed() {
  const s = { schema: 1, seq: 0, users: [], sites: [], rows: { inventory: [], requests: [], approvals: [], assignments: [], consumption: [], returns: [], repairs: [] } };
  const add = (table, site_id, data, created = ago(0)) => {
    const row = { ...data, id: `${table.slice(0, 3)}_${++s.seq}`, site_id, createdAt: created };
    s.rows[table].push(row); return row;
  };
  const hash = (p) => bcrypt.hashSync(p, 6);

  // ---- users ----
  const U = (id, name, email, pw, role, memberships) => s.users.push({ id, name, email, hash: hash(pw), role, memberships });
  U('user_1', 'Aarav Admin', 'admin@opshub.io', 'admin123', 'Admin', {});
  U('user_2', 'Meena Manager', 'manager@opshub.io', 'manager123', 'User', { site_1: 'Manager', site_2: 'Manager', site_3: 'Manager' });
  U('user_3', 'Mohan Member', 'member@opshub.io', 'member123', 'User', { site_1: 'Member', site_2: 'Member', site_3: 'Member' });
  U('user_4', 'Sana Stores', 'stores@opshub.io', 'stores123', 'User', { site_1: 'Manager' });
  U('user_5', 'Tarun Tech', 'tech@opshub.io', 'tech123', 'User', { site_2: 'Manager' });

  // ---- sites ----
  const mkSite = (id, slug, name, description, preset, theme, tweak, versions) => {
    const p = PRESETS[preset](); tweak?.(p);
    const full = { nodes: p.nodes, edges: p.edges, theme: { ...DEFAULT_THEME, ...theme } };
    const vs = (versions || [{ note: 'Initial release', keep: () => true }]).map((v, i) => ({
      v: i + 1, at: ago(14 - i * 5), by: 'Aarav Admin', note: v.note,
      theme: full.theme,
      nodes: structuredClone(full.nodes.filter((n) => v.keep(n.data.type))),
      edges: structuredClone(full.edges.filter((e) => v.keep(e.source.replace(/-1$/, '')) && v.keep(e.target.replace(/-1$/, '')))),
    }));
    s.sites.push({ id, slug, name, description, live: vs.length, draft: structuredClone(full), versions: vs,
      deploys: vs.map((v) => ({ id: `dep_${id}_${v.v}`, action: 'publish', version: v.v, at: v.at, by: v.by, note: v.note })) });
  };
  mkSite('site_1', 'central-stores', 'Central Stores', 'Inventory, stock control, analytics and Excel.', 'Inventory Starter',
    { primary: '#0369a1', accent: '#14b8a6', mode: 'dark', layout: 'sidebar', radius: 10 });
  mkSite('site_2', 'service-centre', 'Service Centre', 'Requests → approval → PCB repair, with returns.', 'Repair Shop',
    { primary: '#9333ea', accent: '#f43f5e', mode: 'dark', layout: 'topbar', radius: 18, font: 'serif' },
    (p) => { p.nodes.find((n) => n.id === 'request-1').data.config.fields = repairRequestFields(); });
  mkSite('site_3', 'distribution', 'Distribution Team', 'Issue material to the field and track consumption.', 'Approval Chain',
    { primary: '#16a34a', accent: '#f59e0b', mode: 'dark', layout: 'sidebar', density: 'compact', radius: 6, font: 'mono' },
    (p) => { p.nodes.find((n) => n.id === 'request-1').data.config.fields = itemRequestFields(); p.nodes.find((n) => n.id === 'approval-1').data.config.steps = ['Manager', 'Admin']; },
    [{ note: 'Initial release (assignment only)', keep: (t) => !['consumption', 'assignmentUi'].includes(t) },
     { note: 'Add consumption tracking + field view', keep: () => true }]);

  // ---- Central Stores inventory ----
  const inv = (site, rows) => rows.map(([sku, name, category, qty, price, reorder]) => add('inventory', site, { sku, name, category, qty, price, reorder, total: qty * price }, ago(20)));
  inv('site_1', [
    ['RES-001', 'Resistor 10kΩ (reel)', 'Passives', 120, 4.5, 40], ['CAP-104', 'Ceramic Capacitor 100nF', 'Passives', 300, 0.8, 100],
    ['IC-555', 'NE555 Timer IC', 'ICs', 45, 12, 20], ['IC-328', 'ATmega328P', 'ICs', 18, 160, 20], ['PCB-A1', 'Prototype PCB 5x7', 'Boards', 60, 35, 25],
    ['CON-USB', 'USB-C Connector', 'Connectors', 8, 22, 15], ['LED-5R', 'LED 5mm Red', 'Optoelectronics', 500, 1.2, 150],
    ['REG-7805', 'Voltage Regulator 7805', 'Power', 70, 9, 30], ['SOL-063', 'Solder Wire 0.63mm', 'Consumables', 14, 420, 10],
    ['FLX-100', 'Flux Paste 100g', 'Consumables', 9, 260, 10], ['HS-220', 'Heatsink TO-220', 'Mechanical', 90, 15, 30], ['BAT-186', 'Li-ion 18650 Cell', 'Power', 32, 185, 20],
  ]);

  // ---- Distribution ----
  const d = Object.fromEntries(inv('site_3', [
    ['CAB-CAT6', 'CAT6 Cable (100m box)', 'Cabling', 34, 2800, 10], ['RTR-AX', 'WiFi Router AX1800', 'Network', 22, 4200, 8],
    ['SW-8P', '8-Port Switch', 'Network', 15, 1950, 6], ['ONT-GP', 'Fiber ONT Unit', 'Network', 40, 2300, 12],
    ['CON-RJ45', 'RJ45 Connectors (pack)', 'Cabling', 120, 350, 40], ['PWR-12V', '12V Power Adapter', 'Power', 58, 420, 20],
    ['MNT-WALL', 'Wall Mount Kit', 'Hardware', 75, 180, 25], ['TOOL-CRM', 'Crimping Tool', 'Tools', 6, 950, 3],
  ]).map((r) => [r.sku, r]));
  const dreq = (no, item, qty, team, priority, status, step, created, notes = '') =>
    add('requests', 'site_3', { requestNo: no, itemId: item.id, qty, team, priority, notes, status, step, requestedBy: 'Mohan Member' }, created);
  const apr = (req, step, role, decision, comment, by, at) => add('approvals', 'site_3', { requestId: req.id, requestNo: req.requestNo, step, role, decision, comment, by, at }, at);
  const r1 = dreq('REQ-001', d['ONT-GP'], 10, 'Field Team Alpha', 'High', 'assigned', 2, ago(9), 'Ward 12 fibre rollout');
  apr(r1, 0, 'Manager', 'approve', 'Ok for rollout', 'Meena Manager', ago(9, -2)); apr(r1, 1, 'Admin', 'approve', 'Budget cleared', 'Aarav Admin', ago(8));
  const r2 = dreq('REQ-002', d['CAB-CAT6'], 5, 'Install Crew B', 'Normal', 'approved', 2, ago(4));
  apr(r2, 0, 'Manager', 'approve', '', 'Meena Manager', ago(4, -3)); apr(r2, 1, 'Admin', 'approve', '', 'Aarav Admin', ago(3));
  const r3 = dreq('REQ-003', d['RTR-AX'], 6, 'Field Team Alpha', 'Normal', 'pending', 1, ago(2));
  apr(r3, 0, 'Manager', 'approve', 'Needs Admin sign-off (value)', 'Meena Manager', ago(2, -4));
  dreq('REQ-004', d['SW-8P'], 3, 'Depot', 'Low', 'pending', 0, ago(1));
  const r5 = dreq('REQ-005', d['TOOL-CRM'], 4, 'Install Crew B', 'Low', 'rejected', 1, ago(6), 'Spare tools');
  apr(r5, 0, 'Manager', 'reject', 'Use existing tools', 'Meena Manager', ago(6, -1));
  const r6 = dreq('REQ-006', d['PWR-12V'], 20, 'Install Crew B', 'Normal', 'assigned', 2, ago(7));
  apr(r6, 0, 'Manager', 'approve', '', 'Meena Manager', ago(7, -1)); apr(r6, 1, 'Admin', 'approve', '', 'Aarav Admin', ago(6, 2));
  const a1 = add('assignments', 'site_3', { requestId: r1.id, requestNo: 'REQ-001', itemId: d['ONT-GP'].id, itemName: d['ONT-GP'].name, qty: 10, remaining: 6, assignee: 'Field Team Alpha', status: 'in-use', issuedBy: 'Meena Manager' }, ago(8));
  const a2 = add('assignments', 'site_3', { requestId: r6.id, requestNo: 'REQ-006', itemId: d['PWR-12V'].id, itemName: d['PWR-12V'].name, qty: 20, remaining: 8, assignee: 'Install Crew B', status: 'in-use', issuedBy: 'Meena Manager' }, ago(5));
  const con = (a, qty, note, dd) => add('consumption', 'site_3', { assignmentId: a.id, itemName: a.itemName, qty, note, date: day(dd), by: 'Mohan Member' }, ago(dd));
  con(a1, 4, 'Ward 12 – block A', 6); con(a2, 7, 'Office park install', 3); con(a2, 5, 'Retail strip install', 1);

  // ---- Service Centre ----
  const sreq = (no, customer, device, issue, priority, estimate, status, step, created) =>
    add('requests', 'site_2', { requestNo: no, customer, device, issue, priority, estimate, status, step, requestedBy: 'Mohan Member' }, created);
  const sapr = (req, decision, comment, at) => add('approvals', 'site_2', { requestId: req.id, requestNo: req.requestNo, step: 0, role: 'Manager', decision, comment, by: 'Meena Manager', at }, at);
  const q1 = sreq('REQ-001', 'Ravi Kulkarni', 'Laptop mainboard X1', 'No power', 'High', 4500, 'in-repair', 1, ago(8)); sapr(q1, 'approve', 'Quote accepted', ago(7));
  const q2 = sreq('REQ-002', 'Meera Shah', 'Router RTR-9', 'Boot loop', 'Normal', 1800, 'closed', 1, ago(12)); sapr(q2, 'approve', '', ago(11));
  const q3 = sreq('REQ-003', 'Dev Patel', 'Drone controller PCB', 'Joystick drift', 'Normal', 2200, 'approved', 1, ago(2)); sapr(q3, 'approve', '', ago(1));
  sreq('REQ-004', 'Anita Joshi', 'Smart TV board', 'Backlight failure', 'High', 6000, 'pending', 0, ago(1));
  const q5 = sreq('REQ-005', 'Kiran Rao', 'Printer logic board', 'Paper jam error', 'Low', 900, 'rejected', 1, ago(5)); sapr(q5, 'reject', 'Not economical to repair', ago(4));
  const rep1 = add('repairs', 'site_2', { requestId: q1.id, requestNo: 'REQ-001', device: 'Laptop mainboard X1', fault: 'Shorted MOSFET on 5V rail', partsCost: 1200, labourCost: 1500, total: 2700, status: 'repairing', technician: 'Tarun Tech' }, ago(6));
  const rep2 = add('repairs', 'site_2', { requestId: q2.id, requestNo: 'REQ-002', device: 'Router RTR-9', fault: 'Corrupt firmware + bad flash IC', partsCost: 300, labourCost: 800, total: 1100, status: 'completed', technician: 'Tarun Tech', returned: true }, ago(10));
  add('returns', 'site_2', { source: 'repair', refId: rep2.id, refLabel: 'REQ-002 · Router RTR-9', qty: 1, condition: 'good', reason: 'Customer declined repaired unit', resolution: 'refund', by: 'Meena Manager' }, ago(4));
  void rep1;
  return s;
}
