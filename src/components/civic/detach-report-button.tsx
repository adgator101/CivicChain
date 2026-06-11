"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Unlink } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { detachReportAction } from "@/lib/actions/reports";
import { Button } from "@/components/ui/button";

// Lets a HEAD / section head split a wrongly-clustered report back into its own
// issue. Shown only when more than one report is attached (you can't un-merge the
// only report). On success the report becomes a new SUBMITTED issue.
export function DetachReportButton({
  reportId,
  onDone,
}: {
  reportId: string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [done, setDone] = useState(false);

  const { execute, isPending } = useAction(detachReportAction, {
    onSuccess: () => {
      toast.success("Report un-merged — now tracked as its own issue.");
      setDone(true);
      onDone?.();
      router.refresh();
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Could not un-merge the report.");
    },
  });

  if (done) return null;

  return (
    <Button
      size="sm"
      variant="ghost"
      className="h-7 px-2 text-xs text-muted-foreground"
      disabled={isPending}
      onClick={() => execute({ reportId })}
    >
      {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Unlink className="size-3.5" />}
      Not part of this issue — un-merge
    </Button>
  );
}
