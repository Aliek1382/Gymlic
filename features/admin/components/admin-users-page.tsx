"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Eye,
  KeyRound,
  Laptop,
  Loader2,
  MoreHorizontal,
  Pencil,
  Search,
  ShieldCheck,
  Trash2,
  UserCog,
  UserRoundX,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ROLE_LABEL } from "@/components/layout/sidebar-nav";
import { fullName } from "@/lib/api/client";
import { formatNumber, formatRelativeTime } from "@/lib/persian";
import { getErrorMessage } from "@/lib/get-error-message";
import { useDebouncedCallback } from "@/lib/use-debounced-callback";
import { useAdminContext } from "@/features/authentication/hooks/use-auth-context";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { ErrorState } from "@/features/dashboard/components/shared/error-state";
import type { AccountType } from "@/types/database.types";
import { setProfileSuspended } from "../services/admin-service";
import {
  listAdminUsers,
  setUserPassword,
  setUserRole,
  type AdminUserRow,
  type UserFilter,
} from "../services/admin-users-service";
import { useAdminCan } from "../hooks/use-admin-access";
import { ExportButton } from "./export-button";
import { AdminAccessDialog, ProfileEditDialog, SessionsDialog } from "./user-account-dialogs";
import { openUserPanel } from "@/features/view-as/services/view-as-service";
import { deleteUser } from "../services/admin-ops-service";
import { UserBulkBar } from "./user-bulk-actions";

const FILTERS: { value: UserFilter; label: string }[] = [
  { value: "", label: "همه" },
  { value: "club", label: "باشگاه‌ها" },
  { value: "trainer", label: "مربی‌ها" },
  { value: "athlete", label: "ورزشکاران" },
  { value: "none", label: "بدون نقش" },
  { value: "admin", label: "مدیران" },
  { value: "suspended", label: "مسدود" },
];

const ROLES: AccountType[] = ["club", "trainer", "athlete"];

/** Parse SQL "YYYY-MM-DD HH:MM:SS" the way Safari accepts too. */
function parseDate(value: string): Date {
  return new Date(value.replace(" ", "T"));
}

type Action =
  | { kind: "edit"; user: AdminUserRow }
  | { kind: "sessions"; user: AdminUserRow }
  | { kind: "role"; user: AdminUserRow }
  | { kind: "password"; user: AdminUserRow }
  | { kind: "admin"; user: AdminUserRow }
  | { kind: "suspend"; user: AdminUserRow }
  | { kind: "delete"; user: AdminUserRow };

