import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionTokenFromCookies, verifySessionToken } from "@/lib/auth";

export async function GET() {
  const token = await getSessionTokenFromCookies();
  if (!token) return NextResponse.json({ user: null });
  const payload = await verifySessionToken(token);
  if (!payload?.sub) return NextResponse.json({ user: null });
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, name: true, role: true, suspended: true },
  });
  if (!user || user.suspended) return NextResponse.json({ user: null });
  return NextResponse.json({ user });
}
