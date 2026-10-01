"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, History, Loader2, Megaphone, Send, Users, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { JalaliDateField } from "@/components/ui/jalali-date-field";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getErrorMessage } from "@/lib/get-error-message";
import { toIsoDate } from "@/lib/iso-date";
import { formatNumber, formatPersianDate, formatRelativeTime, parseLocaleNumber, toPersianDigits } from "@/lib/persian";
import { cn } from "@/lib/utils";
import type { AccountType } from "@/types/database.types";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { listClubOptions } from "../services/admin-service";
import {
  cancelBroadcast,
  createBroadcast,
  listBroadcasts,
  previewBroadcast,
  type BroadcastAudience,
  type BroadcastChannels,
  type BroadcastRow,
  type BroadcastStatus,
  type ChannelMode,
} from "../services/admin-communication-service";

const HISTORY_KEY = ["admin", "broadcasts"] as const;

const TEXTAREA_CLASS =
  "w-full rounded-xl border border-input bg-transparent px-4 py-2 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30";

const ROLE_LABEL: Record<AccountType, string> = { club: "باشگاه‌ها", trainer: "مربی‌ها", athlete: "ورزشکاران" };

const CHANNEL_LABEL: Record<ChannelMode, string> = {
  off: "نفرست",
  opted: "فقط کسانی که روشن کرده‌اند",
  all: "همه (هرکس شماره/ایمیل دارد)",
};

const STATUS: Record<BroadcastStatus, { label: string; variant: "success" | "warning" | "secondary" | "destructive" }> = {
  sent: { label: "ارسال شد", variant: "success" },
  sending: { label: "در حال ارسال", variant: "warning" },
  scheduled: { label: "زمان‌بندی‌شده", variant: "warning" },
  cancelled: { label: "لغو شد", variant: "secondary" },
  failed: { label: "ناموفق", variant: "destructive" },
};

