import { prisma } from "@/lib/prisma";
import { getSessionTokenFromCookies, verifySessionToken } from "@/lib/auth";

export type ApiUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  suspended: boolean;
  passwordHash: string;
};

export async function getApiUser(): Promise<ApiUser | null> {
  const token = await getSessionTokenFromCookies();
  if (!token) return null;
  const payload = await verifySessionToken(token);
  if (!payload?.sub) return null;
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || user.suspended) return null;
  return user;
}

export async function requireApiUser(): Promise<ApiUser> {
  const u = await getApiUser();
  if (!u) throw new Error("UNAUTHORIZED");
  return u;
}
