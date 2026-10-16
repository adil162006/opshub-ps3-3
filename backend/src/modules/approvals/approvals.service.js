import { and, asc, eq, ne } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { approvals, requests, users } from '../../db/schema/index.js';
import { ApiError } from '../../lib/ApiError.js';
import { approvalSteps, getSiteContext, requireRole, roleRank } from '../shared/workflow.js';

export async function listApprovalHistory(siteId, actorId) {
  await getSiteContext(db, siteId, actorId, ['approval']);
  const rows = await db.select({
    id: approvals.id,
    site_id: approvals.siteId,
    requestId: approvals.requestId,
    requestNo: requests.requestNumber,
    step: approvals.step,
    role: approvals.requiredRole,
    decision: approvals.decision,
    comment: approvals.comment,
    by: users.name,
    at: approvals.decidedAt,
    createdAt: approvals.createdAt,
  }).from(approvals)
    .innerJoin(requests, and(eq(requests.siteId, approvals.siteId), eq(requests.id, approvals.requestId)))
    .leftJoin(users, eq(users.id, approvals.decidedBy))
    .where(and(eq(approvals.siteId, siteId), ne(approvals.decision, 'pending')))
    .orderBy(asc(approvals.createdAt));
  return rows.map((row) => ({ ...row, by: row.by || '' }));
}

export async function decideRequest(siteId, actorId, body) {
  const { config, role } = await getSiteContext(db, siteId, actorId, ['approval']);
  requireRole(role, 'Manager');
  const { requestId, decision } = body;
  if (!requestId) throw new ApiError(422, 'requestId is required');
  if (!['approve', 'reject'].includes(decision)) throw new ApiError(422, 'decision must be approve or reject');

  return db.transaction(async (tx) => {
    const [request] = await tx.select().from(requests)
      .where(and(eq(requests.siteId, siteId), eq(requests.id, requestId))).for('update').limit(1);
    if (!request) throw new ApiError(404, 'Request not found');
    if (request.status !== 'pending') throw new ApiError(409, `${request.requestNumber} is ${request.status}, not pending`);
    const steps = approvalSteps(config);
    const requiredRole = steps[request.currentStep];
    if (!requiredRole) throw new ApiError(409, 'Approval chain is already complete');
    if (roleRank(role) < roleRank(requiredRole)) throw new ApiError(403, `Step ${request.currentStep + 1} requires ${requiredRole}`);

    const [row] = await tx.insert(approvals).values({
      siteId,
      requestId,
      step: request.currentStep,
      requiredRole,
      decision,
      decidedBy: actorId,
      comment: typeof body.comment === 'string' ? body.comment.trim() : null,
      decidedAt: new Date(),
    }).returning();
    const nextStep = request.currentStep + 1;
    await tx.update(requests).set({
      status: decision === 'reject' ? 'rejected' : nextStep >= steps.length ? 'approved' : 'pending',
      currentStep: nextStep,
      updatedAt: new Date(),
    }).where(and(eq(requests.siteId, siteId), eq(requests.id, requestId)));
    const [user] = await tx.select({ name: users.name }).from(users).where(eq(users.id, actorId)).limit(1);
    return {
      id: row.id,
      site_id: siteId,
      requestId,
      requestNo: request.requestNumber,
      step: row.step,
      role: row.requiredRole,
      decision: row.decision,
      comment: row.comment || '',
      by: user?.name || '',
      at: row.decidedAt,
    };
  });
}
