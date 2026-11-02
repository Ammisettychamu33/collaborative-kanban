# Multi-Organization & Multi-Tenant Architecture Model

## 1. Executive Summary

This document describes the multi-organization and multi-tenant security model implemented for the **Julley Online Pvt. Ltd. Forward Deployed Engineer Intern** hiring assignment.

The application satisfies strict **tenant isolation**, **cross-organization boundaries**, and **role-based access control (RBAC)** across all data read/write APIs, database constraints, and real-time WebSocket subscriptions.

---

## 2. Structural Hierarchy

```
Organization (e.g. Acme Technologies)
 ├── Tenant / Branch A (e.g. Hyderabad Hub)
 │    ├── Boards (e.g. Q4 Sprint Execution)
 │    │    ├── Columns (To Do, In Progress, Testing, Done)
 │    │    └── Tasks (Versioned with OCC)
 │    ├── Memberships (Scoped to Tenant)
 │    └── Activity Audit Logs (Isolated to Tenant)
 └── Tenant / Branch B (e.g. Bangalore Hub)
      ├── Boards, Columns, Tasks
      ├── Memberships
      └── Activity Audit Logs

Organization B (e.g. Globex Logistics)
 └── Tenant / Branch C (e.g. Mumbai Hub)
      └── ...
```

### Hierarchy Rules
1. **Organizations** represent independent parent entities/enterprises.
2. **Tenants** represent branches, regional offices, or isolated organizational units belonging to exactly one organization.
3. Every business object (`board`, `column`, `task`, `activity_log`) carries a mandatory `tenant_id` foreign key.
4. Boards and columns cannot span across multiple tenants. A task cannot be moved to a column belonging to another tenant or board.
5. Users can hold memberships in multiple organizations and tenants with distinct roles per context.

---

## 3. Role-Based Access Control (RBAC) Matrix

| Permission / Capability | Organization Admin (`ORG_ADMIN`) | Tenant Admin (`TENANT_ADMIN`) | Team Member (`MEMBER`) |
|---|:---:|:---:|:---:|
| Create & Manage Organization | ✅ | ❌ | ❌ |
| Create New Tenants / Branches | ✅ | ❌ | ❌ |
| Assign Tenant Admins | ✅ | ❌ | ❌ |
| Invite / Manage Tenant Members | ✅ | ✅ | ❌ |
| Create & Delete Boards in Tenant | ✅ | ✅ | ❌ |
| Create, Order & Delete Columns | ✅ | ✅ | ❌ |
| Create Tasks | ✅ | ✅ | ✅ |
| Update Tasks & Move Columns | ✅ | ✅ | ✅ |
| Delete Tasks | ✅ | ✅ | ❌ (or creator) |
| View Tenant Activity History | ✅ | ✅ | ✅ |
| Join Tenant WebSocket Room | ✅ (in org) | ✅ (assigned tenant) | ✅ (assigned tenant) |
| Access Cross-Tenant Data | ❌ | ❌ | ❌ |

---

## 4. Strict Isolation Enforcement Mechanisms

### A. Server-Side Verification (Zero Client Trust)
Client-supplied headers such as `x-tenant-id` are treated as unverified requests.
Before processing any request:
1. The user identity is extracted from the cryptographically verified JWT bearer token.
2. The server loads the user's verified memberships from the database.
3. If the user is an `ORG_ADMIN`, the server verifies that the requested `x-tenant-id` actually belongs to the organization they administer.
4. If the user is a `TENANT_ADMIN` or `MEMBER`, the server verifies that the user holds an active membership explicitly matching the requested `tenant_id`.
5. If verification fails, the server responds with `HTTP 403 Forbidden` without revealing the existence of internal records.

### B. Query-Level Tenant Scoping
Every database read, update, or delete is parameterized with `tenantId`:
```javascript
// Example from taskController.js
const task = await prisma.task.findFirst({
  where: {
    id: req.params.id,
    tenantId: req.tenant.id, // Enforced tenant boundary
  },
});
if (!task) {
  return res.status(404).json({ error: 'Task not found' });
}
```
Records are never fetched or modified by primary key alone.

### C. Relationship & Foreign Key Consistency
When moving a task or assigning an assignee:
1. The destination column must have `tenantId === req.tenant.id`. Moving a task into a column belonging to another tenant is blocked with HTTP 400/403.
2. The assigned user must hold a membership in the active tenant. Assigning a user who is not a member of the tenant is rejected.

### D. Real-Time WebSocket Room Scoping
1. When a client socket attempts to join `tenant:<tenantId>` via `socket.emit('join:tenant', { tenantId })`:
2. The server intercepts the event and inspects the socket's authenticated user ID and database memberships.
3. Sockets belonging to users without verified access to `tenantId` are rejected with `{ success: false, error: 'Unauthorized to join tenant room' }`.
4. Event broadcasts (`task:created`, `task:moved`, `presence:update`) are emitted strictly to `io.to('tenant:' + tenantId)`. Unauthorized sockets never receive cross-tenant frames.

---

## 5. Verified Security & Isolation Test Cases

The following isolation scenarios are verified in automated test suite `src/tests/isolation.test.js`:

1. **Cross-Tenant Task Isolation:** User in Hyderabad tenant requesting task in Bangalore tenant receives HTTP 403 Forbidden.
2. **Cross-Tenant Board Mutation:** User in Bangalore tenant attempting to update board in Hyderabad tenant receives HTTP 403 Forbidden.
3. **Tenant Header Spoofing:** User supplying a forged `x-tenant-id` in HTTP headers without holding a membership in that tenant receives HTTP 403 Forbidden.
4. **Cross-Organization Boundary:** User in Acme Technologies attempting to access Globex Logistics Mumbai tenant receives HTTP 403 Forbidden.
5. **Cross-Tenant Column Injection:** Moving a task to a column located in another tenant's board is rejected.
6. **Cross-Tenant Task Assignment:** Assigning a task to a user who is not a member of the active tenant is rejected.
7. **Cross-Tenant Audit Logs:** Activity log endpoint only returns events tagged with the authorized `tenantId`.
8. **Cross-Tenant WebSocket Subscriptions:** Sockets attempting to join unauthorized tenant rooms are rejected with an explicit authorization error.
