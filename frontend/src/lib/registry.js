// Module registry: the 13 approved modules as typed nodes (inputs / outputs).

export const RANK = { Public: 0, Member: 1, Manager: 2, Admin: 3 };
export const ROLES = ['Member', 'Manager', 'Admin'];
export const STAGES = ['diagnosis', 'repairing', 'testing', 'completed'];

export const TYPE_LABEL = {
  session: 'Session',
  layout: 'Layout',
  directory: 'Directory',
  stock: 'Stock',
  request: 'Request',
  approval: 'Approval',
  assignment: 'Assignment',
  consumption: 'Consumption',
  repair: 'Repair',
  return: 'Return',
};

// Analytics and reports accept any one of these operational data outputs.
const DATA = [
  'stock',
  'request',
  'approval',
  'assignment',
  'consumption',
  'repair',
  'return',
];

// Field factory: F(key, label, type, extraProps)
const F = (key, label, type = 'text', extra = {}) => ({ key, label, type, ...extra });

// Theme values are stored with each site's draft and published configuration.
export const DEFAULT_THEME = {
  primary: '#4f46e5',
  accent: '#06b6d4',
  background: '#17191f',
  mode: 'dark',
  layout: 'sidebar',
  radius: 12,
  font: 'Inter',
  density: 'comfortable',
};

// Each `requires` entry is a requirement group: one type in a group is enough,
// while separate groups must all be satisfied. Optional types never block publishing.
export const MODULES = {
  auth: {
    name: 'Authentication & RBAC',
    icon: '🔐',
    group: 'Core',
    desc: 'Global JWT login, bcrypt hashes, Public/Member/Manager/Admin role matrix.',
    requires: [],
    outputs: ['session'],
    resources: [],
    page: { path: 'access', title: 'Access' },
  },

  users: {
    name: 'User Management',
    icon: '👥',
    group: 'Core',
    desc: 'Site members and role assignment.',
    requires: [['session']],
    outputs: ['directory'],
    resources: [],
    page: { path: 'members', title: 'Members' },
  },

  shell: {
    name: 'Dashboard Shell / Navigation / Forms',
    icon: '🧭',
    group: 'Core',
    desc: 'Themed layout, navigation, dashboard and the config-driven form engine.',
    requires: [['session']],
    outputs: ['layout'],
    resources: [],
    page: { path: '', title: 'Dashboard' },
  },

  inventory: {
    name: 'Inventory',
    icon: '📦',
    group: 'Stock',
    desc: 'Stock CRUD with calculated fields (TOTAL = QTY × PRICE).',
    requires: [['layout']],
    outputs: ['stock'],
    resources: ['inventory'],
    page: { path: 'inventory', title: 'Inventory' },
    defaultFields: [
      F('sku', 'SKU', 'text', { required: true }),
      F('name', 'Name', 'text', { required: true }),
      F('category', 'Category'),
      F('qty', 'Qty', 'number', { required: true }),
      F('price', 'Unit Price', 'number'),
      F('reorder', 'Reorder Lvl', 'number'),
      F('total', 'Total', 'calc', { formula: 'qty * price' }),
    ],
  },

  request: {
    name: 'Request',
    icon: '📝',
    group: 'Workflow',
    desc: 'Configurable request form; item field links to Inventory when connected.',
    requires: [['layout']],
    optional: ['stock'],
    outputs: ['request'],
    resources: ['requests'],
    page: { path: 'requests', title: 'Requests' },
    defaultFields: [
      F('title', 'Title', 'text', { required: true }),
      F('qty', 'Qty', 'number'),
      F('priority', 'Priority', 'select', { options: ['Low', 'Normal', 'High'] }),
      F('notes', 'Notes'),
    ],
  },

  approval: {
    name: 'Approval',
    icon: '✅',
    group: 'Workflow',
    desc: 'Multi-step approval chain with role per step.',
    requires: [['request']],
    outputs: ['approval'],
    resources: ['approvals'],
    page: { path: 'approvals', title: 'Approvals' },
  },

  assignment: {
    name: 'Material Assignment',
    icon: '🚚',
    group: 'Workflow',
    desc: 'Issues approved requests; transactional stock decrement.',
    requires: [['approval'], ['stock']],
    outputs: ['assignment'],
    resources: ['assignments'],
    page: { path: 'assignments', title: 'Assignments' },
  },

  assignmentUi: {
    name: 'Assignment Frontend',
    icon: '🗂️',
    group: 'Workflow',
    desc: 'Field-facing cards of issued material and usage.',
    requires: [['assignment']],
    outputs: [],
    resources: [],
    page: { path: 'my-assignments', title: 'Field View' },
  },

  consumption: {
    name: 'Consumption Tracking',
    icon: '📉',
    group: 'Tracking',
    desc: 'Log material used against an assignment.',
    requires: [['assignment']],
    outputs: ['consumption'],
    resources: ['consumption'],
    page: { path: 'consumption', title: 'Consumption' },
  },

  returns: {
    name: 'Return Management',
    icon: '↩️',
    group: 'Tracking',
    desc: 'Returns of assigned material (restock) or repaired devices.',
    requires: [['assignment', 'repair']],
    outputs: ['return'],
    resources: ['returns'],
    page: { path: 'returns', title: 'Returns' },
  },

  repair: {
    name: 'PCB Repair',
    icon: '🔧',
    group: 'Tracking',
    desc: 'Repair board: diagnosis → repairing → testing → completed, with cost fields.',
    requires: [['approval']],
    outputs: ['repair'],
    resources: ['repairs'],
    page: { path: 'repairs', title: 'Repairs' },
    defaultFields: [
      F('device', 'Device / Board', 'text', { required: true }),
      F('serialNo', 'Serial Number'),
      F('customerContact', 'Customer Contact'),
      F('fault', 'Fault', 'text', { required: true }),
      F('diagnosis', 'Diagnosis'),
      F('partsCost', 'Parts Cost', 'number'),
      F('labourCost', 'Labour Cost', 'number'),
      F('total', 'Total', 'calc', { formula: 'partsCost + labourCost' }),
    ],
  },

  analytics: {
    name: 'Analytics Dashboard',
    icon: '📊',
    group: 'Insight',
    desc: 'Per-site Recharts dashboards from connected data.',
    requires: [DATA],
    outputs: [],
    resources: [],
    page: { path: 'analytics', title: 'Analytics' },
  },

  reports: {
    name: 'Reports with Excel Integration',
    icon: '📑',
    group: 'Insight',
    desc: 'Browse data; role-restricted Excel import / export.',
    requires: [DATA],
    outputs: [],
    resources: [],
    page: { path: 'reports', title: 'Reports & Excel' },
  },
};

