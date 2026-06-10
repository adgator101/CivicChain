"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, ImagePlus, X, CheckCircle2, Users, Copy } from "lucide-react";
import { createReportAction, resolveReportDecisionAction } from "@/lib/actions/reports";
import { categoryLabel } from "@/lib/utils";
import { Category } from "@/generated/prisma/enums";
import type { ClusterResult } from "@/types";
import type { CreateReportInput } from "@/lib/validations/report";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CommunityImpactMeter } from "@/components/civic/community-impact-meter";
import { LocationPicker, type LatLng } from "@/components/civic/location-picker";

const CATEGORY_OPTIONS = Object.values(Category);
const CATEGORY_ITEMS: Record<string, string> = Object.fromEntries(
  CATEGORY_OPTIONS.map((c) => [c, categoryLabel(c)])
);

type Defaults = {
  wardNumber: number | null;
  municipalityName: string | null;
  districtName: string | null;
  provinceName: string | null;
};

async function uploadImages(files: File[]): Promise<string[]> {
  if (files.length === 0) return [];
  const fd = new FormData();
  files.forEach((f) => fd.append("files", f));
  const res = await fetch("/api/uploads", { method: "POST", body: fd });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Image upload failed");
  }
  const data = (await res.json()) as { urls: string[] };
  return data.urls;
}

