"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, UserPlus, Clock3, X } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import {
  requestAssignmentAction,
  cancelAssignmentRequestAction,
} from "@/lib/actions/issues";
import { DEPARTMENT_LABELS } from "@/lib/departments";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Category, Department } from "@/generated/prisma/client";

type Employee = {
  id: string;
  name: string;
  email: string;
  department: Department | null;
  wardNumber: number | null;
  openIssueCount: number;
  isRecommended: boolean;
};

function detail(e: Employee) {
  const ward = e.wardNumber != null ? `Ward ${e.wardNumber}` : "Municipality-wide";
  return `${ward} · ${e.openIssueCount} open`;
}

// The picker dialog: a section head (or HEAD override) requests an officer to
// take this issue. No date here — the officer commits the completion date when
// they accept (STORY-017).
export function RequestOfficerDialog({
  issueId,
  issueTitle,
  issueCategory,
  triggerLabel = "Request officer",
  triggerVariant = "outline",
}: {
  issueId: string;
  issueTitle: string;
  issueCategory: Category;
  triggerLabel?: string;
  triggerVariant?: "outline" | "default";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [recommendedDepartment, setRecommendedDepartment] =
    useState<Department | null>(null);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [officerId, setOfficerId] = useState<string>("");
  const [note, setNote] = useState("");

  const { execute, isPending } = useAction(requestAssignmentAction, {
    onSuccess: () => {
      toast.success("Officer requested. Awaiting their response.");
      setOpen(false);
      setOfficerId("");
      setNote("");
      router.refresh();
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Could not send the request.");
    },
  });

  async function onOpenChange(next: boolean) {
    setOpen(next);
    if (next && employees.length === 0) {
      setLoadingEmployees(true);
      try {
        const res = await fetch(
          `/api/authority/employees?category=${issueCategory}`,
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error("Failed to load employees");
        const data = (await res.json()) as {
          employees: Employee[];
          recommendedDepartment: Department | null;
        };
        setEmployees(data.employees);
        setRecommendedDepartment(data.recommendedDepartment);
      } catch {
        toast.error("Could not load officers.");
      } finally {
        setLoadingEmployees(false);
      }
    }
  }

  function submit() {
    if (!officerId) {
      toast.error("Select an officer to request.");
      return;
    }
    execute({ issueId, officerId, note: note || undefined });
  }

  const recommended = employees.filter((e) => e.isRecommended);
  const others = employees.filter((e) => !e.isRecommended);
  const employeeItems = Object.fromEntries(employees.map((e) => [e.id, e.name]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={
          <Button size="sm" variant={triggerVariant}>
            <UserPlus className="size-4" />
            {triggerLabel}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request an officer</DialogTitle>
          <DialogDescription className="line-clamp-2">{issueTitle}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Officer</Label>
            {loadingEmployees ? (
              <p className="text-sm text-muted-foreground">Loading officers…</p>
            ) : employees.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No active officers available. Add staff on the Team page.
              </p>
            ) : (
              <Select
                items={employeeItems}
                value={officerId}
                onValueChange={(v) => setOfficerId(String(v ?? ""))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select an officer" />
                </SelectTrigger>
                <SelectContent>
                  {recommended.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>
                        Recommended
                        {recommendedDepartment
                          ? ` — ${DEPARTMENT_LABELS[recommendedDepartment]}`
                          : ""}
                      </SelectLabel>
                      {recommended.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.name}
                          <span className="text-xs text-muted-foreground">{detail(e)}</span>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  {others.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>
                        {recommended.length > 0 ? "Other staff" : "All staff"}
                      </SelectLabel>
                      {others.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.name}
                          <span className="text-xs text-muted-foreground">{detail(e)}</span>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
            )}
            <p className="text-xs text-muted-foreground">
              The officer accepts and commits a completion date — you don&apos;t set the
              timeline. Open counts are context only.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="requestNote">Note (optional)</Label>
            <Textarea
              id="requestNote"
              rows={3}
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Anything the officer should know."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={isPending} onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button disabled={isPending || !officerId} onClick={submit}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Send request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Shows the current request state for a VERIFIED issue to the section head / HEAD:
// either a "request officer" button (no pending request) or a pending banner with
// cancel + re-request.
export function RequestStatePanel({
  issueId,
  issueTitle,
  issueCategory,
  requestedToName,
}: {
  issueId: string;
  issueTitle: string;
  issueCategory: Category;
  requestedToName: string | null;
}) {
  const router = useRouter();
  const { execute: cancel, isPending: cancelling } = useAction(
    cancelAssignmentRequestAction,
    {
      onSuccess: () => {
        toast.success("Request cancelled.");
        router.refresh();
      },
      onError: ({ error }) => toast.error(error.serverError ?? "Could not cancel."),
    }
  );

  if (!requestedToName) {
    return (
      <div className="flex justify-end">
        <RequestOfficerDialog
          issueId={issueId}
          issueTitle={issueTitle}
          issueCategory={issueCategory}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-500/10 px-3 py-2 ring-1 ring-amber-500/20">
      <span className="inline-flex items-center gap-1.5 text-sm text-amber-700 dark:text-amber-400">
        <Clock3 className="size-4 shrink-0" />
        Requested <span className="font-medium">{requestedToName}</span> · awaiting response
      </span>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          disabled={cancelling}
          onClick={() => cancel({ issueId })}
        >
          <X className="size-4" />
          Cancel
        </Button>
        <RequestOfficerDialog
          issueId={issueId}
          issueTitle={issueTitle}
          issueCategory={issueCategory}
          triggerLabel="Re-request"
        />
      </div>
    </div>
  );
}
