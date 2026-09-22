/**
 * Placeholder segment the dynamic routes are emitted under.
 *
 * Deliberately not in route-params.ts: that module is `"use client"`, and a
 * value imported from a client module into a Server Component arrives as a
 * client reference rather than the string itself — which generateStaticParams
 * rejects.
 */
export const ROUTE_SHELL_PARAM = "_";
