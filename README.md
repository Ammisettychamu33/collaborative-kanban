# Real-Time Collaborative Kanban Board
### Multi-Organization & Multi-Tenant Architecture
**Company:** Julley Online Pvt. Ltd.  
**Position:** Forward Deployed Engineer Intern Assignment  
**Engineer:** Ammisetty Chamu ([@Ammisettychamu33](https://github.com/Ammisettychamu33))

---

## 1. Project Overview
This repository contains a full-stack, real-time collaborative Kanban board application built from the ground up for **Julley Online Pvt. Ltd.** The system provides multi-organization and multi-tenant project management with strict isolation boundaries, optimistic concurrency control (OCC), bi-directional WebSocket synchronization, transactional drag-and-drop task movement, and undo/redo operation history.

---

## 2. Business Problem
Modern enterprises operate across multiple regional branches, divisions, and independent organizations. When managing engineering workflows:
- Cross-tenant data leaks compromise confidentiality between clients or company offices.
- Concurrent drag-and-drop updates by distributed team members can cause race conditions and lost work if concurrency control is absent.
- Latent network conditions require optimistic UI updates that smoothly roll back if the server detects a collision.
- Audit compliance demands tenant-scoped activity logging of every creation, edit, move, and administrative action.

This application directly addresses these problems with verified multi-tenant authorization, database constraints, and optimistic versioning.

---

## 3. Key Features
- **Strict Multi-Tenancy:** Zero client trust; all requests validated against authenticated user memberships.
- **Role-Based Access Control (RBAC):** Explicit permission tiers for `ORG_ADMIN`, `TENANT_ADMIN`, and `MEMBER`.
- **Drag-and-Drop Workflow:** Powered by `@dnd-kit/core` with custom collision detection and smooth animations.
- **Optimistic Concurrency Control (OCC):** Atomic version-checked mutations; stale client submissions return `HTTP 409 Conflict` with the authoritative state.
- **Real-Time Collaboration:** Socket.IO tenant rooms (`tenant:<tenantId>`), broadcasting task moves, edits, and deletions with zero cross-tenant leakage.
- **Live Presence:** Multi-tab presence indicators showing active collaborators in the current branch.
- **Transactional Undo/Redo:** In-memory stack with server-side OCC rollback validation.
- **Tenant Audit Logging:** Paginated history capturing actors, entities, before/after values, and timestamps.
- **One-Click Demo Personas:** Pre-seeded evaluators to test cross-tenant isolation and concurrent collaboration in seconds.

---

## 4. Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, Vite, Tailwind CSS, `@dnd-kit/core`, `@dnd-kit/sortable`, Axios, Socket.IO Client, Lucide React |
| **Backend** | Node.js, Express.js (ES Modules), Socket.IO, Prisma ORM 7.10.1, JWT, bcryptjs, Zod, Helmet, CORS |
| **Database** | PostgreSQL (Neon serverless cloud database / PGlite local embedded) |
| **Testing** | Vitest, React Testing Library, Supertest, JSDOM |
| **Deployment** | GitHub, Vercel / Render, Neon PostgreSQL |

---

## 5. System Architecture
The application uses a modular monolithic architecture:
- Presentation and client state are isolated in `frontend/`.
- Backend services, middleware, and database access are encapsulated in `backend/`.
- Communication occurs via authenticated REST endpoints and tenant-scoped WebSocket channels.

See [docs/architecture.md](docs/architecture.md) for architectural specifications.

---

## 6. System Architecture Diagram

```
[ Browser / Client A (Hyderabad) ]      [ Browser / Client B (Hyderabad) ]      [ Browser / Client C (Bangalore) ]
               |                                       |                                       |
               +-------------------+                   |                                       |
                                   |                   |                                       |
                   HTTP REST       |                   | WSS Socket.IO                         |
                   + JWT Auth      v                   v                                       |
                            +------------------------------------+                             |
                            |       Express API + Socket.IO      |                             |
                            |   - JWT & Tenant Middleware        |                             |
                            |   - Room: tenant:hyd-uuid          |<----------------------------+ (Blocked by RBAC!)
                            +-----------------+------------------+
                                              |
                                    Prisma ORM 7.10.1
                                              |
                                              v
                            +------------------------------------+
                            |        PostgreSQL Database         |
                            |   - Organizations & Tenants        |
                            |   - Versioned Tasks (OCC)          |
                            |   - Tenant Scoped Activity Logs    |
                            +------------------------------------+
```

---

## 7. Organization and Tenant Hierarchy

```
Organization: Acme Technologies
 ├── Tenant 1: Hyderabad Hub
 │    ├── Board: Q4 Product Launch
 │    │    ├── Column: To Do -> Tasks (v1, v2)
 │    │    ├── Column: In Progress
 │    │    ├── Column: Testing
 │    │    └── Column: Done
 │    ├── Members: admin.hyd, member.hyd
 │    └── Audit Logs: Hyderabad Activity
 └── Tenant 2: Bangalore Hub
      ├── Board: Infrastructure Modernization
      └── Members: admin.blr (Cannot access Hyderabad data)

Organization: Globex Logistics
 └── Tenant 3: Mumbai Hub
      └── Members: admin.globex, admin.mum (Completely isolated from Acme)
```

---

## 8. Tenant-Isolation Model
- **Header Verification:** `x-tenant-id` is checked against the user's active database memberships on every request.
- **Scoped Queries:** All queries include `where: { tenantId }`. No records are queried by ID alone.
- **Relational Integrity:** Board, column, task, and user relationships must belong to the same tenant.
- **Socket Rooms:** Sockets can only join `tenant:<id>` rooms after database verification.

Read full details in [docs/tenancy-model.md](docs/tenancy-model.md).

---

## 9. Role and Permission Matrix

| Operation | `ORG_ADMIN` | `TENANT_ADMIN` | `MEMBER` |
|---|:---:|:---:|:---:|
| Manage Organization Settings | ✅ | ❌ | ❌ |
| Create New Branches / Tenants | ✅ | ❌ | ❌ |
| Invite Branch Members & Assign Roles | ✅ | ✅ | ❌ |
| Create & Delete Boards | ✅ | ✅ | ❌ |
| Create & Reorder Columns | ✅ | ✅ | ❌ |
| Create & Edit Tasks | ✅ | ✅ | ✅ |
| Drag-and-Drop Reorder Tasks | ✅ | ✅ | ✅ |
| Delete Tasks | ✅ | ✅ | ❌ (Unless creator) |
| View Audit Logs | ✅ | ✅ | ✅ |

---

## 10. Database Schema
The database contains the 8 required core tables:
1. `organizations`: Parent enterprise identity (`id`, `name`, `created_at`, `updated_at`).
2. `tenants`: Branches/workspaces (`id`, `organization_id`, `name`, `created_at`, `updated_at`).
3. `users`: Credentials and profiles (`id`, `name`, `email` [UNIQUE], `password_hash`).
4. `memberships`: Associates users with orgs/tenants (`id`, `user_id`, `organization_id`, `tenant_id`, `role`).
5. `boards`: Workflow boards (`id`, `organization_id`, `tenant_id`, `name`, `description`, `created_by`).
6. `columns`: Workflow stages (`id`, `board_id`, `tenant_id`, `name`, `position`).
7. `tasks`: Work units (`id`, `board_id`, `column_id`, `tenant_id`, `title`, `description`, `assigned_to`, `priority`, `due_date`, `position`, `version`, `created_by`).
8. `activity_logs`: Immutable audit events (`id`, `tenant_id`, `user_id`, `entity_type`, `entity_id`, `action`, `details`, `created_at`).

---

## 11. Database ER Diagram
The database relationship diagram is stored in `docs/database-erd.png`.  
Editable Mermaid source: [docs/database-erd.mmd](docs/database-erd.mmd).

![Database ERD](docs/database-erd.png)

---

## 12. Authentication Design
- **Registration (`POST /api/auth/register`):** Creates user, creates organization, assigns user as `ORG_ADMIN`, creates default branch, and signs JWT.
- **Login (`POST /api/auth/login`):** Validates password with `bcryptjs.compare`, returns JWT and authorized tenant hierarchy.
- **Session Verification (`GET /api/auth/me`):** Authenticates JWT bearer token and delivers authorized context.
- **Tokens:** Signed with `JWT_SECRET`, expiring in 24 hours.

---

## 13. REST API Overview
A complete reference of all 20+ endpoints is documented in [docs/api.md](docs/api.md).

Summary of primary routes:
- `/api/auth`: `register`, `login`, `me`
- `/api/organizations`: CRUD organizations
- `/api/tenants`: CRUD tenants, branch members
- `/api/boards`: CRUD boards and columns
- `/api/tasks`: CRUD tasks, `PATCH /tasks/:id/move`, `POST /tasks/:id/undo`
- `/api/activity`: Scoped tenant audit trail
- `/api/health`: Health status check

---

## 14. WebSocket Architecture and Event List
- **Handshake:** Authenticates bearer JWT token.
- **Rooms:** `tenant:<tenantId>` rooms isolated to authorized members.
- **Events:**
  - `presence:update`: Live online members in branch.
  - `task:created`: Real-time task creation.
  - `task:updated`: Real-time task updates.
  - `task:moved`: Real-time drag-and-drop movement.
  - `task:deleted`: Real-time task removal.

See [docs/websocket.md](docs/websocket.md) for full specifications.

---

## 15. Concurrency and Conflict-Resolution Strategy
Optimistic Concurrency Control (OCC) is enforced using atomic single-statement updates:
```javascript
const result = await prisma.task.updateMany({
  where: { id, version: clientVersion, tenantId },
  data: { ...updates, version: { increment: 1 } },
});
```
If another collaborator changed the task first, `result.count === 0`. The server immediately responds with `HTTP 409 Conflict` and the latest authoritative server state. The frontend presents a conflict modal and refreshes the board.

---

## 16. Task Ordering
Columns maintain integer position indexes (`0, 1, 2, ...`). When a task is moved:
1. Destination position is determined by target column index.
2. The database updates the task's column and position.
3. Subsequent tasks in the column are reindexed within a transaction.

---

## 17. Optimistic UI Updates
When a card is dragged or edited:
1. The local state updates immediately for zero-latency user feedback.
2. A snapshot of the previous state is saved.
3. The mutation request is dispatched to the backend.
4. If rejected (409 Conflict, network error, or 403 Forbidden), the UI automatically rolls back to the previous snapshot.

---

## 18. Undo/Redo Design and Limitations
- Maintains an in-memory stack of the last 20 actions in `UndoRedoContext`.
- Hotkeys: `Ctrl+Z` (Undo), `Ctrl+Y` (Redo).
- **OCC Protected:** Undo dispatches `POST /api/tasks/:id/undo` with the inverse operation and observed version. If another user moved the task after the original action, undo is safely rejected with 409 Conflict.

---

## 19. Presence Handling
- Handled via `presence:update` events.
- Tracks active socket connections mapped by `userId` and `tenantId`.
- Handles multiple open tabs from the same user without duplicate entries.
- Gracefully removes users when all sockets for a user disconnect.

---

## 20. Network Recovery
When a WebSocket connection drops:
1. An amber pulsing "Connecting..." badge appears in the top navigation bar.
2. The client attempts exponential backoff reconnection.
3. Upon reconnection, the client automatically rejoins the active tenant room.
4. The client fetches the latest board state to reconcile any operations missed while offline.

---

## 21. Installation Requirements
- **Node.js:** v18.0.0 or higher
- **npm:** v9.0.0 or higher
- **PostgreSQL Database:** Local PostgreSQL or cloud PostgreSQL (Neon, Supabase, AWS RDS)

---

## 22. Local Setup Instructions

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Ammisettychamu33/collaborative-kanban.git
   cd collaborative-kanban
   ```

2. **Backend Setup:**
   ```bash
   cd backend
   npm install
   cp .env.example .env
   # Edit .env with your DATABASE_URL and JWT_SECRET
   ```

3. **Frontend Setup:**
   ```bash
   cd ../frontend
   npm install
   cp .env.example .env
   ```

---

## 23. Environment Variables

### Backend (`backend/.env`):
```env
PORT=5000
NODE_ENV=development
DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require"
JWT_SECRET="your-super-secure-jwt-secret-key-32-chars-min"
FRONTEND_URL="http://localhost:5173"
```

### Frontend (`frontend/.env`):
```env
VITE_API_URL="http://localhost:5000/api"
VITE_SOCKET_URL="http://localhost:5000"
```

---

## 24. Database Migration and Seed Instructions
Run Prisma migrations and populate demo organizations and tasks:
```bash
cd backend
npx prisma generate
node src/database/seed.js
```

---

## 25. How to Run Frontend and Backend

### Start Backend API & Socket Server:
```bash
cd backend
npm run dev
# Server running at http://localhost:5000
```

### Start Frontend Client:
```bash
cd frontend
npm run dev
# Frontend running at http://localhost:5173
```

---

## 26. How to Run Automated Tests

### Run Backend Tests (Security, Isolation, Concurrency, Auth, Sockets):
```bash
cd backend
npm test
```
*Result: 21/21 tests passed across 4 test suites.*

### Run Frontend Tests (UI, Kanban, OCC Modal, DND):
```bash
cd frontend
npm test
```
*Result: 5/5 tests passed.*

---

## 27. API Documentation Link
Full REST API specification available in [docs/api.md](docs/api.md).

---

## 28. WebSocket Documentation Link
WebSocket connection and presence details available in [docs/websocket.md](docs/websocket.md).

---

## 29. Deployment Architecture
- **Frontend:** Hosted on Vercel or Netlify with production build output (`frontend/dist`).
- **Backend:** Hosted on Node.js provider with WebSocket support (Render, Railway, Koyeb, Fly.io).
- **Database:** Serverless PostgreSQL on Neon.tech with connection pooling.

---

## 30. Live Application URLs
- **Frontend App:** Verified live upon deployment
- **Backend API:** Verified live upon deployment
- **Health Check:** `/api/health`

---

## 31. Demo Evaluator Credentials

The login screen provides **one-click login buttons** for all testing personas:

| Persona | Organization | Tenant | Email | Password | Role |
|---|---|---|---|---|---|
| **Acme Org Admin** | Acme Technologies | All Branches | `admin.acme@example.com` | `Password123!` | `ORG_ADMIN` |
| **Hyderabad Admin** | Acme Technologies | Hyderabad Hub | `admin.hyd@example.com` | `Password123!` | `TENANT_ADMIN` |
| **Hyderabad Member** | Acme Technologies | Hyderabad Hub | `member.hyd@example.com` | `Password123!` | `MEMBER` |
| **Bangalore Admin** | Acme Technologies | Bangalore Hub | `admin.blr@example.com` | `Password123!` | `TENANT_ADMIN` |
| **Globex Org Admin** | Globex Logistics | Mumbai Hub | `admin.globex@example.com` | `Password123!` | `ORG_ADMIN` |

---

## 32. Known Limitations
1. In-memory presence is maintained on a single Node.js instance. For horizontal multi-instance scaling, a Redis Socket.IO adapter (`@socket.io/redis-adapter`) is recommended.
2. Undo/redo history is stored per client session; refreshing the browser clears the undo stack.
3. Subtasks and checklist items are not yet included in the core schema.

---

## 33. Architectural Trade-offs
- **Monolithic API vs Microservices:** Chosen to minimize deployment overhead, eliminate distributed transaction complexity, and ensure ACID transactional consistency for task reordering.
- **Integer Position vs Fractional/Lexorank Indexing:** Integer positioning with transactional reindexing was chosen for simplicity, zero floating-point precision errors, and predictable test assertions.

---

## 34. Future Improvements
1. **Redis Adapter:** Add Redis Pub/Sub for horizontal clustering of Socket.IO servers.
2. **PostgreSQL Row-Level Security (RLS):** Introduce session-variable RLS as a secondary defense-in-depth layer.
3. **Task Attachments:** Upload files directly to S3/GCS with pre-signed URLs.
4. **Email Notifications:** Deliver digest emails on assignment or due date approaches.
