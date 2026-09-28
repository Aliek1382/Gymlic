"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { JalaliDateField } from "@/components/ui/jalali-date-field";
import { Skeleton } from "@/components/ui/skeleton";
import { getErrorMessage } from "@/lib/get-error-message";
import { todayIso } from "@/lib/iso-date";
import { formatPersianDate, toPersianDigits } from "@/lib/persian";
import { SESSION_STATUS_LABEL, SESSION_STATUS_VARIANT } from "../constants";
import { usePackageSessions } from "../hooks/use-package-sessions";
import { useUpdateSession } from "../hooks/use-update-session";
import type { PackageSession } from "../types/session-package-types";

const DEFAULT_TIME = "18:00";

/** "2026-10-05 18:30:00" is a local wall-clock time, so it is parsed as one. */
function parseScheduledAt(value: string): { date: Date; time: string } {
  const [day, time = ""] = value.split(" ");
  const [year, month, date] = day.split("-").map(Number);
  return { date: new Date(year, month - 1, date), time: time.slice(0, 5) };
}

function SessionRow({
  packageId,
  session,
  editable,
}: {
  packageId: string;
  session: PackageSession;
  editable: boolean;
}) {
  const updateSession = useUpdateSession();
  const [planning, setPlanning] = useState(false);
  const [day, setDay] = useState(todayIso());
  const [time, setTime] = useState(DEFAULT_TIME);
  const [closing, setClosing] = useState<"done" | "canceled" | null>(null);

  const isOpen = session.status === "unscheduled" || session.status === "scheduled";
  const showPicker = editable && isOpen && (session.status === "unscheduled" || planning);
  const scheduled = session.scheduledAt ? parseScheduledAt(session.scheduledAt) : null;

  async function handleSchedule() {
    if (!time) {
      toast.error("ساعت جلسه را وارد کنید.");
      return;
    }
    try {
      await updateSession.mutateAsync({
        packageId,
        sessionId: session.id,
        scheduledAt: `${day} ${time}`,
      });
      toast.success("زمان جلسه ثبت شد.");
      setPlanning(false);
    } catch (error) {
      toast.error(getErrorMessage(error, "ثبت زمان جلسه با خطا مواجه شد."));
    }
  }

  return (
    <li className="space-y-3 rounded-xl border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant={SESSION_STATUS_VARIANT[session.status]}>
            {SESSION_STATUS_LABEL[session.status]}
          </Badge>
          {scheduled && (
            <span className="text-sm text-foreground">
              {formatPersianDate(scheduled.date)}
              {scheduled.time && <> · ساعت {toPersianDigits(scheduled.time)}</>}
            </span>
          )}
        </div>

        {editable && isOpen && (
          <div className="flex flex-wrap gap-2">
            {session.status === "scheduled" && (
              <Button size="sm" variant="outline" onClick={() => setPlanning((open) => !open)}>
                تغییر زمان
              </Button>
            )}
            <Button size="sm" onClick={() => setClosing("done")}>
              برگزار شد
            </Button>
            <Button size="sm" variant="outline" onClick={() => setClosing("canceled")}>
              لغو شد
            </Button>
          </div>
        )}
      </div>

      {showPicker && (
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <JalaliDateField
            id={`session-date-${session.id}`}
            label="تاریخ جلسه"
            value={day}
            onChange={setDay}
            pastYears={1}
            futureYears={2}
          />
          <div className="space-y-2">
            <label htmlFor={`session-time-${session.id}`} className="text-sm font-medium">
              ساعت
            </label>
            <Input
              id={`session-time-${session.id}`}
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
          <Button size="sm" onClick={handleSchedule} disabled={updateSession.isPending}>
            {updateSession.isPending && <Loader2 className="animate-spin" />}
            ثبت زمان
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={closing !== null}
        onOpenChange={(open) => !open && setClosing(null)}
        title={closing === "done" ? "ثبت برگزاری جلسه" : "لغو جلسه"}
        description={
          closing === "done"
            ? "این جلسه برگزارشده ثبت می‌شود و بعداً قابل تغییر نیست."
            : "این جلسه لغو می‌شود و بعداً قابل تغییر نیست. جلسه‌ی لغوشده از تعداد باقی‌مانده کم می‌شود."
        }
        confirmLabel={closing === "done" ? "برگزار شد" : "لغو جلسه"}
        errorMessage="ثبت وضعیت جلسه با خطا مواجه شد."
        onConfirm={async () => {
          if (!closing) return;
          await updateSession.mutateAsync({
            packageId,
            sessionId: session.id,
            status: closing,
          });
          toast.success(closing === "done" ? "جلسه برگزارشده ثبت شد." : "جلسه لغو شد.");
        }}
      />
    </li>
  );
}

/** Every session of one package, dated ones first. `editable` is the trainer's view. */
export function PackageSessionList({
  packageId,
  editable,
}: {
  packageId: string;
  editable: boolean;
}) {
  const sessions = usePackageSessions(packageId);

  if (sessions.isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (sessions.isError) {
    return <p className="text-sm text-destructive">دریافت جلسات با خطا مواجه شد.</p>;
  }

  if (!sessions.data || sessions.data.length === 0) {
    return <p className="text-sm text-muted-foreground">جلسه‌ای برای این پکیج ثبت نشده است.</p>;
  }

  return (
    <ul className="space-y-2">
      {sessions.data.map((session) => (
        <SessionRow
          key={session.id}
          packageId={packageId}
          session={session}
          editable={editable}
        />
      ))}
    </ul>
  );
}
