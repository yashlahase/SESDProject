import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiUser } from "@/lib/api-user";

export async function GET() {
  const user = await getApiUser();
  if (!user || user.role !== "STORE_OWNER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const store = await prisma.store.findUnique({
    where: { ownerId: user.id },
    include: { products: { orderBy: { name: "asc" } } },
  });
  if (!store) return NextResponse.json({ error: "No store" }, { status: 404 });
  return NextResponse.json({ store });
}
