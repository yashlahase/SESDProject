import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getApiUser } from "@/lib/api-user";

type Ctx = { params: Promise<{ userId: string }> };

const patchSchema = z.object({
  suspended: z.boolean(),
});

export async function PATCH(req: Request, ctx: Ctx) {
  const admin = await getApiUser();
  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { userId } = await ctx.params;
  if (userId === admin.id) {
    return NextResponse.json({ error: "Cannot modify self" }, { status: 400 });
  }
  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { suspended: parsed.data.suspended },
    select: { id: true, email: true, name: true, role: true, suspended: true },
  });
  return NextResponse.json({ user: updated });
}
