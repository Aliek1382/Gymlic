/**
 * Supabase Realtime kept these views live over a WebSocket. Shared PHP
 * hosting has no persistent connection to push over, so the same freshness
 * comes from short polling instead. React Query also refetches on window
 * focus, which covers the common "switch back to the tab" case between ticks.
 */

/** An open conversation — the one place a reply is awaited in real time. */
export const CONVERSATION_POLL_MS = 15_000;

/** Ambient counters: the notification bell and the inbox list. */
export const INBOX_POLL_MS = 30_000;
