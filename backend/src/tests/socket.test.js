import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { io as Client } from 'socket.io-client';
import http from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { app } from '../server.js';
import { initSocketService, broadcastToTenant } from '../services/socketService.js';
import config from '../config/index.js';
import { prisma } from '../database/db.js';

let testServer;
let serverPort;
let hydUserToken, blrUserToken;
let hydTenantId, blrTenantId;

beforeAll(async () => {
  // Start dedicated test server on ephemeral port
  testServer = http.createServer(app);
  const testIO = new Server(testServer, { cors: { origin: '*' } });
  initSocketService(testIO);

  await new Promise((resolve) => {
    testServer.listen(0, () => {
      serverPort = testServer.address().port;
      resolve();
    });
  });

  const hydUser = await prisma.user.findUnique({ where: { email: 'hydmember@acme.com' } });
  const blrUser = await prisma.user.findUnique({ where: { email: 'blrmember@acme.com' } });

  hydUserToken = jwt.sign({ userId: hydUser.id }, config.jwtSecret);
  blrUserToken = jwt.sign({ userId: blrUser.id }, config.jwtSecret);

  const hydTenant = await prisma.tenant.findFirst({ where: { name: { contains: 'Hyderabad' } } });
  const blrTenant = await prisma.tenant.findFirst({ where: { name: { contains: 'Bangalore' } } });

  hydTenantId = hydTenant.id;
  blrTenantId = blrTenant.id;
});

afterAll(async () => {
  await new Promise((resolve) => testServer.close(resolve));
});

describe('Real-Time Collaboration & Tenant Room Security Suite', () => {
  it('should successfully authenticate socket using valid JWT', async () => {
    const socket = Client(`http://localhost:${serverPort}`, {
      auth: { token: hydUserToken },
      transports: ['websocket'],
    });

    await new Promise((resolve) => {
      socket.on('connect', () => {
        expect(socket.connected).toBe(true);
        socket.disconnect();
        resolve();
      });
    });
  });

  it('should reject joining unauthorized tenant room', async () => {
    const hydSocket = Client(`http://localhost:${serverPort}`, {
      auth: { token: hydUserToken },
      transports: ['websocket'],
    });

    await new Promise((resolve) => {
      hydSocket.on('connect', () => {
        // Hyderabad user attempts to join Bangalore tenant room!
        hydSocket.emit('join:tenant', { tenantId: blrTenantId }, (response) => {
          expect(response.success).toBe(false);
          expect(response.error).toContain('Unauthorized');
          hydSocket.disconnect();
          resolve();
        });
      });
    });
  });

  it('should permit joining authorized tenant room and receive broadcast events', async () => {
    const hydSocket = Client(`http://localhost:${serverPort}`, {
      auth: { token: hydUserToken },
      transports: ['websocket'],
    });

    const blrSocket = Client(`http://localhost:${serverPort}`, {
      auth: { token: blrUserToken },
      transports: ['websocket'],
    });

    await Promise.all([
      new Promise((res) => hydSocket.on('connect', res)),
      new Promise((res) => blrSocket.on('connect', res)),
    ]);

    // Both join their authorized rooms
    await new Promise((res) => hydSocket.emit('join:tenant', { tenantId: hydTenantId }, res));
    await new Promise((res) => blrSocket.emit('join:tenant', { tenantId: blrTenantId }, res));

    let blrReceivedEvent = false;
    blrSocket.on('task:created', () => {
      blrReceivedEvent = true;
    });

    const eventReceivedPromise = new Promise((resolve) => {
      hydSocket.on('task:created', (data) => {
        expect(data.title).toBe('Realtime Test Task');
        resolve();
      });
    });

    // Broadcast only to Hyderabad room
    broadcastToTenant(hydTenantId, 'task:created', {
      id: 'task-123',
      title: 'Realtime Test Task',
      tenantId: hydTenantId,
    });

    await eventReceivedPromise;

    // Bangalore socket must NEVER receive Hyderabad events!
    expect(blrReceivedEvent).toBe(false);

    hydSocket.disconnect();
    blrSocket.disconnect();
  });
});
