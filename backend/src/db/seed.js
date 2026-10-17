import { inArray, sql } from 'drizzle-orm';
import { db, pool } from './index.js';
import { deployments, modules, siteMembers, siteModules, siteVersions, sites, users } from './schema/index.js';
import { MODULES, PRESETS } from '../../../frontend/src/lib/registry.js';
import { hashPassword } from '../lib/password.js';

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
    enabled: ['auth_rbac', 'user_mgmt', 'inventory', 'dashboard_shell', 'analytics', 'reports_excel'],
  },
  {
    slug: 'service-centre',
    name: 'Service Centre',
    description: 'Customer requests, approvals, PCB repairs and returns.',
    enabled: ['auth_rbac', 'user_mgmt', 'dashboard_shell', 'request', 'approval', 'returns', 'pcb_repair', 'analytics', 'reports_excel'],
  },
  {
    slug: 'distribution',
    name: 'Distribution Team',
    description: 'Material requests, assignment, distribution and consumption tracking.',
    enabled: ['auth_rbac', 'user_mgmt', 'inventory', 'dashboard_shell', 'request', 'approval', 'material_assignment', 'assignment_frontend', 'consumption', 'returns', 'analytics', 'reports_excel'],
  },
];

const siteConfigs = {
  'central-stores': () => PRESETS['Inventory Starter'](),
  'service-centre': () => PRESETS['Repair Shop'](),
  distribution: () => {
    const config = PRESETS['Approval Chain']();
    const node = (type, id) => ({ id, type: 'module', position: { x: 1440, y: type === 'returns' ? 60 : 220 }, data: { type, label: MODULES[type].name, config: {} } });
    config.nodes.push(node('returns', 'returns-1'), node('reports', 'reports-1'));
    config.edges.push(
      { id: 'e-assignment-returns', source: 'assignment-1', target: 'returns-1', label: 'Assignment', animated: true },
      { id: 'e-inventory-reports', source: 'inventory-1', target: 'reports-1', label: 'Stock', animated: true },
    );
    return config;
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

    await tx.insert(sites).values(siteRegistry.map(({ slug, name, description }) => ({
      slug,
      name,
      description,
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
      if (!seedEmail || !seedPassword || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(seedEmail)) {
        throw new Error('Set both a valid SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD.');
      }
      const [existingAdmin] = await tx.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${seedEmail}`).limit(1);
      if (!existingAdmin) {
        await tx.insert(users).values({
          name: process.env.SEED_ADMIN_NAME?.trim() || 'OpsHub Administrator',
          email: seedEmail,
          phoneNumber: '+10000000001',
          isVerified: true,
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
