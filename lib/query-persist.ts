/**
 * Keeps the last successfully fetched data in IndexedDB so the installed app
 * can open and show it without a connection (public/sw.js supplies the app
 * shell; this supplies the data).
 *
 * This is account data at rest in the browser, so it is bound to the session
 * that produced it: the snapshot stores a hash of that session's token and is
 * ignored unless it matches the current one, and it is deleted on logout and
 * whenever the token changes (setToken in lib/api/client.ts) — the same rule
 * lib/offline-queue.ts follows.
 *
 * This file must not import lib/api/client.ts (which imports it).
 */

import {
  dehydrate,
  hydrate,
  type DehydratedState,
  type QueryClient,
} from "@tanstack/react-query";

const DB_NAME = "gymlic-offline-data";
const STORE = "snapshot";
const KEY = "queries";
const TOKEN_KEY = "gymlic.token";
const SAVE_DELAY_MS = 1000;

/** How long a snapshot stays usable. Past this, offline shows nothing rather than very old data. */
export const SNAPSHOT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface Snapshot {
  tokenHash: string;
  savedAt: number;
  state: DehydratedState;
}

function available(): boolean {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

function readToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
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

/** Deletes the snapshot. Called on logout and on any session change. */
export async function clearPersistedQueries(): Promise<void> {
  if (!available()) return;
  try {
    await withStore("readwrite", (store) => store.delete(KEY));
  } catch {
    // Nothing more to do.
  }
}

/** Loads the snapshot into the client when it belongs to the current session. Returns its save time. */
export async function restoreQueries(queryClient: QueryClient): Promise<number | null> {
  if (!available()) return null;
  try {
    const token = readToken();
    if (!token) return null;

    const snapshot = await withStore<Snapshot | undefined>("readonly", (store) =>
      store.get(KEY)
    );
    if (!snapshot) return null;

    if (
      snapshot.tokenHash !== (await hashToken(token)) ||
      Date.now() - snapshot.savedAt > SNAPSHOT_MAX_AGE_MS
    ) {
      await clearPersistedQueries();
      return null;
    }

    hydrate(queryClient, snapshot.state);
    return snapshot.savedAt;
  } catch {
    return null;
  }
}

/** Saves the client's successful queries, debounced, whenever the cache changes. Returns an unsubscribe. */
export function startPersistingQueries(
  queryClient: QueryClient,
  onSaved?: (savedAt: number) => void
): () => void {
  if (!available()) return () => undefined;

  let timer: ReturnType<typeof setTimeout> | undefined;

  const save = async () => {
    try {
      const token = readToken();
      // No session: nothing to keep, and nothing may be written for nobody.
      if (!token) return;
      const snapshot: Snapshot = {
        tokenHash: await hashToken(token),
        savedAt: Date.now(),
        state: dehydrate(queryClient, {
          shouldDehydrateQuery: (query) => query.state.status === "success",
        }),
      };
      // The session may have ended while hashing; don't resurrect its data.
      if (readToken() !== token) return;
      await withStore("readwrite", (store) => store.put(snapshot, KEY));
      onSaved?.(snapshot.savedAt);
    } catch {
      // A failed save only costs the offline copy.
    }
  };

  const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== "updated" || event.action.type !== "success") return;
    clearTimeout(timer);
    timer = setTimeout(save, SAVE_DELAY_MS);
  });

  return () => {
    clearTimeout(timer);
    unsubscribe();
  };
}