export function AdminUsersPage() {
  const queryClient = useQueryClient();
  const { data: me } = useAdminContext();
  const [filter, setFilter] = useState<UserFilter>("");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const applySearch = useDebouncedCallback((value: string) => setQ(value.trim()), 350);
  const [action, setAction] = useState<Action | null>(null);
  const can = useAdminCan();
  const isSuper = can("super");
  const canManage = can("users.manage");
  const canNotify = can("notifications");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const canSelect = canManage || canNotify;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "users", filter, q],
    queryFn: () => listAdminUsers(filter, q),
    placeholderData: (previous) => previous,
  });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
  const rows = data ?? [];
  const close = () => setAction(null);
  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  function viewPanel(userId: string) {
    openUserPanel(userId).catch((error) => toast.error(getErrorMessage(error, "باز کردن پنل کاربر ناموفق بود.")));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">کاربران</h1>
          <p className="text-sm text-muted-foreground">
            همهٔ حساب‌های سایت، از جمله مدیران باشگاه و کسانی که ثبت‌نام کرده‌اند ولی هنوز نقش
            انتخاب نکرده‌اند. از منوی هر ردیف: ویرایش پروفایل، دستگاه‌های فعال، تغییر نقش، رمز تازه،
            مسدودسازی، و (برای مدیر کل) دسترسی مدیریت، دیدن پنل کاربر به‌صورت فقط‌خواندنی برای
            پشتیبانی و حذف حساب. با تیک‌زدن چند ردیف، کارها را گروهی انجام دهید.
          </p>
        </div>
        <ExportButton kind="users" />
      </div>

      <Card className="gap-4 py-5">
        <div className="flex flex-col gap-3 px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((item) => (
              <button
                key={item.value || "all"}
                type="button"
                data-active={filter === item.value}
                onClick={() => setFilter(item.value)}
                className="rounded-full border border-border px-3 py-1 text-xs transition-colors hover:bg-muted data-[active=true]:border-primary data-[active=true]:bg-accent data-[active=true]:text-accent-foreground"
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                applySearch(e.target.value);
              }}
              placeholder="نام، ایمیل یا موبایل..."
              className="pr-9 lg:w-64"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2 px-6">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState message="دریافت فهرست کاربران با خطا مواجه شد." />
        ) : rows.length === 0 ? (
          <div className="px-6">
            <EmptyState icon={Users} title="کاربری پیدا نشد." description="" />
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  {canSelect && (
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        className="size-4 accent-[var(--primary)]"
                        aria-label="انتخاب همهٔ ردیف‌ها"
                        checked={rows.length > 0 && rows.every((row) => selected.has(row.id))}
                        onChange={(event) =>
                          setSelected(event.target.checked ? new Set(rows.map((row) => row.id)) : new Set())
                        }
                      />
                    </TableHead>
                  )}
                  <TableHead>کاربر</TableHead>
                  <TableHead>نقش</TableHead>
                  <TableHead>تماس</TableHead>
                  <TableHead>عضویت</TableHead>
                  <TableHead>آخرین ورود</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((user) => {
                  const name = fullName(user.first_name, user.last_name);
                  const isMe = user.id === me?.userId;
                  // An admin's account is the super admin's to change (the API enforces it).
                  const isAdminAccount = user.is_platform_admin || !!user.admin_role_id;
                  const mayChange = canManage && (isSuper || !isAdminAccount);
                  return (
                    <TableRow key={user.id} className={user.is_suspended ? "opacity-60" : undefined}>
                      {canSelect && (
                        <TableCell>
                          <input
                            type="checkbox"
                            className="size-4 accent-[var(--primary)]"
                            aria-label={`انتخاب ${name}`}
                            checked={selected.has(user.id)}
                            onChange={() => toggle(user.id)}
                          />
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="size-8">
                            {user.avatar_url && <AvatarImage src={user.avatar_url} alt={name} />}
                            <AvatarFallback>{name.slice(0, 2)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground">
                              {name}
                              {isMe && <span className="text-xs text-muted-foreground"> (شما)</span>}
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {user.is_platform_admin && <Badge variant="info">مدیر کل</Badge>}
                              {!user.is_platform_admin && user.admin_role_name && (
                                <Badge variant="info">{user.admin_role_name}</Badge>
                              )}
                              {user.is_suspended && <Badge variant="destructive">مسدود</Badge>}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {user.account_type ? ROLE_LABEL[user.account_type] : "انتخاب نشده"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <p dir="ltr" className="text-right">
                          {user.email ?? "—"}
                        </p>
                        {user.phone && (
                          <p dir="ltr" className="text-right text-xs">
                            {user.phone}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatRelativeTime(parseDate(user.created_at))}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {user.last_login_at ? formatRelativeTime(parseDate(user.last_login_at)) : "—"}
                        {user.session_count > 0 && (
                          <p className="text-[11px]">روی {formatNumber(user.session_count)} دستگاه</p>
                        )}
                      </TableCell>
                      <TableCell>
                        {(mayChange || (isSuper && !isMe)) && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="ghost" aria-label={`عملیات ${name}`}>
                                <MoreHorizontal />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {mayChange && (
                                <>
                                  <DropdownMenuItem onClick={() => setAction({ kind: "edit", user })}>
                                    <Pencil />
                                    ویرایش پروفایل
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setAction({ kind: "sessions", user })}>
                                    <Laptop />
                                    دستگاه‌های فعال
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setAction({ kind: "role", user })}>
                                    <UserCog />
                                    تغییر نقش
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    disabled={isMe}
                                    onClick={() => setAction({ kind: "password", user })}
                                  >
                                    <KeyRound />
                                    تعیین رمز جدید
                                  </DropdownMenuItem>
                                </>
                              )}
                              {isSuper && !isMe && (
                                <DropdownMenuItem onClick={() => setAction({ kind: "admin", user })}>
                                  <ShieldCheck />
                                  دسترسی مدیریت
                                </DropdownMenuItem>
                              )}
                              {isSuper && !isMe && !isAdminAccount && user.account_type && (
                                <DropdownMenuItem onClick={() => viewPanel(user.id)}>
                                  <Eye />
                                  دیدن پنل کاربر (فقط‌خواندنی)
                                </DropdownMenuItem>
                              )}
                              {mayChange && !isMe && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    variant={user.is_suspended ? "default" : "destructive"}
                                    onClick={() => setAction({ kind: "suspend", user })}
                                  >
                                    <UserRoundX />
                                    {user.is_suspended ? "رفع مسدودی" : "مسدودکردن حساب"}
                                  </DropdownMenuItem>
                                </>
                              )}
                              {isSuper && !isMe && !isAdminAccount && (
                                <DropdownMenuItem variant="destructive" onClick={() => setAction({ kind: "delete", user })}>
                                  <Trash2 />
                                  حذف حساب
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <UserBulkBar
              ids={[...selected].filter((id) => rows.some((row) => row.id === id))}
              canManage={canManage}
              canNotify={canNotify}
              onClear={() => setSelected(new Set())}
              onDone={refresh}
            />
            {rows.length >= 300 && (
              <p className="px-6 text-xs text-muted-foreground">
                فقط {formatNumber(300)} کاربر آخر نشان داده شده؛ برای پیدا کردن بقیه جستجو کنید.
              </p>
            )}
          </>
        )}
      </Card>

      <RoleDialog action={action?.kind === "role" ? action.user : null} onClose={close} onDone={refresh} />
      <PasswordDialog
        action={action?.kind === "password" ? action.user : null}
        onClose={close}
        onDone={refresh}
      />
      <ProfileEditDialog user={action?.kind === "edit" ? action.user : null} onClose={close} onDone={refresh} />
      <SessionsDialog user={action?.kind === "sessions" ? action.user : null} onClose={close} onDone={refresh} />
      <AdminAccessDialog user={action?.kind === "admin" ? action.user : null} onClose={close} onDone={refresh} />
      {action?.kind === "delete" && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && close()}
          title={`حذف حساب ${fullName(action.user.first_name, action.user.last_name)}`}
          description={
            action.user.account_type === "club"
              ? "این حساب، باشگاهی که مدیرش است و همهٔ اطلاعات باشگاه (اعضا، پلن‌ها، پرداخت‌ها) به سطل زباله می‌رود و تا ۳۰ روز از «سطل زباله» قابل بازگرداندن است."
              : "این حساب و هر چه فقط مال اوست (برنامه‌ها، پیام‌ها، پرداخت‌ها و…) به سطل زباله می‌رود و تا ۳۰ روز از «سطل زباله» قابل بازگرداندن است."
          }
          confirmLabel="حذف"
          errorMessage="حذف حساب انجام نشد."
          onConfirm={async () => {
            await deleteUser(action.user.id);
            toast.success("حساب به سطل زباله رفت.");
            refresh();
          }}
        />
      )}
      {action?.kind === "suspend" && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && close()}
          title={
            action.user.is_suspended
              ? `رفع مسدودی ${fullName(action.user.first_name, action.user.last_name)}`
              : `مسدودکردن ${fullName(action.user.first_name, action.user.last_name)}`
          }
          description={
            action.user.is_suspended
              ? "کاربر دوباره می‌تواند وارد شود و از پنل استفاده کند."
              : "کاربر فوراً از همهٔ دستگاه‌ها خارج می‌شود و تا رفع مسدودی نمی‌تواند وارد شود. اطلاعاتش پاک نمی‌شود."
          }
          confirmLabel={action.user.is_suspended ? "رفع مسدودی" : "مسدودکردن"}
          errorMessage="تغییر وضعیت حساب با خطا مواجه شد."
          onConfirm={async () => {
            await setProfileSuspended(action.user.id, !action.user.is_suspended);
            toast.success(action.user.is_suspended ? "حساب فعال شد." : "حساب مسدود شد.");
            refresh();
          }}
        />
      )}
    </div>
  );
}

function RoleDialog({
  action: user,
  onClose,
  onDone,
}: {
  action: AdminUserRow | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const locked = !!user && user.link_count > 0;

  async function choose(role: AccountType | null) {
    if (!user) return;
    setSaving(true);
    try {
      await setUserRole(user.id, role);
      toast.success(role ? `نقش به «${ROLE_LABEL[role]}» تغییر کرد.` : "نقش پاک شد؛ کاربر در ورود بعدی دوباره انتخاب می‌کند.");
      onClose();
      onDone();
    } catch (error) {
      toast.error(getErrorMessage(error, "تغییر نقش با خطا مواجه شد."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!user} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>تغییر نقش {user ? fullName(user.first_name, user.last_name) : ""}</DialogTitle>
          <DialogDescription>
            {locked
              ? `این حساب به ${formatNumber(user?.link_count ?? 0)} باشگاه، عضویت یا مربی/ورزشکار وصل است و تغییر نقشش آن ارتباط‌ها را خراب می‌کند؛ برای همین قفل است.`
              : "برای حسابی که هنوز به جایی وصل نشده — مثلاً کسی که هنگام ثبت‌نام نقش اشتباه انتخاب کرده."}
          </DialogDescription>
        </DialogHeader>
        {!locked && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {ROLES.map((role) => (
              <Button
                key={role}
                variant={user?.account_type === role ? "default" : "outline"}
                disabled={saving || user?.account_type === role}
                onClick={() => choose(role)}
              >
                {ROLE_LABEL[role]}
              </Button>
            ))}
            <Button
              variant="outline"
              disabled={saving || user?.account_type === null}
              onClick={() => choose(null)}
            >
              پاک‌کردن نقش (انتخاب دوباره)
            </Button>
          </div>
        )}
        {saving && <Loader2 className="mx-auto animate-spin text-muted-foreground" />}
      </DialogContent>
    </Dialog>
  );
}

function PasswordDialog({
  action: user,
  onClose,
  onDone,
}: {
  action: AdminUserRow | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;
    if (password.length < 8) {
      toast.error("رمز عبور باید حداقل ۸ کاراکتر باشد.");
      return;
    }
    setSaving(true);
    try {
      await setUserPassword(user.id, password);
      toast.success("رمز جدید ثبت شد. آن را از راهی امن به کاربر بدهید.");
      setPassword("");
      onClose();
      onDone();
    } catch (error) {
      toast.error(getErrorMessage(error, "ثبت رمز با خطا مواجه شد."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={!!user}
      onOpenChange={(open) => {
        if (!open) {
          setPassword("");
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>رمز جدید برای {user ? fullName(user.first_name, user.last_name) : ""}</DialogTitle>
          <DialogDescription>
            برای کسی که رمزش را فراموش کرده. کاربر از همهٔ دستگاه‌ها خارج می‌شود و باید با همین رمز
            وارد شود؛ بعد می‌تواند از «تنظیمات حساب» عوضش کند.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="admin-new-password">رمز جدید (حداقل ۸ کاراکتر)</Label>
            <Input
              id="admin-new-password"
              dir="ltr"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              ثبت رمز
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
