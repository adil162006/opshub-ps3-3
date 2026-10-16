import { inArray, sql } from 'drizzle-orm';
import { db, pool } from './index.js';
import { modules, siteModules, sites } from './schema/index.js';

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
      primaryColor: '#2563eb',
      backgroundColor: '#f8fafc',
      sidebarColor: '#172554',
      textColor: '#1e293b',
      fontFamily: 'Inter',
      borderRadius: '8px',
    },
    enabled: ['auth_rbac', 'user_mgmt', 'inventory', 'dashboard_shell', 'analytics', 'reports_excel'],
  },
  {
    slug: 'service-centre',
    name: 'Service Centre',
    description: 'Customer requests, approvals, PCB repairs and returns.',
    theme: {
      primaryColor: '#16a34a',
      backgroundColor: '#f0fdf4',
      sidebarColor: '#14532d',
      textColor: '#14532d',
      fontFamily: 'Inter',
      borderRadius: '10px',
    },
    enabled: ['auth_rbac', 'user_mgmt', 'dashboard_shell', 'request', 'approval', 'returns', 'pcb_repair', 'analytics', 'reports_excel'],
  },
  {
    slug: 'distribution',
    name: 'Distribution Team',
    description: 'Material requests, assignment, distribution and consumption tracking.',
    theme: {
      primaryColor: '#ea580c',
      backgroundColor: '#fff7ed',
      sidebarColor: '#7c2d12',
      textColor: '#431407',
      fontFamily: 'Inter',
      borderRadius: '8px',
    },
    enabled: ['auth_rbac', 'user_mgmt', 'inventory', 'dashboard_shell', 'request', 'approval', 'material_assignment', 'assignment_frontend', 'consumption', 'returns', 'analytics', 'reports_excel'],
  },
];

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
  });

  console.log('Initial modules, sites, and site module settings seeded.');
} finally {
  await pool.end();
}
