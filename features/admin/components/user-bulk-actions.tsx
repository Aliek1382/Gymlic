"use client";

import { useState } from "react";
import { Ban, Loader2, Megaphone, UserCheck, UserCog, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLE_LABEL } from "@/components/layout/sidebar-nav";
import { getErrorMessage } from "@/lib/get-error-message";
import { formatNumber } from "@/lib/persian";
import type { AccountType } from "@/types/database.types";
import { createBroadcast, type ChannelMode } from "../services/admin-communication-service";
import { bulkUserAction, type BulkAction, type BulkResult } from "../services/admin-users-service";

const ROLES: AccountType[] = ["club", "trainer", "athlete"];

const TEXTAREA_CLASS =
  "w-full rounded-xl border border-input bg-transparent px-4 py-2 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30";

/**
 * The bar that appears on /admin/users once rows are ticked: suspend or
 * unsuspend them, give them a role, or send them a notification (a
 * broadcast to exactly these accounts).
 */
export function UserBulkBar({
  ids,
  canManage,
  canNotify,
  onClear,
  onDone,
}: {
  ids: string[];
  canManage: boolean;
  canNotify: boolean;
  onClear: () => void;
  onDone: () => void;
}) {
  const [dialog, setDialog] = useState<"suspend" | "unsuspend" | "role" | "notify" | null>(null);
  const [result, setResult] = useState<BulkResult | null>(null);

  if (ids.length === 0) return null;

  function finished(outcome: BulkResult) {
    setDialog(null);
    if (outcome.skipped.length > 0) setResult(outcome);
    else toast.success(`برای ${formatNumber(outcome.done)} کاربر انجام شد.`);
    onDone();
  }

  return (
    <>
      <div className="sticky bottom-3 z-20 mx-6 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 shadow-lg">
        <span className="text-sm font-medium text-foreground">{formatNumber(ids.length)} کاربر انتخاب شده</span>
        <div className="flex flex-1 flex-wrap justify-end gap-2">
          {canManage && (
            <>
              <Button size="sm" variant="outline" onClick={() => setDialog("suspend")}>
                <Ban />
                مسدودکردن
              </Button>
              <Button size="sm" variant="outline" onClick={() => setDialog("unsuspend")}>
                <UserCheck />
                رفع مسدودی
              </Button>
              <Button size="sm" variant="outline" onClick={() => setDialog("role")}>
                <UserCog />
                تغییر نقش
              </Button>
            </>
          )}
          {canNotify && (
            <Button size="sm" onClick={() => setDialog("notify")}>
              <Megaphone />
              ارسال اعلان
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onClear} aria-label="لغو انتخاب">
            <X />
          </Button>
        </div>
      </div>

      <SuspendDialog
        mode={dialog === "suspend" || dialog === "unsuspend" ? dialog : null}
        ids={ids}
        onClose={() => setDialog(null)}
        onDone={finished}
      />
      <BulkRoleDialog open={dialog === "role"} ids={ids} onClose={() => setDialog(null)} onDone={finished} />
      <BulkNotifyDialog
        open={dialog === "notify"}
        ids={ids}
        onClose={() => setDialog(null)}
        onSent={() => {
          setDialog(null);
          onClear();
        }}
      />
      <ResultDialog result={result} onClose={() => setResult(null)} />
    </>
  );
}

function useBulk(onDone: (result: BulkResult) => void) {
  const [busy, setBusy] = useState(false);
  async function run(action: BulkAction, ids: string[], role?: AccountType | null) {
    setBusy(true);
    try {
      onDone(await bulkUserAction(action, ids, role));
    } catch (error) {
      toast.error(getErrorMessage(error, "انجام نشد."));
    } finally {
      setBusy(false);
    }
  }
  return { busy, run };
}

function SuspendDialog({
  mode,
  ids,
  onClose,
  onDone,
}: {
  mode: "suspend" | "unsuspend" | null;
  ids: string[];
  onClose: () => void;
  onDone: (result: BulkResult) => void;
}) {
  const { busy, run } = useBulk(onDone);
  return (
    <Dialog open={mode !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "suspend" ? "مسدودکردن" : "رفع مسدودی"} {formatNumber(ids.length)} کاربر
          </DialogTitle>
          <DialogDescription>
            {mode === "suspend"
              ? "همه فوراً از دستگاه‌هایشان خارج می‌شوند و تا رفع مسدودی نمی‌توانند وارد شوند. اطلاعاتشان پاک نمی‌شود."
              : "دوباره می‌توانند وارد شوند و از پنل استفاده کنند."}{" "}
            حساب خودتان و (اگر مدیر کل نیستید) حساب مدیران کنار گذاشته می‌شود.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant={mode === "suspend" ? "destructive" : "default"} disabled={busy} onClick={() => mode && run(mode, ids)}>
            {busy && <Loader2 className="animate-spin" />}
            {mode === "suspend" ? "مسدودکردن همه" : "رفع مسدودی همه"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkRoleDialog({
  open,
  ids,
  onClose,
  onDone,
}: {
  open: boolean;
  ids: string[];
  onClose: () => void;
  onDone: (result: BulkResult) => void;
}) {
  const { busy, run } = useBulk(onDone);
  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>تغییر نقش {formatNumber(ids.length)} کاربر</DialogTitle>
          <DialogDescription>
            فقط برای حساب‌هایی که هنوز به باشگاه یا مربی/ورزشکاری وصل نشده‌اند؛ بقیه دست نمی‌خورند و در پایان فهرستشان را
            می‌بینید.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {ROLES.map((role) => (
            <Button key={role} variant="outline" disabled={busy} onClick={() => run("role", ids, role)}>
              {ROLE_LABEL[role]}
            </Button>
          ))}
          <Button variant="outline" disabled={busy} onClick={() => run("role", ids, null)}>
            پاک‌کردن نقش (انتخاب دوباره)
          </Button>
        </div>
        {busy && <Loader2 className="mx-auto animate-spin text-muted-foreground" />}
      </DialogContent>
    </Dialog>
  );
}

const CHANNEL_OPTIONS: { value: ChannelMode; label: string }[] = [
  { value: "off", label: "نه" },
  { value: "opted", label: "فقط کسانی که خواسته‌اند" },
  { value: "all", label: "همه" },
];

function BulkNotifyDialog({
  open,
  ids,
  onClose,
  onSent,
}: {
  open: boolean;
  ids: string[];
  onClose: () => void;
  onSent: () => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [sms, setSms] = useState<ChannelMode>("off");
  const [email, setEmail] = useState<ChannelMode>("off");
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    try {
      const result = await createBroadcast({
        title: title.trim(),
        body,
        link,
        audience: { roles: [], club_ids: [], inactive_days: 0, user_ids: ids },
        channels: { sms, email },
        scheduled_at: null,
      });
      toast.success(`اعلان برای ${formatNumber(result.recipients)} نفر فرستاده شد.`);
      setTitle("");
      setBody("");
      setLink("");
      onSent();
    } catch (error) {
      toast.error(getErrorMessage(error, "ارسال اعلان با خطا مواجه شد."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>اعلان به {formatNumber(ids.length)} کاربر انتخاب‌شده</DialogTitle>
          <DialogDescription>
            در پنلشان نشان داده می‌شود (و روی گوشی‌هایی که اعلان را روشن کرده‌اند). حساب‌های مسدود چیزی دریافت نمی‌کنند. در
            «اعلان همگانی» هم ثبت می‌شود.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="bulk-title">عنوان</Label>
            <Input id="bulk-title" value={title} maxLength={255} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bulk-body">متن</Label>
            <textarea id="bulk-body" rows={4} maxLength={2000} className={TEXTAREA_CLASS} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bulk-link">لینک (اختیاری)</Label>
            <Input id="bulk-link" dir="ltr" placeholder="/subscription" value={link} onChange={(e) => setLink(e.target.value)} />
          </div>
          <ChannelRow label="پیامک هم برود؟" value={sms} onChange={setSms} />
          <ChannelRow label="ایمیل هم برود؟" value={email} onChange={setEmail} />
        </div>
        <DialogFooter>
          <Button disabled={busy || title.trim() === ""} onClick={send}>
            {busy && <Loader2 className="animate-spin" />}
            ارسال
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChannelRow({ label, value, onChange }: { label: string; value: ChannelMode; onChange: (v: ChannelMode) => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <span className="text-foreground">{label}</span>
      <div className="flex gap-1">
        {CHANNEL_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            data-active={value === option.value}
            onClick={() => onChange(option.value)}
            className="rounded-full border border-border px-3 py-1 text-xs hover:bg-muted data-[active=true]:border-primary data-[active=true]:bg-accent data-[active=true]:text-accent-foreground"
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ResultDialog({ result, onClose }: { result: BulkResult | null; onClose: () => void }) {
  return (
    <Dialog open={!!result} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>برای {formatNumber(result?.done ?? 0)} کاربر انجام شد</DialogTitle>
          <DialogDescription>{formatNumber(result?.skipped.length ?? 0)} کاربر دست نخورد:</DialogDescription>
        </DialogHeader>
        <ul className="max-h-72 space-y-1 overflow-y-auto text-sm">
          {result?.skipped.map((row) => (
            <li key={row.id} className="flex justify-between gap-3 rounded-lg bg-muted/50 px-3 py-1.5">
              <span className="text-foreground">{row.name}</span>
              <span className="text-muted-foreground">{row.reason}</span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
