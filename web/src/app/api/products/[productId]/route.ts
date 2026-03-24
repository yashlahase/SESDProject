import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getApiUser } from "@/lib/api-user";

type Ctx = { params: Promise<{ productId: string }> };

async function assertOwnerProduct(userId: string, productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { store: true },
  });
  if (!product || product.store.ownerId !== userId) return null;
  return product;
}

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  priceCents: z.number().int().positive().optional(),
  stock: z.number().int().min(0).optional(),
  imageUrl: z.string().url().nullable().optional().or(z.literal("")),
});

export async function PATCH(req: Request, ctx: Ctx) {
  const user = await getApiUser();
  if (!user || user.role !== "STORE_OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { productId } = await ctx.params;
  const existing = await assertOwnerProduct(user.id, productId);
  if (!existing) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const data = parsed.data;
  const product = await prisma.product.update({
    where: { id: productId },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.priceCents !== undefined ? { priceCents: data.priceCents } : {}),
      ...(data.stock !== undefined ? { stock: data.stock } : {}),
      ...(data.imageUrl !== undefined
        ? { imageUrl: data.imageUrl === "" ? null : data.imageUrl }
        : {}),
    },
  });
  return NextResponse.json({ product });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const user = await getApiUser();
  if (!user || user.role !== "STORE_OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { productId } = await ctx.params;
  const existing = await assertOwnerProduct(user.id, productId);
  if (!existing) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await prisma.product.delete({ where: { id: productId } });
  return NextResponse.json({ ok: true });
}
