"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
import { Switch } from "@/components/ui/switch";
import { formatNumber } from "@/lib/persian";
import { getErrorMessage } from "@/lib/get-error-message";
import type { AdminPermission } from "@/features/authentication/services/auth-context-service";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { ErrorState } from "@/features/dashboard/components/shared/error-state";
import {
  createAdminRole,
  deleteAdminRole,
  listAdminRoles,
  updateAdminRole,
  type AdminRoleRow,
  type PermissionInfo,
} from "../services/admin-security-service";

const QUERY_KEY = ["admin", "roles"] as const;

export function AdminRolesPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({ queryKey: QUERY_KEY, queryFn: listAdminRoles });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  const [editing, setEditing] = useState<AdminRoleRow | "new" | null>(null);
  const [deleting, setDeleting] = useState<AdminRoleRow | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">نقش‌های مدیریتی</h1>
          <p className="text-sm text-muted-foreground">
            برای کسانی که باید بخشی از پنل را ببینند ولی نه همه‌اش، نقش بسازید — مثلاً «پشتیبان» که
            فقط کاربران را مدیریت کند. نقش را از صفحهٔ «همهٔ کاربران» ← «دسترسی مدیریت» به افراد
            بدهید. نقش‌ها، امنیت، کلیدهای پیامک و ایمیل، دیتابیس و نسخهٔ پشتیبان همیشه فقط دست مدیر کل
            است.
          </p>
        </div>
        {data?.ready && (
          <Button onClick={() => setEditing("new")}>
            <Plus />
            نقش جدید
          </Button>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="h-48 rounded-2xl" />
      ) : isError || !data ? (
        <ErrorState message="دریافت نقش‌ها با خطا مواجه شد." />
      ) : !data.ready ? (
        <Card className="py-8">
          <div className="px-6">
            <EmptyState
              icon={KeyRound}
              title="نقش‌های مدیریتی هنوز فعال نیست."
              description="به‌روزرسانی «نقش‌های مدیریتی، قفل ورود و ورود دومرحله‌ای (فاز ۵)» را از صفحهٔ «به‌روزرسانی دیتابیس» اجرا کنید."
            />
          </div>
        </Card>
      ) : data.roles.length === 0 ? (
        <Card className="py-8">
          <div className="px-6">
            <EmptyState
              icon={KeyRound}
              title="هنوز نقشی ساخته نشده است."
              description="با «نقش جدید» اولین نقش را بسازید."
            />
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {data.roles.map((role) => (
            <Card key={role.id} className="gap-3 py-4">
              <div className="flex items-start gap-3 px-5">
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-base">{role.name}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {role.members.length === 0
                      ? "هنوز به کسی داده نشده"
                      : `${formatNumber(role.members.length)} نفر: ${role.members.map((m) => m.name).join("، ")}`}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setEditing(role)}>
                  <Pencil />
                  ویرایش
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  disabled={role.members.length > 0}
                  title={role.members.length > 0 ? "اول نقش را از افرادی که دارند بگیرید." : undefined}
                  onClick={() => setDeleting(role)}
                  aria-label={`حذف ${role.name}`}
                >
                  <Trash2 />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5 px-5">
                {role.permissions.map((key) => (
                  <Badge key={key} variant="secondary">
                    {data.catalog.find((p) => p.key === key)?.label ?? key}
                  </Badge>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {data && (
        <RoleDialog
          key={editing === "new" ? "new" : (editing?.id ?? "closed")}
          role={editing}
          catalog={data.catalog}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`حذف نقش «${deleting?.name ?? ""}»`}
        description="این نقش برای همیشه حذف می‌شود."
        confirmLabel="حذف"
        errorMessage="حذف نقش ناموفق بود."
        onConfirm={async () => {
          if (!deleting) return;
          await deleteAdminRole(deleting.id);
          toast.success("نقش حذف شد.");
          refresh();
        }}
      />
    </div>
  );
}

function RoleDialog({
  role,
  catalog,
  onClose,
  onSaved,
}: {
  role: AdminRoleRow | "new" | null;
  catalog: PermissionInfo[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const existing = role && role !== "new" ? role : null;
  const [name, setName] = useState(existing?.name ?? "");
  const [permissions, setPermissions] = useState<AdminPermission[]>(existing?.permissions ?? []);
  const [saving, setSaving] = useState(false);

  function toggle(key: AdminPermission, on: boolean) {
    setPermissions((current) => {
      let next = on ? [...current, key] : current.filter((p) => p !== key);
      // Managing users without seeing them makes no sense; the API adds it too.
      if (key === "users.manage" && on && !next.includes("users.view")) next = [...next, "users.view"];
      if (key === "users.view" && !on) next = next.filter((p) => p !== "users.manage");
      return next;
    });
  }

  async function save() {
    if (!name.trim()) {
      toast.error("نام نقش را وارد کنید.");
      return;
    }
    if (permissions.length === 0) {
      toast.error("دست‌کم یک دسترسی انتخاب کنید.");
      return;
    }
    setSaving(true);
    try {
      if (existing) {
        await updateAdminRole(existing.id, name.trim(), permissions);
      } else {
        await createAdminRole(name.trim(), permissions);
      }
      toast.success("نقش ذخیره شد.");
      onClose();
      onSaved();
    } catch (error) {
      toast.error(getErrorMessage(error, "ذخیرهٔ نقش ناموفق بود."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!role} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? `ویرایش نقش «${existing.name}»` : "نقش جدید"}</DialogTitle>
          <DialogDescription>
            {existing && existing.members.length > 0
              ? "تغییر دسترسی‌ها برای همهٔ کسانی که این نقش را دارند، از درخواست بعدی‌شان اعمال می‌شود."
              : "هر دسترسی بخش‌هایی از پنل را باز می‌کند."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="role-name">نام نقش</Label>
            <Input
              id="role-name"
              value={name}
              maxLength={100}
              placeholder="مثلاً: پشتیبان، حسابدار، ویراستار محتوا"
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            {catalog.map((permission) => (
              <label
                key={permission.key}
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 hover:bg-muted/50"
              >
                <Switch
                  checked={permissions.includes(permission.key)}
                  onCheckedChange={(on) => toggle(permission.key, on)}
                  className="mt-0.5"
                />
                <span className="space-y-0.5">
                  <span className="block text-sm font-medium text-foreground">{permission.label}</span>
                  <span className="block text-xs leading-5 text-muted-foreground">{permission.description}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="animate-spin" />}
            ذخیره
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