export function ReportForm({ defaults }: { defaults: Defaults }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category>(Category.INFRASTRUCTURE);
  const [address, setAddress] = useState("");
  const [location, setLocation] = useState<LatLng | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [ward, setWard] = useState(defaults.wardNumber ? String(defaults.wardNumber) : "");
  const [municipality, setMunicipality] = useState(defaults.municipalityName ?? "");
  const [district, setDistrict] = useState(defaults.districtName ?? "");
  const [province, setProvince] = useState(defaults.provinceName ?? "");

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ClusterResult | null>(null);
  const [pendingInput, setPendingInput] = useState<CreateReportInput | null>(null);
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [candidate, setCandidate] = useState<
    Extract<ClusterResult, { outcome: "needs_decision" }> | null
  >(null);

  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    setFiles((prev) => [...prev, ...picked].slice(0, 5));
    e.target.value = "";
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  function buildInput(images: string[]): CreateReportInput {
    return {
      title,
      description,
      category,
      latitude: location!.latitude,
      longitude: location!.longitude,
      address: address || undefined,
      wardNumber: ward ? Number(ward) : undefined,
      municipalityName: municipality || undefined,
      districtName: district || undefined,
      provinceName: province || undefined,
      images,
    };
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!location) {
      toast.error("Please set the issue location on the map.");
      return;
    }
    setSubmitting(true);
    try {
      const images = await uploadImages(files);
      const input = buildInput(images);
      const res = await createReportAction(input);

      if (res?.serverError) {
        toast.error(res.serverError);
        return;
      }
      const data = res?.data;
      if (!data) {
        toast.error("Something went wrong submitting your report.");
        return;
      }

      if (data.outcome === "needs_decision") {
        setPendingInput(input);
        setCandidate(data);
        setDecisionOpen(true);
        return;
      }

      setResult(data);
      toast.success(
        data.outcome === "created"
          ? "Report submitted — a new issue was created."
          : "Report submitted — joined an existing issue."
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function resolveDecision(decision: "attach" | "new") {
    if (!pendingInput || !candidate) return;
    setSubmitting(true);
    try {
      const res = await resolveReportDecisionAction({
        ...pendingInput,
        decision,
        attachIssueId: decision === "attach" ? candidate.candidate.id : undefined,
      });
      if (res?.serverError) {
        toast.error(res.serverError);
        return;
      }
      const data = res?.data;
      if (!data || data.outcome === "needs_decision") {
        toast.error("Something went wrong.");
        return;
      }
      setResult(data);
      setDecisionOpen(false);
      toast.success(
        decision === "attach"
          ? "Joined the existing issue."
          : "Submitted as a separate issue."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setTitle("");
    setDescription("");
    setCategory(Category.INFRASTRUCTURE);
    setAddress("");
    setLocation(null);
    setFiles([]);
    setResult(null);
    setPendingInput(null);
    setCandidate(null);
  }

  // ── Success screen ─────────────────────────────────────────────────────────
  if (result && result.outcome !== "needs_decision") {
    const attached = result.outcome !== "created";
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="size-5 text-emerald-600" />
            {attached ? "Report joined an existing issue" : "New issue created"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {attached
              ? "Others have reported this too. Your report increased the issue's community impact."
              : "Thanks for the report. It will be verified by your community before being assigned."}
          </p>

          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Issue</p>
            <p className="font-medium">{result.issueTitle}</p>
          </div>

          {attached && (
            <div className="rounded-lg border p-3">
              <CommunityImpactMeter
                score={result.communityImpactScore}
                affectedCitizenCount={result.reportCount}
              />
              <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Users className="size-4" />
                {result.reportCount}{" "}
                {result.reportCount === 1 ? "citizen has" : "citizens have"} now reported this
              </p>
            </div>
          )}

          <div className="rounded-lg border bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">Your personal tracking ID</p>
            <div className="flex items-center justify-between gap-2">
              <code className="text-sm font-medium">{result.reportId}</code>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  navigator.clipboard.writeText(result.reportId);
                  toast.success("Tracking ID copied");
                }}
              >
                <Copy className="size-4" />
              </Button>
            </div>
          </div>

          <Button type="button" variant="outline" onClick={reset}>
            Report another issue
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ── Form ─────────────────────────────────────────────────────────────────────
  return (
    <>
      <form onSubmit={onSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            required
            minLength={5}
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Large pothole near Bhrikuti Chowk"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            required
            minLength={20}
            maxLength={2000}
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the issue, when you noticed it, and how it affects the community."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Select
            items={CATEGORY_ITEMS}
            value={category}
            onValueChange={(v) => setCategory((v as Category) ?? Category.INFRASTRUCTURE)}
          >
            <SelectTrigger id="category" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_OPTIONS.map((c) => (
                <SelectItem key={c} value={c}>
                  {categoryLabel(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Location</Label>
          <LocationPicker value={location} onChange={setLocation} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="address">Address / landmark (optional)</Label>
          <Input
            id="address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Near the main bus stop"
          />
        </div>

        <fieldset className="grid grid-cols-1 gap-4 rounded-lg border p-3 sm:grid-cols-2">
          <legend className="px-1 text-xs font-medium text-muted-foreground">
            Administrative area
          </legend>
          <div className="space-y-2">
            <Label htmlFor="province">Province</Label>
            <Input id="province" value={province} onChange={(e) => setProvince(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="district">District</Label>
            <Input id="district" value={district} onChange={(e) => setDistrict(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="municipality">Municipality</Label>
            <Input
              id="municipality"
              value={municipality}
              onChange={(e) => setMunicipality(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ward">Ward</Label>
            <Input
              id="ward"
              type="number"
              min={1}
              max={50}
              value={ward}
              onChange={(e) => setWard(e.target.value)}
            />
          </div>
        </fieldset>

        <div className="space-y-2">
          <Label>Photos (optional, up to 5)</Label>
          <div className="flex flex-wrap gap-3">
            {files.map((file, idx) => (
              <div key={idx} className="relative size-20 overflow-hidden rounded-md border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={URL.createObjectURL(file)}
                  alt={file.name}
                  className="size-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeFile(idx)}
                  className="absolute right-0.5 top-0.5 rounded-full bg-background/80 p-0.5"
                  aria-label="Remove image"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
            {files.length < 5 && (
              <label className="grid size-20 cursor-pointer place-items-center rounded-md border border-dashed text-muted-foreground hover:bg-muted/40">
                <ImagePlus className="size-5" />
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  className="hidden"
                  onChange={onPickFiles}
                />
              </label>
            )}
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting && <Loader2 className="size-4 animate-spin" />}
          Submit report
        </Button>
      </form>

      {/* Semantic similarity 0.50–0.79 → ask the citizen */}
      <Dialog open={decisionOpen} onOpenChange={setDecisionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>A similar issue exists nearby</DialogTitle>
            <DialogDescription>
              We found an existing issue that looks related
              {candidate ? ` (${Math.round(candidate.similarity * 100)}% similar)` : ""}.
              Attach your report to it to raise its community impact, or submit separately.
            </DialogDescription>
          </DialogHeader>

          {candidate && (
            <div className="rounded-lg border p-3">
              <p className="font-medium">{candidate.candidate.title}</p>
              <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">
                {candidate.candidate.description}
              </p>
              <div className="mt-3">
                <CommunityImpactMeter
                  score={candidate.candidate.communityImpactScore}
                  affectedCitizenCount={candidate.candidate.reportCount}
                />
              </div>
              {candidate.reason && (
                <p className="mt-2 text-xs text-muted-foreground">{candidate.reason}</p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => resolveDecision("new")}
            >
              Submit separately
            </Button>
            <Button type="button" disabled={submitting} onClick={() => resolveDecision("attach")}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Attach to this issue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
