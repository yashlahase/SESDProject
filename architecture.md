# Architecture Deep-Dives & Viva Preparation
## Hyperlocal Quick-Commerce Platform

---

## 1. Real-Time Chat Architecture

### Message Flow

```
Customer (Browser)
    │
    │  socket.emit("send_message", { roomId, content, clientMsgId })
    ▼
Socket.io Server (Instance A)
    │
    ├─► Save to PostgreSQL (messages table)
    │       └─ Returns { serverMsgId }
    │
    ├─► PUBLISH to Redis channel: "room:{roomId}"
    │       { event: "message", serverMsgId, content, sender, timestamp }
    │
    └─► Emit back to sender: "message_delivered" { clientMsgId, serverMsgId }

Redis Pub/Sub
    │
    └─► All Socket.io instances subscribed to "room:{roomId}"
            │
            ├─► Instance A: emit to sockets in room (same server)
            └─► Instance B: emit to sockets in room (cross-server)
                    │
                    └─► Store Owner (Browser) receives "new_message"
```

### WebSocket Scaling Strategy

**Problem:** With multiple NestJS instances behind a load balancer, a customer on Server 1 and a store owner on Server 2 cannot communicate directly via Socket.io.

**Solution: Socket.io Redis Adapter**

```typescript
// main.ts (NestJS bootstrap)
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

const pubClient = createClient({ url: process.env.REDIS_URL });
const subClient = pubClient.duplicate();

await Promise.all([pubClient.connect(), subClient.connect()]);

const app = await NestFactory.create(AppModule);
const io = app.get(Server);
io.adapter(createAdapter(pubClient, subClient));
```

**How it works:**
1. Every Socket.io server subscribes to Redis channels on startup
2. When Server 1 emits to a room, it publishes to Redis
3. Redis fans out to all subscribed servers
4. Each server checks if any of its local sockets are in that room and delivers accordingly

### Pub/Sub Channel Design

| Channel | Purpose | Subscribers |
|---|---|---|
| `room:{roomId}` | Chat messages in an order room | All servers |
| `channel:store:{storeId}` | Store-specific events (new orders) | Store owner's server |
| `channel:customer:{userId}` | Customer-specific events | Customer's server |
| `channel:delivery:{partnerId}` | Delivery partner events | Partner's server |
| `channel:order:{orderId}` | Order status broadcasts | All parties' servers |

### Delivery Guarantees

**Three-tier delivery system:**

| Tier | Mechanism | When Used |
|---|---|---|
| **Tier 1** | WebSocket (real-time) | User is online and connected |
| **Tier 2** | BullMQ job queue | User is online but WebSocket dropped |
| **Tier 3** | IndexedDB local queue | User is completely offline |

**Acknowledgment Flow:**
```
1. Client sends message with clientMsgId
2. Server saves to DB → emits "message_delivered" back to sender
3. Sender updates UI: ⏳ → ✓ (delivered to server)
4. Recipient receives message → emits "message_read" 
5. Server broadcasts "read_receipt" to sender
6. Sender updates UI: ✓ → ✓✓ (read)
```

**Guaranteed delivery for offline recipients:**
- Messages saved to PostgreSQL immediately
- When recipient reconnects, they fetch missed messages via REST API
- `GET /messages?roomId={id}&since={lastSeenTimestamp}`

---

## 2. Offline Sync Architecture

### Local Storage Schema (IndexedDB)

```typescript
// IndexedDB Database: "quickcommerce_offline_db" (version 1)

// Object Store: offline_orders
interface OfflineOrder {
  localId: string;          // IDBKeyPath (auto-generated UUID)
  serverId?: string;        // Set after successful sync
  storeId: string;
  items: CartItem[];
  deliveryAddress: string;
  totalAmount: number;
  idempotencyKey: string;   // UUID v4, prevents duplicates
  status: 'PENDING_SYNC' | 'SYNCED' | 'CONFLICT' | 'FAILED';
  conflictDetails?: object;
  retryCount: number;       // Max 5 retries
  createdAt: number;        // Unix timestamp (for ordering)
}

// Object Store: offline_messages
interface OfflineMessage {
  localId: string;          // IDBKeyPath
  serverId?: string;
  roomId: string;
  content: string;
  status: 'PENDING_SYNC' | 'SYNCED' | 'FAILED';
  retryCount: number;
  createdAt: number;
}

// Object Store: cached_stores
interface CachedStore {
  storeId: string;          // IDBKeyPath
  data: Store;
  products: Product[];
  cachedAt: number;         // For cache invalidation
  expiresAt: number;        // TTL: 30 minutes
}

// Object Store: sync_metadata
interface SyncMetadata {
  key: string;              // e.g., "last_sync_timestamp"
  value: any;
}
```

