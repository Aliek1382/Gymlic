"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Megaphone } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { formatNumber } from "@/lib/persian";
import { getErrorMessage } from "@/lib/get-error-message";
import { useSendBroadcastNotification } from "../hooks/use-send-broadcast-notification";
import {
  broadcastNotificationSchema,
  type BroadcastNotificationFormValues,
} from "../validators/notification-schemas";

interface ClubOption {
  id: string;
  name: string;
}

export function BroadcastNotificationForm({ clubs }: { clubs: ClubOption[] }) {
  const sendBroadcast = useSendBroadcastNotification();
  const [targetSpecificClubs, setTargetSpecificClubs] = useState(false);
  const [selectedClubIds, setSelectedClubIds] = useState<string[]>([]);

  const form = useForm<BroadcastNotificationFormValues>({
    resolver: zodResolver(broadcastNotificationSchema),
    defaultValues: { title: "", body: "", link: "" },
  });

  function toggleClub(clubId: string) {
    setSelectedClubIds((prev) =>
      prev.includes(clubId) ? prev.filter((id) => id !== clubId) : [...prev, clubId]
    );
  }

  async function onSubmit(values: BroadcastNotificationFormValues) {
    if (targetSpecificClubs && selectedClubIds.length === 0) {
      toast.error("حداقل یک باشگاه را انتخاب کنید.");
      return;
    }

    try {
      await sendBroadcast.mutateAsync({
        title: values.title,
        body: values.body || null,
        link: values.link || null,
        clubIds: targetSpecificClubs ? selectedClubIds : undefined,
      });
      toast.success(
        targetSpecificClubs
          ? "اعلان برای اعضای باشگاه‌های انتخاب‌شده ارسال شد."
          : "اعلان برای همه کاربران ارسال شد."
      );
      form.reset({ title: "", body: "", link: "" });
      setSelectedClubIds([]);
    } catch (error) {
      toast.error(getErrorMessage(error, "ارسال اعلان با خطا مواجه شد."));
    }
  }

  return (
    <Card className="gap-6 py-6">
      <div className="flex items-center gap-2 px-6">
        <Megaphone className="size-4 text-muted-foreground" />
        <CardTitle className="text-base">ارسال اعلان عمومی</CardTitle>
      </div>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="broadcast-title">عنوان</Label>
            <Input id="broadcast-title" {...form.register("title")} />
            {form.formState.errors.title && (
              <p className="text-xs text-destructive">
                {form.formState.errors.title.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="broadcast-body">متن (اختیاری)</Label>
            <textarea
              id="broadcast-body"
              rows={3}
              className="w-full rounded-xl border border-input bg-transparent px-4 py-2 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30"
              {...form.register("body")}
            />
            {form.formState.errors.body && (
              <p className="text-xs text-destructive">
                {form.formState.errors.body.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="broadcast-link">لینک مقصد (اختیاری)</Label>
            <Input
              id="broadcast-link"
              dir="ltr"
              placeholder="/dashboard"
              {...form.register("link")}
            />
            {form.formState.errors.link && (
              <p className="text-xs text-destructive">
                {form.formState.errors.link.message}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">
                محدود به باشگاه‌های خاص
              </p>
              <p className="text-xs text-muted-foreground">
                خاموش = ارسال برای تمام کاربران جیم‌لیک
              </p>
            </div>
            <Switch
              checked={targetSpecificClubs}
              onCheckedChange={(checked) => {
                setTargetSpecificClubs(checked);
                if (!checked) setSelectedClubIds([]);
              }}
            />
          </div>

          {targetSpecificClubs && (
            <div className="space-y-2">
              <Label>باشگاه‌های مقصد</Label>
              <ScrollArea className="h-48 rounded-xl border border-border">
                <div className="space-y-1 p-2">
                  {clubs.length === 0 ? (
                    <p className="p-2 text-xs text-muted-foreground">باشگاهی ثبت نشده است.</p>
                  ) : (
                    clubs.map((club) => (
                      <label
                        key={club.id}
                        className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted"
                      >
                        <input
                          type="checkbox"
                          className="size-4 accent-primary"
                          checked={selectedClubIds.includes(club.id)}
                          onChange={() => toggleClub(club.id)}
                        />
                        {club.name}
                      </label>
                    ))
                  )}
                </div>
              </ScrollArea>
              <p className="text-xs text-muted-foreground">
                {formatNumber(selectedClubIds.length)} باشگاه انتخاب شده — به همه اعضای فعال آن‌ها ارسال می‌شود.
              </p>
            </div>
          )}

          <Button type="submit" disabled={sendBroadcast.isPending}>
            {sendBroadcast.isPending && <Loader2 className="animate-spin" />}
            {targetSpecificClubs ? "ارسال برای باشگاه‌های انتخاب‌شده" : "ارسال برای همه"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
