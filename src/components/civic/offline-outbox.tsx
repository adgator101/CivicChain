"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Trash2,
  Clock3,
  AlertTriangle,
  Loader2,
  Inbox,
} from "lucide-react";
import { getAllReports, type QueuedReport } from "@/lib/offline/db";
import {
  subscribeOutbox,
  syncOutbox,
  retryReport,
  discardReport,
} from "@/lib/offline/sync";
import { Button } from "@/components/ui/button";

function StatusPill({ report }: { report: QueuedReport }) {
  const map = {
    pending: { icon: Clock3, label: "Waiting to send", cls: "text-amber-600" },
    syncing: { icon: Loader2, label: "Sending…", cls: "text-nilo" },
    error: { icon: AlertTriangle, label: "Send failed", cls: "text-destructive" },
    needs_attention: {
      icon: AlertTriangle,
      label: "Needs attention",
      cls: "text-destructive",
    },
  }[report.status];
  const Icon = map.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${map.cls}`}>
      <Icon className={`size-3.5 ${report.status === "syncing" ? "animate-spin" : ""}`} />
      {map.label}
    </span>
  );
}

// Live online/offline status without synchronous setState-in-effect.
function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

// Connectivity banner + the queue of complaints waiting to reach the server.
// Updates live as items sync. Mounted under the offline report form.
export function OfflineOutbox() {
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true // assume online during SSR
  );
  const [queue, setQueue] = useState<QueuedReport[]>([]);
  const [syncingAll, setSyncingAll] = useState(false);

  useEffect(() => {
    const refresh = () => getAllReports().then(setQueue).catch(() => {});
    refresh();
    const unsub = subscribeOutbox(refresh);
    return unsub;
  }, []);

  async function syncNow() {
    setSyncingAll(true);
    try {
      const { sent, failed } = await syncOutbox();
      if (sent === 0 && failed === 0 && queue.length === 0) return;
    } finally {
      setSyncingAll(false);
    }
  }

  const pendingCount = queue.filter((r) => r.status !== "needs_attention").length;

  return (
    <div className="space-y-3">
      {/* Connectivity banner */}
      <div
        className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm ring-1 ${
          online
            ? "bg-status-resolved/10 text-status-resolved ring-status-resolved/20"
            : "bg-amber-500/10 text-amber-700 ring-amber-500/20 dark:text-amber-400"
        }`}
      >
        <span className="inline-flex items-center gap-2">
          {online ? <Wifi className="size-4" /> : <WifiOff className="size-4" />}
          {online ? "Online — reports send immediately" : "Offline — reports are saved on your phone"}
        </span>
        {queue.length > 0 && online && (
          <Button size="sm" variant="ghost" onClick={syncNow} disabled={syncingAll}>
            {syncingAll ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Sync now
          </Button>
        )}
      </div>

      {/* Queue */}
      {queue.length === 0 ? null : (
        <div className="space-y-2 rounded-xl border bg-card p-3">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <Inbox className="size-4" />
            Outbox
            <span className="font-normal text-muted-foreground">
              ({pendingCount} waiting)
            </span>
          </h2>
          <ul className="space-y-2">
            {queue.map((r) => (
              <li
                key={r.id}
                className="flex items-start justify-between gap-2 rounded-lg border bg-background p-2.5"
              >
                <div className="min-w-0 space-y-1">
                  <p className="truncate text-sm font-medium">{r.payload.title}</p>
                  <StatusPill report={r} />
                  {r.error && (
                    <p className="text-xs text-muted-foreground">{r.error}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {(r.status === "error" || r.status === "needs_attention") && (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Retry"
                      onClick={() => retryReport(r.id)}
                    >
                      <RefreshCw className="size-4" />
                    </Button>
                  )}
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Discard"
                    onClick={() => discardReport(r.id)}
                  >
                    <Trash2 className="size-4 text-muted-foreground" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
