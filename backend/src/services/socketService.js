import jwt from 'jsonwebtoken';
import { prisma } from '../database/db.js';
import config from '../config/index.js';

let ioInstance = null;

// Map: tenantId -> Map<userId, { id, name, email, socketIds: Set<string> }>
const presenceMap = new Map();

export function initSocketService(io) {
  ioInstance = io;

  // Socket Authentication Middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, config.jwtSecret);
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: {
          memberships: {
            include: { organization: true, tenant: true },
          },
        },
      });

      if (!user) {
        return next(new Error('User not found'));
      }

      socket.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        memberships: user.memberships,
      };

      next();
    } catch (err) {
      next(new Error('Unauthorized socket connection'));
    }
  });

  io.on('connection', (socket) => {
    let currentTenantId = null;

    // Join authorized tenant room
    socket.on('join:tenant', async ({ tenantId }, ack) => {
      try {
        if (!tenantId) {
          if (typeof ack === 'function') ack({ success: false, error: 'tenantId is required' });
          return;
        }

        // Verify authorization on the server!
        const tenant = await prisma.tenant.findUnique({
          where: { id: tenantId },
        });

        if (!tenant) {
          if (typeof ack === 'function') ack({ success: false, error: 'Tenant does not exist' });
          return;
        }

        const isDirectMember = socket.user.memberships.some((m) => m.tenantId === tenant.id);
        const isOrgAdmin = socket.user.memberships.some(
          (m) => m.organizationId === tenant.organizationId && m.role === 'ORG_ADMIN'
        );

        if (!isDirectMember && !isOrgAdmin) {
          if (typeof ack === 'function') {
            ack({ success: false, error: 'Unauthorized: You are not a member of this tenant' });
          }
          return;
        }

        // Leave previous tenant room if switching
        if (currentTenantId && currentTenantId !== tenantId) {
          leaveTenantPresence(socket, currentTenantId);
          socket.leave(`tenant:${currentTenantId}`);
        }

        // Join authorized room
        currentTenantId = tenantId;
        const roomName = `tenant:${tenantId}`;
        socket.join(roomName);

        // Add to presence
        joinTenantPresence(socket, tenantId);

        if (typeof ack === 'function') {
          ack({ success: true, tenantId });
        }
      } catch (err) {
        if (typeof ack === 'function') ack({ success: false, error: err.message });
      }
    });

    // Leave tenant room
    socket.on('leave:tenant', ({ tenantId }) => {
      const targetTenant = tenantId || currentTenantId;
      if (targetTenant) {
        leaveTenantPresence(socket, targetTenant);
        socket.leave(`tenant:${targetTenant}`);
        if (currentTenantId === targetTenant) {
          currentTenantId = null;
        }
      }
    });

    // Disconnect handling
    socket.on('disconnect', () => {
      if (currentTenantId) {
        leaveTenantPresence(socket, currentTenantId);
      }
    });
  });

  return ioInstance;
}

function joinTenantPresence(socket, tenantId) {
  if (!presenceMap.has(tenantId)) {
    presenceMap.set(tenantId, new Map());
  }

  const tenantUsers = presenceMap.get(tenantId);
  const user = socket.user;

  if (tenantUsers.has(user.id)) {
    tenantUsers.get(user.id).socketIds.add(socket.id);
  } else {
    tenantUsers.set(user.id, {
      id: user.id,
      name: user.name,
      email: user.email,
      socketIds: new Set([socket.id]),
      onlineSince: new Date().toISOString(),
    });
  }

  emitPresenceUpdate(tenantId);
}

function leaveTenantPresence(socket, tenantId) {
  if (!presenceMap.has(tenantId)) return;

  const tenantUsers = presenceMap.get(tenantId);
  const userId = socket.user?.id;

  if (userId && tenantUsers.has(userId)) {
    const entry = tenantUsers.get(userId);
    entry.socketIds.delete(socket.id);
    if (entry.socketIds.size === 0) {
      tenantUsers.delete(userId);
    }
  }

  if (tenantUsers.size === 0) {
    presenceMap.delete(tenantId);
  }

  emitPresenceUpdate(tenantId);
}

function emitPresenceUpdate(tenantId) {
  if (!ioInstance) return;

  const tenantUsers = presenceMap.get(tenantId);
  const onlineUsers = tenantUsers
    ? Array.from(tenantUsers.values()).map(({ id, name, email, onlineSince }) => ({
        id,
        name,
        email,
        onlineSince,
      }))
    : [];

  ioInstance.to(`tenant:${tenantId}`).emit('presence:update', {
    tenantId,
    onlineUsers,
    count: onlineUsers.length,
  });
}

/**
 * Broadcasts an event to a verified tenant room
 */
export function broadcastToTenant(tenantId, event, payload, excludeSocketId = null) {
  if (!ioInstance) return;

  const room = `tenant:${tenantId}`;
  if (excludeSocketId) {
    ioInstance.to(room).except(excludeSocketId).emit(event, payload);
  } else {
    ioInstance.to(room).emit(event, payload);
  }
}

export function getIO() {
  return ioInstance;
}
