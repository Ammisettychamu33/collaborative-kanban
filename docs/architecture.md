# System Architecture & Technical Design

## 1. Architectural Overview

The Collaborative Kanban Board application is designed as a modular monolith adhering to modern distributed system patterns:
- **Presentation Layer:** React (Vite) Single-Page Application (SPA) with Tailwind CSS, `@dnd-kit/core` & `@dnd-kit/sortable`, TanStack Query, and Axios.
- **Application Layer:** Express.js REST API with Socket.IO server running on Node.js with ES Modules (`"type": "module"`).
- **Data Layer:** PostgreSQL relational database managed by Prisma ORM 7.10.1 with connection pooling via `@prisma/adapter-pg`.
- **Real-Time Communication:** Bi-directional WebSockets with stateful room routing, authentication handshakes, and multi-tab presence tracking.
- **Concurrency & State Layer:** Optimistic Concurrency Control (OCC) using monotonic integer `version` checking and transactional undo/redo stacks.

```
                           +----------------------------------------+
                           |           React SPA (Vite)             |
                           |  - dnd-kit Drag & Drop                 |
                           |  - Optimistic UI & Rollback            |
                           |  - Socket.IO Client Presence           |
                           +--------------------+-------------------+
                                                |
                       HTTP / HTTPS (REST API)  |  WSS (Socket.IO)
                                                v
                           +----------------------------------------+
                           |          Node.js Express Server        |
                           |  - Helmet & CORS Security              |
                           |  - JWT Authentication Middleware       |
                           |  - Tenant Authorization Middleware     |
                           |  - Rate Limiting                       |
                           |  - Socket.IO Tenant Room Dispatcher    |
                           +--------------------+-------------------+
                                                |
                                      Prisma ORM 7.10.1
                                                v
                           +----------------------------------------+
                           |           PostgreSQL Database          |
                           |  - 8 Core Normalized Tables            |
                           |  - Foreign Key Cascades & Constraints  |
                           |  - Atomic Concurrency OCC Queries      |
                           |  - Tenant Indexes                      |
                           +----------------------------------------+
```

---

## 2. Component Structure

### Backend Modules (`backend/src`)
- `server.js`: Application entrypoint, HTTP server initialization, Socket.IO attachment, and graceful shutdown.
- `config/index.js`: Environment configuration and validation.
- `database/`:
  - `db.js`: Resilient database driver factory with PostgreSQL pool and PGlite embedded fallback.
  - `seed.js`: Database seeding script for multi-org demo personas, boards, columns, and tasks.
- `middleware/`:
  - `auth.js`: JWT verification and user identity extraction.
  - `tenant.js`: Active tenant authorization and RBAC verification.
  - `errorHandler.js`: Centralized error handling and safe error status code mapping.
- `controllers/`:
  - `authController.js`: Registration, login, logout, and `/me` identity.
  - `orgController.js`: Organization lifecycle management.
  - `tenantController.js`: Branch/tenant management and membership enrollment.
  - `boardController.js`: Tenant-scoped board management.
  - `columnController.js`: Positional column workflow management.
  - `taskController.js`: Task CRUD, atomic OCC updates, positional drag-and-drop movement, and undo actions.
  - `activityController.js`: Tenant audit logging.
- `services/`:
  - `socketService.js`: Socket.IO handshake auth, room subscription validation, and event broadcasting.

### Frontend Modules (`frontend/src`)
- `context/`:
  - `AuthContext.jsx`: User identity, token persistence, organization/tenant switching.
  - `SocketContext.jsx`: Real-time WebSocket connection, auto-rejoin on tenant switch, presence state.
  - `UndoRedoContext.jsx`: History stack and transactional undo/redo replay.
- `components/`:
  - `Navbar.jsx`: Brand, WebSocket indicator, org/tenant switcher, presence avatars, undo/redo triggers.
  - `BoardHeader.jsx`: Active board selection, search query input, priority filter.
  - `KanbanBoard.jsx`: `@dnd-kit/core` DND container, sortable columns, optimistic UI updates, conflict modal.
  - `Column.jsx`: Droppable workflow column with task count and quick-add button.
  - `TaskCard.jsx`: Draggable sortable card with priority pill, version badge, due date, and assignee avatar.
  - `TaskDetailModal.jsx`: Edit task fields, OCC version display, and task audit trail.
  - `CreateTaskModal.jsx`: Task creation form with priority and assignee selectors.
  - `ConflictModal.jsx`: HTTP 409 concurrency conflict modal with authoritative state display.
  - `ActivityLogDrawer.jsx`: Slide-over audit history panel.
  - `MembersModal.jsx`: Branch membership list and role assignment.
  - `LoginPage.jsx`: Sign-in/registration screen with 1-click demo persona buttons.

---

## 3. Optimistic Concurrency Control (OCC) Architecture

To prevent silent overwrites when multiple users collaborate on the same board:
1. Every task record maintains an integer `version` field, initialized to `1`.
2. When a client reads a task, it stores the task's current `version`.
3. When sending an update (`PUT /api/tasks/:id`) or move (`PATCH /api/tasks/:id/move`), the client includes the observed `version`.
4. The database executes an atomic single-statement update:
   ```javascript
   const result = await prisma.task.updateMany({
     where: {
       id: taskId,
       version: clientVersion, // Must match observed version
       tenantId: activeTenantId,
     },
     data: {
       ...updates,
       version: { increment: 1 },
       updatedAt: new Date(),
     },
   });
   ```
5. If `result.count === 0`:
   - Another user committed a change in the interim.
   - The server immediately returns `HTTP 409 Conflict` along with the latest authoritative server task.
   - The client cancels the optimistic update, alerts the user via `ConflictModal`, and refreshes the authoritative state.

---

## 4. Undo / Redo Mechanism

- The application maintains an in-memory action stack in `UndoRedoContext.jsx`.
- When a task is moved or edited, the operation pushes `{ taskId, payload, inversePayload, version }` onto the `past` stack.
- Triggering Undo (`Ctrl+Z` or Navbar button):
  1. Retrieves the last action from `past`.
  2. Sends `POST /api/tasks/:id/undo` with `inversePayload` and the current observed task version.
  3. The server validates permissions, executes an OCC check, applies the inverse mutation transactionally, logs the undo action, and broadcasts `task:moved` or `task:updated` to all collaborators.
  4. The client moves the action from `past` to `future`.
- If another user modified the task after the original move, the OCC check returns `HTTP 409 Conflict`, preventing an accidental overwrite of the third party's newer changes.

---

## 5. Security & Threat Mitigation

- **Zero-Trust Headers:** Client headers like `x-tenant-id` are validated against database memberships on every single request.
- **Password Security:** Passwords hashed with `bcryptjs` with salt work factor 10.
- **SQL Injection Prevention:** Prisma ORM parameterized queries completely neutralize SQL injection vectors.
- **XSS & HTTP Header Hardening:** `Helmet` middleware sets `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, and `X-Frame-Options: DENY`.
- **CORS Protection:** Configured with explicit `allowedOrigins` whitelist.
- **Rate Limiting:** Protects `/api/auth` endpoints against brute-force attacks.
- **Zero Information Leakage:** Unauthorized requests return non-disclosing 403 or 404 responses without leaking foreign IDs or user existence.
