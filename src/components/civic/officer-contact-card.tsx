import Link from "next/link";
import { Phone, IdCard, ArrowUpRight } from "lucide-react";
import { DEPARTMENT_LABELS } from "@/lib/departments";
import type { Department } from "@/generated/prisma/client";

function initials(name: string) {
  return (
    name
      .split(" ")
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

// Compact "ID card" for the officer handling an issue (STORY-013). The phone is
// labelled an office contact — in production this is an official line. The name
// links to the officer's public recognition profile (STORY-019).
export function OfficerContactCard({
  officerId,
  name,
  department,
  wardNumber,
  phone,
}: {
  officerId?: string;
  name: string;
  department: Department | null;
  wardNumber: number | null;
  phone: string | null;
}) {
  const nameEl = officerId ? (
    <Link
      href={`/officers/${officerId}`}
      className="inline-flex items-center gap-1 truncate font-medium leading-snug hover:underline"
    >
      {name}
      <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground" />
    </Link>
  ) : (
    <p className="truncate font-medium leading-snug">{name}</p>
  );

  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="mb-3 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <IdCard className="size-3.5" />
        Office contact
      </p>
      <div className="flex items-center gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-full bg-nilo/10 text-sm font-medium text-nilo">
          {initials(name)}
        </div>
        <div className="min-w-0 flex-1">
          {nameEl}
          <p className="truncate text-xs text-muted-foreground">
            {department ? DEPARTMENT_LABELS[department] : "Local body officer"}
            {wardNumber ? ` · Ward ${wardNumber}` : ""}
          </p>
        </div>
        {phone ? (
          <a
            href={`tel:${phone}`}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted/60"
          >
            <Phone className="size-4" />
            {phone}
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">No contact on file</span>
        )}
      </div>
    </div>
  );
}
