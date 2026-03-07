import { prisma } from "@/lib/prisma";
import { getSessionTokenFromCookies, verifySessionToken } from "@/lib/auth";

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  suspended: boolean;
};

export async function getCurrentUser(): Promise<PublicUser | null> {
  const token = await getSessionTokenFromCookies();
  if (!token) return null;
  const payload = await verifySessionToken(token);
  if (!payload?.sub) return null;
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, name: true, role: true, suspended: true },
  });
  return user;
}

export async function requireUser(): Promise<PublicUser> {
  const u = await getCurrentUser();
  if (!u || u.suspended) throw new Error("UNAUTHORIZED");
  return u;
}
