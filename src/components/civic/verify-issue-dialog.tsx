"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Users, ThumbsUp, ThumbsDown } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { manualVerifyIssueAction } from "@/lib/actions/issues";
import { VERIFY_BASIS, VERIFY_BASIS_KEYS, type VerifyBasis } from "@/lib/verification";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Replaces the old one-click "Verify" button. A manual SUBMITTED → VERIFIED
// override by the HEAD now requires reviewing the community signal, choosing an
// explicit basis, and attesting responsibility — all logged to the timeline.
export function VerifyIssueDialog({
  issueId,
  issueTitle,
  affectedCitizenCount,
  confirmCount,
  disputeCount,
}: {
  issueId: string;
  issueTitle: string;
  affectedCitizenCount: number;
  confirmCount: number;
  disputeCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [basis, setBasis] = useState<VerifyBasis | "">("");
  const [note, setNote] = useState("");
  const [attested, setAttested] = useState(false);

  const { execute, isPending } = useAction(manualVerifyIssueAction, {
    onSuccess: () => {
      toast.success("Issue verified — moved into the assignment queue.");
      setOpen(false);
      router.refresh();
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Could not verify the issue.");
    },
  });

  const needsNote = basis === "OTHER";
  const canSubmit =
    !!basis && attested && (!needsNote || note.trim().length >= 5) && !isPending;

  function submit() {
    if (!basis) {
      toast.error("Choose the basis for verification.");
      return;
    }
    if (!attested) {
      toast.error("Confirm responsibility to proceed.");
      return;
    }
    execute({ issueId, basis, note: note.trim() || undefined, attested: true });
  }

  const basisItems = Object.fromEntries(
    VERIFY_BASIS_KEYS.map((k) => [k, VERIFY_BASIS[k]])
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setBasis("");
          setNote("");
          setAttested(false);
        }
      }}
    >
      <DialogTrigger
        render={
          <Button size="sm" variant="outline">
            <ShieldCheck className="size-4" />
            Review &amp; verify
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Verify this issue</DialogTitle>
          <DialogDescription className="line-clamp-2">{issueTitle}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Community signal so far — decide with context, not blind. */}
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1">
              <Users className="size-3.5 text-nilo" />
              {affectedCitizenCount} {affectedCitizenCount === 1 ? "citizen" : "citizens"} affected
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1">
              <ThumbsUp className="size-3.5 text-status-resolved" />
              {confirmCount} confirmed
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1">
              <ThumbsDown className="size-3.5 text-destructive" />
              {disputeCount} disputed
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            You are verifying this ahead of the community threshold. This bypasses
            the weighted citizen vote, so record why.
          </p>

          <div className="space-y-1.5">
            <Label>Basis for verification</Label>
            <Select
              items={basisItems}
              value={basis}
              onValueChange={(v) => setBasis((String(v ?? "") as VerifyBasis) || "")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="How did you confirm this is genuine?" />
              </SelectTrigger>
              <SelectContent>
                {VERIFY_BASIS_KEYS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {VERIFY_BASIS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="verifyNote">
              Note {needsNote ? <span className="text-destructive">(required)</span> : "(optional)"}
            </Label>
            <Textarea
              id="verifyNote"
              rows={3}
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                needsNote
                  ? "Explain the basis for verifying this issue."
                  : "Any context for the record (visible on the timeline)."
              }
            />
          </div>

          <label
            htmlFor="verifyAttest"
            className="flex cursor-pointer items-start gap-2.5 rounded-lg bg-muted/60 p-3 text-sm"
          >
            <input
              id="verifyAttest"
              type="checkbox"
              checked={attested}
              onChange={(e) => setAttested(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 rounded border-input accent-nilo"
            />
            <span className="text-muted-foreground">
              I confirm this issue is genuine and take responsibility for verifying
              it on behalf of the municipality.
            </span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={isPending} onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button disabled={!canSubmit} onClick={submit}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Verify issue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
