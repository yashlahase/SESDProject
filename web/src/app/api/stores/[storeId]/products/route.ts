import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getApiUser } from "@/lib/api-user";

type Ctx = { params: Promise<{ storeId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { storeId } = await ctx.params;
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store?.isApproved) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const products = await prisma.product.findMany({
    where: { storeId },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ products });
}

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  priceCents: z.number().int().positive(),
  stock: z.number().int().min(0),
  imageUrl: z.string().url().optional().or(z.literal("")),
});

export async function POST(req: Request, ctx: Ctx) {
  const user = await getApiUser();
  if (!user || user.role !== "STORE_OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { storeId } = await ctx.params;
  const store = await prisma.store.findFirst({ where: { id: storeId, ownerId: user.id } });
  if (!store) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const { name, description, priceCents, stock, imageUrl } = parsed.data;
  const product = await prisma.product.create({
    data: {
      storeId,
      name,
      description: description ?? null,
      priceCents,
      stock,
      imageUrl: imageUrl || null,
    },
  });
  return NextResponse.json({ product });
}
