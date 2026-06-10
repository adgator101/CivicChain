import { createSafeActionClient } from "next-safe-action";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { Role } from "@/generated/prisma/client";

export const actionClient = createSafeActionClient();

export const authActionClient = actionClient.use(async ({ next }) => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");
  return next({ ctx: { user: session.user, session: session.session } });
});

export function roleActionClient(allowedRoles: Role[]) {
  return authActionClient.use(async ({ next, ctx }) => {
    const role = (ctx.user as { role?: Role }).role ?? Role.CITIZEN;
    if (!allowedRoles.includes(role)) {
      throw new Error("Forbidden: insufficient role");
    }
    return next({ ctx });
  });
}
