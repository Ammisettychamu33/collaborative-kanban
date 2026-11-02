import bcrypt from 'bcryptjs';
import { prisma } from './db.js';

export async function seedDatabase() {
  console.log('[Seed] Starting database seeding...');

  // Clean existing data in reverse order of foreign keys
  await prisma.activityLog.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.column.deleteMany({});
  await prisma.board.deleteMany({});
  await prisma.membership.deleteMany({});
  await prisma.tenant.deleteMany({});
  await prisma.organization.deleteMany({});
  await prisma.user.deleteMany({});

  const passwordHash = await bcrypt.hash('Password123!', 10);

  // 1. Create Organizations
  const orgA = await prisma.organization.create({
    data: { name: 'Acme Technologies' },
  });
  const orgB = await prisma.organization.create({
    data: { name: 'Globex Logistics' },
  });

  console.log(`[Seed] Organizations created: ${orgA.name}, ${orgB.name}`);

  // 2. Create Tenants
  const tenantHyd = await prisma.tenant.create({
    data: {
      organizationId: orgA.id,
      name: 'Hyderabad Engineering Hub',
    },
  });

  const tenantBlr = await prisma.tenant.create({
    data: {
      organizationId: orgA.id,
      name: 'Bangalore Operations',
    },
  });

  const tenantMumbai = await prisma.tenant.create({
    data: {
      organizationId: orgB.id,
      name: 'Mumbai Dispatch Center',
    },
  });

  console.log(`[Seed] Tenants created: Hyd (${tenantHyd.id}), Blr (${tenantBlr.id}), Mumbai (${tenantMumbai.id})`);

  // 3. Create Users
  const userOrgAdmin = await prisma.user.create({
    data: {
      name: 'Aarav Sharma (Org Admin)',
      email: 'orgadmin@acme.com',
      passwordHash,
    },
  });

  const userHydAdmin = await prisma.user.create({
    data: {
      name: 'Priya Reddy (Tenant Admin)',
      email: 'hydadmin@acme.com',
      passwordHash,
    },
  });

  const userHydDev = await prisma.user.create({
    data: {
      name: 'Vikram Verma (Member)',
      email: 'hydmember@acme.com',
      passwordHash,
    },
  });

  const userBlrAdmin = await prisma.user.create({
    data: {
      name: 'Suresh Kumar (Tenant Admin)',
      email: 'blradmin@acme.com',
      passwordHash,
    },
  });

  const userBlrMember = await prisma.user.create({
    data: {
      name: 'Ananya Rao (Member)',
      email: 'blrmember@acme.com',
      passwordHash,
    },
  });

  const userMumbaiAdmin = await prisma.user.create({
    data: {
      name: 'Rohan Mehta (Globex Admin)',
      email: 'mumbaiadmin@globex.com',
      passwordHash,
    },
  });

  const userMumbaiMember = await prisma.user.create({
    data: {
      name: 'Neha Patil (Globex Member)',
      email: 'mumbaimember@globex.com',
      passwordHash,
    },
  });

  // 4. Create Memberships
  // Aarav: ORG_ADMIN of Acme Technologies
  await prisma.membership.create({
    data: {
      userId: userOrgAdmin.id,
      organizationId: orgA.id,
      role: 'ORG_ADMIN',
    },
  });

  // Priya: TENANT_ADMIN of Hyderabad
  await prisma.membership.create({
    data: {
      userId: userHydAdmin.id,
      organizationId: orgA.id,
      tenantId: tenantHyd.id,
      role: 'TENANT_ADMIN',
    },
  });

  // Vikram: MEMBER of Hyderabad
  await prisma.membership.create({
    data: {
      userId: userHydDev.id,
      organizationId: orgA.id,
      tenantId: tenantHyd.id,
      role: 'MEMBER',
    },
  });

  // Suresh: TENANT_ADMIN of Bangalore
  await prisma.membership.create({
    data: {
      userId: userBlrAdmin.id,
      organizationId: orgA.id,
      tenantId: tenantBlr.id,
      role: 'TENANT_ADMIN',
    },
  });

  // Ananya: MEMBER of Bangalore
  await prisma.membership.create({
    data: {
      userId: userBlrMember.id,
      organizationId: orgA.id,
      tenantId: tenantBlr.id,
      role: 'MEMBER',
    },
  });

  // Rohan: TENANT_ADMIN of Mumbai, Globex
  await prisma.membership.create({
    data: {
      userId: userMumbaiAdmin.id,
      organizationId: orgB.id,
      tenantId: tenantMumbai.id,
      role: 'TENANT_ADMIN',
    },
  });

  // Neha: MEMBER of Mumbai, Globex
  await prisma.membership.create({
    data: {
      userId: userMumbaiMember.id,
      organizationId: orgB.id,
      tenantId: tenantMumbai.id,
      role: 'MEMBER',
    },
  });

  // 5. Create Boards & Columns
  // Hyderabad Board 1: Core Platform Sprint
  const boardHyd = await prisma.board.create({
    data: {
      organizationId: orgA.id,
      tenantId: tenantHyd.id,
      name: 'Core Platform Sprint 42',
      description: 'Q4 Core microservices, real-time sync, and tenant isolation delivery',
      createdBy: userHydAdmin.id,
    },
  });

  const hydCols = await Promise.all([
    prisma.column.create({ data: { boardId: boardHyd.id, tenantId: tenantHyd.id, name: 'To Do', position: 0 } }),
    prisma.column.create({ data: { boardId: boardHyd.id, tenantId: tenantHyd.id, name: 'In Progress', position: 1 } }),
    prisma.column.create({ data: { boardId: boardHyd.id, tenantId: tenantHyd.id, name: 'Testing', position: 2 } }),
    prisma.column.create({ data: { boardId: boardHyd.id, tenantId: tenantHyd.id, name: 'Done', position: 3 } }),
  ]);

  // Bangalore Board 1: Supply Chain Ops
  const boardBlr = await prisma.board.create({
    data: {
      organizationId: orgA.id,
      tenantId: tenantBlr.id,
      name: 'Bangalore Fleet Orchestration',
      description: 'Fleet routing and vendor telemetry monitoring',
      createdBy: userBlrAdmin.id,
    },
  });

  const blrCols = await Promise.all([
    prisma.column.create({ data: { boardId: boardBlr.id, tenantId: tenantBlr.id, name: 'To Do', position: 0 } }),
    prisma.column.create({ data: { boardId: boardBlr.id, tenantId: tenantBlr.id, name: 'In Progress', position: 1 } }),
    prisma.column.create({ data: { boardId: boardBlr.id, tenantId: tenantBlr.id, name: 'Testing', position: 2 } }),
    prisma.column.create({ data: { boardId: boardBlr.id, tenantId: tenantBlr.id, name: 'Done', position: 3 } }),
  ]);

  // Mumbai Board 1: Globex Cargo Inbound
  const boardMumbai = await prisma.board.create({
    data: {
      organizationId: orgB.id,
      tenantId: tenantMumbai.id,
      name: 'Western Port Cargo Inbound',
      description: 'Container clearance, customs verification, and dock assignment',
      createdBy: userMumbaiAdmin.id,
    },
  });

  const mumbaiCols = await Promise.all([
    prisma.column.create({ data: { boardId: boardMumbai.id, tenantId: tenantMumbai.id, name: 'To Do', position: 0 } }),
    prisma.column.create({ data: { boardId: boardMumbai.id, tenantId: tenantMumbai.id, name: 'In Progress', position: 1 } }),
    prisma.column.create({ data: { boardId: boardMumbai.id, tenantId: tenantMumbai.id, name: 'Testing', position: 2 } }),
    prisma.column.create({ data: { boardId: boardMumbai.id, tenantId: tenantMumbai.id, name: 'Done', position: 3 } }),
  ]);

  // 6. Create Tasks for Hyderabad
  await prisma.task.createMany({
    data: [
      {
        boardId: boardHyd.id,
        columnId: hydCols[0].id,
        tenantId: tenantHyd.id,
        title: 'Implement Tenant-Scoped WebSocket Rooms',
        description: 'Ensure sockets verify tenant membership on handshake and only subscribe to authorized rooms.',
        priority: 'URGENT',
        assignedTo: userHydDev.id,
        position: 0,
        version: 1,
        createdBy: userHydAdmin.id,
        dueDate: new Date(Date.now() + 86400000 * 2),
      },
      {
        boardId: boardHyd.id,
        columnId: hydCols[0].id,
        tenantId: tenantHyd.id,
        title: 'Design Optimistic Concurrency Control',
        description: 'Verify task version on PATCH/PUT and return 409 Conflict if stale.',
        priority: 'HIGH',
        assignedTo: userHydDev.id,
        position: 1,
        version: 1,
        createdBy: userHydAdmin.id,
        dueDate: new Date(Date.now() + 86400000 * 3),
      },
      {
        boardId: boardHyd.id,
        columnId: hydCols[1].id,
        tenantId: tenantHyd.id,
        title: 'Build Drag-and-Drop Task Reordering',
        description: 'Use dnd-kit for seamless drag between columns with optimistic UI updates.',
        priority: 'HIGH',
        assignedTo: userHydDev.id,
        position: 0,
        version: 1,
        createdBy: userHydAdmin.id,
        dueDate: new Date(Date.now() + 86400000 * 1),
      },
      {
        boardId: boardHyd.id,
        columnId: hydCols[2].id,
        tenantId: tenantHyd.id,
        title: 'Automated Isolation Test Suite',
        description: 'Write comprehensive Supertest tests verifying cross-tenant and cross-org access is blocked.',
        priority: 'MEDIUM',
        assignedTo: userHydAdmin.id,
        position: 0,
        version: 1,
        createdBy: userHydAdmin.id,
        dueDate: new Date(Date.now() + 86400000 * 4),
      },
      {
        boardId: boardHyd.id,
        columnId: hydCols[3].id,
        tenantId: tenantHyd.id,
        title: 'Database Schema & Foreign Key Constraints',
        description: 'Set up UUID keys, indexes, and cascading deletion for tenant entities.',
        priority: 'LOW',
        assignedTo: userHydAdmin.id,
        position: 0,
        version: 1,
        createdBy: userHydAdmin.id,
        dueDate: new Date(Date.now() - 86400000),
      },
    ],
  });

  // Tasks for Bangalore
  await prisma.task.createMany({
    data: [
      {
        boardId: boardBlr.id,
        columnId: blrCols[0].id,
        tenantId: tenantBlr.id,
        title: 'Inspect Bangalore Hub Fuel Logs',
        description: 'Review monthly transit logs and driver overtime sheets.',
        priority: 'MEDIUM',
        assignedTo: userBlrMember.id,
        position: 0,
        version: 1,
        createdBy: userBlrAdmin.id,
      },
      {
        boardId: boardBlr.id,
        columnId: blrCols[1].id,
        tenantId: tenantBlr.id,
        title: 'Calibrate GPS Gate Sensors',
        description: 'Hardware maintenance on bay 4 and bay 9 entry gates.',
        priority: 'URGENT',
        assignedTo: userBlrMember.id,
        position: 0,
        version: 1,
        createdBy: userBlrAdmin.id,
      },
    ],
  });

  // Tasks for Mumbai (Globex)
  await prisma.task.createMany({
    data: [
      {
        boardId: boardMumbai.id,
        columnId: mumbaiCols[0].id,
        tenantId: tenantMumbai.id,
        title: 'Customs Declaration for Vessel MH-402',
        description: 'Submit cargo manifest to Jawaharlal Nehru Port Trust customs.',
        priority: 'URGENT',
        assignedTo: userMumbaiMember.id,
        position: 0,
        version: 1,
        createdBy: userMumbaiAdmin.id,
      },
      {
        boardId: boardMumbai.id,
        columnId: mumbaiCols[3].id,
        tenantId: tenantMumbai.id,
        title: 'Cold Storage Temperature Audit',
        description: 'All 12 reefer units verified between 2°C and 4°C.',
        priority: 'LOW',
        assignedTo: userMumbaiAdmin.id,
        position: 0,
        version: 1,
        createdBy: userMumbaiAdmin.id,
      },
    ],
  });

  // 7. Activity Logs
  await prisma.activityLog.create({
    data: {
      tenantId: tenantHyd.id,
      userId: userHydAdmin.id,
      entityType: 'BOARD',
      entityId: boardHyd.id,
      action: 'CREATED',
      details: { boardName: boardHyd.name },
    },
  });

  await prisma.activityLog.create({
    data: {
      tenantId: tenantHyd.id,
      userId: userHydDev.id,
      entityType: 'TASK',
      entityId: 'initial-setup',
      action: 'INITIALIZED',
      details: { message: 'Initialized Core Platform Sprint 42 tasks.' },
    },
  });

  console.log('[Seed] Seeding completed successfully!');
  return {
    orgs: [orgA, orgB],
    tenants: [tenantHyd, tenantBlr, tenantMumbai],
    users: [
      { email: 'orgadmin@acme.com', role: 'ORG_ADMIN', org: 'Acme Technologies' },
      { email: 'hydadmin@acme.com', role: 'TENANT_ADMIN', tenant: 'Hyderabad Engineering Hub' },
      { email: 'hydmember@acme.com', role: 'MEMBER', tenant: 'Hyderabad Engineering Hub' },
      { email: 'blradmin@acme.com', role: 'TENANT_ADMIN', tenant: 'Bangalore Operations' },
      { email: 'blrmember@acme.com', role: 'MEMBER', tenant: 'Bangalore Operations' },
      { email: 'mumbaiadmin@globex.com', role: 'TENANT_ADMIN', tenant: 'Mumbai Dispatch Center' },
      { email: 'mumbaimember@globex.com', role: 'MEMBER', tenant: 'Mumbai Dispatch Center' },
    ],
  };
}

if (process.argv[1]?.endsWith('seed.js')) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Seed Error]:', err);
      process.exit(1);
    });
}
