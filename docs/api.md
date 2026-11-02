# REST API Documentation

## Base URL
- Local: `http://localhost:5000/api`
- Production: `<PRODUCTION_BACKEND_URL>/api`

## Authentication & Headers
All protected endpoints require:
```http
Authorization: Bearer <JWT_TOKEN>
x-tenant-id: <ACTIVE_TENANT_UUID>
Content-Type: application/json
```

---

## 1. Authentication Endpoints

### Register User & Organization
`POST /api/auth/register`
- **Access:** Public
- **Request Body:**
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "Password123!",
  "organizationName": "Acme Corp"
}
```
- **Response (201 Created):**
```json
{
  "message": "User registered successfully",
  "token": "eyJhbGciOi...",
  "user": {
    "id": "e6a06bc5-...",
    "name": "Jane Doe",
    "email": "jane@example.com"
  },
  "organizations": [
    {
      "id": "org-uuid",
      "name": "Acme Corp",
      "role": "ORG_ADMIN",
      "tenants": [
        { "id": "tenant-uuid", "name": "Default Branch", "role": "ORG_ADMIN" }
      ]
    }
  ]
}
```

### User Login
`POST /api/auth/login`
- **Access:** Public
- **Request Body:**
```json
{
  "email": "admin.hyd@example.com",
  "password": "Password123!"
}
```
- **Response (200 OK):**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOi...",
  "user": { "id": "...", "name": "Hyderabad Admin", "email": "admin.hyd@example.com" },
  "organizations": [ ... ]
}
```

### Current User Session
`GET /api/auth/me`
- **Access:** Authenticated
- **Response (200 OK):** Returns profile, active roles, and authorized organizations/tenants.

---

## 2. Organization Endpoints

### List Organizations
`GET /api/organizations`
- **Access:** Authenticated (returns organizations the user belongs to).

### Create Organization
`POST /api/organizations`
- **Access:** Authenticated
- **Request Body:** `{ "name": "New Enterprise" }`

---

## 3. Tenant / Branch Endpoints

### List Tenants in Current Organization
`GET /api/tenants`
- **Access:** Authenticated (`ORG_ADMIN` or member)

### Create Tenant / Branch
`POST /api/tenants`
- **Access:** `ORG_ADMIN` only
- **Request Body:** `{ "name": "Chennai Hub" }`

### Get Tenant Members
`GET /api/tenants/:id/members`
- **Access:** Tenant Member or `ORG_ADMIN`

### Assign / Invite Tenant Member
`POST /api/tenants/:id/members`
- **Access:** `ORG_ADMIN` or `TENANT_ADMIN`
- **Request Body:**
```json
{
  "email": "colleague@example.com",
  "role": "MEMBER" // "ORG_ADMIN" | "TENANT_ADMIN" | "MEMBER"
}
```

---

## 4. Board Endpoints

### List Boards in Tenant
`GET /api/boards`
- **Access:** Scoped to `x-tenant-id` header
- **Response (200 OK):** List of boards belonging strictly to the active tenant.

### Create Board
`POST /api/boards`
- **Access:** `ORG_ADMIN` or `TENANT_ADMIN`
- **Request Body:**
```json
{
  "name": "Sprint 42 Tracking",
  "description": "Cross-functional development board"
}
```

### Get Board by ID (with Columns & Tasks)
`GET /api/boards/:id`
- **Access:** Tenant Member
- **Response (200 OK):**
```json
{
  "data": {
    "id": "board-uuid",
    "name": "Sprint 42 Tracking",
    "columns": [
      {
        "id": "col-uuid-1",
        "name": "To Do",
        "position": 0
      }
    ],
    "tasks": [
      {
        "id": "task-uuid-1",
        "columnId": "col-uuid-1",
        "title": "Build Real-Time Kanban",
        "priority": "HIGH",
        "version": 1,
        "position": 0
      }
    ]
  }
}
```

---

## 5. Column Endpoints

### Create Column
`POST /api/boards/:boardId/columns`
- **Access:** `ORG_ADMIN` or `TENANT_ADMIN`
- **Request Body:**
```json
{
  "name": "Code Review",
  "position": 2
}
```

### Delete Column
`DELETE /api/columns/:id`
- **Access:** `ORG_ADMIN` or `TENANT_ADMIN`

---

## 6. Task Endpoints

### Create Task
`POST /api/tasks`
- **Access:** Tenant Member
- **Request Body:**
```json
{
  "boardId": "board-uuid",
  "columnId": "col-uuid",
  "title": "Implement Optimistic Concurrency Control",
  "description": "Use version-checked atomic updates",
  "priority": "HIGH",
  "assignedTo": "user-uuid",
  "dueDate": "2026-12-31T00:00:00.000Z"
}
```

### Update Task (with Concurrency Check)
`PUT /api/tasks/:id`
- **Access:** Tenant Member
- **Request Body:**
```json
{
  "title": "Updated Task Title",
  "description": "Updated description",
  "priority": "URGENT",
  "version": 2 // Must match current version in DB
}
```
- **Success (200 OK):** Returns updated task with `version: 3`.
- **Conflict (409 Conflict):**
```json
{
  "error": "Conflict: Task has been modified by another user.",
  "code": "CONCURRENCY_CONFLICT",
  "currentTask": { ...authoritative server task... }
}
```

### Move Task Across Columns / Positions
`PATCH /api/tasks/:id/move`
- **Access:** Tenant Member
- **Request Body:**
```json
{
  "columnId": "destination-column-uuid",
  "position": 1,
  "version": 2
}
```
- **Success (200 OK):** Returns committed task with incremented version. Broadcasts `task:moved` to tenant socket room.

### Undo Task Mutation
`POST /api/tasks/:id/undo`
- **Access:** Tenant Member
- **Request Body:**
```json
{
  "columnId": "previous-column-uuid",
  "position": 0,
  "version": 3
}
```

### Delete Task
`DELETE /api/tasks/:id`
- **Access:** `ORG_ADMIN`, `TENANT_ADMIN`, or Task Creator.

---

## 7. Audit Activity Logs

### Get Tenant Activity History
`GET /api/activity?page=1&limit=30`
- **Access:** Tenant Member
- **Response (200 OK):**
```json
{
  "data": [
    {
      "id": "log-uuid",
      "action": "MOVE",
      "entityType": "TASK",
      "entityId": "task-uuid",
      "createdAt": "2026-11-02T19:00:00.000Z",
      "user": { "name": "Hyderabad Admin", "email": "admin.hyd@example.com" },
      "details": {
        "title": "Fix Auth Flaws",
        "fromColumn": "To Do",
        "toColumn": "In Progress",
        "version": 2
      }
    }
  ]
}
```
