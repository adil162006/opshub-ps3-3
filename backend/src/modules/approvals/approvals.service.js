import { and, asc, eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { approvals, requests, users } from '../../db/schema/index.js';
import { AppError } from '../../lib/AppError.js';
import { configNode, getSiteContext, requireRole } from '../shared/siteContext.js';

const ranks = { Member: 1, Manager: 2, Admin: 3 };
const getSteps = (config) => configNode(config, 'approval')?.data?.config?.steps ?? ['Manager'];

export async function listApprovals(siteId, userId) {
  const context = await getSiteContext(db, siteId, userId, ['request', 'approval']);
  requireRole(context.role, 'Member');
  const rows = await db.select({
    id: approvals.id, site_id: approvals.siteId, requestId: approvals.requestId, requestNo: requests.requestNumber,
    step: approvals.step, role: approvals.requiredRole, decision: approvals.decision,
    comment: approvals.comment, by: users.name, at: approvals.decidedAt,
    createdAt: approvals.createdAt,
  }).from(approvals).innerJoin(requests, and(eq(requests.id, approvals.requestId), eq(requests.siteId, approvals.siteId)))
    .leftJoin(users, eq(users.id, approvals.decidedBy)).where(eq(approvals.siteId, siteId)).orderBy(asc(approvals.createdAt));
  return rows;
}

export async function decideApproval(siteId, userId, body) {
  if (!body.requestId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.requestId)) {
    throw new AppError(422, 'requestId must be a valid UUID');
  }
  if (!['approve', 'reject'].includes(body.decision)) throw new AppError(422, 'decision must be approve or reject');
  return db.transaction(async (tx) => {
    const context = await getSiteContext(tx, siteId, userId, ['request', 'approval']);
    requireRole(context.role, 'Manager');
    const [request] = await tx.select({
      id: requests.id, requestNumber: requests.requestNumber, status: requests.status,
      currentStep: requests.currentStep,
    }).from(requests).where(and(eq(requests.siteId, siteId), eq(requests.id, body.requestId))).for('update').limit(1);
    if (!request) throw new AppError(404, 'Request not found');
    if (request.status !== 'pending') throw new AppError(409, `${request.requestNumber} is ${request.status}, not pending`);

    const steps = getSteps(context.config);
    const requiredRole = steps[request.currentStep];
    if (!requiredRole || !Object.hasOwn(ranks, requiredRole)) throw new AppError(422, 'Approval step configuration is invalid');
    if (ranks[context.role] < ranks[requiredRole]) {
      throw new AppError(403, `Step ${request.currentStep + 1} needs ${requiredRole} (you are ${context.role})`);
    }

    const decidedAt = new Date();
    const [approval] = await tx.insert(approvals).values({
      siteId, requestId: request.id, step: request.currentStep, requiredRole,
      decision: body.decision, comment: String(body.comment || ''), decidedBy: userId, decidedAt,
    }).returning();
    const nextStep = body.decision === 'approve' ? request.currentStep + 1 : request.currentStep;
    const status = body.decision === 'reject' ? 'rejected' : nextStep >= steps.length ? 'approved' : 'pending';
    await tx.update(requests).set({ currentStep: nextStep, status, updatedAt: decidedAt })
      .where(and(eq(requests.siteId, siteId), eq(requests.id, request.id)));
    return {
      id: approval.id, requestId: request.id, requestNo: request.requestNumber,
      step: approval.step, role: approval.requiredRole, decision: approval.decision,
      comment: approval.comment, by: context.actor.name, at: approval.decidedAt,
      site_id: siteId, createdAt: approval.createdAt,
    };
  });
}