export const ORDER = Object.keys(MODULES);

// ---- connection helpers ----

// All output types a module will accept as input (required + optional).
export const accepts = (type) => [
  ...new Set([
    ...MODULES[type].requires.flat(),
    ...(MODULES[type].optional || []),
  ]),
];

// The output type that `src` provides to `tgt`, or null if none / same module.
export const connectionType = (src, tgt) => {
  if (src === tgt) return null;
  return MODULES[src].outputs.find((o) => accepts(tgt).includes(o)) || null;
};

// Resolve accepted output types to source module names for the builder's guidance.
const sourceModulesFor = (types) =>
  ORDER.filter((source) =>
    MODULES[source].outputs.some((output) => types.includes(output))
  );

const isOperationalDataGroup = (group) =>
  group.length === DATA.length && DATA.every((type) => group.includes(type));

export const inputGuide = (type) => {
  const required = MODULES[type].requires.map((group) => {
    const sources = sourceModulesFor(group).map((source) => MODULES[source].name);

    return isOperationalDataGroup(group)
      ? `At least one operational data source (${sources.join(', ')})`
      : sources.join(' or ');
  });

  const optional = (MODULES[type].optional || []).flatMap((output) =>
    sourceModulesFor([output]).map((source) => MODULES[source].name)
  );

  return { required, optional };
};

export const MODULE_TIPS = {
  auth: 'Start here. This supplies the signed-in session and roles used by the rest of the site.',
  users: 'Connect Authentication so member management uses the site sign-in and roles.',
  shell: 'Connect Authentication. This supplies the shared layout that hosts the site pages.',
  inventory: 'Connect the Dashboard Shell. Keep the SKU, Name, and Qty fields; other modules use this stock list.',
  request: 'Connect the Dashboard Shell to host the form. To let people choose stock items, also connect Inventory and add an Item field plus a Qty field.',
  approval: 'Connect Request so approvers can review submitted requests.',
  assignment: 'Connect both Approval and Inventory. This issues approved requests and updates stock.',
  assignmentUi: 'Connect Material Assignment to show issued materials to field staff.',
  consumption: 'Connect Material Assignment so usage is recorded against issued materials.',
  returns: 'Connect Material Assignment for material returns, or PCB Repair for repaired-device returns.',
  repair: 'Connect Approval. Keep the Device / Board and Fault fields so repair jobs have the required details.',
  analytics: 'Connect one or more operational data modules to choose which site data appears in charts.',
  reports: 'Connect one or more operational data modules to choose which site data is available in reports.',
};

