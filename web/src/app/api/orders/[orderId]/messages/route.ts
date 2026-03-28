import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getApiUser } from "@/lib/api-user";

type Ctx = { params: Promise<{ orderId: string }> };

async function canAccessChat(user: { id: string; role: string }, orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { store: true, delivery: true, chatRoom: true },
  });
  if (!order?.chatRoom) return null;
  if (user.role === "ADMIN") return order.chatRoom;
  if (user.role === "CUSTOMER" && order.customerId === user.id) return order.chatRoom;
  if (user.role === "STORE_OWNER" && order.store.ownerId === user.id) return order.chatRoom;
  if (user.role === "DELIVERY" && order.delivery?.partnerId === user.id) return order.chatRoom;
  return null;
}

export async function GET(_req: Request, ctx: Ctx) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { orderId } = await ctx.params;
  const room = await canAccessChat(user, orderId);
  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const messages = await prisma.message.findMany({
    where: { roomId: room.id },
    orderBy: { createdAt: "asc" },
    include: { sender: { select: { id: true, name: true, role: true } } },
  });
  return NextResponse.json({ messages });
}

const postSchema = z.object({
  content: z.string().min(1).max(2000),
  clientMsgId: z.string().min(8).max(80).optional(),
});

export async function POST(req: Request, ctx: Ctx) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { orderId } = await ctx.params;
  const room = await canAccessChat(user, orderId);
  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const json = await req.json().catch(() => null);
  const parsed = postSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const { content, clientMsgId } = parsed.data;

  if (clientMsgId) {
    const existing = await prisma.message.findUnique({ where: { clientMsgId } });
    if (existing) {
      const full = await prisma.message.findUniqueOrThrow({
        where: { id: existing.id },
        include: { sender: { select: { id: true, name: true, role: true } } },
      });
      return NextResponse.json({ message: full, deduped: true });
    }
  }

  const message = await prisma.message.create({
    data: {
      roomId: room.id,
      senderId: user.id,
      content: content.trim(),
      clientMsgId: clientMsgId ?? null,
    },
    include: { sender: { select: { id: true, name: true, role: true } } },
  });
  return NextResponse.json({ message });
}