export function AdminNotificationsPage() {
  const { data: history } = useQuery({ queryKey: HISTORY_KEY, queryFn: listBroadcasts });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">اعلان همگانی</h1>
        <p className="text-sm text-muted-foreground">
          پیام به گروهی از کاربران: همه، یک یا چند نقش، اعضای باشگاه‌های مشخص، یا کسانی که مدتی وارد
          نشده‌اند — همراه با پیامک یا ایمیل، الان یا در زمانی که تعیین می‌کنید.
        </p>
      </div>

      <Tabs defaultValue="compose" className="space-y-6">
        <TabsList>
          <TabsTrigger value="compose">
            <Megaphone />
            ارسال جدید
          </TabsTrigger>
          <TabsTrigger value="history">
            <History />
            تاریخچه
            {history?.items.some((b) => b.status === "scheduled") && (
              <span className="size-1.5 rounded-full bg-warning" aria-label="ارسال زمان‌بندی‌شده دارد" />
            )}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="compose">
          <ComposeForm ready={history?.ready ?? false} />
        </TabsContent>
        <TabsContent value="history">
          <HistoryList ready={history?.ready} items={history?.items} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ComposeForm({ ready }: { ready: boolean }) {
  const queryClient = useQueryClient();
  const { data: clubs } = useQuery({ queryKey: ["admin", "clubs", "names"], queryFn: listClubOptions });

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [roles, setRoles] = useState<AccountType[]>([]);
  const [clubFilter, setClubFilter] = useState(false);
  const [clubIds, setClubIds] = useState<string[]>([]);
  const [inactive, setInactive] = useState(false);
  const [inactiveDays, setInactiveDays] = useState("30");
  const [sms, setSms] = useState<ChannelMode>("off");
  const [email, setEmail] = useState<ChannelMode>("off");
  const [schedule, setSchedule] = useState(false);
  const [date, setDate] = useState(() => toIsoDate(new Date(Date.now() + 86_400_000)));
  const [time, setTime] = useState("10:00");
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const audience: BroadcastAudience = useMemo(
    () => ({
      roles,
      club_ids: clubFilter ? clubIds : [],
      inactive_days: inactive ? Math.max(1, parseLocaleNumber(inactiveDays) ?? 0) : 0,
    }),
    [roles, clubFilter, clubIds, inactive, inactiveDays]
  );
  const channels: BroadcastChannels = useMemo(() => ({ sms, email }), [sms, email]);

  // The count follows the choices, a moment after the last change.
  const [debounced, setDebounced] = useState({ audience, channels });
  useEffect(() => {
    const timer = setTimeout(() => setDebounced({ audience, channels }), 400);
    return () => clearTimeout(timer);
  }, [audience, channels]);
  const { data: preview, isFetching: counting } = useQuery({
    queryKey: ["admin", "broadcast-preview", debounced],
    queryFn: () => previewBroadcast(debounced.audience, debounced.channels),
    enabled: !(clubFilter && clubIds.length === 0),
  });

  function toggleRole(role: AccountType) {
    setRoles((current) => (current.includes(role) ? current.filter((r) => r !== role) : [...current, role]));
  }

  function validate(): string | null {
    if (!title.trim()) return "عنوان اعلان را وارد کنید.";
    if (link.trim() && !/^(\/|https?:\/\/)/.test(link.trim())) return "لینک باید با / یا https:// شروع شود.";
    if (clubFilter && clubIds.length === 0) return "دست‌کم یک باشگاه انتخاب کنید.";
    if (schedule && !/^\d{2}:\d{2}$/.test(time)) return "ساعت ارسال را به شکل ۱۰:۳۰ وارد کنید.";
    if (preview && preview.recipients === 0) return "با این انتخاب هیچ گیرنده‌ای پیدا نشد.";
    return null;
  }

  async function send() {
    setConfirming(false);
    setSending(true);
    try {
      const result = await createBroadcast({
        title: title.trim(),
        body,
        link,
        audience,
        channels,
        scheduled_at: schedule ? `${date}T${time}` : null,
      });
      toast.success(
        result.status === "scheduled"
          ? `اعلان زمان‌بندی شد؛ برای ${formatNumber(result.recipients)} نفر ارسال می‌شود.`
          : `اعلان برای ${formatNumber(result.recipients)} نفر ارسال شد.`
      );
      setTitle("");
      setBody("");
      setLink("");
      void queryClient.invalidateQueries({ queryKey: HISTORY_KEY });
    } catch (error) {
      toast.error(getErrorMessage(error, "ارسال اعلان با خطا مواجه شد."));
    } finally {
      setSending(false);
    }
  }

  const audienceText = [
    roles.length === 0 ? "همهٔ کاربران" : roles.map((r) => ROLE_LABEL[r]).join(" و "),
    clubFilter && clubIds.length > 0 ? `عضو ${formatNumber(clubIds.length)} باشگاه انتخاب‌شده` : null,
    inactive ? `که ${toPersianDigits(audience.inactive_days)} روز وارد نشده‌اند` : null,
  ]
    .filter(Boolean)
    .join("، ");

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_20rem]">
      <Card className="gap-5 py-5">
        <div className="space-y-4 px-6">
          <div className="space-y-2">
            <Label htmlFor="broadcast-title">عنوان</Label>
            <Input id="broadcast-title" value={title} maxLength={255} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="broadcast-body">
              متن <span className="text-muted-foreground">(اختیاری)</span>
            </Label>
            <textarea
              id="broadcast-body"
              rows={4}
              maxLength={2000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className={TEXTAREA_CLASS}
            />
            {sms !== "off" && body.length > 200 && (
              <p className="text-xs text-warning">متن پیامکِ بلند در چند بخش ارسال و چند بار هزینه حساب می‌شود.</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="broadcast-link">
              لینک <span className="text-muted-foreground">(اختیاری)</span>
            </Label>
            <Input
              id="broadcast-link"
              dir="ltr"
              value={link}
              placeholder="/finance یا https://…"
              onChange={(e) => setLink(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-4 border-t border-border px-6 pt-5">
          <CardTitle className="text-base">گیرندگان</CardTitle>
          <div className="flex flex-wrap gap-2">
            <RoleChip active={roles.length === 0} onClick={() => setRoles([])}>
              همه
            </RoleChip>
            {(Object.keys(ROLE_LABEL) as AccountType[]).map((role) => (
              <RoleChip key={role} active={roles.includes(role)} onClick={() => toggleRole(role)}>
                {ROLE_LABEL[role]}
              </RoleChip>
            ))}
          </div>

          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border px-4 py-3">
            <span>
              <span className="block text-sm font-medium text-foreground">فقط اعضای باشگاه‌های خاص</span>
              <span className="block text-xs text-muted-foreground">مالک، مربی‌ها و ورزشکاران فعال آن باشگاه‌ها</span>
            </span>
            <Switch
              checked={clubFilter}
              onCheckedChange={(checked) => {
                setClubFilter(checked);
                if (!checked) setClubIds([]);
              }}
            />
          </label>
          {clubFilter && (
            <ScrollArea className="h-44 rounded-xl border border-border">
              <div className="space-y-1 p-2">
                {(clubs ?? []).length === 0 ? (
                  <p className="p-2 text-xs text-muted-foreground">باشگاهی ثبت نشده است.</p>
                ) : (
                  (clubs ?? []).map((club) => (
                    <label
                      key={club.id}
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted"
                    >
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        checked={clubIds.includes(club.id)}
                        onChange={() =>
                          setClubIds((current) =>
                            current.includes(club.id) ? current.filter((id) => id !== club.id) : [...current, club.id]
                          )
                        }
                      />
                      {club.name}
                    </label>
                  ))
                )}
              </div>
            </ScrollArea>
          )}

          <div className="space-y-2 rounded-xl border border-border px-4 py-3">
            <label className="flex cursor-pointer items-center justify-between gap-3">
              <span>
                <span className="block text-sm font-medium text-foreground">فقط کسانی که مدتی وارد نشده‌اند</span>
                <span className="block text-xs text-muted-foreground">برای برگرداندن کاربرانِ غیرفعال</span>
              </span>
              <Switch checked={inactive} onCheckedChange={setInactive} />
            </label>
            {inactive && (
              <div className="flex items-center gap-2 text-sm">
                <span>بیش از</span>
                <Input
                  dir="ltr"
                  inputMode="numeric"
                  className="w-20"
                  value={inactiveDays}
                  onChange={(e) => setInactiveDays(e.target.value)}
                />
                <span>روز</span>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4 border-t border-border px-6 pt-5">
          <div>
            <CardTitle className="text-base">ارسال هم‌زمان</CardTitle>
            <CardDescription>
              اعلان همیشه در پنل و (برای کسانی که فعال کرده‌اند) روی گوشی نشان داده می‌شود. پیامک و ایمیل
              از صف ارسال، چند دقیقه بعد فرستاده می‌شوند.
            </CardDescription>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ChannelSelect label="پیامک" value={sms} onChange={setSms} />
            <ChannelSelect label="ایمیل" value={email} onChange={setEmail} />
          </div>
        </div>

        <div className="space-y-4 border-t border-border px-6 pt-5">
          <label className="flex cursor-pointer items-center justify-between gap-3">
            <span>
              <span className="block text-sm font-medium text-foreground">زمان‌بندی</span>
              <span className="block text-xs text-muted-foreground">
                {ready ? "به وقت ایران؛ خاموش = ارسال همین حالا" : "پس از اجرای به‌روزرسانی دیتابیس فاز ۷ فعال می‌شود."}
              </span>
            </span>
            <Switch checked={schedule} onCheckedChange={setSchedule} disabled={!ready} />
          </label>
          {schedule && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_8rem]">
              <JalaliDateField id="broadcast-date" label="تاریخ" value={date} onChange={setDate} pastYears={1} futureYears={1} />
              <div className="space-y-2">
                <Label htmlFor="broadcast-time">ساعت</Label>
                <Input id="broadcast-time" dir="ltr" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
            </div>
          )}
        </div>
      </Card>

      <div className="space-y-4">
        <Card className="gap-3 py-5 lg:sticky lg:top-24">
          <div className="space-y-3 px-5">
            <p className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Users className="size-4" />
              {audienceText}
            </p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Count label="نفر" value={preview?.recipients} loading={counting} />
              <Count label="پیامک" value={sms === "off" ? 0 : preview?.sms} loading={counting} />
              <Count label="ایمیل" value={email === "off" ? 0 : preview?.email} loading={counting} />
            </div>
            <Button
              className="w-full"
              disabled={sending}
              onClick={() => {
                const error = validate();
                if (error) toast.error(error);
                else setConfirming(true);
              }}
            >
              {sending ? <Loader2 className="animate-spin" /> : schedule ? <CalendarClock /> : <Send />}
              {schedule ? "زمان‌بندی ارسال" : "ارسال همین حالا"}
            </Button>
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={schedule ? "زمان‌بندی اعلان" : "ارسال اعلان"}
        description={`«${title.trim()}» برای ${formatNumber(preview?.recipients ?? 0)} نفر${
          sms !== "off" ? `، با ${formatNumber(preview?.sms ?? 0)} پیامک` : ""
        }${email !== "off" ? `، با ${formatNumber(preview?.email ?? 0)} ایمیل` : ""}${
          schedule ? ` در ${formatPersianDate(new Date(`${date}T00:00:00`))} ساعت ${toPersianDigits(time)}` : ""
        } ارسال می‌شود. ارسالِ انجام‌شده قابل برگشت نیست.`}
        confirmLabel={schedule ? "زمان‌بندی" : "ارسال"}
        errorMessage="ارسال ناموفق بود."
        onConfirm={send}
      />
    </div>
  );
}

function RoleChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground hover:bg-muted"
      )}
    >
      {children}
    </button>
  );
}

