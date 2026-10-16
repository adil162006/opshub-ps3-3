import { inArray, sql } from 'drizzle-orm';
import { db, pool } from './index.js';
import { deployments, modules, siteMembers, siteModules, siteVersions, sites, users } from './schema/index.js';
import { DEFAULT_THEME, MODULES, PRESETS } from '../../../frontend/src/lib/registry.js';
import { hashPassword, MIN_PASSWORD_LENGTH } from '../lib/password.js';

const moduleRegistry = [
  { key: 'auth_rbac', name: 'Authentication & RBAC', category: 'Core' },
  { key: 'user_mgmt', name: 'User Management', category: 'Core' },
  { key: 'inventory', name: 'Inventory', category: 'Stock' },
  { key: 'dashboard_shell', name: 'Dashboard Shell / Navigation / Forms', category: 'Core' },
  { key: 'request', name: 'Request', category: 'Workflow' },
  { key: 'approval', name: 'Approval', category: 'Workflow' },
  { key: 'material_assignment', name: 'Material Assignment', category: 'Workflow' },
  { key: 'assignment_frontend', name: 'Assignment Frontend', category: 'Workflow' },
  { key: 'consumption', name: 'Consumption Tracking', category: 'Tracking' },
  { key: 'returns', name: 'Return Management', category: 'Tracking' },
  { key: 'pcb_repair', name: 'PCB Repair', category: 'Tracking' },
  { key: 'analytics', name: 'Analytics Dashboard', category: 'Insight' },
  { key: 'reports_excel', name: 'Reports with Excel Integration', category: 'Insight' },
];

const siteRegistry = [
  {
    slug: 'central-stores',
    name: 'Central Stores',
    description: 'Inventory, stock control, analytics and Excel reporting.',
    theme: {
      primaryColor: '#0369a1',
      backgroundColor: '#0b1020',
      sidebarColor: '#131c2e',
      cardColor: '#131c2e',
      textColor: '#e5e7eb',
      fontFamily: 'Inter',
      borderRadius: '10px',
      mode: 'dark',
    },
    enabled: ['auth_rbac', 'user_mgmt', 'inventory', 'dashboard_shell', 'analytics', 'reports_excel'],
  },
  {
    slug: 'service-centre',
    name: 'Service Centre',
    description: 'Customer requests, approvals, PCB repairs and returns.',
    theme: {
      primaryColor: '#9333ea',
      backgroundColor: '#0b1020',
      sidebarColor: '#131c2e',
      cardColor: '#131c2e',
      textColor: '#e5e7eb',
      fontFamily: 'Inter',
      borderRadius: '18px',
      mode: 'dark',
    },
    enabled: ['auth_rbac', 'user_mgmt', 'dashboard_shell', 'request', 'approval', 'returns', 'pcb_repair', 'analytics', 'reports_excel'],
  },
  {
    slug: 'distribution',
    name: 'Distribution Team',
    description: 'Material requests, assignment, distribution and consumption tracking.',
    theme: {
      primaryColor: '#16a34a',
      backgroundColor: '#0b1020',
      sidebarColor: '#131c2e',
      cardColor: '#131c2e',
      textColor: '#e5e7eb',
      fontFamily: 'Inter',
      borderRadius: '6px',
      mode: 'dark',
    },
    enabled: ['auth_rbac', 'user_mgmt', 'inventory', 'dashboard_shell', 'request', 'approval', 'material_assignment', 'assignment_frontend', 'consumption', 'returns', 'analytics', 'reports_excel'],
  },
];

const siteConfigs = {
  'central-stores': () => ({ ...PRESETS['Inventory Starter'](), theme: { ...DEFAULT_THEME, primary: '#0369a1' } }),
  'service-centre': () => ({ ...PRESETS['Repair Shop'](), theme: { ...DEFAULT_THEME, primary: '#9333ea', radius: 18 } }),
  distribution: () => {
    const config = PRESETS['Approval Chain']();
    const node = (type, id) => ({ id, type: 'module', position: { x: 1440, y: type === 'returns' ? 60 : 220 }, data: { type, label: MODULES[type].name, config: {} } });
    config.nodes.push(node('returns', 'returns-1'), node('reports', 'reports-1'));
    config.edges.push(
      { id: 'e-assignment-returns', source: 'assignment-1', target: 'returns-1', label: 'Assignment', animated: true },
      { id: 'e-inventory-reports', source: 'inventory-1', target: 'reports-1', label: 'Stock', animated: true },
    );
    return { ...config, theme: { ...DEFAULT_THEME, primary: '#16a34a', radius: 6 } };
  },
};

try {
  await db.transaction(async (tx) => {
    await tx.insert(modules).values(moduleRegistry).onConflictDoUpdate({
      target: modules.key,
      set: {
        name: sql`excluded.name`,
        category: sql`excluded.category`,
        updatedAt: new Date(),
      },
    });

    await tx.insert(sites).values(siteRegistry.map(({ slug, name, description, theme }) => ({
      slug,
      name,
      description,
      theme,
    }))).onConflictDoNothing({ target: sites.slug });

    const seededSites = await tx.select({ id: sites.id, slug: sites.slug })
      .from(sites)
      .where(inArray(sites.slug, siteRegistry.map((site) => site.slug)));
    const seededModules = await tx.select({ id: modules.id, key: modules.key }).from(modules);
    const siteIds = Object.fromEntries(seededSites.map((site) => [site.slug, site.id]));
    const moduleIds = Object.fromEntries(seededModules.map((module) => [module.key, module.id]));

    const moduleSettings = siteRegistry.flatMap((site) => moduleRegistry.map((module) => ({
      siteId: siteIds[site.slug],
      moduleId: moduleIds[module.key],
      enabled: site.enabled.includes(module.key),
      config: {},
    })));

    await tx.insert(siteModules).values(moduleSettings).onConflictDoNothing({
      target: [siteModules.siteId, siteModules.moduleId],
    });

    for (const registrySite of siteRegistry) {
      const siteId = siteIds[registrySite.slug];
      const [site] = await tx.select({ liveVersionId: sites.liveVersionId }).from(sites).where(sql`${sites.id} = ${siteId}`).limit(1);
      if (!site?.liveVersionId) {
        const config = siteConfigs[registrySite.slug]();
        const [version] = await tx.insert(siteVersions).values({
          siteId, version: 1, config, note: 'Initial site configuration',
        }).returning({ id: siteVersions.id });
        await tx.update(sites).set({ liveVersionId: version.id, draft: config, theme: config.theme }).where(sql`${sites.id} = ${siteId}`);
        await tx.insert(deployments).values({ siteId, versionId: version.id, action: 'publish', note: 'Initial configuration' });
      }
    }

    const seedEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
    const seedPassword = process.env.SEED_ADMIN_PASSWORD;
    if (seedEmail || seedPassword) {
      if (!seedEmail || !seedPassword || seedPassword.length < MIN_PASSWORD_LENGTH || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(seedEmail)) {
        throw new Error(`Set both SEED_ADMIN_EMAIL and a SEED_ADMIN_PASSWORD of at least ${MIN_PASSWORD_LENGTH} characters.`);
      }
      const [existingAdmin] = await tx.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${seedEmail}`).limit(1);
      if (!existingAdmin) {
        await tx.insert(users).values({
          name: process.env.SEED_ADMIN_NAME?.trim() || 'OpsHub Administrator',
          email: seedEmail,
          passwordHash: await hashPassword(seedPassword),
          isHubAdmin: true,
          isActive: true,
        });
      }
    }
  });

  console.log('Initial modules, sites, and site module settings seeded.');
} finally {
  await pool.end();
}
