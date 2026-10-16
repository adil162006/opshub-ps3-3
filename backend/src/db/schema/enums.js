import { pgEnum } from 'drizzle-orm/pg-core';

export const siteRoleEnum = pgEnum('site_role', ['Member', 'Manager', 'Admin']);
export const siteStatusEnum = pgEnum('site_status', ['active', 'inactive', 'archived']);
export const moduleKeyEnum = pgEnum('module_key', [
  'auth_rbac',
  'user_mgmt',
  'inventory',
  'dashboard_shell',
  'request',
  'approval',
  'material_assignment',
  'assignment_frontend',
  'consumption',
  'returns',
  'pcb_repair',
  'analytics',
  'reports_excel',
]);
export const requestStatusEnum = pgEnum('request_status', [
  'pending',
  'open',
  'approved',
  'rejected',
  'assigned',
  'in-repair',
  'closed',
  'cancelled',
]);
export const priorityEnum = pgEnum('priority', ['Low', 'Normal', 'High']);
export const approvalDecisionEnum = pgEnum('approval_decision', ['pending', 'approve', 'reject']);
export const assignmentStatusEnum = pgEnum('assignment_status', ['issued', 'in-use', 'completed', 'returned']);
export const stockMovementTypeEnum = pgEnum('stock_movement_type', [
  'receipt',
  'issue',
  'adjustment',
  'return',
  'transfer_in',
  'transfer_out',
]);
export const returnTypeEnum = pgEnum('return_type', ['material', 'repair']);
export const returnStatusEnum = pgEnum('return_status', ['pending', 'accepted', 'rejected']);
export const repairStageEnum = pgEnum('repair_stage', ['diagnosis', 'repairing', 'testing', 'completed']);
export const repairStatusEnum = pgEnum('repair_status', ['open', 'in-progress', 'completed', 'cancelled']);
export const excelJobTypeEnum = pgEnum('excel_job_type', ['import', 'export']);
export const excelJobStatusEnum = pgEnum('excel_job_status', ['queued', 'running', 'completed', 'failed']);
export const deploymentActionEnum = pgEnum('deployment_action', ['publish', 'rollback']);
