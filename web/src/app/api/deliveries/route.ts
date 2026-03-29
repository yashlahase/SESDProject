import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiUser } from "@/lib/api-user";

export async function GET(req: Request) {
  const user = await getApiUser();
  if (!user || user.role !== "DELIVERY") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope") ?? "open";

  if (scope === "mine") {
    const deliveries = await prisma.delivery.findMany({
      where: { partnerId: user.id },
      orderBy: { updatedAt: "desc" },
      include: {
        order: {
          include: {
            store: { select: { id: true, name: true, address: true, lat: true, lng: true } },
            customer: { select: { id: true, name: true } },
          },
        },
      },
    });
    return NextResponse.json({ deliveries });
  }

  const deliveries = await prisma.delivery.findMany({
    where: { status: "UNASSIGNED", partnerId: null },
    orderBy: { createdAt: "desc" },
    include: {
      order: {
        include: {
          store: { select: { id: true, name: true, address: true, lat: true, lng: true } },
          customer: { select: { id: true, name: true } },
        },
      },
    },
  });
  return NextResponse.json({ deliveries });
}
