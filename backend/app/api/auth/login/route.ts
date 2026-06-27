import { NextRequest } from "next/server";
import { loginSchema, UserRole } from "@flowace/shared";
import { prisma } from "@/lib/prisma";
import { signAdminToken, verifyPassword } from "@/lib/auth";
import { fail, handler, ok } from "@/lib/http";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export const POST = handler(async (req: NextRequest) => {
  const body = loginSchema.parse(await req.json());
  const admin = await prisma.admin.findUnique({ where: { email: body.email } });
  if (!admin || !(await verifyPassword(body.password, admin.password))) {
    return fail("Invalid email or password", 401);
  }

  const token = signAdminToken({
    sub: admin.id,
    email: admin.email,
    role: admin.role as UserRole,
  });

  const res = ok({
    token,
    admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
  });
  res.cookies.set("flowace_token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProd,
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return res;
});
