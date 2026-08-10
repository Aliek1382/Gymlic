"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Megaphone } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getErrorMessage } from "@/lib/get-error-message";
import { useSendBroadcastNotification } from "../hooks/use-send-broadcast-notification";
import {
  broadcastNotificationSchema,
  type BroadcastNotificationFormValues,
} from "../validators/notification-schemas";

/** Only rendered for profiles.is_platform_admin — the caller is responsible
 * for that check, this component doesn't re-verify it (the RPC does). */
export function BroadcastNotificationForm() {
  const sendBroadcast = useSendBroadcastNotification();

  const form = useForm<BroadcastNotificationFormValues>({
    resolver: zodResolver(broadcastNotificationSchema),
    defaultValues: { title: "", body: "", link: "" },
  });

  async function onSubmit(values: BroadcastNotificationFormValues) {
    try {
      await sendBroadcast.mutateAsync({
        title: values.title,
        body: values.body || null,
        link: values.link || null,
      });
      toast.success("اعلان برای همه کاربران ارسال شد.");
      form.reset({ title: "", body: "", link: "" });
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
        <p className="mb-4 text-xs text-muted-foreground">
          این اعلان برای تمام کاربران جیم‌لیک (باشگاه، مربی و ورزشکار) ارسال می‌شود.
        </p>
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

          <Button type="submit" disabled={sendBroadcast.isPending}>
            {sendBroadcast.isPending && <Loader2 className="animate-spin" />}
            ارسال برای همه
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
