"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  ImagePlus,
  X,
  CheckCircle2,
  CloudOff,
  MapPin,
  Locate,
  Copy,
} from "lucide-react";
import { categoryLabel } from "@/lib/utils";
import { Category } from "@/generated/prisma/enums";
import type { ClusterResult } from "@/types";
import type { CreateReportInput } from "@/lib/validations/report";
import { enqueueReport, submitReport, isOnline, syncOutbox } from "@/lib/offline/sync";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

type Coords = { latitude: number; longitude: number };

// A deliberately small, offline-first complaint form. No map SDK, no instant
// uploads — just the essentials, photos held as blobs, location from the device
// GPS. Submitting while offline queues the complaint (IndexedDB) and it syncs
// itself when the connection returns.
export function OfflineReportForm({ defaults }: { defaults: Defaults }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category>(Category.INFRASTRUCTURE);
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locating, setLocating] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<
    | { mode: "online"; result: ClusterResult }
    | { mode: "queued" }
    | null
  >(null);

  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    const remaining = 3 - files.length;
    const toAdd = picked.slice(0, remaining);
    if (toAdd.length === 0) return;
    setFiles((prev) => [...prev, ...toAdd]);
    setPreviews((prev) => [...prev, ...toAdd.map((f) => URL.createObjectURL(f))]);
  }

  function removeImage(idx: number) {
    setPreviews((prev) => {
      const url = prev[idx];
      if (url) URL.revokeObjectURL(url);
      return prev.filter((_, i) => i !== idx);
    });
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      toast.error("Location is not available on this device.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setLocating(false);
        toast.success("Location captured.");
      },
      () => {
        setLocating(false);
        toast.error("Couldn't get your location — enter it below or try again.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function buildPayload(): Omit<CreateReportInput, "images"> {
    return {
      title: title.trim(),
      description: description.trim(),
      category,
      latitude: coords!.latitude,
      longitude: coords!.longitude,
      address: address.trim() || undefined,
      wardNumber: defaults.wardNumber ?? undefined,
      municipalityName: defaults.municipalityName ?? undefined,
      districtName: defaults.districtName ?? undefined,
      provinceName: defaults.provinceName ?? undefined,
    };
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (title.trim().length < 5) return toast.error("Add a short title (5+ characters).");
    if (description.trim().length < 20)
      return toast.error("Describe the issue in a bit more detail (20+ characters).");
    if (!coords) return toast.error("Capture the location with the button below.");

    const payload = buildPayload();
    setSubmitting(true);
    try {
      if (isOnline()) {
        // Online → deliver now and show the tracking outcome.
        try {
          const result = await submitReport(payload, files);
          setDone({ mode: "online", result });
          toast.success("Report sent.");
          return;
        } catch {
          // Network blipped mid-submit — fall back to the offline queue.
        }
      }
      await enqueueReport(payload, files);
      setDone({ mode: "queued" });
      toast.success("Saved on your phone — it'll send automatically when you're online.");
      // In case we just regained connectivity between the check and now.
      void syncOutbox();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the report.");
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    previews.forEach((u) => URL.revokeObjectURL(u));
    setTitle("");
    setDescription("");
    setCategory(Category.INFRASTRUCTURE);
    setAddress("");
    setCoords(null);
    setFiles([]);
    setPreviews([]);
    setDone(null);
  }

  // ── Success / queued confirmation ──────────────────────────────────────────
  if (done) {
    const trackingId =
      done.mode === "online" && "reportId" in done.result ? done.result.reportId : null;
    return (
      <div className="space-y-4 rounded-xl border bg-card p-5 text-center">
        {done.mode === "online" ? (
          <CheckCircle2 className="mx-auto size-10 text-status-resolved" />
        ) : (
          <CloudOff className="mx-auto size-10 text-nilo" />
        )}
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">
            {done.mode === "online" ? "Report submitted" : "Saved offline"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {done.mode === "online"
              ? "Your report reached the municipality."
              : "We've stored your report on this phone. It will be sent automatically the moment you reconnect — you can close the app."}
          </p>
        </div>
        {trackingId && (
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(trackingId);
              toast.success("Tracking ID copied.");
            }}
            className="mx-auto flex items-center gap-2 rounded-lg bg-muted px-3 py-1.5 text-xs"
          >
            <span className="font-mono">{trackingId}</span>
            <Copy className="size-3.5" />
          </button>
        )}
        <Button variant="outline" onClick={reset}>
          Report another issue
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="title">What&apos;s the problem?</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Broken street light on the main road"
          maxLength={120}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Describe it</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="When did you notice it? How is it affecting people?"
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label>Category</Label>
        <Select
          items={CATEGORY_ITEMS}
          value={category}
          onValueChange={(v) => setCategory((v as Category) ?? Category.INFRASTRUCTURE)}
        >
          <SelectTrigger className="w-full">
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

      {/* Photo (held as a blob until sync) */}
      <div className="space-y-1.5">
        <Label>Photo (optional, up to 3)</Label>
        <div className="flex flex-wrap gap-2">
          {previews.map((src, idx) => (
            <div key={src} className="relative size-20 overflow-hidden rounded-lg border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="Selected" className="size-full object-cover" />
              <button
                type="button"
                onClick={() => removeImage(idx)}
                className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white"
                aria-label="Remove photo"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
          {files.length < 3 && (
            <label className="flex size-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-muted-foreground hover:bg-muted/40">
              <ImagePlus className="size-5" />
              <span className="text-[10px]">Add</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                capture="environment"
                multiple
                className="hidden"
                onChange={onPickFiles}
              />
            </label>
          )}
        </div>
      </div>

      {/* Location via device GPS — works without the map SDK */}
      <div className="space-y-2 rounded-lg border p-3">
        <div className="flex items-center justify-between gap-2">
          <Label className="flex items-center gap-1.5">
            <MapPin className="size-4" />
            Location
          </Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={useMyLocation}
            disabled={locating}
          >
            {locating ? <Loader2 className="size-4 animate-spin" /> : <Locate className="size-4" />}
            Use my location
          </Button>
        </div>
        {coords ? (
          <p className="text-xs text-muted-foreground">
            Pinned at {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Input
              inputMode="decimal"
              placeholder="Latitude"
              onChange={(e) => {
                const lat = parseFloat(e.target.value);
                if (!Number.isNaN(lat)) setCoords((c) => ({ latitude: lat, longitude: c?.longitude ?? 0 }));
              }}
            />
            <Input
              inputMode="decimal"
              placeholder="Longitude"
              onChange={(e) => {
                const lng = parseFloat(e.target.value);
                if (!Number.isNaN(lng)) setCoords((c) => ({ latitude: c?.latitude ?? 0, longitude: lng }));
              }}
            />
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="address">Landmark / address (optional)</Label>
        <Input
          id="address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Nearby landmark to help locate it"
        />
      </div>

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting && <Loader2 className="size-4 animate-spin" />}
        Submit report
      </Button>
    </form>
  );
}
