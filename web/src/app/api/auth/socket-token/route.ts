import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionTokenFromCookies, verifySessionToken } from "@/lib/auth";

/** Short-lived token for Socket.io (readable by client after this request). */
export async function GET() {
  const token = await getSessionTokenFromCookies();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await verifySessionToken(token);
  if (!payload?.sub) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, name: true, role: true, suspended: true },
  });
  if (!user || user.suspended) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { SignJWT } = await import("jose");
  const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
  const socketToken = await new SignJWT({
    role: user.role,
    email: user.email,
    name: user.name,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(secret);

  return NextResponse.json({ token: socketToken });
}
