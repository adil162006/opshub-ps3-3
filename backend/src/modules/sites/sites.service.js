import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { deployments, siteMembers, siteVersions, sites, users } from '../../db/schema/index.js';
import { ApiError } from '../../lib/ApiError.js';
import { getSiteContext } from '../shared/siteContext.js';
import { DEFAULT_THEME, MODULES, PRESETS, validateConfig } from '../../../../frontend/src/lib/registry.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const clone = (value) => JSON.parse(JSON.stringify(value));

function validateDraft(config, { allowIncomplete = false } = {}) {
  if (!config || typeof config !== 'object' || Array.isArray(config) || !Array.isArray(config.nodes) || !Array.isArray(config.edges)) {
    throw new ApiError(422, 'Draft must contain nodes and edges arrays');
  }
  const nodeIds = new Set();
  for (const node of config.nodes) {
    if (!node || typeof node.id !== 'string' || !node.id || !node.data || !MODULES[node.data.type]) {
      throw new ApiError(422, 'Each module needs a unique id and an approved module type');
    }
    if (nodeIds.has(node.id)) throw new ApiError(422, `Duplicate module id: ${node.id}`);
    nodeIds.add(node.id);
    if (node.data.config !== undefined && (!node.data.config || typeof node.data.config !== 'object' || Array.isArray(node.data.config))) {
      throw new ApiError(422, `Configuration for ${node.data.type} must be an object`);
    }
    const nodeConfig = node.data.config || {};
    if (nodeConfig.fields !== undefined) {
      if (!Array.isArray(nodeConfig.fields) || nodeConfig.fields.length > 100) throw new ApiError(422, `${node.data.type} fields must be an array of at most 100 entries`);
      const fieldKeys = new Set();
      for (const field of nodeConfig.fields) {
        if (!field || !/^[A-Za-z_]\w*$/.test(field.key || '') || fieldKeys.has(field.key)) throw new ApiError(422, `${node.data.type} contains an invalid or duplicate field key`);
        if (!['text', 'number', 'select', 'date', 'item', 'calc'].includes(field.type)) throw new ApiError(422, `Field ${field.key} has an unsupported type`);
        if (field.label !== undefined && (typeof field.label !== 'string' || field.label.length > 120)) throw new ApiError(422, `Field ${field.key} label must be at most 120 characters`);
        if (field.required !== undefined && typeof field.required !== 'boolean') throw new ApiError(422, `Field ${field.key} required must be a boolean`);
        if (field.type === 'select' && (!Array.isArray(field.options) || field.options.length > 100 || field.options.some((option) => typeof option !== 'string' || !option.trim()))) {
          throw new ApiError(422, `Select field ${field.key} must define valid options`);
        }
        fieldKeys.add(field.key);
      }
    }
    if (node.data.type === 'approval' && nodeConfig.steps !== undefined &&
      (!Array.isArray(nodeConfig.steps) || !nodeConfig.steps.length || nodeConfig.steps.length > 10 || nodeConfig.steps.some((role) => !['Member', 'Manager', 'Admin'].includes(role)))) {
      throw new ApiError(422, 'Approval steps must contain 1 to 10 valid site roles');
    }
  }
  const result = validateConfig(config);
  if (!allowIncomplete && result.errors.length) throw new ApiError(422, 'Site configuration is invalid', result.errors);
  const seenEdges = new Set();
  const ids = new Set(config.nodes.map((node) => node?.id));
  for (const edge of config.edges) {
    if (!ids.has(edge?.source) || !ids.has(edge?.target)) throw new ApiError(422, 'Every connection must reference existing modules');
    const source = config.nodes.find((node) => node.id === edge.source)?.data?.type;
    const target = config.nodes.find((node) => node.id === edge.target)?.data?.type;
    if (!MODULES[source] || !MODULES[target] || !MODULES[source].outputs.some((output) =>
      [...MODULES[target].requires.flat(), ...(MODULES[target].optional || [])].includes(output))) {
      throw new ApiError(422, 'A connection uses incompatible module types');
    }
    const key = `${edge.source}:${edge.target}`;
    if (seenEdges.has(key)) throw new ApiError(422, 'Duplicate module connection');
    seenEdges.add(key);
  }
  return config;
}

