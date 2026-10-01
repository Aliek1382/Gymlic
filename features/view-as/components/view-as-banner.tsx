"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { api, fullName } from "@/lib/api/client";
import { isViewAsTab } from "@/lib/view-as";
import { endViewAs } from "../services/view-as-service";

interface MeResponse {
  user: { first_name: string | null; last_name: string | null };
  view_as: { admin_name: string; read_only: boolean; expires_at: string; expires_in: number } | null;
}

/**
 * Always on screen in a tab that shows a user's panel to an admin (see
 * lib/view-as.ts): whose panel it is, that nothing can be changed, and the
 * way out.
 */
export function ViewAsBanner() {
  // sessionStorage only exists in the browser: decided after mounting.
  const [active, setActive] = useState(false);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => setActive(isViewAsTab()), []);

  const { data, dataUpdatedAt } = useQuery({
    queryKey: ["auth", "view-as"],
    queryFn: () => api.get<MeResponse>("/auth/me"),
    enabled: active,
    staleTime: 5 * 60_000,
    retry: false,
  });

  if (!active) return null;

  const name = data ? fullName(data.user.first_name, data.user.last_name) : "…";
  const until = data?.view_as
    ? new Date(dataUpdatedAt + data.view_as.expires_in * 1000).toLocaleTimeString("fa-IR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-[100] mx-auto flex max-w-xl items-center gap-3 rounded-2xl bg-warning px-4 py-2.5 text-warning-foreground shadow-lg"
    >
      <Eye className="size-5 shrink-0" />
      <div className="min-w-0 flex-1 text-xs leading-5">
        <p className="font-semibold">نمای فقط‌خواندنی پنل {name}</p>
        <p className="opacity-90">
          همان چیزی را می‌بینید که این کاربر می‌بیند؛ هیچ تغییری ذخیره نمی‌شود.
          {until && ` تا ساعت ${until} اعتبار دارد.`}
        </p>
      </div>
      <Button
        size="sm"
        variant="secondary"
        disabled={leaving}
        onClick={() => {
          setLeaving(true);
          void endViewAs();
        }}
      >
        {leaving ? <Loader2 className="animate-spin" /> : <X />}
        پایان
      </Button>
    </div>
  );
}
