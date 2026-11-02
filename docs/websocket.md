# WebSocket Real-Time Synchronization Documentation

## 1. Protocol & Transport
- **Engine:** Socket.IO v4
- **Transports:** `['websocket', 'polling']`
- **Handshake Authentication:** Bearer JWT token passed in `auth: { token }` object.

```javascript
// Client initialization
const socket = io('http://localhost:5000', {
  auth: { token: localStorage.getItem('kanban_token') },
  transports: ['websocket', 'polling'],
});
```

---

## 2. Security & Room Model

### Handshake Authentication
When a socket initiates a handshake, the server verifies the JWT:
- If token is missing, expired, or invalid: connection is aborted with `Authentication error`.
- If valid: user ID, email, and name are attached to `socket.data.user`.

### Tenant Room Scoping (`tenant:<tenantId>`)
Clients cannot listen to global channels or arbitrary rooms.
To subscribe to a tenant's live updates, the client emits `join:tenant`:
```javascript
socket.emit('join:tenant', { tenantId: 'tenant-uuid' }, (acknowledgement) => {
  if (acknowledgement.success) {
    console.log('Joined room:', acknowledgement.room);
  }
});
```

**Server Validation:**
- Server verifies that `socket.data.user.id` has an active membership in `tenantId` (or is an `ORG_ADMIN` of the parent organization).
- If unauthorized: subscription is rejected and the socket is not added to the room.

---

## 3. Real-Time Event Catalog

### Client to Server Events

| Event | Payload | Description |
|---|---|---|
| `join:tenant` | `{ "tenantId": "string" }` | Requests to join tenant-scoped room and register presence |
| `leave:tenant` | `{ "tenantId": "string" }` | Leaves tenant room and deregisters presence |

---

### Server to Client Events

#### `presence:update`
Emitted whenever a collaborator connects, disconnects, or switches tenants.
- **Payload:**
```json
{
  "tenantId": "tenant-uuid",
  "onlineUsers": [
    { "id": "user-uuid-1", "name": "Hyderabad Admin", "email": "admin.hyd@example.com" },
    { "id": "user-uuid-2", "name": "Member One", "email": "member.hyd@example.com" }
  ]
}
```

#### `task:created`
Emitted after a new task is successfully committed to the database.
- **Payload:**
```json
{
  "id": "task-uuid",
  "boardId": "board-uuid",
  "columnId": "col-uuid",
  "tenantId": "tenant-uuid",
  "title": "Refactor API",
  "priority": "HIGH",
  "position": 0,
  "version": 1,
  "createdAt": "2026-11-02T19:00:00.000Z"
}
```

#### `task:moved`
Emitted after a drag-and-drop or reordering operation commits.
- **Payload:**
```json
{
  "id": "task-uuid",
  "boardId": "board-uuid",
  "columnId": "new-col-uuid",
  "position": 2,
  "version": 4
}
```

#### `task:updated`
Emitted after task details (title, description, priority, assignee) are modified.
- **Payload:** Authoritative updated task record with incremented version.

#### `task:deleted`
Emitted when a task is removed.
- **Payload:**
```json
{
  "id": "task-uuid",
  "boardId": "board-uuid",
  "tenantId": "tenant-uuid"
}
```

#### `column:created` & `column:deleted`
Emitted when workflow columns are added or removed from a board.

---

## 4. Disconnection & Reconnection Recovery

1. **Temporary Network Interruption:**
   - Socket.IO automatically attempts exponential backoff reconnection.
   - The UI displays an amber pulsing "Connecting..." status indicator in the top navbar.
2. **Reconnection & Re-Authentication:**
   - On successful reconnection, Socket.IO triggers the `'connect'` event.
   - The application re-emits `join:tenant` with the currently active tenant ID.
   - The client invokes `fetchBoardData()` to pull authoritative server state and reconcile any operations committed by peers while the client was offline.
