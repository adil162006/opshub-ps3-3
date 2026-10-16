import assert from 'node:assert/strict';
import { pool, db } from './src/db/index.js';
import { sites, users, siteMembers, repairRecords, repairParts, requests } from './src/db/schema/index.js';
import {
  listRepairs,
  getRepair,
  createRepair,
  updateRepair,
  deleteRepair,
  addRepairPart,
  removeRepairPart,
} from './src/modules/repairs/repairs.service.js';
import { eq } from 'drizzle-orm';

async function runTests() {
  console.log('🧪 Starting Repair Module Integration Tests...\n');

  // 1. Get or create a test site and user
  let [site] = await db.select().from(sites).where(eq(sites.slug, 'service-centre')).limit(1);
  if (!site) {
    [site] = await db.insert(sites).values({
      slug: 'service-centre',
      name: 'Service Centre',
      description: 'Customer requests, repairs, and returns',
    }).returning();
  }

  let [siteB] = await db.select().from(sites).where(eq(sites.slug, 'central-stores')).limit(1);
  if (!siteB) {
    [siteB] = await db.insert(sites).values({
      slug: 'central-stores',
      name: 'Central Stores',
      description: 'Stores site',
    }).returning();
  }

  let [testUser] = await db.select().from(users).limit(1);
  if (!testUser) {
    [testUser] = await db.insert(users).values({
      name: 'Test Technician',
      email: 'tech@opshub.local',
      passwordHash: 'dummy',
    }).returning();
  }

  console.log(`Using site: ${site.name} (${site.id})`);
  console.log(`Using technician: ${testUser.name} (${testUser.id})`);

  // 2. Test createRepair (direct repair job)
  console.log('\n--- 1. Testing createRepair (direct repair) ---');
  const created = await createRepair(site.id, {
    device: 'iPhone 13 Pro Logic Board',
    fault: 'No power on, PMIC short circuit',
    customerName: 'Acme Corp',
    partsCost: 45.5,
    labourCost: 80.0,
    stage: 'diagnosis',
  }, testUser.id);

  assert.ok(created.id, 'Repair should have an ID');
  assert.equal(created.siteId, site.id, 'Site ID should match');
  assert.equal(created.device, 'iPhone 13 Pro Logic Board');
  assert.equal(created.fault, 'No power on, PMIC short circuit');
  assert.equal(created.customerName, 'Acme Corp');
  assert.equal(created.stage, 'diagnosis');
  assert.equal(created.status, 'diagnosis'); // Frontend compatibility
  assert.equal(created.partsCost, 45.5);
  assert.equal(created.labourCost, 80.0);
  assert.equal(created.total, 125.5);
  console.log('✅ createRepair passed: Ticket', created.ticketNumber, 'Total:', created.total);

  // 3. Test getRepair
  console.log('\n--- 2. Testing getRepair ---');
  const fetched = await getRepair(site.id, created.id);
  assert.ok(fetched, 'Fetched repair should exist');
  assert.equal(fetched.id, created.id);
  assert.equal(fetched.device, created.device);
  assert.equal(fetched.total, 125.5);
  console.log('✅ getRepair passed');

  // 4. Test addRepairPart
  console.log('\n--- 3. Testing addRepairPart ---');
  const part = await addRepairPart(site.id, created.id, {
    description: 'Replacement PMIC Chip U2001',
    quantity: 1,
    unitCost: 15.0,
  });
  assert.ok(part.id);
  assert.equal(part.quantity, 1);
  assert.equal(part.unitCost, 15.0);

  const afterPart = await getRepair(site.id, created.id);
  assert.equal(afterPart.parts.length, 1);
  assert.equal(afterPart.parts[0].description, 'Replacement PMIC Chip U2001');
  console.log('✅ addRepairPart passed: Parts count:', afterPart.parts.length, 'New partsCost:', afterPart.partsCost);

  // 5. Test updateRepair lifecycle (diagnosis -> repairing -> testing -> completed)
  console.log('\n--- 4. Testing updateRepair lifecycle ---');
  const stage1 = await updateRepair(site.id, created.id, { stage: 'repairing' });
  assert.equal(stage1.stage, 'repairing');
  assert.equal(stage1.recordStatus, 'in-progress');

  const stage2 = await updateRepair(site.id, created.id, { status: 'testing' });
  assert.equal(stage2.stage, 'testing');

  const completed = await updateRepair(site.id, created.id, { status: 'completed' });
  assert.equal(completed.stage, 'completed');
  assert.equal(completed.recordStatus, 'completed');
  assert.ok(completed.completedAt, 'completedAt timestamp should be set');
  console.log('✅ updateRepair lifecycle passed: stage transitioned to completed');

  // 6. Test listRepairs with filters
  console.log('\n--- 5. Testing listRepairs ---');
  const allList = await listRepairs(site.id);
  assert.ok(allList.length >= 1, 'Should find at least 1 repair');
  const foundInList = allList.find((r) => r.id === created.id);
  assert.ok(foundInList, 'Created repair should appear in listRepairs');
  console.log('✅ listRepairs passed: found', allList.length, 'records');

  // 7. Test Tenant Isolation
  console.log('\n--- 6. Testing Tenant Isolation ---');
  const crossSiteFetch = await getRepair(siteB.id, created.id);
  assert.equal(crossSiteFetch, null, 'Cross-site fetch must return null');

  const crossSiteUpdate = await updateRepair(siteB.id, created.id, { device: 'Hacked Device' });
  assert.equal(crossSiteUpdate, null, 'Cross-site update must return null');

  const crossSiteDelete = await deleteRepair(siteB.id, created.id);
  assert.equal(crossSiteDelete, null, 'Cross-site delete must return null');
  console.log('✅ Tenant isolation verified: site B cannot access or mutate site A repairs');

  // 8. Test removeRepairPart
  console.log('\n--- 7. Testing removeRepairPart ---');
  const removed = await removeRepairPart(site.id, created.id, part.id);
  assert.equal(removed.deleted, part.id);
  const afterRemove = await getRepair(site.id, created.id);
  assert.equal(afterRemove.parts.length, 0);
  console.log('✅ removeRepairPart passed');

  // 9. Test deleteRepair
  console.log('\n--- 8. Testing deleteRepair ---');
  const deleted = await deleteRepair(site.id, created.id);
  assert.equal(deleted.id, created.id);
  const afterDelete = await getRepair(site.id, created.id);
  assert.equal(afterDelete, null, 'Deleted repair should no longer exist');
  console.log('✅ deleteRepair passed');

  console.log('\n🎉 ALL REPAIR TESTS PASSED SUCCESSFULLY!');
}

try {
  await runTests();
} catch (err) {
  console.error('\n❌ Test failed with error:', err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
