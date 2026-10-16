import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  approvals,
  requests,
  siteMembers,
  siteVersions,
  sites,
  users,
} from '../../db/schema/index.js';

const RANK = { Member: 1, Manager: 2, Admin: 3 };
export const rank = (role) => RANK[role] ?? 0;

export async function getMembership(siteId, userId) {
  const [row] = await db
    .select({ role: siteMembers.role })
    .from(siteMembers)
    .where(and(eq(siteMembers.siteId, siteId), eq(siteMembers.userId, userId)))
    .limit(1);

  if (row) return row.role;

  const [user] = await db
    .select({ isHubAdmin: users.isHubAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return user?.isHubAdmin ? 'Admin' : null;
}

export async function getSiteConfig(siteId, executor = db) {
  const [site] = await executor
    .select({ id: sites.id, liveVersionId: sites.liveVersionId })
    .from(sites)
    .where(eq(sites.id, siteId))
    .limit(1);

  if (!site || !site.liveVersionId) return null;

  const [version] = await executor
    .select({ config: siteVersions.config })
    .from(siteVersions)
    .where(and(eq(siteVersions.siteId, siteId), eq(siteVersions.id, site.liveVersionId)))
    .limit(1);

  return version?.config || null;
}

export function stepsOf(config) {
  if (!config?.nodes) return ['Manager'];
  const node = config.nodes.find((n) => n?.data?.type === 'approval');
  if (!node) return [];
  return node.data?.config?.steps || ['Manager'];
}

function formatApprovalRow(row) {
  return {
    id: row.id,
    siteId: row.siteId,
    site_id: row.siteId,
    requestId: row.requestId,
    requestNo: row.requestNumber || '',
    step: row.step,
    role: row.requiredRole,
    requiredRole: row.requiredRole,
    decision: row.decision,
    comment: row.comment || '',
    by: row.decidedByName || 'Unknown',
    decidedBy: row.decidedBy,
    at: row.decidedAt,
    decidedAt: row.decidedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ---- LIST APPROVALS ----
export async function listApprovals(siteId) {
  const rows = await db
    .select({
      id: approvals.id,
      siteId: approvals.siteId,
      requestId: approvals.requestId,
      step: approvals.step,
      requiredRole: approvals.requiredRole,
      decision: approvals.decision,
      comment: approvals.comment,
      decidedBy: approvals.decidedBy,
      decidedAt: approvals.decidedAt,
      createdAt: approvals.createdAt,
      updatedAt: approvals.updatedAt,
      requestNumber: requests.requestNumber,
      decidedByName: users.name,
    })
    .from(approvals)
    .innerJoin(requests, and(eq(approvals.requestId, requests.id), eq(approvals.siteId, requests.siteId)))
    .leftJoin(users, eq(approvals.decidedBy, users.id))
    .where(eq(approvals.siteId, siteId))
    .orderBy(desc(approvals.createdAt));

  return rows.map(formatApprovalRow);
}

// ---- GET SINGLE APPROVAL ----
export async function getApproval(siteId, id) {
  const [row] = await db
    .select({
      id: approvals.id,
      siteId: approvals.siteId,
      requestId: approvals.requestId,
      step: approvals.step,
      requiredRole: approvals.requiredRole,
      decision: approvals.decision,
      comment: approvals.comment,
      decidedBy: approvals.decidedBy,
      decidedAt: approvals.decidedAt,
      createdAt: approvals.createdAt,
      updatedAt: approvals.updatedAt,
      requestNumber: requests.requestNumber,
      decidedByName: users.name,
    })
    .from(approvals)
    .innerJoin(requests, and(eq(approvals.requestId, requests.id), eq(approvals.siteId, requests.siteId)))
    .leftJoin(users, eq(approvals.decidedBy, users.id))
    .where(and(eq(approvals.siteId, siteId), eq(approvals.id, id)))
    .limit(1);

  return row ? formatApprovalRow(row) : null;
}

// ---- CREATE APPROVAL (DECIDE ON A REQUEST) ----
export async function createApproval(siteId, body, userId) {
  const { requestId, decision, comment } = body;

  if (!['approve', 'reject'].includes(decision)) {
    const err = new Error('decision must be approve or reject');
    err.status = 422;
    throw err;
  }

  return db.transaction(async (tx) => {
    // 1. Fetch request in this site
    const [req] = await tx
      .select()
      .from(requests)
      .where(and(eq(requests.siteId, siteId), eq(requests.id, requestId)))
      .limit(1);

    if (!req) {
      const err = new Error('Request not found');
      err.status = 404;
      throw err;
    }

    if (req.status !== 'pending') {
      const err = new Error(`${req.requestNumber} is ${req.status}, not pending`);
      err.status = 409;
      throw err;
    }

    // 2. Fetch site config and required role for current step
    const config = await getSiteConfig(siteId, tx);
    const steps = stepsOf(config);
    const resolvedSteps = steps.length > 0 ? steps : ['Manager'];

    const currentStep = req.currentStep || 0;
    const need = resolvedSteps[currentStep] || 'Manager';

    // 3. Resolve user's site role
    const userRole = await getMembership(siteId, userId);
    if (!userRole) {
      const err = new Error('You do not have access to this site');
      err.status = 403;
      throw err;
    }

    if (rank(userRole) < rank(need)) {
      const err = new Error(`Step ${currentStep + 1} needs ${need} (you are ${userRole})`);
      err.status = 403;
      throw err;
    }

    // 4. Record approval decision
    const [created] = await tx
      .insert(approvals)
      .values({
        siteId,
        requestId: req.id,
        step: currentStep,
        requiredRole: need,
        decision,
        decidedBy: userId,
        comment: typeof comment === 'string' ? comment.trim() || null : null,
        decidedAt: new Date(),
      })
      .returning();

    // 5. Update request status
    let updatedStatus = 'pending';
    let nextStep = currentStep;

    if (decision === 'reject') {
      updatedStatus = 'rejected';
      await tx
        .update(requests)
        .set({ status: 'rejected', updatedAt: new Date() })
        .where(and(eq(requests.siteId, siteId), eq(requests.id, req.id)));
    } else {
      nextStep = currentStep + 1;
      if (nextStep >= resolvedSteps.length) {
        updatedStatus = 'approved';
      }
      await tx
        .update(requests)
        .set({
          status: updatedStatus,
          currentStep: nextStep,
          updatedAt: new Date(),
        })
        .where(and(eq(requests.siteId, siteId), eq(requests.id, req.id)));
    }

    // 6. Fetch decider name
    const [u] = await tx.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1);

    return {
      ...formatApprovalRow({
        ...created,
        requestNumber: req.requestNumber,
        decidedByName: u?.name || 'Unknown',
      }),
      requestStatus: updatedStatus,
      requestStep: nextStep,
    };
  });
}
