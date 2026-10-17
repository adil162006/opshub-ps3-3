import { createHash, randomUUID } from 'node:crypto';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db, pool } from './src/db/index.js';
import {
  approvals,
  assignmentItems,
  assignments,
  categories,
  consumptionRecords,
  excelJobs,
  items,
  repairParts,
  repairRecords,
  requestItems,
  requests,
  returnItems,
  returns,
  siteMembers,
  sites,
  stockMovements,
  users,
} from './src/db/schema/index.js';
import { hashPassword } from './src/lib/password.js';

const DEMO_SITE_SLUGS = ['central-stores', 'service-centre', 'distribution'];

const idFor = (key) => {
  const bytes = createHash('sha256').update(`opshub-electronics-demo:${key}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

async function upsertByNaturalKey(tx, table, siteId, criteria, values, key) {
  const [existing] = await tx.select({ id: table.id }).from(table)
    .where(and(eq(table.siteId, siteId), ...Object.entries(criteria).map(([column, value]) => eq(table[column], value))))
    .limit(1);
  const recordValues = { siteId, ...criteria, ...values };
  if (existing) {
    await tx.update(table)
      .set(table.updatedAt ? { ...recordValues, updatedAt: new Date() } : recordValues)
      .where(eq(table.id, existing.id));
    return existing.id;
  }
  const id = idFor(key);
  await tx.insert(table).values({ id, ...recordValues });
  return id;
}

async function upsertById(tx, table, id, values) {
  await tx.insert(table).values({ id, ...values }).onConflictDoUpdate({
    target: table.id,
    set: values,
  });
  return id;
}

async function getOrCreateUser(tx, { name, email, isHubAdmin, passwordHash, isActive }) {
  const normalizedEmail = email.trim().toLowerCase();
  const [existing] = await tx.select({ id: users.id }).from(users)
    .where(sql`lower(${users.email}) = ${normalizedEmail}`).limit(1);
  if (existing) {
    await tx.update(users).set({ name, email: normalizedEmail, phoneNumber: '+10000000001', isVerified: true, passwordHash, isHubAdmin, isActive, updatedAt: new Date() })
      .where(eq(users.id, existing.id));
    return existing.id;
  }
  const id = idFor(`user:${normalizedEmail}`);
  await tx.insert(users).values({ id, name, email: normalizedEmail, phoneNumber: '+10000000001', isVerified: true, passwordHash, isHubAdmin, isActive });
  return id;
}

async function getOrCreateDemoUser(tx, name, email) {
  const normalizedEmail = email.toLowerCase();
  const [existing] = await tx.select({ id: users.id }).from(users)
    .where(sql`lower(${users.email}) = ${normalizedEmail}`).limit(1);
  if (existing) return existing.id;
  const id = idFor(`user:${normalizedEmail}`);
  await tx.insert(users).values({
    id,
    name,
    email: normalizedEmail,
    phoneNumber: '+10000000000',
    isVerified: false,
    passwordHash: await hashPassword(randomUUID()),
    isHubAdmin: false,
    isActive: false,
  });
  return id;
}

const categoriesBySite = {
  'central-stores': [
    ['pcb-boards', 'PCB Boards', 'Bare and populated circuit boards'],
    ['capacitors', 'Capacitors', 'Ceramic, electrolytic, and film capacitors'],
    ['integrated-circuits', 'Integrated Circuits', 'Logic, interface, and control ICs'],
    ['resistors', 'Resistors', 'Through-hole and surface-mount resistors'],
    ['relays', 'Relays', 'Signal and power relays'],
    ['connectors', 'Connectors', 'Board, wire, and power connectors'],
    ['repair-parts', 'Repair Parts', 'Common replacement components for repair work'],
  ],
  'service-centre': [
    ['repair-components', 'Repair Components', 'Components used for PCB diagnosis and repair'],
    ['replacement-boards', 'Replacement Boards', 'Replacement PCB assemblies'],
  ],
  distribution: [
    ['field-electronics', 'Field Electronics', 'Electronic parts issued to field technicians'],
    ['service-consumables', 'Service Consumables', 'Consumables used during field service'],
  ],
};

const inventoryBySite = {
  'central-stores': [
    ['PCB-CTRL-8L', '8-layer control PCB', 'pcb-boards', 'each', 24, 8, 68.5, 'Control board for the HX industrial drive'],
    ['CAP-100U-25V', '100 µF 25 V electrolytic capacitor', 'capacitors', 'each', 420, 100, 0.18, 'Low-ESR radial capacitor'],
    ['CAP-10U-50V', '10 µF 50 V ceramic capacitor', 'capacitors', 'each', 32, 50, 0.12, 'X7R ceramic capacitor; reorder needed'],
    ['IC-STM32G4', 'STM32G4 microcontroller', 'integrated-circuits', 'each', 38, 12, 7.8, '32-bit control MCU'],
    ['IC-TI-DRV8323', 'Three-phase gate driver IC', 'integrated-circuits', 'each', 9, 10, 5.45, 'Motor-control gate driver; below reorder level'],
    ['RES-10K-0603', '10 kΩ 0603 resistor', 'resistors', 'each', 2400, 500, 0.01, '1% thick-film resistor'],
    ['REL-24V-10A', '24 V 10 A power relay', 'relays', 'each', 27, 8, 4.6, 'Single-pole normally-open relay'],
    ['CON-JST-XH4', 'JST-XH 4-pin connector', 'connectors', 'each', 160, 40, 0.22, '4-position board connector'],
    ['FUSE-5A-MINI', '5 A miniature blade fuse', 'repair-parts', 'each', 5, 20, 0.55, 'Automotive mini fuse; reorder needed'],
  ],
  'service-centre': [
    ['SRV-CAP-100U', '100 µF repair capacitor', 'repair-components', 'each', 36, 10, 0.2, 'Low-ESR replacement capacitor'],
    ['SRV-IC-DRV', 'Motor driver IC', 'repair-components', 'each', 14, 6, 5.45, 'Replacement power-stage driver'],
    ['SRV-PCB-HX', 'HX drive replacement PCB', 'replacement-boards', 'each', 3, 2, 74, 'Tested replacement board; reorder needed'],
  ],
  distribution: [
    ['FLD-CAP-100U', '100 µF field-repair capacitor', 'field-electronics', 'each', 80, 20, 0.2, 'Common field replacement part'],
    ['FLD-CON-XH4', '4-pin field connector', 'field-electronics', 'each', 45, 15, 0.25, 'Replacement cable-to-board connector'],
    ['FLD-SOLDER-KIT', 'Field solder and wick kit', 'service-consumables', 'kit', 12, 5, 8.75, 'Portable solder and desoldering kit'],
  ],
};

// The inventory quantities below are opening stock. These seeded operations
// consume stock, so the item balance and movement ledger must include them.
const seededStockIssues = {
  'service-centre': { 'SRV-IC-DRV': 1, 'SRV-CAP-100U': 3 },
  distribution: { 'FLD-CAP-100U': 12 },
};

try {
  const adminName = process.env.SEED_ADMIN_NAME?.trim() || 'OpsHub Administrator';
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
    throw new Error('Set a valid SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD.');
  }
  const adminPasswordHash = await hashPassword(adminPassword);

  await db.transaction(async (tx) => {
    const existingSites = await tx.select({ id: sites.id, slug: sites.slug })
      .from(sites)
      .where(inArray(sites.slug, DEMO_SITE_SLUGS));
    const siteIds = Object.fromEntries(existingSites.map((site) => [site.slug, site.id]));
    const missingSites = DEMO_SITE_SLUGS.filter((slug) => !siteIds[slug]);
    if (missingSites.length) {
      throw new Error(`Seed these sites before running newSeed.js: ${missingSites.join(', ')}`);
    }

    const adminId = await getOrCreateUser(tx, {
      name: adminName,
      email: adminEmail,
      passwordHash: adminPasswordHash,
      isHubAdmin: true,
      isActive: true,
    });

    const staff = {};
    for (const [slug, name, email, role] of [
      ['central-stores', 'Central Stores Manager', 'central.manager@demo.opshub.invalid', 'Manager'],
      ['central-stores', 'Central Stores Associate', 'central.associate@demo.opshub.invalid', 'Member'],
      ['service-centre', 'Service Centre Manager', 'service.manager@demo.opshub.invalid', 'Manager'],
      ['service-centre', 'Repair Technician', 'repair.technician@demo.opshub.invalid', 'Member'],
      ['distribution', 'Distribution Manager', 'distribution.manager@demo.opshub.invalid', 'Manager'],
      ['distribution', 'Field Technician', 'field.technician@demo.opshub.invalid', 'Member'],
    ]) {
      const userId = await getOrCreateDemoUser(tx, name, email);
      staff[email] = userId;
      await tx.insert(siteMembers).values({
        siteId: siteIds[slug],
        userId,
        role,
      }).onConflictDoUpdate({
        target: [siteMembers.siteId, siteMembers.userId],
        set: { role, updatedAt: new Date() },
      });
    }

    const categoryIds = {};
    const itemIds = {};
    for (const siteSlug of DEMO_SITE_SLUGS) {
      const siteId = siteIds[siteSlug];
      categoryIds[siteSlug] = {};
      itemIds[siteSlug] = {};
      for (const [key, name, description] of categoriesBySite[siteSlug]) {
        categoryIds[siteSlug][key] = await upsertByNaturalKey(
          tx, categories, siteId, { name }, { description, isActive: true }, `category:${siteSlug}:${key}`,
        );
      }
      for (const [sku, name, categoryKey, unit, quantity, reorder, price, description] of inventoryBySite[siteSlug]) {
        const currentQuantity = quantity - (seededStockIssues[siteSlug]?.[sku] || 0);
        const itemId = await upsertByNaturalKey(tx, items, siteId, { sku }, {
          name,
          description,
          categoryId: categoryIds[siteSlug][categoryKey],
          unit,
          quantityOnHand: String(currentQuantity),
          reorderLevel: String(reorder),
          unitPrice: String(price),
          metadata: { demoRecord: true, source: 'electronics-operations-demo' },
        }, `item:${siteSlug}:${sku}`);
        itemIds[siteSlug][sku] = itemId;
        await upsertById(tx, stockMovements, idFor(`stock-movement:${siteSlug}:${sku}:opening`), {
          siteId,
          itemId,
          movementType: 'receipt',
          quantity: String(quantity),
          balanceAfter: String(quantity),
          referenceType: 'seed',
          note: 'Demo opening stock',
          createdBy: adminId,
        });
      }
    }

    const centralId = siteIds['central-stores'];
    const serviceId = siteIds['service-centre'];
    const distributionId = siteIds.distribution;
    const centralManagerId = staff['central.manager@demo.opshub.invalid'];
    const repairTechId = staff['repair.technician@demo.opshub.invalid'];
    const distributionManagerId = staff['distribution.manager@demo.opshub.invalid'];
    const fieldTechId = staff['field.technician@demo.opshub.invalid'];

    await upsertById(tx, excelJobs, idFor('excel-job:central-stores:import'), {
      siteId: centralId,
      type: 'import',
      status: 'completed',
      resource: 'inventory',
      fileName: 'central-stores-opening-stock.xlsx',
      requestedBy: adminId,
      rowCount: inventoryBySite['central-stores'].length,
      result: { created: inventoryBySite['central-stores'].length, updated: 0, errors: [] },
      startedAt: new Date(),
      completedAt: new Date(),
    });
    await upsertById(tx, excelJobs, idFor('excel-job:central-stores:export'), {
      siteId: centralId,
      type: 'export',
      status: 'completed',
      resource: 'inventory',
      fileName: 'central-stores-inventory-export.xlsx',
      requestedBy: adminId,
      rowCount: inventoryBySite['central-stores'].length,
      result: { exported: inventoryBySite['central-stores'].length },
      startedAt: new Date(),
      completedAt: new Date(),
    });

    const serviceRequestIds = {};
    for (const request of [
      {
        number: 'SR-REQ-1001',
        requestedBy: repairTechId,
        status: 'in-repair',
        priority: 'High',
        step: 1,
        notes: 'Approved intake; technician diagnosis is in progress.',
        metadata: { customer: 'Northstar Fabrication', device: 'HX-400 motor controller', serialNo: 'HX4-220184', issue: 'Intermittent shutdown under load', estimate: 185 },
      },
      {
        number: 'SR-REQ-1002',
        requestedBy: repairTechId,
        status: 'in-repair',
        priority: 'Normal',
        step: 1,
        notes: 'Approved PCB repair; replacement driver IC required.',
        metadata: { customer: 'Beacon Cold Storage', device: 'BCS-12 control PCB', serialNo: 'BCS12-00873', issue: 'No compressor output; driver stage damaged', estimate: 96 },
      },
      {
        number: 'SR-REQ-1003',
        requestedBy: repairTechId,
        status: 'closed',
        priority: 'Low',
        step: 1,
        notes: 'Repair and burn-in passed; board is ready for customer return.',
        metadata: { customer: 'Metro Water Systems', device: 'MW-2 pump controller', serialNo: 'MW2-44019', issue: 'Bulged DC-link capacitor', estimate: 58 },
      },
    ]) {
      serviceRequestIds[request.number] = await upsertByNaturalKey(tx, requests, serviceId,
        { requestNumber: request.number }, {
          requestedBy: request.requestedBy,
          status: request.status,
          priority: request.priority,
          currentStep: request.step,
          team: 'PCB Repair',
          notes: request.notes,
          metadata: request.metadata,
        }, `request:service-centre:${request.number}`);
    }

    for (const [number, decision, comment] of [
      ['SR-REQ-1001', 'approve', 'Approved for diagnosis and repair.'],
      ['SR-REQ-1002', 'approve', 'Approved for component-level repair.'],
      ['SR-REQ-1003', 'approve', 'Approved; repair has passed final test.'],
    ]) {
      const requestId = serviceRequestIds[number];
      await upsertById(tx, approvals, idFor(`approval:service-centre:${number}:manager`), {
        siteId: serviceId,
        requestId,
        step: 0,
        requiredRole: 'Manager',
        decision,
        decidedBy: decision === 'pending' ? null : staff['service.manager@demo.opshub.invalid'],
        comment,
        decidedAt: decision === 'pending' ? null : new Date(),
      });
    }

    const serviceRepairIds = {};
    for (const repair of [
      {
        ticket: 'SR-24001',
        request: 'SR-REQ-1001',
        customer: 'Northstar Fabrication',
        contact: '+1-555-0101',
        board: 'HX-400 motor controller',
        serial: 'HX4-220184',
        fault: 'Intermittent shutdown under load; thermal discoloration near the gate driver.',
        diagnosis: 'Approved; intake inspection is complete and diagnosis is in progress.',
        stage: 'diagnosis',
        status: 'in-progress',
        partsCost: 0,
        labourCost: 0,
      },
      {
        ticket: 'SR-24002',
        request: 'SR-REQ-1002',
        customer: 'Beacon Cold Storage',
        contact: '+1-555-0102',
        board: 'BCS-12 control PCB',
        serial: 'BCS12-00873',
        fault: 'Compressor output missing; gate-driver channel is shorted.',
        diagnosis: 'Replace motor driver IC and repeat loaded thermal test.',
        stage: 'repairing',
        status: 'in-progress',
        partsCost: 5.45,
        labourCost: 42,
      },
      {
        ticket: 'SR-24003',
        request: 'SR-REQ-1003',
        customer: 'Metro Water Systems',
        contact: '+1-555-0103',
        board: 'MW-2 pump controller',
        serial: 'MW2-44019',
        fault: 'DC-link capacitor swollen; periodic reset reported.',
        diagnosis: 'Replaced capacitor bank and passed 2-hour burn-in test.',
        stage: 'completed',
        status: 'completed',
        partsCost: 0.6,
        labourCost: 28,
      },
    ]) {
      serviceRepairIds[repair.ticket] = await upsertByNaturalKey(tx, repairRecords, serviceId,
        { ticketNumber: repair.ticket }, {
          requestId: serviceRequestIds[repair.request],
          customerName: repair.customer,
          customerContact: repair.contact,
          device: repair.board,
          serialNo: repair.serial,
          fault: repair.fault,
          diagnosis: repair.diagnosis,
          stage: repair.stage,
          status: repair.status,
          technicianId: repairTechId,
          partsCost: String(repair.partsCost),
          labourCost: String(repair.labourCost),
          metadata: { demoRecord: true },
          completedAt: repair.status === 'completed' ? new Date() : null,
        }, `repair:service-centre:${repair.ticket}`);
    }

    const driverItemId = itemIds['service-centre']['SRV-IC-DRV'];
    const capacitorItemId = itemIds['service-centre']['SRV-CAP-100U'];
    const repairPartIds = {};
    repairPartIds['SR-24002'] = await upsertById(tx, repairParts, idFor('repair-part:SR-24002:driver'), {
      siteId: serviceId,
      repairRecordId: serviceRepairIds['SR-24002'],
      itemId: driverItemId,
      description: 'Motor driver IC replacement',
      quantity: '1',
      unitCost: '5.45',
    });
    repairPartIds['SR-24003'] = await upsertById(tx, repairParts, idFor('repair-part:SR-24003:capacitor'), {
      siteId: serviceId,
      repairRecordId: serviceRepairIds['SR-24003'],
      itemId: capacitorItemId,
      description: '100 µF DC-link replacement capacitor',
      quantity: '3',
      unitCost: '0.20',
    });

    for (const [ticket, sku, quantity, balanceAfter] of [
      ['SR-24002', 'SRV-IC-DRV', 1, 13],
      ['SR-24003', 'SRV-CAP-100U', 3, 33],
    ]) {
      await upsertById(tx, stockMovements, idFor(`stock-movement:service-centre:${ticket}:parts`), {
        siteId: serviceId,
        itemId: itemIds['service-centre'][sku],
        movementType: 'issue',
        quantity: String(quantity),
        balanceAfter: String(balanceAfter),
        referenceType: 'repair',
        referenceId: serviceRepairIds[ticket],
        note: `Parts issued to repair ${ticket}`,
        createdBy: repairTechId,
      });
    }

    const serviceReturnId = await upsertByNaturalKey(tx, returns, serviceId,
      { returnNumber: 'SR-RET-24003' }, {
        type: 'repair',
        status: 'pending',
        assignmentId: null,
        repairRecordId: serviceRepairIds['SR-24003'],
        receivedBy: repairTechId,
        receivedAt: null,
        notes: 'Repaired pump controller awaiting customer collection.',
      }, 'return:service-centre:SR-RET-24003');
    await upsertById(tx, returnItems, idFor('return-item:SR-RET-24003:capacitor'), {
      siteId: serviceId,
      returnId: serviceReturnId,
      itemId: capacitorItemId,
      assignmentItemId: null,
      repairPartId: repairPartIds['SR-24003'],
      quantity: '3',
      condition: 'Installed',
      notes: 'Replacement parts recorded against completed repair.',
    });

    const distributionRequestIds = {};
    for (const request of [
      {
        number: 'FD-REQ-5001',
        requestedBy: fieldTechId,
        status: 'assigned',
        priority: 'High',
        currentStep: 1,
        team: 'North Field Team',
        notes: 'Parts requested for scheduled cold-storage controller visit.',
        sku: 'FLD-CAP-100U',
        quantity: '12',
      },
      {
        number: 'FD-REQ-5002',
        requestedBy: fieldTechId,
        status: 'pending',
        priority: 'Normal',
        currentStep: 0,
        team: 'East Field Team',
        notes: 'Connector replacements requested for pump station callout.',
        sku: 'FLD-CON-XH4',
        quantity: '8',
      },
    ]) {
      const requestId = await upsertByNaturalKey(tx, requests, distributionId,
        { requestNumber: request.number }, {
          requestedBy: request.requestedBy,
          status: request.status,
          priority: request.priority,
          currentStep: request.currentStep,
          team: request.team,
          notes: request.notes,
          metadata: { source: 'field-material-request' },
        }, `request:distribution:${request.number}`);
      distributionRequestIds[request.number] = requestId;
      const itemId = itemIds.distribution[request.sku];
      await upsertById(tx, requestItems, idFor(`request-item:distribution:${request.number}`), {
        siteId: distributionId,
        requestId,
        itemId,
        description: inventoryBySite.distribution.find(([sku]) => sku === request.sku)[1],
        quantity: request.quantity,
        unitPrice: request.sku === 'FLD-CAP-100U' ? '0.20' : '0.25',
        metadata: { demoRecord: true },
      });
      await upsertById(tx, approvals, idFor(`approval:distribution:${request.number}:manager`), {
        siteId: distributionId,
        requestId,
        step: 0,
        requiredRole: 'Manager',
        decision: request.number === 'FD-REQ-5001' ? 'approve' : 'pending',
        decidedBy: request.number === 'FD-REQ-5001' ? distributionManagerId : null,
        comment: request.number === 'FD-REQ-5001' ? 'Approved for the scheduled field visit.' : null,
        decidedAt: request.number === 'FD-REQ-5001' ? new Date() : null,
      });
    }

    const assignmentId = await upsertByNaturalKey(tx, assignments, distributionId,
      { assignmentNumber: 'FD-ASG-5001' }, {
        requestId: distributionRequestIds['FD-REQ-5001'],
        assignedTo: fieldTechId,
        assignee: 'Field Technician',
        assignedBy: distributionManagerId,
        status: 'in-use',
        notes: 'Issued for North Field Team callout.',
      }, 'assignment:distribution:FD-ASG-5001');
    const assignmentItemId = await upsertById(tx, assignmentItems, idFor('assignment-item:FD-ASG-5001:FLD-CAP-100U'), {
      siteId: distributionId,
      assignmentId,
      requestItemId: idFor('request-item:distribution:FD-REQ-5001'),
      itemId: itemIds.distribution['FLD-CAP-100U'],
      quantity: '12',
      remainingQuantity: '5',
    });
    await upsertById(tx, stockMovements, idFor('stock-movement:distribution:FD-ASG-5001:issue'), {
      siteId: distributionId,
      itemId: itemIds.distribution['FLD-CAP-100U'],
      movementType: 'issue',
      quantity: '12',
      balanceAfter: '68',
      referenceType: 'assignment',
      referenceId: assignmentId,
      note: 'Materials issued to field assignment FD-ASG-5001',
      createdBy: distributionManagerId,
    });
    await upsertById(tx, consumptionRecords, idFor('consumption:FD-ASG-5001:FLD-CAP-100U'), {
      siteId: distributionId,
      assignmentItemId,
      quantity: '7',
      consumedBy: fieldTechId,
      note: 'Replaced failed capacitors on compressor control board.',
    });

    const distributionReturnId = await upsertByNaturalKey(tx, returns, distributionId,
      { returnNumber: 'FD-RET-5001' }, {
        type: 'material',
        status: 'pending',
        assignmentId,
        repairRecordId: null,
        receivedBy: null,
        receivedAt: null,
        notes: 'Unused materials returned from North Field Team callout.',
      }, 'return:distribution:FD-RET-5001');
    await upsertById(tx, returnItems, idFor('return-item:FD-RET-5001:FLD-CAP-100U'), {
      siteId: distributionId,
      returnId: distributionReturnId,
      itemId: itemIds.distribution['FLD-CAP-100U'],
      assignmentItemId,
      repairPartId: null,
      quantity: '5',
      condition: 'Good',
      notes: 'Unopened parts returned for inspection and restock.',
    });
  });

  console.log('Electronics demo users, inventory, and operational workflows seeded.');
} finally {
  await pool.end();
}
