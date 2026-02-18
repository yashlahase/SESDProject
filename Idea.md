# Hyperlocal Quick-Commerce Platform with Real-Time Chat & Offline Sync

## Project Overview

The **Hyperlocal Quick-Commerce Platform** is a production-ready, offline-first digital marketplace that bridges the gap between neighborhood kirana (grocery) stores and local customers. Unlike warehouse-based quick-commerce giants (Blinkit, Zepto), this platform leverages the existing network of local stores, enabling 15–30 minute deliveries without any centralized inventory infrastructure.

The system digitizes local shops end-to-end — from inventory management and order processing to real-time customer communication and delivery tracking — all while functioning gracefully under poor or intermittent network conditions.

---

## Scope & Objectives

### In Scope
- Multi-role platform: Customer, Store Owner, Delivery Partner, Admin
- Real-time bidirectional communication via WebSockets (Socket.io)
- Offline-first architecture with local persistence (IndexedDB / SQLite)
- Background sync and conflict resolution when connectivity is restored
- Geo-based store discovery and proximity matching
- Queue-based order and message processing for reliability
- JWT-based authentication with role-based access control (RBAC)
- Scalable cloud deployment on AWS/GCP with Docker and load balancing

### Out of Scope
- Payment gateway integration (placeholder hooks provided)
- Native mobile app development (PWA-ready web app)
- Warehouse/dark store management

### Objectives
1. Enable local kirana stores to compete with large quick-commerce platforms
2. Provide a seamless offline-first experience for customers in low-connectivity areas
3. Guarantee message and order delivery through queue-based retry mechanisms
4. Design a horizontally scalable system capable of handling thousands of concurrent users

---

## Key Features

### Customer
| Feature | Description |
|---|---|
| Browse Nearby Stores | Geo-based discovery using PostGIS radius queries |
| Product Search | Full-text search with Redis-cached results |
| Cart & Order | Optimistic UI updates with offline queue support |
| Real-Time Chat | WebSocket chat with store owners |
| Live Order Tracking | Real-time delivery status via Socket.io |
| Offline Sync | Orders and messages queued in IndexedDB, synced on reconnect |

### Store Owner (Kirana Merchant)
| Feature | Description |
|---|---|
| Inventory Management | Add/update/delete products with image upload to S3 |
| Order Management | Accept/reject orders with concurrency-safe locking |
| Customer Chat | Real-time messaging with customers |
| Delivery Assignment | Assign available delivery partners to orders |

### Delivery Partner
| Feature | Description |
|---|---|
| Delivery Requests | Receive and accept delivery jobs |
| Navigation | Store and customer address with map integration |
| Status Updates | Real-time delivery status broadcasting |
| Chat | Communicate with store owners and customers |

### Admin
| Feature | Description |
|---|---|
| User Management | Approve/suspend stores, customers, delivery partners |
| Order Monitoring | Dashboard for all active and historical orders |
| System Activity | Real-time metrics and audit logs |

---

## User Roles

```
┌─────────────────────────────────────────────────────────┐
│                    PLATFORM USERS                        │
├─────────────┬──────────────┬───────────────┬────────────┤
│  Customer   │ Store Owner  │   Delivery    │   Admin    │
│             │  (Merchant)  │   Partner     │            │
├─────────────┼──────────────┼───────────────┼────────────┤
│ Browse      │ Manage       │ Accept Jobs   │ Manage     │
│ Order       │ Inventory    │ Navigate      │ Users      │
│ Track       │ Accept Orders│ Update Status │ Monitor    │
│ Chat        │ Chat         │ Chat          │ Audit      │
└─────────────┴──────────────┴───────────────┴────────────┘
```

---

## System Design Challenges

### 1. Scaling Real-Time Communication
**Challenge:** Thousands of concurrent WebSocket connections across multiple server instances.  
**Solution:** Socket.io with Redis Adapter for pub/sub across nodes. Sticky sessions via load balancer for initial handshake, then Redis handles cross-node message routing.

### 2. Message Delivery Guarantees
**Challenge:** Ensuring messages are delivered even if the recipient is offline.  
**Solution:** Three-tier delivery: WebSocket (online) → BullMQ queue (offline) → IndexedDB local queue (no connectivity). Messages persist until acknowledged.

### 3. Intermittent Connectivity
**Challenge:** Customers in rural/semi-urban areas with poor 2G/3G connectivity.  
**Solution:** Offline-first architecture with IndexedDB on web and SQLite on mobile. Service Workers handle background sync. Optimistic UI shows immediate feedback.