### Background Sync Process

```typescript
// Service Worker registration
self.addEventListener('sync', async (event: SyncEvent) => {
  if (event.tag === 'sync-orders') {
    event.waitUntil(syncPendingOrders());
  }
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncPendingMessages());
  }
});

// Trigger sync on reconnect
window.addEventListener('online', async () => {
  const registration = await navigator.serviceWorker.ready;
  await registration.sync.register('sync-orders');
  await registration.sync.register('sync-messages');
});
```

**Sync Algorithm:**
```
1. Query IndexedDB for all records with status = 'PENDING_SYNC'
2. Sort by createdAt ASC (preserve order)
3. For each record:
   a. POST to API with idempotencyKey
   b. On success → update status = 'SYNCED', store serverId
   c. On 409 CONFLICT → update status = 'CONFLICT', store details
   d. On network error → increment retryCount
      - If retryCount < 5: leave as PENDING_SYNC (retry next sync)
      - If retryCount >= 5: update status = 'FAILED'
4. Notify UI via BroadcastChannel API
```

### Retry & Reconciliation Logic

**Exponential Backoff for Failed Syncs:**
```typescript
const RETRY_DELAYS = [1000, 2000, 4000, 8000, 16000]; // ms

async function syncWithRetry(item: OfflineOrder, attempt = 0) {
  try {
    const response = await api.post('/orders', {
      ...item,
      idempotencyKey: item.idempotencyKey
    });
    await db.updateOrderStatus(item.localId, 'SYNCED', response.orderId);
  } catch (error) {
    if (attempt < 5) {
      await sleep(RETRY_DELAYS[attempt]);
      return syncWithRetry(item, attempt + 1);
    }
    await db.updateOrderStatus(item.localId, 'FAILED');
  }
}
```

### Conflict Resolution Strategies

| Conflict Type | Strategy | Implementation |
|---|---|---|
| **Product out of stock** | Manual resolution | Show UI to edit/cancel order |
| **Store closed** | Automatic rejection | Notify user, clear cart |
| **Duplicate order** | Server-side dedup | Idempotency key → return existing order |
| **Price changed** | Last-write-wins | Recalculate total, notify user |
| **Message ordering** | Timestamp-based | Sort by `createdAt`, server assigns final order |

**Idempotency Key Flow:**
```
Client generates UUID v4 → stores in IndexedDB with order
    ↓
POST /orders { idempotencyKey: "abc-123" }
    ↓
Server checks Redis: GET idempotency:abc-123
    ├── Not found → Process order → SET idempotency:abc-123 {orderId} EX 86400
    └── Found → Return existing orderId (no duplicate!)
```

---

## 3. Scalability Strategy

### Load Balancing Sockets

```
Internet
    │
    ▼
AWS Application Load Balancer (ALB)
    │  ← Sticky sessions for WebSocket handshake (1 min)
    │  ← After handshake, Redis handles cross-server routing
    │
    ├── NestJS Instance 1 (ECS Task)
    ├── NestJS Instance 2 (ECS Task)
    └── NestJS Instance 3 (ECS Task)
         │
         └── All connected to Redis Cluster (Pub/Sub + Cache)
```

**Sticky Session Strategy:**
- ALB uses cookie-based stickiness for the initial WebSocket upgrade
- Once connected, Redis Adapter handles all cross-server message routing
- If a server goes down, client auto-reconnects (Socket.io built-in)

### Caching Strategy

**Multi-Layer Cache:**

