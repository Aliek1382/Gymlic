"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Laptop, Loader2, LogOut, Smartphone } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
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
import { Skeleton } from "@/components/ui/skeleton";
import { fullName } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { formatNumber, formatRelativeTime } from "@/lib/persian";
import { getErrorMessage } from "@/lib/get-error-message";
import { updateProfileAsAdmin } from "../services/admin-service";
import { listAdminRoles } from "../services/admin-security-service";
import {
  listUserSessions,
  revokeUserSessions,
  setUserAdminLevel,
  type AdminLevel,
  type AdminUserRow,
  type UserSession,
} from "../services/admin-users-service";
import { parseSqlDate } from "../utils/format";

function nameOf(user: AdminUserRow) {
  return fullName(user.first_name, user.last_name);
}

// ---- Profile ------------------------------------------------------------------

export function ProfileEditDialog({
  user,
  onClose,
  onDone,
}: {
  user: AdminUserRow | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [draft, setDraft] = useState({ firstName: "", lastName: "", email: "", phone: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setDraft({
        firstName: user.first_name ?? "",
        lastName: user.last_name ?? "",
        email: user.email ?? "",
        phone: user.phone ?? "",
      });
    }
  }, [user]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;
    if (!draft.email.trim()) {
      toast.error("ایمیل نمی‌تواند خالی باشد؛ کاربر با آن وارد می‌شود.");
      return;
    }
    setSaving(true);
    try {
      await updateProfileAsAdmin({
        userId: user.id,
        firstName: draft.firstName.trim() || null,
        lastName: draft.lastName.trim() || null,
        email: draft.email.trim(),
        phone: draft.phone.trim() || null,
        birthDate: user.birth_date,
      });
      toast.success("پروفایل ذخیره شد.");
      onClose();
      onDone();
    } catch (error) {
      toast.error(getErrorMessage(error, "ذخیرهٔ پروفایل با خطا مواجه شد."));
    } finally {
      setSaving(false);
    }
  }

  const field = (key: keyof typeof draft, label: string, ltr = false) => (
    <div className="space-y-2">
      <Label htmlFor={`edit-${key}`}>{label}</Label>
      <Input
        id={`edit-${key}`}
        dir={ltr ? "ltr" : undefined}
        value={draft[key]}
        onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
      />
    </div>
  );

  return (
    <Dialog open={!!user} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>ویرایش پروفایل {user ? nameOf(user) : ""}</DialogTitle>
          <DialogDescription>
            تغییر ایمیل یعنی کاربر از این به بعد با ایمیل جدید وارد می‌شود؛ به او خبر بدهید.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {field("firstName", "نام")}
            {field("lastName", "نام خانوادگی")}
            {field("email", "ایمیل (برای ورود)", true)}
            {field("phone", "موبایل", true)}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              ذخیره
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---- Devices ------------------------------------------------------------------

/** "Chrome · Android" from a user-agent string — enough to recognise a device. */
function describeAgent(agent: string | null): { label: string; mobile: boolean } {
  if (!agent) return { label: "دستگاه ناشناخته", mobile: false };
  const browser = /Edg\//.test(agent)
    ? "Edge"
    : /OPR\//.test(agent)
      ? "Opera"
      : /Firefox\//.test(agent)
        ? "Firefox"
        : /Chrome\//.test(agent)
          ? "Chrome"
          : /Safari\//.test(agent)
            ? "Safari"
            : "مرورگر";
  const os = /Android/.test(agent)
    ? "Android"
    : /iPhone|iPad|iOS/.test(agent)
      ? "iOS"
      : /Windows/.test(agent)
        ? "Windows"
        : /Mac OS/.test(agent)
          ? "macOS"
          : /Linux/.test(agent)
            ? "Linux"
            : "";
  return { label: os ? `${browser} · ${os}` : browser, mobile: /Android|iPhone|iPad|Mobile/.test(agent) };
}

export function SessionsDialog({
  user,
  onClose,
  onDone,
}: {
  user: AdminUserRow | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin", "users", "sessions", user?.id],
    queryFn: () => listUserSessions(user!.id),
    enabled: !!user,
  });
  const [busy, setBusy] = useState<string | null>(null);

  async function revoke(session?: UserSession) {
    if (!user) return;
    setBusy(session?.id ?? "all");
    try {
      const { count } = await revokeUserSessions(user.id, session?.id);
      toast.success(
        session ? "از این دستگاه خارج شد." : `از ${formatNumber(count)} دستگاه خارج شد.`
      );
      await refetch();
      onDone();
    } catch (error) {
      toast.error(getErrorMessage(error, "خارج‌کردن ناموفق بود."));
    } finally {
      setBusy(null);
    }
  }

  const sessions = data ?? [];
  const others = sessions.filter((s) => !s.is_current);

  return (
    <Dialog open={!!user} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>دستگاه‌های فعال {user ? nameOf(user) : ""}</DialogTitle>
          <DialogDescription>
            جاهایی که این حساب الان وارد است. خارج‌کردن یعنی آن دستگاه باید دوباره با رمز وارد شود؛
            اگر رمز لو رفته، اول رمز تازه بگذارید.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-14 rounded-xl" />
            <Skeleton className="h-14 rounded-xl" />
          </div>
        ) : sessions.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            این حساب الان روی هیچ دستگاهی وارد نیست.
          </p>
        ) : (
          <div className="space-y-2">
            {sessions.map((session) => {
              const agent = describeAgent(session.user_agent);
              const Icon = agent.mobile ? Smartphone : Laptop;
              return (
                <div key={session.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                  <Icon className="size-5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {agent.label}
                      {session.is_current && (
                        <Badge variant="info" className="ms-2">
                          همین دستگاه
                        </Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ورود {formatRelativeTime(parseSqlDate(session.created_at))}
                      {session.ip_address && (
                        <>
                          {" · "}
                          <span dir="ltr">{session.ip_address}</span>
                        </>
                      )}
                    </p>
                  </div>
                  {!session.is_current && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy !== null}
                      onClick={() => revoke(session)}
                      aria-label="خارج‌کردن از این دستگاه"
                    >
                      {busy === session.id ? <Loader2 className="animate-spin" /> : <LogOut />}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {others.length > 1 && (
          <DialogFooter>
            <Button variant="destructive" disabled={busy !== null} onClick={() => revoke()}>
              {busy === "all" && <Loader2 className="animate-spin" />}
              خارج‌کردن از همهٔ دستگاه‌ها
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---- Admin access ---------------------------------------------------------------

function currentLevel(user: AdminUserRow): { level: AdminLevel; roleId: string | null } {
  if (user.is_platform_admin) return { level: "super", roleId: null };
  if (user.admin_role_id) return { level: "role", roleId: user.admin_role_id };
  return { level: "none", roleId: null };
}

export function AdminAccessDialog({
  user,
  onClose,
  onDone,
}: {
  user: AdminUserRow | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { data: roles } = useQuery({
    queryKey: ["admin", "roles"],
    queryFn: listAdminRoles,
    enabled: !!user,
  });
  const [choice, setChoice] = useState<{ level: AdminLevel; roleId: string | null }>({ level: "none", roleId: null });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) setChoice(currentLevel(user));
  }, [user]);

  const unchanged =
    !!user &&
    currentLevel(user).level === choice.level &&
    currentLevel(user).roleId === choice.roleId;

  async function save() {
    if (!user) return;
    setSaving(true);
    try {
      await setUserAdminLevel(user.id, choice.level, choice.roleId ?? undefined);
      toast.success("دسترسی به‌روزرسانی شد.");
      onClose();
      onDone();
    } catch (error) {
      toast.error(getErrorMessage(error, "تغییر دسترسی با خطا مواجه شد."));
    } finally {
      setSaving(false);
    }
  }

  const option = (
    key: string,
    selected: boolean,
    onSelect: () => void,
    title: string,
    description: string,
    disabled = false
  ) => (
    <button
      key={key}
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "w-full rounded-xl border p-3 text-right transition-colors disabled:opacity-50",
        selected ? "border-primary bg-accent" : "border-border hover:bg-muted"
      )}
    >
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs leading-5 text-muted-foreground">{description}</p>
    </button>
  );

  return (
    <Dialog open={!!user} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>دسترسی مدیریت {user ? nameOf(user) : ""}</DialogTitle>
          <DialogDescription>
            تغییر از درخواست بعدی همین کاربر اثر می‌کند؛ لازم نیست دوباره وارد شود.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {option(
            "none",
            choice.level === "none",
            () => setChoice({ level: "none", roleId: null }),
            "بدون دسترسی",
            "کاربر عادی؛ پنل مدیریت را نمی‌بیند."
          )}
          {(roles?.roles ?? []).map((role) =>
            option(
              role.id,
              choice.level === "role" && choice.roleId === role.id,
              () => setChoice({ level: "role", roleId: role.id }),
              `نقش «${role.name}»`,
              role.permissions
                .map((p) => roles?.catalog.find((c) => c.key === p)?.label ?? p)
                .join("، ")
            )
          )}
          {roles?.ready === false && (
            <p className="rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              نقش‌های محدود بعد از اجرای به‌روزرسانی دیتابیس «فاز ۵» فعال می‌شوند.
            </p>
          )}
          {roles?.ready && roles.roles.length === 0 && (
            <p className="rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              هنوز نقش محدودی تعریف نشده؛ از صفحهٔ «نقش‌های مدیریتی» بسازید.
            </p>
          )}
          {option(
            "super",
            choice.level === "super",
            () => setChoice({ level: "super", roleId: null }),
            "مدیر کل",
            "دسترسی کامل به همه‌چیز، از جمله نقش‌ها، امنیت، کلیدهای پیامک و ایمیل، دیتابیس و نسخهٔ پشتیبان. فقط به کسی بدهید که کاملاً به او اعتماد دارید."
          )}
        </div>

        <DialogFooter>
          <Button onClick={save} disabled={saving || unchanged}>
            {saving && <Loader2 className="animate-spin" />}
            ذخیره
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
