# KiranaReach (web)

Hyperlocal quick-commerce demo aligned with `Idea.md`: customers, store owners, delivery partners, admin; REST + Prisma (SQLite); Socket.io for live chat; IndexedDB queue for offline order sync.

## Setup

```bash
cd web
cp .env.example .env   # then edit secrets if you like
npm install
npx prisma migrate dev   # creates SQLite DB + applies schema
npm run db:seed          # optional if migrate already seeded
```

## Develop

Run **Next.js** and the **Socket.io** server together:

```bash
npm run dev
```

- App: http://localhost:3000  
- Realtime: http://localhost:3001 (CORS allows `NEXT_PUBLIC_APP_URL`)

## Seeded logins (password `password123`)

| Role        | Email                 |
| ----------- | --------------------- |
| Customer    | customer@kirana.local |
| Store owner | owner@kirana.local    |
| Delivery    | delivery@kirana.local |
| Admin       | admin@kirana.local    |
| 2nd store   | owner2@kirana.local   |

New registrations via `/register` are **customers** only.

## Production build

```bash
npm run build
npm start
```

For production, run the Socket server (`server/socket.ts`) alongside the Next process, set `JWT_SECRET`, `INTERNAL_SOCKET_SECRET`, `NEXT_PUBLIC_SOCKET_URL`, and `NEXT_PUBLIC_APP_URL` to your public URLs.