```
Request → L1: In-Memory (Node.js) → L2: Redis → L3: PostgreSQL
              (< 1ms)               (< 5ms)       (< 50ms)
```

| Data | Cache Layer | TTL | Invalidation |
|---|---|---|---|
| Nearby stores | Redis GEO + JSON | 5 min | On store update |
| Store products | Redis Hash | 5 min | On inventory change |
| User profile | Redis String | 15 min | On profile update |
| Hot products | Redis Sorted Set | 10 min | On stock change |
| Auth tokens | Redis String | Token expiry | On logout |
| Idempotency keys | Redis String | 24 hr | Never (TTL) |

**Cache Invalidation Pattern:**
```typescript
// When inventory is updated
async updateProduct(id: string, dto: UpdateProductDto) {
  await this.productRepo.update(id, dto);
  // Invalidate cache
  await this.redis.del(`store:products:${dto.storeId}`);
  await this.redis.del(`product:${id}`);
}
```

### Horizontal Scaling

**Stateless API Design:**
- JWT tokens are self-contained (no server-side session)
- All shared state in Redis (presence, rooms, cache)
- PostgreSQL for persistent data with read replicas

**Auto-Scaling Rules (AWS ECS):**
```
Scale OUT: CPU > 70% for 2 minutes → Add 2 instances
Scale IN:  CPU < 30% for 10 minutes → Remove 1 instance
Min instances: 2 (high availability)
Max instances: 20 (cost control)
```

**Database Scaling:**
```
PostgreSQL Primary (writes)
    │
    ├── Read Replica 1 (store/product queries)
    ├── Read Replica 2 (order history queries)
    └── Read Replica 3 (analytics/admin)
```

### Queue-Based Processing

**BullMQ Job Queues:**

| Queue | Jobs | Workers | Priority |
|---|---|---|---|
| `notify-store` | New order alerts | 3 | HIGH |
| `notify-customer` | Order status updates | 3 | HIGH |
| `find-delivery` | Match delivery partners | 2 | MEDIUM |
| `send-notifications` | Push notifications | 5 | LOW |
| `sync-offline` | Process synced data | 2 | LOW |
| `analytics` | Update metrics | 1 | LOWEST |

**Retry Strategy:**
```typescript
const orderQueue = new Queue('notify-store', {
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 1000,  // 1s, 2s, 4s, 8s, 16s
    },
    removeOnComplete: 100,  // Keep last 100 completed jobs
    removeOnFail: 500,      // Keep last 500 failed jobs
  }
});
```

**Dead Letter Queue:**
- Failed jobs after max retries → moved to `failed-jobs` queue
- Admin dashboard shows failed jobs with error details
- Manual retry or discard option

---

## 4. Viva Preparation — System Design Q&A

### Architecture & Design

**Q1: Why did you choose NestJS over Express for the backend?**

> NestJS provides a structured, opinionated framework with built-in support for dependency injection, decorators, modules, and WebSocket gateways. For a complex system with multiple domains (orders, chat, delivery), NestJS's modular architecture prevents code sprawl. It also has first-class TypeScript support, making the entire stack type-safe from frontend to backend.

**Q2: Why PostgreSQL over MongoDB for this system?**

> This system has complex relational data: orders reference products, deliveries reference orders, chat rooms reference orders. PostgreSQL's ACID transactions are critical for preventing double order submissions and ensuring inventory consistency. PostGIS extension enables geospatial queries natively. MongoDB would require application-level joins and lacks strong consistency guarantees needed for financial transactions.

**Q3: How does your system handle the CAP theorem trade-offs?**

> The system prioritizes **Consistency and Partition Tolerance (CP)** for critical operations (order placement, payment) using PostgreSQL with row-level locking. For non-critical operations (presence, location updates), we prioritize **Availability and Partition Tolerance (AP)** using Redis, accepting eventual consistency. The offline-first design acknowledges partition tolerance as a first-class concern.

---

### Real-Time Communication

**Q4: How do you scale WebSockets across multiple servers?**

