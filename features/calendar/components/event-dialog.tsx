"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { JalaliDateField } from "@/components/ui/jalali-date-field";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAthletes } from "@/features/athletes";
import { getErrorMessage } from "@/lib/get-error-message";
import { parseIsoDate, todayIso } from "@/lib/iso-date";
import {
  useCreateCalendarEvent,
  useDeleteCalendarEvent,
  useUpdateCalendarEvent,
} from "../hooks/use-calendar-mutations";
import type { CalendarEvent, CalendarEventInput } from "../types/calendar-types";

const NO_ATHLETE = "none";

export type EventDialogTarget = { date: string } | { event: CalendarEvent };

/** "New event" for a clicked day, or the edit form of a manual event. */
export function EventDialog({
  target,
  onClose,
}: {
  target: EventDialogTarget | null;
  onClose: () => void;
}) {
  const open = target !== null;
  const event = target && "event" in target ? target.event : null;

  const athletes = useAthletes({ enabled: open });
  const createEvent = useCreateCalendarEvent();
  const updateEvent = useUpdateCalendarEvent();
  const deleteEvent = useDeleteCalendarEvent();

  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [athleteId, setAthleteId] = useState(NO_ATHLETE);
  const [weekly, setWeekly] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Re-seed on every open so "new" comes back blank for the clicked day.
  useEffect(() => {
    if (!target) return;
    if ("event" in target) {
      const e = target.event;
      setTitle(e.title);
      // A recurring event is edited as a series, so show where the series starts.
      setDate(e.eventDate);
      setTime(e.startTime ?? "");
      setAthleteId(e.athleteId ?? NO_ATHLETE);
      setWeekly(e.isRecurring);
    } else {
      setTitle("");
      setDate(target.date);
      setTime("");
      setAthleteId(NO_ATHLETE);
      setWeekly(false);
    }
  }, [target]);

  const isPending = createEvent.isPending || updateEvent.isPending;

  // An athlete who has since left the roster still has to show in the select.
  const options = athletes.data ?? [];
  const athleteOptions =
    event?.athleteId && !options.some((a) => a.id === event.athleteId)
      ? [...options, { id: event.athleteId, name: event.athleteName ?? "ورزشکار" }]
      : options;

  function buildInput(): CalendarEventInput | null {
    if (!title.trim()) {
      toast.error("عنوان رویداد را وارد کنید.");
      return null;
    }
    const weekday = String(parseIsoDate(date).getDay());
    // A series set up with several weekdays through the API keeps them as long as this day is one of them.
    const keepRule = event?.recurrenceRule?.split(",").includes(weekday) ? event.recurrenceRule : null;

    return {
      title: title.trim(),
      athleteId: athleteId === NO_ATHLETE ? null : athleteId,
      eventDate: date,
      startTime: time || null,
      recurrenceRule: weekly ? (keepRule ?? weekday) : null,
      recurrenceUntil: weekly ? (event?.recurrenceUntil ?? null) : null,
    };
  }

  async function handleSave() {
    const input = buildInput();
    if (!input) return;
    try {
      if (event) {
        await updateEvent.mutateAsync({ id: event.id, input });
        toast.success("رویداد ویرایش شد.");
      } else {
        await createEvent.mutateAsync(input);
        toast.success("رویداد ثبت شد.");
      }
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error, "ثبت رویداد با خطا مواجه شد."));
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{event ? "ویرایش رویداد" : "رویداد جدید"}</DialogTitle>
            <DialogDescription>
              یادآوری یا جلسه‌ی غیررسمی خود را در تقویم ثبت کنید. فقط برای خودتان دیده می‌شود.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="event-title">عنوان</Label>
              <Input
                id="event-title"
                value={title}
                maxLength={255}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثلاً: تماس با ورزشکار"
              />
            </div>

            <JalaliDateField
              id="event-date"
              label="تاریخ"
              value={date || todayIso()}
              onChange={setDate}
              pastYears={2}
              futureYears={2}
            />

            <div className="space-y-2">
              <Label htmlFor="event-time">
                ساعت <span className="text-muted-foreground">(اختیاری)</span>
              </Label>
              <Input
                id="event-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="event-athlete">
                ورزشکار <span className="text-muted-foreground">(اختیاری)</span>
              </Label>
              <Select value={athleteId} onValueChange={setAthleteId}>
                <SelectTrigger id="event-athlete" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_ATHLETE}>بدون ورزشکار</SelectItem>
                  {athleteOptions.map((athlete) => (
                    <SelectItem key={athlete.id} value={athlete.id}>
                      {athlete.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="event-recurrence">تکرار</Label>
              <Select
                value={weekly ? "weekly" : "none"}
                onValueChange={(value) => setWeekly(value === "weekly")}
              >
                <SelectTrigger id="event-recurrence" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون تکرار</SelectItem>
                  <SelectItem value="weekly">هر هفته در همین روز</SelectItem>
                </SelectContent>
              </Select>
              {event?.isRecurring && (
                <p className="text-xs text-muted-foreground">
                  تغییر یا حذف روی همه‌ی تکرارهای این رویداد اعمال می‌شود.
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <Button className="flex-1" onClick={handleSave} disabled={isPending}>
                {isPending && <Loader2 className="animate-spin" />}
                {event ? "ذخیره تغییرات" : "ثبت رویداد"}
              </Button>
              {event && (
                <Button variant="outline" onClick={() => setConfirmingDelete(true)}>
                  حذف
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title="حذف رویداد"
        description={
          event?.isRecurring
            ? "این رویداد و همه‌ی تکرارهای آن از تقویم حذف می‌شود."
            : "این رویداد از تقویم حذف می‌شود."
        }
        confirmLabel="حذف"
        errorMessage="حذف رویداد با خطا مواجه شد."
        onConfirm={async () => {
          if (!event) return;
          await deleteEvent.mutateAsync(event.id);
          toast.success("رویداد حذف شد.");
          setConfirmingDelete(false);
          onClose();
        }}
      />
    </>
  );
}
