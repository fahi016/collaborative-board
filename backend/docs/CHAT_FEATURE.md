# Real-Time Chat Feature — Production Notes

## 1. Flow of Request

### Sending a message (real-time)

1. **Client** is connected over WebSocket (STOMP over SockJS) and subscribed to:
   - Send: `/app/room/{roomId}/chat` with payload `{ "content": "..." }`
   - Receive: `/topic/room/{roomId}/chat`

2. **JwtChannelInterceptor** (on CONNECT) has already authenticated the user; subsequent messages carry `Principal` (email).

3. **WebSocketController.handleChat**
   - Validates `Principal` and `roomId`.
   - Ensures the session is in the room via `UserService.isSessionInRoom(roomId, sessionId)`.
   - Delegates to **ChatService.sendMessage(roomId, senderEmail, content)**.

4. **ChatService.sendMessage**
   - Validates `roomId`, `senderEmail`, `content` (non-blank, length ≤ 2000).
   - Loads **Room** and **User** (sender); throws if room not found or user not found.
   - Checks **ActiveUser** so only users currently in the room can send.
   - Persists **ChatMessage** and returns **ChatMessageResponse**.

5. **WebSocketController** returns the response; Spring STOMP **@SendTo** broadcasts it to `/topic/room/{roomId}/chat`, so all subscribers in the room receive the message.

### Loading history (REST)

1. **Client** calls `GET /api/rooms/{roomId}/messages?page=0&size=50` with JWT.

2. **Auth filter** validates JWT and sets `SecurityContext`.

3. **ChatController.getMessages**
   - Uses **AuthService.getCurrentUser()** (authenticated user).
   - Builds `Pageable` (default size 50, max 100, sort by `createdAt` DESC).
   - Calls **ChatService.getMessages(roomId, pageable)**.

4. **ChatService.getMessages**
   - Validates `roomId` and checks room exists.
   - Reads **ChatMessage** page from **ChatMessageRepository** and maps to **ChatMessageResponse**.

5. **ChatController** returns `Page<ChatMessageResponse>` as JSON.

---

## 2. DB Schema

Table: **chat_message**

| Column      | Type         | Nullable | Description                |
|------------|--------------|----------|----------------------------|
| id         | BIGSERIAL    | NO       | Primary key                |
| room_id    | VARCHAR(36)  | NO       | FK → room(room_id)         |
| sender_id  | BIGINT       | NO       | FK → users(id)             |
| content    | VARCHAR(2000)| NO       | Message text               |
| created_at | TIMESTAMP    | NO       | Server time at insert      |

- **Index:** `idx_chat_message_room_created` on `(room_id, created_at DESC)` for efficient pagination by room and time.

JPA creates/updates the table via `spring.jpa.hibernate.ddl-auto=update` (use `validate` or Flyway in production).

---

## 3. Possible Failure Points

| Failure point              | Mitigation / handling |
|----------------------------|------------------------|
| **Invalid/expired JWT**    | CONNECT rejected by JwtChannelInterceptor; client must re-auth. |
| **User not in room**       | Send path: `isSessionInRoom` + ActiveUser check; throw `IllegalStateException` → WebSocketExceptionHandler sends to `/queue/errors`. |
| **Room not found**         | `RoomNotFoundException` → WebSocketExceptionHandler or GlobalExceptionHandler (REST); client gets structured error. |
| **Content validation**     | DTO `@NotBlank` + `@Size(max=2000)`; service double-checks; `BindException` / `IllegalArgumentException` → `/queue/errors`. |
| **DB down / timeout**      | Transaction rolls back; exception handler returns generic error; add retries/health checks and alerting. |
| **Duplicate/out-of-order** | Messages keyed by `id` and `created_at`; client can sort by `createdAt`; idempotency can be added later if needed. |
| **High write load**        | Index on (room_id, created_at); optional: async persist + in-memory broadcast first; DB scaling (read replicas for history). |
| **Abuse (spam/length)**    | Rate limiting (per user/room) and max length enforced; consider moderation pipeline later. |

---

## 4. How to Scale to 100k Users

- **WebSocket layer**
  - Use a **STOMP broker relay** (e.g. RabbitMQ or ActiveMQ) instead of the in-memory broker so multiple app instances share subscriptions and broadcasts.
  - Run multiple app instances behind a load balancer; ensure **sticky sessions** or broker-based subscription so that “send to topic” reaches all subscribers across nodes.

- **Application**
  - **Horizontal scaling**: Stateless app instances; auth via JWT; session/room state in Redis (e.g. ActiveUser, room membership) if you move off in-memory.
  - **ChatService**: Keep “send message” as a single write (DB + broadcast). Optionally: publish “message sent” event to a queue and have a worker persist and broadcast to reduce latency on the HTTP path.

- **Database**
  - **chat_message**: Partition or shard by `room_id` (or time) if one room or global message volume grows very large.
  - **Read replicas** for `getMessages` (history) so reads don’t hit the primary.
  - **Connection pooling** and timeouts tuned for concurrency.

- **Redis (existing)**
  - Use Redis for **ActiveUser** / session-to-room mapping if not already; supports multiple app instances and fast “is user in room?” checks.

- **Observability**
  - Metrics: message rate per room, latency (send + persist), error rates, WebSocket connection count.
  - Logging: already in place (e.g. send message); avoid logging full message body at scale.
  - Alerts on error rate, DB/Redis latency, broker queue depth.

- **Rate limiting**
  - Per-user or per-room limits on send (e.g. token bucket in filter or before ChatService) to protect DB and broker.

With a broker relay, horizontal app scaling, DB read replicas and optional partitioning, and Redis for session/room state, the design can scale toward 100k concurrent users; exact numbers depend on message rate and hardware.