> We use the **Socket.io Redis Adapter**. Each server instance subscribes to Redis Pub/Sub channels on startup. When a message is emitted to a room, the server publishes to Redis, which fans out to all instances. Each instance then delivers to its locally connected sockets. This allows horizontal scaling without sticky sessions for message routing (only the initial WebSocket handshake needs stickiness).

**Q5: What happens if a WebSocket connection drops mid-message?**

> Socket.io has built-in reconnection with exponential backoff. Messages are saved to PostgreSQL before broadcasting, so on reconnect, the client fetches missed messages via REST API (`GET /messages?since=lastTimestamp`). The client-side message queue in IndexedDB ensures no messages are lost during the reconnection window.

**Q6: How do you implement typing indicators efficiently?**

> Typing indicators use a **debounced event** approach. The client emits `typing` only when the user starts typing, then stops emitting after 3 seconds of inactivity. The server broadcasts to the room via Redis Pub/Sub. Typing indicators are **not persisted** — they're ephemeral events. If the connection drops, the indicator disappears naturally (no cleanup needed).

**Q7: How do you handle presence (online/offline) at scale?**

> Each user's presence is stored in Redis as `presence:{userId}` with a 30-second TTL. The client sends a heartbeat every 20 seconds to refresh the TTL. On disconnect, Socket.io fires the `disconnect` event, which deletes the Redis key. For bulk presence queries (e.g., "which of these 50 users are online?"), we use Redis `MGET` for O(n) lookup.

---

### Offline Sync

**Q8: How do you prevent duplicate orders when a user retries after a network failure?**

> **Idempotency keys.** The client generates a UUID v4 when the user first clicks "Place Order" and stores it in IndexedDB. Every retry uses the same key. The server checks Redis for this key before processing: if found, it returns the existing order ID without creating a new one. The key is stored in Redis with a 24-hour TTL and also saved in the `orders` table with a UNIQUE constraint as a database-level safety net.

**Q9: What is your conflict resolution strategy for offline orders?**

> We use a **hybrid approach**:
> - **Server-authoritative** for inventory conflicts (product out of stock → reject, notify user)
> - **Last-write-wins** for non-critical data (price changes → recalculate, notify user)
> - **Manual resolution** for ambiguous conflicts (show UI to user)
> 
> The key insight is that most conflicts are detectable server-side during sync, and the client UI can present clear resolution options rather than silently overwriting data.

**Q10: How does Background Sync work in the browser?**

> The **Background Sync API** (via Service Workers) allows the browser to defer network requests until connectivity is restored, even if the tab is closed. We register sync tags (`sync-orders`, `sync-messages`) when the user goes offline. When connectivity returns, the browser fires the `sync` event in the Service Worker, which processes the IndexedDB queue. This works even if the user has closed the browser tab.

---

### Database & Performance

**Q11: How do you implement geo-based store discovery efficiently?**

> **Two-layer approach:**
> 1. **Redis GEO commands** for hot-path queries: `GEORADIUS delivery:locations 73.8 18.5 3 km` — sub-millisecond response, cached for 5 minutes
> 2. **PostGIS** for precise queries: `ST_DWithin(geolocation, ST_MakePoint(lng, lat)::geography, 3000)` — used when cache misses or for admin queries
> 
> Stores are indexed with a GIST spatial index on the `geolocation` column. For a city with 10,000 stores, a 3km radius query returns results in < 10ms.

**Q12: How do you prevent race conditions when two store owners try to accept the same order?**

> **Optimistic locking with PostgreSQL row-level locks:**
> ```sql
> BEGIN;
> SELECT * FROM orders WHERE id = $1 AND status = 'PENDING' FOR UPDATE;
> -- If no row returned, another transaction already accepted it
> UPDATE orders SET status = 'ACCEPTED' WHERE id = $1;
> COMMIT;
> ```
> The `FOR UPDATE` lock ensures only one transaction can modify the row at a time. Combined with a Redis distributed lock (Redlock) for the API layer, this provides two layers of protection.

**Q13: What is your database indexing strategy?**

> Key indexes:
> - **GIST spatial index** on `stores.geolocation` for geo queries
> - **Composite index** on `orders(customer_id, status)` for order history
> - **Composite index** on `messages(room_id, created_at DESC)` for paginated chat
> - **GIN full-text index** on `products(name, description)` for search
> - **Partial index** on `delivery_partner_profiles(is_available) WHERE is_available = true` for fast partner lookup
> - **Unique index** on `orders(idempotency_key)` for deduplication

