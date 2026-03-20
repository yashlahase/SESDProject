import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { distanceKm } from "@/lib/geo";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  const radiusKm = Number(searchParams.get("radiusKm") ?? "5");
  const q = searchParams.get("q")?.trim();

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat and lng required" }, { status: 400 });
  }

  const stores = await prisma.store.findMany({
    where: { isApproved: true },
    select: {
      id: true,
      name: true,
      description: true,
      address: true,
      lat: true,
      lng: true,
      _count: { select: { products: true } },
    },
  });

  const withDistance = stores
    .map((s) => ({
      ...s,
      distanceKm: distanceKm(lat, lng, s.lat, s.lng),
    }))
    .filter((s) => s.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  if (q) {
    const lower = q.toLowerCase();
    const filtered = withDistance.filter(
      (s) => s.name.toLowerCase().includes(lower) || (s.description ?? "").toLowerCase().includes(lower),
    );
    return NextResponse.json({ stores: filtered });
  }

  return NextResponse.json({ stores: withDistance });
}
