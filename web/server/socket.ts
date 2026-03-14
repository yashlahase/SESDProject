import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { Server } from "socket.io";
import { PrismaClient } from "@prisma/client";
import { jwtVerify } from "jose";

const PORT = Number(process.env.SOCKET_PORT ?? 3001);
const prisma = new PrismaClient();

function secretKey() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET is not set");
  return new TextEncoder().encode(s);
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

async function userCanAccessOrder(userId: string, role: string, orderId: string): Promise<boolean> {
  if (role === "ADMIN") return true;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { store: true, delivery: true },
  });
  if (!order) return false;
  if (role === "CUSTOMER" && order.customerId === userId) return true;
  if (role === "STORE_OWNER" && order.store.ownerId === userId) return true;
  if (role === "DELIVERY" && order.delivery?.partnerId === userId) return true;
  return false;
}

const httpServer = createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/internal/emit-order") {
    const key = req.headers["x-internal-key"];
    if (key !== process.env.INTERNAL_SOCKET_SECRET) {
      res.writeHead(401).end("unauthorized");
      return;
    }
    const body = (await readJsonBody(req)) as { orderId?: string } | null;
    const orderId = body?.orderId;
    if (!orderId) {
      res.writeHead(400).end("bad request");
      return;
    }
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        store: { select: { id: true, name: true } },
        delivery: true,
        items: { include: { product: { select: { id: true, name: true } } } },
      },
    });
    io.to(`order:${orderId}`).emit("order_updated", order);
    res.writeHead(200).end("ok");
    return;
  }
  res.writeHead(404).end();
});

const io = new Server(httpServer, {
  cors: {
    origin: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    credentials: true,
  },
});

io.use(async (socket, next) => {
  try {
    const token =
      (socket.handshake.auth?.token as string | undefined) ||
      (typeof socket.handshake.headers.authorization === "string"
        ? socket.handshake.headers.authorization.replace(/^Bearer\s+/i, "")
        : undefined);
    if (!token) return next(new Error("no token"));
    const { payload } = await jwtVerify(token, secretKey());
    const sub = payload.sub;
    const role = payload.role;
    if (!sub || typeof role !== "string") return next(new Error("bad token"));
    socket.data.userId = sub;
    socket.data.role = role;
    next();
  } catch {
    next(new Error("unauthorized"));
  }
});

io.on("connection", (socket) => {
  const userId = socket.data.userId as string;
  const role = socket.data.role as string;

  socket.on("join_order", async (orderId: string, cb?: (ack?: { ok: boolean; error?: string }) => void) => {
    try {
      if (!orderId || typeof orderId !== "string") {
        cb?.({ ok: false, error: "invalid" });
        return;
      }
      const ok = await userCanAccessOrder(userId, role, orderId);
      if (!ok) {
        cb?.({ ok: false, error: "forbidden" });
        return;
      }
      await socket.join(`order:${orderId}`);
      cb?.({ ok: true });
    } catch {
      cb?.({ ok: false, error: "error" });
    }
  });

  socket.on(
    "send_message",
    async (
      payload: { orderId?: string; content?: string; clientMsgId?: string },
      cb?: (ack: { ok: boolean; id?: string; error?: string }) => void,
    ) => {
      try {
        const { orderId, content, clientMsgId } = payload ?? {};
        if (!orderId || !content?.trim()) {
          cb?.({ ok: false, error: "invalid" });
          return;
        }
        const ok = await userCanAccessOrder(userId, role, orderId);
        if (!ok) {
          cb?.({ ok: false, error: "forbidden" });
          return;
        }
        const room = await prisma.chatRoom.findUnique({ where: { orderId } });
        if (!room) {
          cb?.({ ok: false, error: "no_room" });
          return;
        }
          if (clientMsgId) {
          const existing = await prisma.message.findUnique({ where: { clientMsgId } });
          if (existing) {
            io.to(`order:${orderId}`).emit("new_message", existing);
            cb?.({ ok: true, id: existing.id });
            return;
          }
        }
        const msg = await prisma.message.create({
          data: {
            roomId: room.id,
            senderId: userId,
            content: content.trim(),
            clientMsgId: clientMsgId ?? null,
          },
          include: { sender: { select: { id: true, name: true, role: true } } },
        });
        io.to(`order:${orderId}`).emit("new_message", msg);
        cb?.({ ok: true, id: msg.id });
      } catch (e) {
        console.error(e);
        cb?.({ ok: false, error: "server" });
      }
    },
  );
});

httpServer.listen(PORT, () => {
  console.log(`[socket] listening on ${PORT}`);
});
