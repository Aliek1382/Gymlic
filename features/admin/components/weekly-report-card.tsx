"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Loader2, Mail, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { getErrorMessage } from "@/lib/get-error-message";
import { formatNumber, formatRelativeTime, toPersianDigits } from "@/lib/persian";
import {
  getWeeklyReport,
  saveReportSettings,
  sendWeeklyReportNow,
  type ReportSettings,
} from "../services/admin-ops-service";
import { parseSqlDate } from "../utils/format";

const TEXTAREA_CLASS =
  "w-full rounded-xl border border-input bg-transparent px-4 py-2 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30";

const HOURS = [6, 7, 8, 9, 10, 12, 14, 18];

/** On the stats page: the Saturday email summary — who gets it, a preview, send now. */
export function WeeklyReportCard() {
  const { data, isLoading } = useQuery({ queryKey: ["admin", "weekly-report"], queryFn: getWeeklyReport });

  return (
    <Card className="gap-5 py-5">
      <div className="flex items-start gap-3 px-6">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
          <Mail className="size-4" />
        </div>
        <div className="space-y-1">
          <CardTitle className="text-base">گزارش هفتگی ایمیلی</CardTitle>
          <CardDescription className="text-xs leading-5">
            هر شنبه صبح خلاصهٔ ثبت‌نام‌ها، درآمد، تیکت‌ها و اشتراک‌های رو به اتمام هفتهٔ گذشته به این ایمیل‌ها فرستاده
            می‌شود. ایمیل از همان تنظیمات «پیامک و ایمیل» سایت می‌رود.
          </CardDescription>
        </div>
      </div>
      {isLoading || !data ? <Skeleton className="mx-6 h-32 rounded-xl" /> : <ReportForm key={JSON.stringify(data.settings)} info={data} />}
    </Card>
  );
}

function ReportForm({ info }: { info: NonNullable<Awaited<ReturnType<typeof getWeeklyReport>>> }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<ReportSettings>(info.settings);
  const [recipients, setRecipients] = useState(info.settings.recipients.join("\n"));
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await saveReportSettings({ ...draft, recipients: recipients.split(/[\s,،;]+/).filter(Boolean) });
      toast.success("تنظیمات گزارش هفتگی ذخیره شد.");
      void queryClient.invalidateQueries({ queryKey: ["admin", "weekly-report"] });
    } catch (error) {
      toast.error(getErrorMessage(error, "ذخیره انجام نشد."));
    } finally {
      setSaving(false);
    }
  }

  async function sendNow() {
    setSending(true);
    try {
      const { sent } = await sendWeeklyReportNow();
      toast.success(`گزارش برای ${formatNumber(sent)} گیرنده فرستاده شد.`);
      void queryClient.invalidateQueries({ queryKey: ["admin", "weekly-report"] });
    } catch (error) {
      toast.error(getErrorMessage(error, "ارسال انجام نشد."));
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <div className="space-y-4 px-6">
        <div className="flex items-center justify-between gap-4 rounded-xl bg-muted/50 px-4 py-3">
          <Label htmlFor="weekly-enabled">ارسال خودکار هر شنبه</Label>
          <Switch id="weekly-enabled" checked={draft.weekly_enabled} onCheckedChange={(checked) => setDraft((d) => ({ ...d, weekly_enabled: checked }))} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_10rem]">
          <div className="space-y-1.5">
            <Label htmlFor="weekly-recipients">ایمیل گیرنده‌ها (هر خط یکی، حداکثر ۵)</Label>
            <textarea
              id="weekly-recipients"
              dir="ltr"
              rows={3}
              className={TEXTAREA_CLASS}
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="weekly-hour">از ساعت</Label>
            <select
              id="weekly-hour"
              className="h-9 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
              value={draft.send_hour}
              onChange={(e) => setDraft((d) => ({ ...d, send_hour: Number(e.target.value) }))}
            >
              {HOURS.map((hour) => (
                <option key={hour} value={hour}>
                  {toPersianDigits(hour)}:۰۰ صبح شنبه
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {info.last_sent
            ? `آخرین ارسال: ${formatRelativeTime(parseSqlDate(info.last_sent.at))}، برای ${formatNumber(info.last_sent.sent)} گیرنده.`
            : "هنوز ارسال نشده است."}
          {info.last_sent && info.last_sent.failed.length > 0 && ` ناموفق: ${info.last_sent.failed.map((f) => f.email).join("، ")}`}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-6 pt-4">
        <Button variant="ghost" onClick={() => setPreview(true)}>
          <Eye />
          پیش‌نمایش
        </Button>
        <Button variant="outline" disabled={sending || info.settings.recipients.length === 0} onClick={sendNow}>
          {sending ? <Loader2 className="animate-spin" /> : <Send />}
          ارسال همین حالا
        </Button>
        <Button disabled={saving || !info.storage_ready} onClick={save}>
          {saving && <Loader2 className="animate-spin" />}
          ذخیره
        </Button>
      </div>

      <Dialog open={preview} onOpenChange={setPreview}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{info.subject}</DialogTitle>
            <DialogDescription>همان متنی که اگر همین حالا فرستاده شود می‌رسد.</DialogDescription>
          </DialogHeader>
          <pre className="max-h-[60dvh] overflow-y-auto whitespace-pre-wrap rounded-xl bg-muted/50 p-4 font-sans text-sm leading-7 text-foreground">
            {info.preview}
          </pre>
        </DialogContent>
      </Dialog>
    </>
  );
}