function ChannelSelect({ label, value, onChange }: { label: string; value: ChannelMode; onChange: (v: ChannelMode) => void }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={(next) => onChange(next as ChannelMode)}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(CHANNEL_LABEL) as ChannelMode[]).map((mode) => (
            <SelectItem key={mode} value={mode}>
              {CHANNEL_LABEL[mode]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function Count({ label, value, loading }: { label: string; value: number | undefined; loading: boolean }) {
  return (
    <div className="rounded-xl bg-muted/60 px-2 py-3">
      <p className={cn("text-lg font-bold text-foreground", loading && "opacity-50")}>
        {value === undefined ? "—" : formatNumber(value)}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function HistoryList({ ready, items }: { ready: boolean | undefined; items: BroadcastRow[] | undefined }) {
  const queryClient = useQueryClient();
  const [cancelling, setCancelling] = useState<BroadcastRow | null>(null);

  if (ready === undefined) return <Skeleton className="h-48 rounded-2xl" />;
  if (!ready) {
    return (
      <Card className="py-8">
        <div className="px-6">
          <EmptyState
            icon={History}
            title="تاریخچه هنوز ثبت نمی‌شود."
            description="به‌روزرسانی «اعلان همگانی، تیکت پشتیبانی و صفحه‌های متنی (فاز ۷)» را از صفحهٔ «به‌روزرسانی دیتابیس» اجرا کنید."
          />
        </div>
      </Card>
    );
  }
  if (!items || items.length === 0) {
    return (
      <Card className="py-8">
        <div className="px-6">
          <EmptyState icon={History} title="هنوز اعلانی نفرستاده‌اید." description="ارسال‌ها و زمان‌بندی‌ها اینجا می‌آیند." />
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((b) => (
        <Card key={b.id} className="gap-2 py-4">
          <div className="flex flex-wrap items-start gap-3 px-5">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-foreground">{b.title}</p>
                <Badge variant={STATUS[b.status].variant}>{STATUS[b.status].label}</Badge>
              </div>
              {b.body && <p className="line-clamp-2 text-sm text-muted-foreground">{b.body}</p>}
              <p className="text-xs text-muted-foreground">
                {describeAudience(b.audience)}
                {b.status === "scheduled" && b.scheduled_at
                  ? ` · ارسال: ${formatPersianDate(new Date(b.scheduled_at))} ساعت ${toPersianDigits(
                      new Date(b.scheduled_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tehran" })
                    )}`
                  : ` · ${formatRelativeTime(new Date(b.sent_at ?? b.created_at))}`}
                {b.created_by_name ? ` · ${b.created_by_name}` : ""}
              </p>
              {b.status === "sent" && (
                <p className="text-xs text-foreground">
                  {formatNumber(b.recipient_count)} نفر
                  {b.sms_count > 0 && ` · ${formatNumber(b.sms_count)} پیامک`}
                  {b.email_count > 0 && ` · ${formatNumber(b.email_count)} ایمیل`}
                </p>
              )}
              {b.status === "failed" && b.error && <p className="text-xs text-destructive">{b.error}</p>}
            </div>
            {b.status === "scheduled" && (
              <Button size="sm" variant="outline" onClick={() => setCancelling(b)}>
                <X />
                لغو
              </Button>
            )}
          </div>
        </Card>
      ))}
      <ConfirmDialog
        open={!!cancelling}
        onOpenChange={(open) => !open && setCancelling(null)}
        title="لغو ارسال زمان‌بندی‌شده"
        description={`«${cancelling?.title ?? ""}» فرستاده نمی‌شود.`}
        confirmLabel="لغو ارسال"
        errorMessage="لغو ناموفق بود."
        onConfirm={async () => {
          if (!cancelling) return;
          await cancelBroadcast(cancelling.id);
          toast.success("ارسال لغو شد.");
          void queryClient.invalidateQueries({ queryKey: HISTORY_KEY });
        }}
      />
    </div>
  );
}

function describeAudience(a: BroadcastAudience): string {
  const parts = [a.roles.length === 0 ? "همه" : a.roles.map((r) => ROLE_LABEL[r]).join(" و ")];
  if (a.club_ids.length > 0) parts.push(`عضو ${formatNumber(a.club_ids.length)} باشگاه`);
  if (a.inactive_days > 0) parts.push(`غیرفعال بیش از ${toPersianDigits(a.inactive_days)} روز`);
  return parts.join("، ");
}
