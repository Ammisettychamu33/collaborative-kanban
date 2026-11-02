import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../server.js';
import { seedDatabase } from '../database/seed.js';

import { prisma } from '../database/db.js';

beforeAll(async () => {
  const user = await prisma.user.findFirst();
  if (!user) {
    await seedDatabase();
  }
}, 25000);

describe('Authentication & Authorization Suite', () => {
  it('should successfully register a new user and create an organization', async () => {
    const testEmail = `tester.${Date.now()}@example.com`;
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'New Tester',
        email: testEmail,
        password: 'Password123!',
        organizationName: 'Tester Enterprise',
      });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe(testEmail);
  });

  it('should reject registration if email is already registered', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Duplicate Tester',
        email: 'hydadmin@acme.com',
        password: 'Password123!',
      });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EMAIL_EXISTS');
  });

  it('should successfully log in with valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'hydadmin@acme.com',
        password: 'Password123!',
      });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.name).toBe('Priya Reddy (Tenant Admin)');
    expect(res.body.organizations.length).toBeGreaterThan(0);
  });

  it('should reject login with incorrect password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'hydadmin@acme.com',
        password: 'WrongPassword!',
      });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('should reject access to protected endpoint without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('AUTH_REQUIRED');
  });

  it('should return current user profile and memberships with valid token', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'hydadmin@acme.com', password: 'Password123!' });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${loginRes.body.token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('hydadmin@acme.com');
    expect(res.body.organizations[0].name).toBe('Acme Technologies');
  });
});