// ---- default config & config accessors ----

export const defaultConfig = (type) => {
  const m = MODULES[type];
  const config = {};

  if (m.defaultFields) config.fields = structuredClone(m.defaultFields);
  if (type === 'approval') config.steps = ['Manager'];

  return config;
};

export const nodeOf = (cfg, type) => cfg.nodes.find((n) => n.data.type === type);

export const hasModule = (cfg, type) => !!nodeOf(cfg, type);

export const fieldsOf = (cfg, type) =>
  nodeOf(cfg, type)?.data.config?.fields ?? MODULES[type].defaultFields ?? [];

export const stepsOf = (cfg) =>
  hasModule(cfg, 'approval')
    ? nodeOf(cfg, 'approval').data.config?.steps ?? ['Manager']
    : [];

export const itemKey = (cfg) =>
  fieldsOf(cfg, 'request').find((f) => f.type === 'item')?.key;

export const pagesOf = (cfg) =>
  ORDER
    .filter((t) => hasModule(cfg, t) && MODULES[t].page)
    .map((t) => ({ type: t, icon: MODULES[t].icon, ...MODULES[t].page }));

export const resourcesOf = (cfg) =>
  ORDER
    .filter((t) => hasModule(cfg, t))
    .flatMap((t) => MODULES[t].resources);

// ---- calculated fields ----

export function validateFormula(formula, keys) {
  if (!formula || !/^[\w\s+\-*/().]+$/.test(formula)) {
    return 'Formula uses invalid characters';
  }

  const identifiers = formula.match(/[A-Za-z_]\w*/g) || [];
  const unknown = identifiers.find((id) => !keys.includes(id));
  if (unknown) return `Unknown field "${unknown}"`;

  try {
    // Substitute every identifier with 1 and make sure the expression parses/runs.
    new Function(`return (${formula.replace(/[A-Za-z_]\w*/g, '1')})`)();
  } catch {
    return 'Syntax error in formula';
  }

  return null;
}

export function evalFormula(formula, row) {
  // Replace each field name with its numeric value (0 if missing / not a number).
  const expr = formula.replace(
    /[A-Za-z_]\w*/g,
    (key) => `(${Number(row[key]) || 0})`
  );

  try {
    const value = new Function(`return (${expr})`)();
    return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
  } catch {
    return 0;
  }
}

// ---- config validation (typed connections + schema) ----

export function validateConfig(cfg) {
  const errors = [];
  const byNode = {};

  // Record an error against a node (and in the global list), without duplicates.
  const add = (id, msg) => {
    byNode[id] = byNode[id] || [];
    if (!byNode[id].includes(msg)) byNode[id].push(msg);
    if (!errors.includes(msg)) errors.push(msg);
  };

  const nodes = cfg.nodes || [];
  const edges = cfg.edges || [];
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const types = nodes.map((n) => n.data.type);

  // Auth and Shell are mandatory in every site.
  ['auth', 'shell'].forEach((t) => {
    if (!types.includes(t)) errors.push(`${MODULES[t].name} is required in every site`);
  });

  nodes.forEach((n, i) => {
    const t = n.data.type;
    const m = MODULES[t];

    // Each module may appear only once.
    if (types.indexOf(t) !== i) add(n.id, `${m.name} added twice`);

    // Output types this node receives via incoming edges.
    const provided = new Set(
      edges
        .filter((e) => e.target === n.id)
        .flatMap((e) => (byId[e.source] ? MODULES[byId[e.source].data.type].outputs : []))
    );

    // Every requirement group must be satisfied by at least one provided type.
    m.requires.forEach((group) => {
      if (group.some((x) => provided.has(x))) return;

      const guide = inputGuide(t);
      const groupIndex = m.requires.indexOf(group);
      add(
        n.id,
        `${m.name} needs a connection from ${
          guide.required[groupIndex] || group.map((x) => TYPE_LABEL[x]).join(' or ')
        }`
      );
    });

    // Field schema checks.
    const fields = n.data.config?.fields;
    if (!fields) return;

    const keys = fields.map((f) => f.key);

    fields.forEach((f) => {
      if (!/^[a-zA-Z_]\w*$/.test(f.key)) {
        add(n.id, `Field key "${f.key}" is invalid`);
      }

      if (keys.indexOf(f.key) !== keys.lastIndexOf(f.key)) {
        add(n.id, `Duplicate field key "${f.key}"`);
      }

      if (f.type === 'calc') {
        const otherKeys = keys.filter((k) => k !== f.key);
        const err = validateFormula(f.formula || '', otherKeys);
        if (err) add(n.id, `${f.label}: ${err}`);
      }

      if (f.type === 'item' && !types.includes('inventory')) {
        add(n.id, `"${f.label}" needs the Inventory module`);
      }
    });

    if (t === 'inventory') {
      ['sku', 'name', 'qty']
        .filter((key) => !keys.includes(key))
        .forEach((key) => add(n.id, `Inventory needs a "${key}" field`));
    }

    if (t === 'repair') {
      ['device', 'fault']
        .filter((key) => !keys.includes(key))
        .forEach((key) => add(n.id, `Repair needs a "${key}" field`));
    }

    if (t === 'request' && fields.some((f) => f.type === 'item') && !keys.includes('qty')) {
      add(n.id, 'Request needs a "qty" field when it has an item field');
    }
  });

  return { errors, byNode };
}

