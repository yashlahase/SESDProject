import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ storeId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { storeId } = await ctx.params;
  const store = await prisma.store.findFirst({
    where: { id: storeId, isApproved: true },
    include: {
      owner: { select: { name: true } },
      _count: { select: { products: true } },
    },
  });
  if (!store) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ store });
}
