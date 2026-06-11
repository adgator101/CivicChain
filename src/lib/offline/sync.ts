// Offline outbox sync engine.
//
// Owns the lifecycle of a queued complaint: enqueue while offline, then on
// reconnect upload the photos and call the same `createReportAction` the online
// form uses. Server-side clustering / AI behave identically — the queue is just
// a delivery buffer, never a parallel code path.

import { createReportAction, resolveReportDecisionAction } from "@/lib/actions/reports";
import type { CreateReportInput } from "@/lib/validations/report";
import type { ClusterResult } from "@/types";
import {
  deleteReport,
  getAllReports,
  isIndexedDbAvailable,
  putReport,
  type QueuedReport,
} from "./db";

const CHANGE_EVENT = "civicchain:outbox-change";
const MAX_ATTEMPTS = 5;
let syncing = false;

function notify() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
}

// Subscribe to any outbox change (enqueue / sync progress / completion).
export function subscribeOutbox(cb: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, cb);
  return () => window.removeEventListener(CHANGE_EVENT, cb);
}

export function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

function uid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `r_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

// Add a complaint to the outbox. Returns the queue id.
export async function enqueueReport(
  payload: Omit<CreateReportInput, "images">,
  files: File[]
): Promise<string> {
  if (!isIndexedDbAvailable()) {
    throw new Error("Offline storage is not available on this device.");
  }
  const report: QueuedReport = {
    id: uid(),
    createdAt: Date.now(),
    status: "pending",
    attempts: 0,
    payload,
    files: files.map((f) => ({ blob: f, name: f.name, type: f.type })),
  };
  await putReport(report);
  notify();
  return report.id;
}

async function uploadFiles(files: File[]): Promise<string[]> {
  if (files.length === 0) return [];
  const fd = new FormData();
  for (const f of files) {
    fd.append("files", f);
  }
  const res = await fetch("/api/uploads", { method: "POST", body: fd });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Photo upload failed");
  }
  const data = (await res.json()) as { urls?: string[] };
  return data.urls ?? [];
}

// The single delivery path shared by the online form and the offline queue:
// upload photos, then run the same clustering action the rest of the app uses.
export async function submitReport(
  payload: Omit<CreateReportInput, "images">,
  files: File[]
): Promise<ClusterResult> {
  const imageUrls = await uploadFiles(files);
  const input: CreateReportInput = { ...payload, images: imageUrls };

  const res = await createReportAction(input);
  if (res?.serverError) throw new Error(res.serverError);

  let data = res?.data;
  // The citizen isn't present to resolve a 0.50–0.79 similarity prompt during
  // background sync, so we submit it as its own issue (never a silent merge).
  // Future duplicate reports still cluster onto it normally.
  if (data?.outcome === "needs_decision") {
    const resolved = await resolveReportDecisionAction({ ...input, decision: "new" });
    if (resolved?.serverError) throw new Error(resolved.serverError);
    data = resolved?.data;
  }

  if (!data) throw new Error("No response from server.");
  return data;
}

function toFiles(stored: QueuedReport["files"]): File[] {
  return stored.map(
    (f) => new File([f.blob], f.name || "photo.jpg", { type: f.type })
  );
}

async function syncOne(report: QueuedReport): Promise<void> {
  await putReport({ ...report, status: "syncing", error: undefined });
  notify();

  await submitReport(report.payload, toFiles(report.files));

  // Delivered — drop it from the outbox.
  await deleteReport(report.id);
  notify();
}

// Try to flush the whole outbox. Safe to call repeatedly; no-ops while offline
// or already running.
export async function syncOutbox(): Promise<{ sent: number; failed: number }> {
  if (syncing || !isOnline() || !isIndexedDbAvailable()) {
    return { sent: 0, failed: 0 };
  }
  syncing = true;
  let sent = 0;
  let failed = 0;
  try {
    const queue = await getAllReports();
    for (const report of queue) {
      if (report.status === "needs_attention") continue;
      try {
        await syncOne(report);
        sent++;
      } catch (e) {
        failed++;
        const attempts = report.attempts + 1;
        await putReport({
          ...report,
          status: attempts >= MAX_ATTEMPTS ? "needs_attention" : "error",
          attempts,
          error: e instanceof Error ? e.message : "Sync failed",
        });
        notify();
      }
    }
  } finally {
    syncing = false;
    notify();
  }
  return { sent, failed };
}

// Re-queue a failed item and attempt a flush.
export async function retryReport(id: string): Promise<void> {
  const { getReport } = await import("./db");
  const report = await getReport(id);
  if (!report) return;
  await putReport({ ...report, status: "pending", error: undefined });
  notify();
  void syncOutbox();
}

// Discard a queued item (e.g. a duplicate the citizen no longer wants to send).
export async function discardReport(id: string): Promise<void> {
  await deleteReport(id);
  notify();
}

// Wire automatic flushing to connectivity. Returns a cleanup function.
export function startAutoSync(): () => void {
  const onOnline = () => void syncOutbox();
  window.addEventListener("online", onOnline);
  // Also try when the tab regains focus / visibility (covers flaky mobile).
  const onVisible = () => {
    if (document.visibilityState === "visible") void syncOutbox();
  };
  document.addEventListener("visibilitychange", onVisible);
  // Opportunistic first flush.
  if (isOnline()) void syncOutbox();
  return () => {
    window.removeEventListener("online", onOnline);
    document.removeEventListener("visibilitychange", onVisible);
  };
}
