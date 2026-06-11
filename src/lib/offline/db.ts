// Offline outbox storage.
//
// We use IndexedDB (not localStorage) because a queued complaint carries photo
// *blobs*, which localStorage cannot hold and which would blow its ~5MB string
// budget. IndexedDB stores File/Blob natively and survives the app being fully
// closed — so a complaint filed in a dead zone is still there tomorrow.

import type { CreateReportInput } from "@/lib/validations/report";

export const OUTBOX_DB = "civicchain-outbox";
export const OUTBOX_STORE = "reports";
const DB_VERSION = 1;

export type QueueStatus = "pending" | "syncing" | "error" | "needs_attention";

// What we persist for one queued complaint. `payload` is everything except the
// image URLs (those don't exist yet — we hold the raw files and upload on sync).
export type QueuedReport = {
  id: string;
  createdAt: number;
  status: QueueStatus;
  attempts: number;
  error?: string;
  payload: Omit<CreateReportInput, "images">;
  files: { blob: Blob; name: string; type: string }[];
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(OUTBOX_DB, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
        const store = db.createObjectStore(OUTBOX_STORE, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(OUTBOX_STORE, mode);
        const store = transaction.objectStore(OUTBOX_STORE);
        const request = run(store);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => db.close();
      })
  );
}

export async function putReport(report: QueuedReport): Promise<void> {
  await tx("readwrite", (s) => s.put(report));
}

export async function getAllReports(): Promise<QueuedReport[]> {
  const all = await tx<QueuedReport[]>("readonly", (s) => s.getAll());
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function getReport(id: string): Promise<QueuedReport | undefined> {
  return tx("readonly", (s) => s.get(id));
}

export async function deleteReport(id: string): Promise<void> {
  await tx("readwrite", (s) => s.delete(id));
}

export function isIndexedDbAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}
