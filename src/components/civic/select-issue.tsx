"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useSelectIssue } from "./authority-issue-map";

// Wraps a card in the authority dashboard's left panel so clicking it opens the
// floating right-side detail panel (in place) instead of navigating to the full
// issue page. Falls back to a plain block if used outside the map context.
export function SelectIssue({
  issueId,
  children,
  className,
}: {
  issueId: string;
  children: ReactNode;
  className?: string;
}) {
  const select = useSelectIssue();
  return (
    <button
      type="button"
      onClick={() => select?.(issueId)}
      className={cn("block w-full text-left", className)}
    >
      {children}
    </button>
  );
}
