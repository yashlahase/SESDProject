import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getApiUser } from "@/lib/api-user";
import { notifyOrderUpdated } from "@/lib/socket-notify";

type Ctx = { params: Promise<{ deliveryId: string }> };

const patchSchema = z.object({
  action: z.enum(["claim", "pickup", "at_customer", "complete"]),
});

export async function PATCH(req: Request, ctx: Ctx) {
  const user = await getApiUser();
  if (!user || user.role !== "DELIVERY") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { deliveryId } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const { action } = parsed.data;

  const delivery = await prisma.delivery.findUnique({
    where: { id: deliveryId },
    include: { order: true },
  });
  if (!delivery) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const out = await prisma.$transaction(async (tx) => {
      if (action === "claim") {
        const claimed = await tx.delivery.updateMany({
          where: { id: deliveryId, status: "UNASSIGNED", partnerId: null },
          data: { partnerId: user.id, status: "ASSIGNED" },
        });
        if (claimed.count !== 1) throw new Error("STATE");
        await tx.order.update({
          where: { id: delivery.orderId },
          data: { status: "OUT_FOR_DELIVERY" },
        });
        return tx.delivery.findUniqueOrThrow({ where: { id: deliveryId } });
      }

      if (delivery.partnerId !== user.id) throw new Error("FORBIDDEN");

      if (action === "pickup") {
        if (delivery.status !== "ASSIGNED") throw new Error("STATE");
        return tx.delivery.update({
          where: { id: deliveryId },
          data: { status: "PICKED_UP" },
        });
      }
      if (action === "at_customer") {
        if (delivery.status !== "PICKED_UP") throw new Error("STATE");
        return tx.delivery.update({
          where: { id: deliveryId },
          data: { status: "AT_CUSTOMER" },
        });
      }
      if (action === "complete") {
        if (!["AT_CUSTOMER", "PICKED_UP", "ASSIGNED"].includes(delivery.status)) throw new Error("STATE");
        await tx.delivery.update({
          where: { id: deliveryId },
          data: { status: "COMPLETED" },
        });
        await tx.order.update({
          where: { id: delivery.orderId },
          data: { status: "DELIVERED" },
        });
        return tx.delivery.findUniqueOrThrow({ where: { id: deliveryId } });
      }

      throw new Error("STATE");
    });

    await notifyOrderUpdated(delivery.orderId);
    const full = await prisma.delivery.findUnique({
      where: { id: out.id },
      include: {
        order: {
          include: {
            store: { select: { id: true, name: true, address: true } },
            customer: { select: { id: true, name: true } },
            items: { include: { product: true } },
            delivery: true,
          },
        },
      },
    });
    return NextResponse.json({ delivery: full });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "STATE") return NextResponse.json({ error: "Invalid state" }, { status: 409 });
    if (msg === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    throw e;
  }
}
