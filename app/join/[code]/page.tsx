import { JoinPage } from "@/features/authentication";
import { ROUTE_SHELL_PARAM } from "@/lib/route-shell";

export const metadata = { title: "پیوستن به جیم‌لیک" };

/**
 * Invite links are handed out as /join/<code> and shared outside the app, so
 * the path has to keep working. Real codes only exist at runtime, so the route
 * is emitted once under a placeholder and the host rewrites every /join/*
 * request onto that file — the page then reads the code back off the URL.
 */
export function generateStaticParams() {
  return [{ code: ROUTE_SHELL_PARAM }];
}

export default function Page() {
  return <JoinPage />;
}
