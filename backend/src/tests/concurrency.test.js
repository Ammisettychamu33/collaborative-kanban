import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../server.js';
import { seedDatabase } from '../database/seed.js';
import { prisma } from '../database/db.js';

let hydUserToken, hydTenantId, hydBoardId, hydColumnId;

beforeAll(async () => {
  const user = await prisma.user.findFirst();
  if (!user) {
    await seedDatabase();
  }

  const hydLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: 'hydadmin@acme.com', password: 'Password123!' });
  hydUserToken = hydLogin.body.token;

  const tenant = await prisma.tenant.findFirst({ where: { name: { contains: 'Hyderabad' } } });
  hydTenantId = tenant.id;

  const board = await prisma.board.findFirst({ where: { tenantId: hydTenantId } });
  hydBoardId = board.id;

  const column = await prisma.column.findFirst({ where: { tenantId: hydTenantId } });
  hydColumnId = column.id;
});

describe('Optimistic Concurrency Control & Conflict Resolution Suite', () => {
  it('should successfully update task when client version matches current version', async () => {
    // 1. Create task (initial version = 1)
    const createRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${hydUserToken}`)
      .set('x-tenant-id', hydTenantId)
      .send({
        boardId: hydBoardId,
        columnId: hydColumnId,
        title: 'Original Title',
        priority: 'MEDIUM',
      });

    expect(createRes.status).toBe(201);
    const task = createRes.body;
    expect(task.version).toBe(1);

    // 2. Update task with version 1 -> should increment to version 2
    const updateRes = await request(app)
      .put(`/api/tasks/${task.id}`)
      .set('Authorization', `Bearer ${hydUserToken}`)
      .set('x-tenant-id', hydTenantId)
      .send({
        title: 'Updated Title by User 1',
        version: 1,
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.title).toBe('Updated Title by User 1');
    expect(updateRes.body.version).toBe(2);
  });

  it('should return HTTP 409 Conflict when submitting a stale version', async () => {
    // Create task
    const createRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${hydUserToken}`)
      .set('x-tenant-id', hydTenantId)
      .send({
        boardId: hydBoardId,
        columnId: hydColumnId,
        title: 'Concurrency Test Task',
        priority: 'HIGH',
      });

    const task = createRes.body;

    // First update commits version 2
    await request(app)
      .put(`/api/tasks/${task.id}`)
      .set('Authorization', `Bearer ${hydUserToken}`)
      .set('x-tenant-id', hydTenantId)
      .send({ title: 'First Edit', version: 1 });

    // Second client attempts to update using stale version 1
    const staleRes = await request(app)
      .put(`/api/tasks/${task.id}`)
      .set('Authorization', `Bearer ${hydUserToken}`)
      .set('x-tenant-id', hydTenantId)
      .send({ title: 'Stale Edit', version: 1 });

    expect(staleRes.status).toBe(409);
    expect(staleRes.body.code).toBe('CONCURRENCY_CONFLICT');
    expect(staleRes.body.currentVersion).toBe(2);
    expect(staleRes.body.task.title).toBe('First Edit');
  });

  it('should handle competing simultaneous updates safely with only one succeeding', async () => {
    const createRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${hydUserToken}`)
      .set('x-tenant-id', hydTenantId)
      .send({
        boardId: hydBoardId,
        columnId: hydColumnId,
        title: 'Competing Race Condition Task',
      });

    const taskId = createRes.body.id;

    // Two users simultaneously send updates with version 1
    const [res1, res2] = await Promise.all([
      request(app)
        .put(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${hydUserToken}`)
        .set('x-tenant-id', hydTenantId)
        .send({ title: 'Client A Won', version: 1 }),
      request(app)
        .put(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${hydUserToken}`)
        .set('x-tenant-id', hydTenantId)
        .send({ title: 'Client B Won', version: 1 }),
    ]);

    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([200, 409]);
  });

  it('should reject undo if task version does not match expected version', async () => {
    const createRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${hydUserToken}`)
      .set('x-tenant-id', hydTenantId)
      .send({
        boardId: hydBoardId,
        columnId: hydColumnId,
        title: 'Task For Undo',
      });

    const taskId = createRes.body.id;

    // Mutate to version 2
    await request(app)
      .put(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${hydUserToken}`)
      .set('x-tenant-id', hydTenantId)
      .send({ title: 'Mutated Title', version: 1 });

    // Client attempts undo expecting version 1
    const undoRes = await request(app)
      .post(`/api/tasks/${taskId}/undo`)
      .set('Authorization', `Bearer ${hydUserToken}`)
      .set('x-tenant-id', hydTenantId)
      .send({ title: 'Task For Undo', version: 1 });

    expect(undoRes.status).toBe(409);
    expect(undoRes.body.code).toBe('UNDO_CONFLICT');
  });
});
