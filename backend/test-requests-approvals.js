import assert from 'node:assert/strict';
import { pool, db } from './src/db/index.js';
import {
  approvals,
  assignments,
  items,
  repairRecords,
  requests,
  siteMembers,
  siteVersions,
  sites,
  users,
} from './src/db/schema/index.js';
import {
  createRequest,
  deleteRequest,
  getRequest,
  listRequests,
  updateRequest,
} from './src/modules/requests/requests.service.js';
import {
  createApproval,
  getApproval,
  listApprovals,
} from './src/modules/approvals/approvals.service.js';
import { createAssignment } from './src/modules/assignments/assignments.service.js';
import { createRepair } from './src/modules/repairs/repairs.service.js';
import { and, eq } from 'drizzle-orm';

async function runTests() {
  console.log('🧪 Starting Requests and Approvals Integration Tests...\n');

  // 1. Get or create test sites
  let [siteA] = await db.select().from(sites).where(eq(sites.slug, 'central-stores')).limit(1);
  if (!siteA) {
    [siteA] = await db.insert(sites).values({
      slug: 'central-stores',
      name: 'Central Stores',
      description: 'Stores site',
    }).returning();
  }

  let [siteB] = await db.select().from(sites).where(eq(sites.slug, 'service-centre')).limit(1);
  if (!siteB) {
    [siteB] = await db.insert(sites).values({
      slug: 'service-centre',
      name: 'Service Centre',
      description: 'Service centre site',
    }).returning();
  }

  // 2. Set up test users: Admin, Manager, Member
  let [adminUser] = await db.select().from(users).where(eq(users.email, 'admin@opshub.local')).limit(1);
  if (!adminUser) {
    [adminUser] = await db.insert(users).values({
      name: 'Super Admin',
      email: 'admin@opshub.local',
      passwordHash: 'dummy',
      isHubAdmin: true,
    }).returning();
  }

  let [mgrUser] = await db.select().from(users).where(eq(users.email, 'manager@opshub.local')).limit(1);
  if (!mgrUser) {
    [mgrUser] = await db.insert(users).values({
      name: 'Site Manager',
      email: 'manager@opshub.local',
      passwordHash: 'dummy',
      isHubAdmin: false,
    }).returning();
  }

  let [memberUser] = await db.select().from(users).where(eq(users.email, 'member@opshub.local')).limit(1);
  if (!memberUser) {
    [memberUser] = await db.insert(users).values({
      name: 'Site Member',
      email: 'member@opshub.local',
      passwordHash: 'dummy',
      isHubAdmin: false,
    }).returning();
  }

  // Ensure site memberships for siteA
  const upsertMember = async (siteId, userId, role) => {
    const [existing] = await db.select().from(siteMembers).where(and(eq(siteMembers.siteId, siteId), eq(siteMembers.userId, userId))).limit(1);
    if (!existing) {
      await db.insert(siteMembers).values({ siteId, userId, role });
    } else if (existing.role !== role) {
      await db.update(siteMembers).set({ role }).where(and(eq(siteMembers.siteId, siteId), eq(siteMembers.userId, userId)));
    }
  };

  await upsertMember(siteA.id, mgrUser.id, 'Manager');
  await upsertMember(siteA.id, memberUser.id, 'Member');

  // Also create a sample item in siteA for item request testing
  let [testItem] = await db.select().from(items).where(and(eq(items.siteId, siteA.id), eq(items.sku, 'REQ-TEST-SKU-1'))).limit(1);
  if (!testItem) {
    [testItem] = await db.insert(items).values({
      siteId: siteA.id,
      sku: 'REQ-TEST-SKU-1',
      name: 'Safety Helmets Standard',
      quantityOnHand: '50.000',
      unitPrice: '15.00',
    }).returning();
  }

  console.log(`Using Site A: ${siteA.name} (${siteA.id})`);
  console.log(`Using Site B: ${siteB.name} (${siteB.id})`);
  console.log(`Using Member: ${memberUser.name}, Manager: ${mgrUser.name}, Admin: ${adminUser.name}`);

  // ---- TEST 1: Create request with item reference ----
  console.log('\n--- 1. Testing createRequest ---');
  const req1 = await createRequest(siteA.id, {
    title: 'Urgent gear for field team',
    itemId: testItem.id,
    qty: 5,
    team: 'North Construction Crew',
    priority: 'High',
    notes: 'Needed before Monday',
  }, memberUser.id);

  assert.ok(req1.id, 'Request must have an ID');
  assert.equal(req1.siteId, siteA.id, 'Site ID must match');
  assert.ok(req1.requestNumber.startsWith('REQ-'), 'Request number should start with REQ-');
  assert.equal(req1.status, 'pending', 'Request should start as pending when approval is expected');
  assert.equal(req1.priority, 'High');
  assert.equal(req1.team, 'North Construction Crew');
  assert.equal(req1.notes, 'Needed before Monday');
  assert.equal(req1.items.length, 1, 'Should have attached 1 item');
  assert.equal(req1.items[0].itemId, testItem.id);
  assert.equal(req1.items[0].quantity, 5);
  console.log('✅ createRequest passed:', req1.requestNumber, 'Status:', req1.status);

  // ---- TEST 2: Get request by ID ----
  console.log('\n--- 2. Testing getRequest ---');
  const fetchedReq = await getRequest(siteA.id, req1.id);
  assert.ok(fetchedReq);
  assert.equal(fetchedReq.id, req1.id);
  assert.equal(fetchedReq.requestNumber, req1.requestNumber);
  assert.equal(fetchedReq.items.length, 1);
  console.log('✅ getRequest passed');

  // ---- TEST 3: Tenant Isolation ----
  console.log('\n--- 3. Testing Tenant Isolation ---');
  // Site B cannot see Site A request
  const siteBCrossRead = await getRequest(siteB.id, req1.id);
  assert.equal(siteBCrossRead, null, 'Site B should not be able to get Site A request');

  // Site B cannot approve Site A request
  let crossApproveFailed = false;
  try {
    await createApproval(siteB.id, { requestId: req1.id, decision: 'approve' }, adminUser.id);
  } catch (err) {
    crossApproveFailed = true;
    assert.equal(err.status, 404, 'Cross-site approval should return 404 Not Found');
  }
  assert.ok(crossApproveFailed, 'Cross-site approval must fail');
  console.log('✅ Tenant isolation verified: Site B cannot access or approve Site A requests');

  // ---- TEST 4: Role enforcement for approval ----
  console.log('\n--- 4. Testing Role Enforcement in Approvals ---');
  let memberApproveFailed = false;
  try {
    // Member (rank 1) tries to approve step that requires Manager (rank 2)
    await createApproval(siteA.id, { requestId: req1.id, decision: 'approve', comment: 'I approve myself' }, memberUser.id);
  } catch (err) {
    memberApproveFailed = true;
    assert.equal(err.status, 403, 'Member should get 403 Forbidden for Manager step');
  }
  assert.ok(memberApproveFailed, 'Member cannot approve a request requiring Manager');
  console.log('✅ Insufficient role properly rejected with 403');

  // ---- TEST 5: Manager approves request ----
  console.log('\n--- 5. Testing Manager Approval ---');
  const approvalResult = await createApproval(siteA.id, {
    requestId: req1.id,
    decision: 'approve',
    comment: 'Approved for field deployment',
  }, mgrUser.id);

  assert.ok(approvalResult.id, 'Approval record created');
  assert.equal(approvalResult.decision, 'approve');
  assert.equal(approvalResult.requestStatus, 'approved', 'Request status should now be approved');
  assert.equal(approvalResult.by, mgrUser.name);

  // Verify request state in DB
  const approvedReq = await getRequest(siteA.id, req1.id);
  assert.equal(approvedReq.status, 'approved');
  assert.equal(approvedReq.approvals.length, 1);
  assert.equal(approvedReq.approvals[0].decision, 'approve');
  console.log('✅ Manager approval passed: Request is now', approvedReq.status);

  // ---- TEST 6: Double approval / approving non-pending request fails with 409 ----
  console.log('\n--- 6. Testing 409 on approving non-pending request ---');
  let doubleApproveFailed = false;
  try {
    await createApproval(siteA.id, { requestId: req1.id, decision: 'approve' }, mgrUser.id);
  } catch (err) {
    doubleApproveFailed = true;
    assert.equal(err.status, 409);
  }
  assert.ok(doubleApproveFailed, 'Approving an already approved request must return 409');
  console.log('✅ 409 conflict properly returned when approving non-pending request');

  // ---- TEST 7: Rejection workflow ----
  console.log('\n--- 7. Testing Rejection Workflow ---');
  const req2 = await createRequest(siteA.id, {
    title: 'Luxury espresso machine',
    priority: 'Low',
    notes: 'Office comfort',
  }, memberUser.id);

  assert.equal(req2.status, 'pending');

  const rejectResult = await createApproval(siteA.id, {
    requestId: req2.id,
    decision: 'reject',
    comment: 'Not within current operational budget',
  }, mgrUser.id);

  assert.equal(rejectResult.decision, 'reject');
  assert.equal(rejectResult.requestStatus, 'rejected');

  const rejectedReq = await getRequest(siteA.id, req2.id);
  assert.equal(rejectedReq.status, 'rejected');
  console.log('✅ Rejection workflow passed: Request is now', rejectedReq.status);

  // ---- TEST 8: Editing requests ----
  console.log('\n--- 8. Testing Request Updates ---');
  const req3 = await createRequest(siteA.id, {
    title: 'Spare cables',
    priority: 'Normal',
  }, memberUser.id);

  // Pending request can be updated
  const updatedReq3 = await updateRequest(siteA.id, req3.id, {
    priority: 'High',
    notes: 'Updated note: need fast',
  }, mgrUser.id);
  assert.equal(updatedReq3.priority, 'High');
  assert.equal(updatedReq3.notes, 'Updated note: need fast');

  // Rejected request cannot be updated (returns 409)
  let updateRejectedFailed = false;
  try {
    await updateRequest(siteA.id, req2.id, { priority: 'High' }, mgrUser.id);
  } catch (err) {
    updateRejectedFailed = true;
    assert.equal(err.status, 409);
  }
  assert.ok(updateRejectedFailed, 'Updating a non-pending request must return 409');
  console.log('✅ Request update rules verified (pending allowed, non-pending 409)');

  // ---- TEST 9: Integration with Assignments ----
  console.log('\n--- 9. Testing Integration with Material Assignment ---');
  // req1 is approved for testItem (qty: 5). Let's create an assignment for it.
  const initialStock = Number(testItem.quantityOnHand);

  const asg = await createAssignment(siteA.id, {
    requestId: req1.id,
    assignedTo: memberUser.id,
    notes: 'Issued by test',
    items: [{ itemId: testItem.id, quantity: 5 }],
  }, mgrUser.id);

  assert.ok(asg.id, 'Assignment created');
  assert.equal(asg.requestId, req1.id);

  // Verify stock decremented
  const [itemAfter] = await db.select().from(items).where(eq(items.id, testItem.id));
  assert.equal(Number(itemAfter.quantityOnHand), initialStock - 5, 'Stock must decrement by 5');

  // Verify request status transitioned to 'assigned'
  const reqAfterAsg = await getRequest(siteA.id, req1.id);
  assert.equal(reqAfterAsg.status, 'assigned', 'Request status should transition to assigned');
  console.log('✅ Assignment integration passed: Stock decremented, Request status is now assigned');

  // ---- TEST 10: Integration with Repairs ----
  console.log('\n--- 10. Testing Integration with PCB Repairs ---');
  const req4 = await createRequest(siteA.id, {
    title: 'Broken inverter board',
    device: 'Solar Inverter Board X5',
    fault: 'Capacitor blowout',
  }, memberUser.id);

  // Approve req4
  await createApproval(siteA.id, { requestId: req4.id, decision: 'approve' }, mgrUser.id);

  // Create repair referencing req4
  const repair = await createRepair(siteA.id, {
    requestId: req4.id,
    device: 'Solar Inverter Board X5',
    fault: 'Capacitor blowout',
  }, adminUser.id);

  assert.ok(repair.id);
  assert.equal(repair.requestId, req4.id);

  // Verify request transitioned to 'in-repair'
  const reqAfterRepair = await getRequest(siteA.id, req4.id);
  assert.equal(reqAfterRepair.status, 'in-repair', 'Request status should transition to in-repair');
  console.log('✅ Repair integration passed: Request status is now in-repair');

  // ---- TEST 11: List requests & approvals ----
  console.log('\n--- 11. Testing listRequests and listApprovals ---');
  const allReqs = await listRequests(siteA.id);
  assert.ok(allReqs.length >= 4);

  const pendingReqs = await listRequests(siteA.id, { status: 'pending' });
  assert.ok(Array.isArray(pendingReqs));

  const allApps = await listApprovals(siteA.id);
  assert.ok(allApps.length >= 3);
  assert.ok(allApps[0].requestNo, 'Approval row must have requestNo');
  assert.ok(allApps[0].by, 'Approval row must have approver name');
  console.log('✅ listRequests and listApprovals passed');

  // ---- TEST 12: Delete request ----
  console.log('\n--- 12. Testing deleteRequest ---');
  const delResult = await deleteRequest(siteA.id, req3.id);
  assert.ok(delResult.deleted, 'Request should be deleted');
  const deletedCheck = await getRequest(siteA.id, req3.id);
  assert.equal(deletedCheck, null, 'Deleted request should no longer be found');
  console.log('✅ deleteRequest passed');

  console.log('\n🎉 ALL REQUESTS AND APPROVALS TESTS PASSED SUCCESSFULLY!\n');
}

runTests()
  .catch((err) => {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
