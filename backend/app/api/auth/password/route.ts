import { NextRequest } from "next/server";
import { changePasswordSchema } from "@flowace/shared";
import { prisma } from "@/lib/prisma";
import { encodePassword, requireAdmin, verifyPassword } from "@/lib/auth";
import { fail, handler, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Change the signed-in admin's own password. */
export const POST = handler(async (req: NextRequest) => {
  const session = requireAdmin(req);
  const body = changePasswordSchema.parse(await req.json());

  const admin = await prisma.admin.findUnique({ where: { id: session.sub } });
  if (!admin) return fail("Account not found", 404);

  // Re-check the current password. A valid session alone must not be enough to
  // take over the account if a token ever leaks.
  if (!(await verifyPassword(body.currentPassword, admin.password))) {
    // Deliberately 400, not 401: the dashboard's fetch wrapper treats every 401
    // as an expired session and bounces to /login, which would log the admin
    // out over a simple typo.
    return fail("Current password is incorrect", 400);
  }

  await prisma.admin.update({
    where: { id: admin.id },
    data: { password: await encodePassword(body.newPassword) },
  });

  return ok({ success: true });
});