---

### Scalability & Reliability

**Q14: How does your system handle a sudden spike in orders (e.g., festival sale)?**

> **Multi-layer approach:**
> 1. **Auto-scaling**: AWS ECS scales NestJS instances based on CPU/memory metrics
> 2. **Queue buffering**: Orders go into BullMQ queue immediately, processed asynchronously — the API responds fast, processing happens in background
> 3. **Redis caching**: Hot store/product data served from cache, reducing DB load
> 4. **Read replicas**: Order history and analytics queries routed to PostgreSQL read replicas
> 5. **Rate limiting**: Per-user rate limits prevent abuse during spikes

**Q15: What is your disaster recovery strategy?**

> - **PostgreSQL**: Streaming replication to standby in different AZ. Point-in-time recovery with WAL archiving to S3. RTO: 5 min, RPO: 1 min
> - **Redis**: Redis Sentinel for automatic failover. Redis Cluster for data sharding
> - **Application**: Multi-AZ deployment. Health checks with automatic instance replacement
> - **Data**: Daily backups to S3 with 30-day retention

**Q16: How do you monitor the system in production?**

> - **Metrics**: Prometheus + Grafana for API latency, queue depth, WebSocket connections, cache hit rate
> - **Logging**: Structured JSON logs → AWS CloudWatch → Elasticsearch for search
> - **Tracing**: OpenTelemetry distributed tracing across services
> - **Alerting**: PagerDuty alerts for: queue depth > 1000, p95 latency > 500ms, error rate > 1%, WebSocket connections drop > 20%
> - **Business metrics**: Orders per minute, delivery success rate, chat message volume

**Q17: How do you handle the "thundering herd" problem when cache expires?**

> **Cache stampede prevention:**
> 1. **Probabilistic early expiration**: Refresh cache before it expires (at 80% of TTL)
> 2. **Mutex lock**: Only one request rebuilds the cache; others wait or serve stale data
> 3. **Staggered TTLs**: Add random jitter to TTL (e.g., 300 ± 30 seconds) to prevent synchronized expiration
> 4. **Background refresh**: A cron job pre-warms popular store/product caches

---

### Security

**Q18: How do you secure the JWT implementation?**

> - **Short-lived access tokens**: 15-minute expiry reduces exposure window
> - **Refresh token rotation**: Each refresh generates a new refresh token, old one is invalidated
> - **Refresh token storage**: Hashed in PostgreSQL, not stored in plain text
> - **Token revocation**: Redis blacklist for immediate invalidation on logout
> - **RBAC**: Role claims in JWT payload, validated by NestJS guards on every request
> - **HTTPS only**: All tokens transmitted over TLS

**Q19: How do you prevent a customer from accessing another customer's orders?**

> Every API endpoint validates ownership:
> ```typescript
> @Get(':id')
> @UseGuards(JwtAuthGuard)
> async getOrder(@Param('id') id: string, @CurrentUser() user: User) {
>   const order = await this.orderService.findById(id);
>   if (order.customerId !== user.id && user.role !== 'ADMIN') {
>     throw new ForbiddenException();
>   }
>   return order;
> }
> ```
> Database queries always include `WHERE customer_id = $userId` to prevent data leakage even if authorization checks are bypassed.

---

### System Design Trade-offs

**Q20: What would you change if you had to handle 10x more users?**

> 1. **Microservices**: Split into separate services (Order Service, Chat Service, Delivery Service) with independent scaling
> 2. **Event Sourcing**: Replace direct DB updates with event streams for better audit trail and replay capability
> 3. **CQRS**: Separate read and write models for orders — write to PostgreSQL, read from Elasticsearch
> 4. **Message broker**: Replace Redis Pub/Sub with Apache Kafka for guaranteed message ordering and replay
> 5. **CDN**: Edge caching for product images and store data closer to users
> 6. **Database sharding**: Shard orders by region or customer ID for horizontal DB scaling
