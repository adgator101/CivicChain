import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Role } from "@/generated/prisma/client";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  wardNumber: number | null;
  municipalityName: string | null;
  districtName: string | null;
  provinceName: string | null;
};

function normalize(user: Record<string, unknown>): CurrentUser {
  return {
    id: String(user.id),
    name: String(user.name ?? ""),
    email: String(user.email ?? ""),
    role: (user.role as Role) ?? Role.CITIZEN,
    wardNumber: (user.wardNumber as number | null) ?? null,
    municipalityName: (user.municipalityName as string | null) ?? null,
    districtName: (user.districtName as string | null) ?? null,
    provinceName: (user.provinceName as string | null) ?? null,
  };
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  return normalize(session.user as Record<string, unknown>);
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(allowed: Role[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!allowed.includes(user.role)) {
    redirect(homePathForRole(user.role));
  }
  return user;
}

export function homePathForRole(role: Role): string {
  switch (role) {
    case Role.LOCAL_BODY_EMPLOYEE:
    case Role.LOCAL_BODY_HEAD:
      return "/authority/dashboard";
    case Role.EXECUTIVE_BODY:
      return "/executive/dashboard";
    default:
      return "/dashboard";
  }
}
