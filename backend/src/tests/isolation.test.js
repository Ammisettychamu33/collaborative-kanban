import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../server.js';
import { seedDatabase } from '../database/seed.js';
import { prisma } from '../database/db.js';

let hydUserToken, blrUserToken, mumbaiUserToken;
let hydTenantId, blrTenantId, mumbaiTenantId;
let hydBoardId, blrBoardId, hydTaskId, blrColumnId;
let mumbaiMemberUserId;

beforeAll(async () => {
  const user = await prisma.user.findFirst();
  if (!user) {
    await seedDatabase();
  }

  // Log in as Hyderabad Member
  const hydLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: 'hydmember@acme.com', password: 'Password123!' });
  hydUserToken = hydLogin.body.token;

  // Log in as Bangalore Member
  const blrLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: 'blrmember@acme.com', password: 'Password123!' });
  blrUserToken = blrLogin.body.token;

  // Log in as Mumbai Member (Globex Logistics - Org B)
  const mumbaiLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: 'mumbaimember@globex.com', password: 'Password123!' });
  mumbaiUserToken = mumbaiLogin.body.token;

  // Fetch tenant and board IDs from DB
  const tenants = await prisma.tenant.findMany();
  hydTenantId = tenants.find((t) => t.name.includes('Hyderabad')).id;
  blrTenantId = tenants.find((t) => t.name.includes('Bangalore')).id;
  mumbaiTenantId = tenants.find((t) => t.name.includes('Mumbai')).id;

  const hydBoard = await prisma.board.findFirst({ where: { tenantId: hydTenantId } });
  hydBoardId = hydBoard.id;

  const blrBoard = await prisma.board.findFirst({ where: { tenantId: blrTenantId } });
  blrBoardId = blrBoard.id;

  const blrCol = await prisma.column.findFirst({ where: { tenantId: blrTenantId } });
  blrColumnId = blrCol.id;

  const hydTask = await prisma.task.findFirst({ where: { tenantId: hydTenantId } });
  hydTaskId = hydTask.id;

  const mumbaiMember = await prisma.user.findUnique({ where: { email: 'mumbaimember@globex.com' } });
  mumbaiMemberUserId = mumbaiMember.id;
});

describe('Mandatory Strict Multi-Tenant & Multi-Organization Isolation Suite', () => {
  it('1. Hyderabad user cannot read Bangalore tasks (returns 403 Forbidden)', async () => {
    const res = await request(app)
      .get('/api/tasks')
      .set('Authorization', `Bearer ${hydUserToken}`)
      .set('x-tenant-id', blrTenantId);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_TENANT_ACCESS');
  });

  it('2. Bangalore user cannot update Hyderabad board (returns 403 Forbidden)', async () => {
    const res = await request(app)
      .put(`/api/boards/${hydBoardId}`)
      .set('Authorization', `Bearer ${blrUserToken}`)
      .set('x-tenant-id', blrTenantId)
      .send({ name: 'Hacked Board Name' });

    // Bangalore user operating in Bangalore tenant cannot touch Hyderabad board
    expect([403, 404]).toContain(res.status);
  });

  it('3. User cannot switch tenants by modifying a request payload without valid membership', async () => {
    const res = await request(app)
      .get('/api/boards')
      .set('Authorization', `Bearer ${hydUserToken}`)
      .set('x-tenant-id', blrTenantId); // Trying to forge Bangalore tenant

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_TENANT_ACCESS');
  });

  it('4. Acme user cannot access Globex Mumbai tenant (cross-organization isolation)', async () => {
    const res = await request(app)
      .get('/api/boards')
      .set('Authorization', `Bearer ${hydUserToken}`)
      .set('x-tenant-id', mumbaiTenantId);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_TENANT_ACCESS');
  });

  it('5. Task cannot be moved into a column from another tenant (cross-tenant move rejection)', async () => {
    const res = await request(app)
      .patch(`/api/tasks/${hydTaskId}/move`)
      .set('Authorization', `Bearer ${hydUserToken}`)
      .set('x-tenant-id', hydTenantId)
      .send({
        columnId: blrColumnId, // Foreign Bangalore column!
        position: 0,
        version: 1,
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_DESTINATION_COLUMN');
  });

  it('6. Unauthorized users cannot assign tasks to inaccessible users outside the tenant', async () => {
    const hydCol = await prisma.column.findFirst({ where: { tenantId: hydTenantId } });

    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${hydUserToken}`)
      .set('x-tenant-id', hydTenantId)
      .send({
        boardId: hydBoardId,
        columnId: hydCol.id,
        title: 'Illegal Assignment Task',
        assignedTo: mumbaiMemberUserId, // User from Globex Mumbai!
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_ASSIGNEE');
  });

  it('7. Unauthorized users cannot view activity logs from another tenant', async () => {
    const res = await request(app)
      .get('/api/activity')
      .set('Authorization', `Bearer ${hydUserToken}`)
      .set('x-tenant-id', blrTenantId);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_TENANT_ACCESS');
  });

  it('8. A user cannot delete a task belonging to another tenant', async () => {
    const blrTask = await prisma.task.findFirst({ where: { tenantId: blrTenantId } });

    const res = await request(app)
      .delete(`/api/tasks/${blrTask.id}`)
      .set('Authorization', `Bearer ${hydUserToken}`)
      .set('x-tenant-id', hydTenantId); // Trying to delete blrTask under hyd tenant context

    expect(res.status).toBe(404);
  });
});
