// When the offline copy of the data was last refreshed from the server, for
// the "you are offline" notice. In memory only; it is rebuilt from the
// persisted snapshot at startup.

let lastSyncedAt: number | null = null;
const listeners = new Set<() => void>();

export function setLastSyncedAt(value: number): void {
  lastSyncedAt = value;
  listeners.forEach((listener) => listener());
}

export function subscribeLastSyncedAt(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getLastSyncedAt(): number | null {
  return lastSyncedAt;
}
