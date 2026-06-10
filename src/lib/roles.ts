// Client-safe role helpers (no server-only imports).
import type { Role } from "@/generated/prisma/client";

export const ROLE_LABELS: Record<Role, string> = {
  CITIZEN: "Citizen",
  LOCAL_BODY_EMPLOYEE: "Local Body Employee",
  LOCAL_BODY_HEAD: "Local Body Head",
  EXECUTIVE_BODY: "Executive Body (National)",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  CITIZEN: "Report and verify civic issues in your ward.",
  LOCAL_BODY_EMPLOYEE: "Investigate and resolve assigned issues.",
  LOCAL_BODY_HEAD: "Assign work, review root causes, manage your municipality.",
  EXECUTIVE_BODY: "National read-only oversight across all municipalities.",
};

export function roleHomePath(role: Role): string {
  switch (role) {
    case "LOCAL_BODY_EMPLOYEE":
    case "LOCAL_BODY_HEAD":
      return "/authority/dashboard";
    case "EXECUTIVE_BODY":
      return "/executive/dashboard";
    default:
      return "/dashboard";
  }
}
