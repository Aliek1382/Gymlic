/**
 * Offline queue for a few low-risk write requests.
 *
 * When one of the allow-listed writes below fails because the network is
 * down, it is stored in IndexedDB and replayed by lib/offline-sync.ts once
 * the browser is back online. Reads are never stored, and the queue is wiped
 * on logout or whenever the session token changes (see setToken in
 * lib/api/client.ts) — the same "nothing account-specific outlives the
 * account" rule public/sw.js keeps for its caches.
 *
 * A record keeps the token that was valid when the action was taken. It is
 * replayed with that token, never with whatever getToken() returns later: a
 * different user signing in on this browser must not get a queued write sent
 * under their identity.
 *
 * This file must not import lib/api/client.ts (which imports it).
 */

const DB_NAME = "gymlic-offline";
const STORE = "mutations";

export interface QueuedMutation {
  id: string;
  method: string;
  url: string;
  body: unknown;
  token: string | null;
  createdAt: number;
  retries: number;
}

/** What a queueable write resolves to when it was stored instead of sent. */
export interface Queued {
  queued: true;
}

export function isQueued(result: unknown): result is Queued {
  return (
    typeof result === "object" &&
    result !== null &&
    (result as { queued?: unknown }).queued === true
  );
}

// The complete list of writes that may be queued. Anything not matched here
// fails loudly when offline. Money (invoices, payments, session packages),
// deletes, and anything needing a live confirmation are deliberately absent —
// a late or duplicated financial request is a real risk. Every entry is
// idempotent or close to it.
const QUEUEABLE: ReadonlyArray<{
  method: string;
  path: RegExp;
  accepts?: (body: unknown) => boolean;
}> = [
  // Ticking a workout day: the server ignores a repeated tick.
  { method: "POST", path: /^\/workout-day-logs$/ },
  { method: "POST", path: /^\/notes$/ },
  { method: "PATCH", path: /^\/notes\/[^/?]+$/ },
  { method: "POST", path: /^\/athletes\/[^/?]+\/measurements$/ },
  {
    // Plain text only: a media message needs its upload to have succeeded.
    method: "POST",
    path: /^\/messages$/,
    accepts: (body) => (body as { type?: unknown } | null)?.type === "text",
  },
];

export function isQueueable(method: string, path: string, body: unknown): boolean {
  const pathname = path.split("?")[0];
  return QUEUEABLE.some(
    (rule) =>
      rule.method === method &&
      rule.path.test(pathname) &&
      (rule.accepts ? rule.accepts(body) : true)
  );
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, 1);
    open.onupgradeneeded = () => {
      open.result.createObjectStore(STORE, { keyPath: "id" });
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = run(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

function storageAvailable(): boolean {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

// --- pending count, for the always-visible indicator ---

let pendingCount = 0;
const listeners = new Set<() => void>();

function setCount(next: number) {
  if (next === pendingCount) return;
  pendingCount = next;
  listeners.forEach((listener) => listener());
}

export function subscribePendingCount(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPendingCount(): number {
  return pendingCount;
}

export async function refreshPendingCount(): Promise<void> {
  if (!storageAvailable()) return;
  try {
    setCount(await withStore("readonly", (store) => store.count()));
  } catch {
    // An unreadable store just means no indicator.
  }
}

// --- queue operations ---

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Returns false when the record could not be stored, so the caller can fail normally. */
export async function enqueue(
  mutation: Pick<QueuedMutation, "method" | "url" | "body" | "token">
): Promise<boolean> {
  if (!storageAvailable()) return false;
  const record: QueuedMutation = {
    id: newId(),
    createdAt: Date.now(),
    retries: 0,
    ...mutation,
  };
  try {
    await withStore("readwrite", (store) => store.add(record));
    await refreshPendingCount();
    return true;
  } catch {
    return false;
  }
}

/** The oldest record, FIFO by creation time. */
export async function peek(): Promise<QueuedMutation | null> {
  if (!storageAvailable()) return null;
  const all = await withStore<QueuedMutation[]>("readonly", (store) => store.getAll());
  if (all.length === 0) return null;
  return all.reduce((oldest, item) => (item.createdAt < oldest.createdAt ? item : oldest));
}

export async function remove(id: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(id));
  await refreshPendingCount();
}

export async function update(record: QueuedMutation): Promise<void> {
  await withStore("readwrite", (store) => store.put(record));
}

/** Drops everything. Called on logout and on any session change. */
export async function clearQueue(): Promise<void> {
  if (!storageAvailable()) return;
  try {
    await withStore("readwrite", (store) => store.clear());
  } catch {
    // Nothing more to do; the count below is reset regardless.
  }
  setCount(0);
}