function publicSite(site, role, config, liveVersion = null) {
  return { id: site.id, slug: site.slug, name: site.name, description: site.description || '', live: liveVersion,
    role, theme: config?.theme || {}, moduleTypes: (config?.nodes || []).map((node) => node.data.type) };
}

async function requireSiteAdmin(siteId, actorId) {
  const context = await getSiteContext(db, siteId, actorId);
  if (!context.actor.isHubAdmin) throw new ApiError(403, 'Global Administrator access required');
  return context;
}

export async function listSites(actorId) {
  const [actor] = await db.select({ isHubAdmin: users.isHubAdmin, isActive: users.isActive }).from(users).where(eq(users.id, actorId)).limit(1);
  if (!actor?.isActive) throw new ApiError(401, 'Authenticated user is unavailable');
  const rows = actor.isHubAdmin
    ? await db.select({ site: sites, role: sql`'Admin'::text` }).from(sites).orderBy(asc(sites.name))
    : await db.select({ site: sites, role: siteMembers.role }).from(siteMembers).innerJoin(sites, eq(sites.id, siteMembers.siteId))
      .where(eq(siteMembers.userId, actorId)).orderBy(asc(sites.name));
  const result = [];
  for (const row of rows) {
    let config = { nodes: [], edges: [], theme: row.site.theme };
    let liveVersion = null;
    if (row.site.liveVersionId) {
      const [version] = await db.select({ config: siteVersions.config, version: siteVersions.version }).from(siteVersions)
        .where(and(eq(siteVersions.siteId, row.site.id), eq(siteVersions.id, row.site.liveVersionId))).limit(1);
      if (version) {
        config = version.config;
        liveVersion = version.version;
      }
    }
    result.push(publicSite(row.site, row.role, config, liveVersion));
  }
  return result;
}

