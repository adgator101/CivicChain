"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, GitBranch, Loader2, X } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { removeCascadeLinkAction, undoCascadeChainAction } from "@/lib/actions/issues";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SelectIssue } from "@/components/civic/select-issue";

type ChainIssue = { id: string; title: string };

// Dashboard "Cascading Complaints" alert. Clicking the summary opens the issue
// on the map; expanding reveals each downstream issue so the HEAD can either
// detach a single mis-cascaded issue or dissolve the whole chain. Keeps AI
// cascade suggestions fully human-reversible.
export function CascadeChainCard({
  root,
  downstream,
  linkedCount,
}: {
  root: { id: string; title: string; wardNumber: number | null };
  downstream: ChainIssue[];
  linkedCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [gone, setGone] = useState(false);
  const [detached, setDetached] = useState<Set<string>>(new Set());

  const undoChain = useAction(undoCascadeChainAction, {
    onSuccess: ({ data }) => {
      toast.success(`Cascade dissolved — ${data?.detached ?? 0} issue(s) detached.`);
      setGone(true);
      router.refresh();
    },
    onError: ({ error }) => toast.error(error.serverError ?? "Could not undo the cascade."),
  });

  const removeLink = useAction(removeCascadeLinkAction, {
    onSuccess: () => {
      toast.success("Issue detached from the chain.");
      router.refresh();
    },
    onError: ({ error }) => toast.error(error.serverError ?? "Could not detach the issue."),
  });

  if (gone) return null;

  const visibleDownstream = downstream.filter((d) => !detached.has(d.id));

  return (
    <Card className="overflow-hidden border-l-4 border-amber-500">
      <SelectIssue issueId={root.id} className="p-3 transition-colors hover:bg-muted/40">
        <p className="text-sm font-medium">
          {root.wardNumber ? `Ward ${root.wardNumber} · ` : ""}
          {linkedCount} linked issues
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          Root: {root.title} · fix once, clear the chain
        </p>
      </SelectIssue>

      <div className="border-t border-border/60 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <span className="inline-flex items-center gap-1.5">
            <GitBranch className="size-3.5" />
            Review &amp; undo cascade
          </span>
          <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        {open && (
          <div className="mt-2 space-y-2">
            <p className="text-xs text-muted-foreground">
              Wrongly linked by AI? Detach a single issue, or dissolve the whole chain.
            </p>

            <ul className="space-y-1">
              {visibleDownstream.length === 0 && (
                <li className="text-xs text-muted-foreground">No downstream issues remain linked.</li>
              )}
              {visibleDownstream.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="inline-flex min-w-0 items-center gap-2">
                    <span className="size-1.5 shrink-0 rounded-full bg-amber-500" />
                    <span className="truncate">{d.title}</span>
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 shrink-0 px-1.5 text-xs text-muted-foreground"
                    disabled={removeLink.isPending || undoChain.isPending}
                    onClick={() => {
                      setDetached((prev) => new Set(prev).add(d.id));
                      removeLink.execute({ downstreamIssueId: d.id });
                    }}
                  >
                    <X className="size-3.5" />
                    Detach
                  </Button>
                </li>
              ))}
            </ul>

            <Button
              size="sm"
              variant="outline"
              className="h-7 w-full text-xs"
              disabled={undoChain.isPending || removeLink.isPending}
              onClick={() => undoChain.execute({ rootIssueId: root.id })}
            >
              {undoChain.isPending && <Loader2 className="size-3.5 animate-spin" />}
              Undo entire cascade
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
