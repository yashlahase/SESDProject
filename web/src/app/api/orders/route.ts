import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getApiUser } from "@/lib/api-user";
import { notifyOrderUpdated } from "@/lib/socket-notify";

const itemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
});

const createSchema = z.object({
  storeId: z.string().min(1),
  items: z.array(itemSchema).min(1),
  deliveryAddress: z.string().min(5).max(500),
  notes: z.string().max(500).optional(),
  idempotencyKey: z.string().min(8).max(80).optional(),
});

export async function GET() {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (user.role === "CUSTOMER") {
    const orders = await prisma.order.findMany({
      where: { customerId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        store: { select: { id: true, name: true, address: true } },
        delivery: true,
        items: { include: { product: { select: { id: true, name: true } } } },
      },
    });
    return NextResponse.json({ orders });
  }

  if (user.role === "STORE_OWNER") {
    const store = await prisma.store.findUnique({ where: { ownerId: user.id } });
    if (!store) return NextResponse.json({ orders: [] });
    const orders = await prisma.order.findMany({
      where: { storeId: store.id },
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { id: true, name: true, email: true } },
        delivery: { include: { partner: { select: { id: true, name: true } } } },
        items: { include: { product: true } },
      },
    });
    return NextResponse.json({ orders });
  }

  if (user.role === "ADMIN") {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        customer: { select: { id: true, name: true } },
        store: { select: { id: true, name: true } },
        delivery: true,
      },
    });
    return NextResponse.json({ orders });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(req: Request) {
  const user = await getApiUser();
  if (!user || user.role !== "CUSTOMER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const headerKey = req.headers.get("Idempotency-Key") ?? req.headers.get("idempotency-key");
  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const headerOk = headerKey && z.string().min(8).max(80).safeParse(headerKey).success;
  const idempotencyKey = parsed.data.idempotencyKey ?? (headerOk ? headerKey! : undefined);
  if (!idempotencyKey) {
    return NextResponse.json({ error: "idempotencyKey or Idempotency-Key header required" }, { status: 400 });
  }

  const existing = await prisma.order.findUnique({
    where: { idempotencyKey },
    include: {
      store: { select: { id: true, name: true, address: true } },
      delivery: true,
      items: { include: { product: { select: { id: true, name: true } } } },
    },
  });
  if (existing) {
    return NextResponse.json({ order: existing, deduped: true });
  }

  const { storeId, items, deliveryAddress, notes } = parsed.data;
  const store = await prisma.store.findFirst({ where: { id: storeId, isApproved: true } });
  if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });

  try {
    const order = await prisma.$transaction(async (tx) => {
      let totalCents = 0;
      const lines: { productId: string; quantity: number; unitPriceCents: number }[] = [];

      for (const line of items) {
        const product = await tx.product.findFirst({
          where: { id: line.productId, storeId },
        });
        if (!product) throw new Error("BAD_PRODUCT");
        if (product.stock < line.quantity) throw new Error("OOS");
        totalCents += product.priceCents * line.quantity;
        lines.push({
          productId: product.id,
          quantity: line.quantity,
          unitPriceCents: product.priceCents,
        });
      }

      const created = await tx.order.create({
        data: {
          idempotencyKey,
          customerId: user.id,
          storeId,
          status: "PENDING",
          deliveryAddress,
          totalCents,
          notes: notes ?? null,
          items: { create: lines },
          delivery: { create: { status: "UNASSIGNED" } },
          chatRoom: { create: {} },
        },
        include: {
          store: { select: { id: true, name: true, address: true } },
          delivery: true,
          items: { include: { product: { select: { id: true, name: true } } } },
        },
      });
      return created;
    });

    await notifyOrderUpdated(order.id);
    return NextResponse.json({ order });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "BAD_PRODUCT") return NextResponse.json({ error: "Invalid product" }, { status: 400 });
    if (msg === "OOS") return NextResponse.json({ error: "Insufficient stock" }, { status: 409 });
    throw e;
  }
}