### 4. Double Order Submission Prevention
**Challenge:** Network retries causing duplicate orders.  
**Solution:** Client-generated idempotency keys (UUID v4) stored in IndexedDB. Server-side deduplication using Redis with TTL-based idempotency key cache.

### 5. Geo-Based Store Matching
**Challenge:** Efficiently finding stores within a radius for thousands of concurrent users.  
**Solution:** PostGIS extension on PostgreSQL for geospatial queries. Redis GEO commands for hot-path proximity lookups. Geohash-based indexing.

### 6. Concurrency in Order Acceptance
**Challenge:** Multiple store owners or systems trying to accept the same order simultaneously.  
**Solution:** PostgreSQL row-level locking (`SELECT FOR UPDATE`) combined with Redis distributed locks (Redlock algorithm) for atomic order state transitions.

### 7. Caching Hot Products & Stores
**Challenge:** Repeated database queries for popular stores and products.  
**Solution:** Multi-layer caching: Redis L1 cache for hot data (TTL: 5 min), CDN edge caching for static assets, query result caching with cache invalidation on inventory updates.

### 8. Queue-Based Processing
**Challenge:** Ensuring order processing, notifications, and sync operations are reliable.  
**Solution:** BullMQ with Redis backend for job queues. Dead letter queues for failed jobs. Exponential backoff retry strategy.

---

## Scalability & Reliability Considerations

### Horizontal Scaling
```
                    ┌─────────────────┐
                    │   Load Balancer  │
                    │  (AWS ALB/Nginx) │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │ NestJS   │  │ NestJS   │  │ NestJS   │
        │ Instance │  │ Instance │  │ Instance │
        │    1     │  │    2     │  │    3     │
        └────┬─────┘  └────┬─────┘  └────┬─────┘
             │              │              │
             └──────────────┼──────────────┘
                            │
                    ┌───────┴───────┐
                    │  Redis Cluster │
                    │  (Pub/Sub +   │
                    │   Cache)      │
                    └───────┬───────┘
                            │
                    ┌───────┴───────┐
                    │  PostgreSQL   │
                    │  (Primary +   │
                    │   Replicas)   │
                    └───────────────┘
```

### Reliability Patterns
- **Circuit Breaker:** Prevent cascade failures when downstream services are slow
- **Retry with Backoff:** Exponential backoff for failed queue jobs (max 5 retries)
- **Health Checks:** Kubernetes liveness/readiness probes
- **Database Replication:** PostgreSQL streaming replication with read replicas
- **Redis Sentinel/Cluster:** High availability for cache and pub/sub

### Performance Targets
| Metric | Target |
|---|---|
| API Response Time (p95) | < 200ms |
| WebSocket Message Latency | < 100ms |
| Order Processing Time | < 2 seconds |
| Offline Sync Time | < 5 seconds on reconnect |
| System Uptime | 99.9% |

---

## Why Offline-First Matters

India has over **500 million internet users**, but a significant portion experience:
- Intermittent 2G/3G connectivity in tier-2/3 cities
- Network drops in crowded areas (markets, transit)
- High latency on mobile networks

### Offline-First Benefits
1. **User Experience:** App remains functional without internet — customers can browse cached products, compose orders, and write messages
2. **Data Integrity:** Local queues prevent data loss during connectivity gaps
3. **Competitive Advantage:** Works where competitors' apps fail
4. **Reduced Server Load:** Batched sync reduces API call frequency
5. **Trust Building:** Consistent experience builds user confidence

### Offline Capabilities by Role
| Role | Offline Capability |
|---|---|
| Customer | Browse cached stores/products, compose orders, write chat messages |
| Store Owner | View pending orders, update inventory (synced later) |
| Delivery Partner | View assigned delivery details, update status (queued) |

---

## Tech Stack Summary

| Layer | Technology | Rationale |
|---|---|---|
| Frontend | Next.js + TypeScript | SSR/SSG, PWA support, type safety |
| Backend | NestJS + TypeScript | Modular, decorator-based, production-ready |
| Database | PostgreSQL + PostGIS | ACID compliance, geospatial support |
| Cache | Redis | Sub-millisecond reads, pub/sub, GEO commands |
| Real-time | Socket.io | WebSocket with fallback, room management |
| Queue | BullMQ | Redis-backed, reliable job processing |
| Offline | IndexedDB + SQLite | Browser/mobile local persistence |
| Auth | JWT + Refresh Tokens | Stateless, scalable, RBAC |
| Storage | S3-compatible | Scalable image/file storage |
| Deployment | Docker + AWS/GCP | Container orchestration, auto-scaling |