export async function getSite(siteId, actorId, preview = false) {
  if (!UUID.test(siteId)) throw new ApiError(400, 'siteId must be a valid UUID');
  const context = await getSiteContext(db, siteId, actorId);
  if (preview && !context.actor.isHubAdmin) throw new ApiError(403, 'Global Administrator access required');
  const [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
  let live = { nodes: [], edges: [], theme: site.theme };
  let versions = [];
  let deploys = [];
  if (site.liveVersionId) {
    const [version] = await db.select({ config: siteVersions.config }).from(siteVersions)
      .where(and(eq(siteVersions.siteId, siteId), eq(siteVersions.id, site.liveVersionId))).limit(1);
    live = version?.config || live;
  }
  if (context.actor.isHubAdmin) {
    versions = await db.select({ id: siteVersions.id, version: siteVersions.version, config: siteVersions.config, note: siteVersions.note, createdAt: siteVersions.createdAt, createdBy: users.name })
      .from(siteVersions).leftJoin(users, eq(users.id, siteVersions.createdBy)).where(eq(siteVersions.siteId, siteId)).orderBy(desc(siteVersions.version));
    deploys = await db.select({ id: deployments.id, action: deployments.action, versionId: deployments.versionId, note: deployments.note, createdAt: deployments.createdAt, deployedBy: users.name })
      .from(deployments).leftJoin(users, eq(users.id, deployments.deployedBy)).where(eq(deployments.siteId, siteId)).orderBy(desc(deployments.createdAt));
  }
  const config = preview ? site.draft : live;
  return { site: { id: site.id, slug: site.slug, name: site.name, description: site.description || '', live: site.liveVersionId },
    role: context.role, config, ...(context.actor.isHubAdmin ? { draft: site.draft, versions, deploys } : {}) };
}

export async function createSite(actorId, input) {
  const [user] = await db.select({ isHubAdmin: users.isHubAdmin, isActive: users.isActive }).from(users).where(eq(users.id, actorId)).limit(1);
  if (!user?.isActive) throw new ApiError(401, 'Authenticated user is unavailable');
  if (!user.isHubAdmin) throw new ApiError(403, 'Global Administrator access required');
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const slug = typeof input.slug === 'string' ? input.slug.trim().toLowerCase() : '';
  if (!name || name.length > 180) throw new ApiError(422, 'name is required and must be at most 180 characters');
  if (!slugPattern.test(slug) || slug.length > 120) throw new ApiError(422, 'slug must contain lowercase letters, numbers and hyphens');
  const factory = PRESETS[input.preset];
  if (!factory) throw new ApiError(422, 'preset must be one of the approved site presets');
  const config = { ...factory(), theme: clone(DEFAULT_THEME) };
  validateDraft(config);
  const description = typeof input.description === 'string' ? input.description.trim().slice(0, 2000) : '';
  return db.transaction(async (tx) => {
    const [created] = await tx.insert(sites).values({ slug, name, description, createdBy: actorId, draft: config }).returning();
    const [version] = await tx.insert(siteVersions).values({ siteId: created.id, version: 1, config, note: `Created from ${input.preset}`, createdBy: actorId }).returning();
    await tx.update(sites).set({ liveVersionId: version.id }).where(eq(sites.id, created.id));
    await tx.insert(deployments).values({ siteId: created.id, versionId: version.id, action: 'publish', deployedBy: actorId, note: 'Created' });
    return { id: created.id, slug: created.slug };
  }).catch((error) => {
    if (error.code === '23505') throw new ApiError(409, 'Slug already in use');
    throw error;
  });
}

export async function saveDraft(siteId, actorId, config) {
  await requireSiteAdmin(siteId, actorId);
  validateDraft(config, { allowIncomplete: true });
  const [saved] = await db.update(sites).set({ draft: clone(config), updatedAt: new Date() }).where(eq(sites.id, siteId)).returning({ id: sites.id });
  if (!saved) throw new ApiError(404, 'Site not found');
  return { saved: true };
}

export async function publishDraft(siteId, actorId, note = '') {
  await requireSiteAdmin(siteId, actorId);
  return db.transaction(async (tx) => {
    const [site] = await tx.select().from(sites).where(eq(sites.id, siteId)).for('update').limit(1);
    if (!site) throw new ApiError(404, 'Site not found');
    const config = validateDraft(site.draft);
    const [{ version: previous }] = await tx.select({ version: sql`coalesce(max(${siteVersions.version}), 0)::int` }).from(siteVersions).where(eq(siteVersions.siteId, siteId));
    const [version] = await tx.insert(siteVersions).values({ siteId, version: Number(previous) + 1, config, note: String(note).slice(0, 1000), createdBy: actorId }).returning();
    await tx.update(sites).set({ liveVersionId: version.id, updatedAt: new Date() }).where(eq(sites.id, siteId));
    await tx.insert(deployments).values({ siteId, versionId: version.id, action: 'publish', deployedBy: actorId, note: String(note).slice(0, 1000) });
    return { version: version.version };
  });
}

export async function rollbackSite(siteId, actorId, targetVersion) {
  await requireSiteAdmin(siteId, actorId);
  const versionNumber = Number(targetVersion);
  if (!Number.isSafeInteger(versionNumber) || versionNumber < 1) throw new ApiError(422, 'version must be a positive integer');
  return db.transaction(async (tx) => {
    const [site] = await tx.select().from(sites).where(eq(sites.id, siteId)).for('update').limit(1);
    if (!site) throw new ApiError(404, 'Site not found');
    const [target] = await tx.select().from(siteVersions).where(and(eq(siteVersions.siteId, siteId), eq(siteVersions.version, versionNumber))).limit(1);
    if (!target) throw new ApiError(404, 'Version not found');
    validateDraft(target.config);
    await tx.update(sites).set({ liveVersionId: target.id, draft: target.config, updatedAt: new Date() }).where(eq(sites.id, siteId));
    await tx.insert(deployments).values({ siteId, versionId: target.id, action: 'rollback', deployedBy: actorId, note: `Rolled back to v${versionNumber}` });
    return { version: versionNumber };
  });
}
