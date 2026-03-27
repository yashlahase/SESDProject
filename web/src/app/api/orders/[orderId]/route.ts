import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getApiUser } from "@/lib/api-user";
import { notifyOrderUpdated } from "@/lib/socket-notify";

type Ctx = { params: Promise<{ orderId: string }> };

async function loadOrderFor(user: { id: string; role: string }, orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      store: true,
      customer: { select: { id: true, name: true, email: true } },
      delivery: { include: { partner: { select: { id: true, name: true, email: true } } } },
      items: { include: { product: true } },
      chatRoom: { select: { id: true } },
    },
  });
  if (!order) return null;
  if (user.role === "ADMIN") return order;
  if (user.role === "CUSTOMER" && order.customerId === user.id) return order;
  if (user.role === "STORE_OWNER" && order.store.ownerId === user.id) return order;
  if (user.role === "DELIVERY" && order.delivery?.partnerId === user.id) return order;
  return null;
}

export async function GET(_req: Request, ctx: Ctx) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { orderId } = await ctx.params;
  const order = await loadOrderFor(user, orderId);
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ order });
}

const patchSchema = z.object({
  action: z.enum(["accept", "reject", "mark_ready"]),
});

export async function PATCH(req: Request, ctx: Ctx) {
  const user = await getApiUser();
  if (!user || user.role !== "STORE_OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { orderId } = await ctx.params;
  const store = await prisma.store.findUnique({ where: { ownerId: user.id } });
  if (!store) return NextResponse.json({ error: "No store" }, { status: 403 });

  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const { action } = parsed.data;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.order.findFirst({
        where: { id: orderId, storeId: store.id, status: "PENDING" },
        include: { items: true },
      });
      if (!current) {
        const any = await tx.order.findFirst({ where: { id: orderId, storeId: store.id } });
        if (!any) throw new Error("NOT_FOUND");
        throw new Error("STATE");
      }

      if (action === "reject") {
        return tx.order.update({
          where: { id: orderId },
          data: { status: "REJECTED" },
          include: {
            store: { select: { id: true, name: true, address: true } },
            delivery: true,
            items: { include: { product: { select: { id: true, name: true } } } },
          },
        });
      }

      if (action === "accept") {
        for (const line of current.items) {
          const p = await tx.product.findUnique({ where: { id: line.productId } });
          if (!p || p.stock < line.quantity) throw new Error("OOS");
        }
        for (const line of current.items) {
          await tx.product.update({
            where: { id: line.productId },
            data: { stock: { decrement: line.quantity } },
          });
        }
        return tx.order.update({
          where: { id: orderId },
          data: { status: "ACCEPTED" },
          include: {
            store: { select: { id: true, name: true, address: true } },
            delivery: true,
            items: { include: { product: { select: { id: true, name: true } } } },
          },
        });
      }

      if (action === "mark_ready") {
        const o = await tx.order.findFirst({
          where: { id: orderId, storeId: store.id, status: "ACCEPTED" },
        });
        if (!o) throw new Error("STATE");
        return tx.order.update({
          where: { id: orderId },
          data: { status: "READY_FOR_PICKUP" },
          include: {
            store: { select: { id: true, name: true, address: true } },
            delivery: true,
            items: { include: { product: { select: { id: true, name: true } } } },
          },
        });
      }

      throw new Error("STATE");
    });

    await notifyOrderUpdated(updated.id);
    return NextResponse.json({ order: updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "NOT_FOUND") return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (msg === "STATE") return NextResponse.json({ error: "Invalid state" }, { status: 409 });
    if (msg === "OOS") return NextResponse.json({ error: "Insufficient stock" }, { status: 409 });
    throw e;
  }
}