// ---- presets ----

// Build a graph node for a module type at (x, y).
const node = (type, x, y, config) => ({
  id: `${type}-1`,
  type: 'module',
  position: { x, y },
  data: {
    type,
    label: MODULES[type].name,
    config: config ?? defaultConfig(type),
  },
});

// Build a graph edge from module `a` to module `b`.
const E = (a, b) => ({
  id: `e-${a}-${b}`,
  source: `${a}-1`,
  target: `${b}-1`,
  label: TYPE_LABEL[connectionType(a, b)],
  animated: true,
});

export const itemRequestFields = () => [
  F('itemId', 'Item', 'item', { required: true }),
  F('qty', 'Qty', 'number', { required: true }),
  F('team', 'Requested for'),
  F('priority', 'Priority', 'select', { options: ['Low', 'Normal', 'High'] }),
  F('notes', 'Notes'),
];

export const repairRequestFields = () => [
  F('customer', 'Customer', 'text', { required: true }),
  F('device', 'Device', 'text', { required: true }),
  F('issue', 'Issue', 'text', { required: true }),
  F('priority', 'Priority', 'select', { options: ['Low', 'Normal', 'High'] }),
  F('estimate', 'Estimate', 'number'),
];

export const PRESETS = {
  'Inventory Starter': () => ({
    nodes: [
      node('auth', 0, 80),
      node('users', 260, 0),
      node('shell', 260, 140),
      node('inventory', 520, 140),
      node('analytics', 780, 80),
      node('reports', 780, 220),
    ],
    edges: [
      E('auth', 'users'),
      E('auth', 'shell'),
      E('shell', 'inventory'),
      E('inventory', 'analytics'),
      E('inventory', 'reports'),
    ],
  }),

  'Approval Chain': () => ({
    nodes: [
      node('auth', 0, 140),
      node('users', 240, 0),
      node('shell', 240, 140),
      node('inventory', 480, 0),
      node('request', 480, 140, { fields: itemRequestFields() }),
      node('approval', 720, 140),
      node('assignment', 960, 70),
      node('assignmentUi', 1200, 0),
      node('consumption', 1200, 140),
      node('analytics', 1200, 280),
    ],
    edges: [
      E('auth', 'users'),
      E('auth', 'shell'),
      E('shell', 'inventory'),
      E('shell', 'request'),
      E('inventory', 'request'),
      E('request', 'approval'),
      E('approval', 'assignment'),
      E('inventory', 'assignment'),
      E('assignment', 'assignmentUi'),
      E('assignment', 'consumption'),
      E('assignment', 'analytics'),
    ],
  }),

  'Repair Shop': () => ({
    nodes: [
      node('auth', 0, 120),
      node('users', 240, 0),
      node('shell', 240, 120),
      node('request', 480, 120, { fields: repairRequestFields() }),
      node('approval', 720, 120),
      node('repair', 960, 120),
      node('returns', 1200, 40),
      node('analytics', 1200, 180),
      node('reports', 1200, 300),
    ],
    edges: [
      E('auth', 'users'),
      E('auth', 'shell'),
      E('shell', 'request'),
      E('request', 'approval'),
      E('approval', 'repair'),
      E('repair', 'returns'),
      E('repair', 'analytics'),
      E('request', 'reports'),
    ],
  }),
};