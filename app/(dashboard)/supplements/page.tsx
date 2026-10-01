"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { RouteLoading } from "@/components/layout/route-loading";

// The supplement library now lives in a tab of the food library; this keeps old
// bookmarks and links working.
export default function SupplementsPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/foods?tab=supplements");
  }, [router]);
  return <RouteLoading />;
}
