"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, TicketPercent, Trash2 } from "lucide-react";
import { toast } from "sonner";

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
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getErrorMessage } from "@/lib/get-error-message";
import { toIsoDate } from "@/lib/iso-date";
import { formatNumber, formatPersianDate, formatToman, parseLocaleNumber, toAsciiDigits } from "@/lib/persian";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { ErrorState } from "@/features/dashboard/components/shared/error-state";
import type { DiscountCodeInput, DiscountCodeRow, DiscountKind } from "../services/admin-billing-service";

const ANY_PLAN = "__any__";

type PlanOption = { id: string; name: string; price_toman: number; is_active: boolean };

/** What differs between the club codes and the trainer codes. */
export interface DiscountManagerConfig {
  queryKey: readonly string[];
  load: () => Promise<{ ready: boolean; items: DiscountCodeRow[]; plans: PlanOption[] }>;
  create: (input: DiscountCodeInput) => Promise<unknown>;
  update: (id: string, input: DiscountCodeInput) => Promise<unknown>;
  remove: (id: string) => Promise<unknown>;
  /** The switch in the dialog, and the line under a code that has the rule. */
  onceLabel: string;
  onceBadge: string;
  /** Shown while the database update for the codes has not been run. */
  notReady: string;
  emptyText: string;
  /** Codes that are not tied to a plan (a trainer's): hides the plan choice. */
  hidePlanScope?: boolean;
  /** Highest percent a code may give; 100 (the default) for the platform's own, 99 where a code may not make it free. */
  maxPercent?: number;
}

function describe(code: Pick<DiscountCodeRow, "kind" | "value">): string {
  return code.kind === "percent" ? `${formatNumber(code.value)}٪` : `${formatToman(code.value)} تومان`;
}

/** Why a code would currently be refused, or null if clubs can use it. */
function unusableReason(code: DiscountCodeRow): string | null {
  if (!code.is_active) return "غیرفعال";
  if (code.expires_at && new Date(code.expires_at).getTime() <= Date.now()) return "منقضی";
  if (code.max_uses != null && code.uses >= code.max_uses) return "ظرفیت تمام";
  return null;
}

export function DiscountCodesManager({ config }: { config: DiscountManagerConfig }) {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({ queryKey: config.queryKey, queryFn: config.load });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: config.queryKey });
  const [editing, setEditing] = useState<DiscountCodeRow | "new" | null>(null);
  const [deleting, setDeleting] = useState<DiscountCodeRow | null>(null);

  return (
    <div className="space-y-6">
      {data?.ready && (
        <div className="flex justify-end">
          <Button onClick={() => setEditing("new")}>
            <Plus />
            کد جدید
          </Button>
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-48 rounded-2xl" />
      ) : isError || !data ? (
        <ErrorState message="دریافت کدهای تخفیف با خطا مواجه شد." />
      ) : !data.ready ? (
        <Card className="py-8">
          <div className="px-6">
            <EmptyState icon={TicketPercent} title="کد تخفیف هنوز فعال نیست." description={config.notReady} />
          </div>
        </Card>
      ) : data.items.length === 0 ? (
        <Card className="py-8">
          <div className="px-6">
            <EmptyState icon={TicketPercent} title="هنوز کد تخفیفی نساخته‌اید." description={config.emptyText} />
          </div>
        </Card>
      ) : (
        <Card className="gap-4 py-5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>کد</TableHead>
                <TableHead>تخفیف</TableHead>
                <TableHead>پلن</TableHead>
                <TableHead>استفاده</TableHead>
                <TableHead>انقضا</TableHead>
                <TableHead>وضعیت</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((code) => {
                const reason = unusableReason(code);
                return (
                  <TableRow key={code.id}>
                    <TableCell>
                      <span dir="ltr" className="font-mono font-medium text-foreground">
                        {code.code}
                      </span>
                      {code.note && <p className="max-w-48 truncate text-xs text-muted-foreground">{code.note}</p>}
                    </TableCell>
                    <TableCell className="text-foreground">{describe(code)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {code.plan_name ?? "همهٔ پلن‌ها"}
                      {code.once_per_club && <p className="text-xs">{config.onceBadge}</p>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatNumber(code.uses)}
                      {code.max_uses != null ? ` از ${formatNumber(code.max_uses)}` : ""}
                      {code.total_discount > 0 && (
                        <p className="text-xs">{formatToman(code.total_discount)} تومان تخفیف</p>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {code.expires_at ? formatPersianDate(new Date(code.expires_at)) : "ندارد"}
                    </TableCell>
                    <TableCell>
                      {reason ? <Badge variant="secondary">{reason}</Badge> : <Badge variant="success">قابل استفاده</Badge>}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="outline" onClick={() => setEditing(code)}>
                          <Pencil />
                          ویرایش
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => setDeleting(code)}
                          aria-label={`حذف ${code.code}`}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {data?.ready && (
        <DiscountDialog
          key={editing === "new" ? "new" : (editing?.id ?? "closed")}
          code={editing}
          config={config}
          plans={data.plans}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`حذف کد «${deleting?.code ?? ""}»`}
        description="کدی که در درخواست پرداختی استفاده شده حذف نمی‌شود (سابقه‌اش باید بماند)؛ آن را غیرفعال کنید."
        confirmLabel="حذف"
        errorMessage="حذف کد ناموفق بود."
        onConfirm={async () => {
          if (!deleting) return;
          await config.remove(deleting.id);
          toast.success("کد تخفیف حذف شد.");
          refresh();
        }}
      />
    </div>
  );
}

function DiscountDialog({
  code,
  config,
  plans,
  onClose,
  onSaved,
}: {
  code: DiscountCodeRow | "new" | null;
  config: DiscountManagerConfig;
  plans: PlanOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const existing = code && code !== "new" ? code : null;
  const maxPercent = config.maxPercent ?? 100;
  const [text, setText] = useState(existing?.code ?? "");
  const [kind, setKind] = useState<DiscountKind>(existing?.kind ?? "percent");
  const [value, setValue] = useState(existing ? String(existing.value) : "");
  const [planId, setPlanId] = useState(existing?.plan_id ?? ANY_PLAN);
  const [maxUses, setMaxUses] = useState(existing?.max_uses != null ? String(existing.max_uses) : "");
  const [oncePerClub, setOncePerClub] = useState(existing?.once_per_club ?? false);
  const [hasExpiry, setHasExpiry] = useState(!!existing?.expires_at);
  const [expiresAt, setExpiresAt] = useState(
    existing?.expires_at ? existing.expires_at.slice(0, 10) : toIsoDate(new Date(Date.now() + 30 * 86_400_000))
  );
  const [isActive, setIsActive] = useState(existing?.is_active ?? true);
  const [note, setNote] = useState(existing?.note ?? "");
  const [saving, setSaving] = useState(false);

  const numericValue = parseLocaleNumber(value);
  const samplePlan = plans.find((p) => p.id === planId) ?? plans.find((p) => p.is_active);
  const sample =
    samplePlan && numericValue && numericValue > 0
      ? Math.max(
          0,
          samplePlan.price_toman -
            (kind === "percent"
              ? Math.floor((samplePlan.price_toman * Math.min(100, numericValue)) / 100)
              : numericValue)
        )
      : null;

  async function save() {
    const normalized = toAsciiDigits(text).replace(/\s+/g, "").toUpperCase();
    if (!/^[A-Z0-9_-]{3,40}$/.test(normalized)) {
      toast.error("کد باید ۳ تا ۴۰ حرف انگلیسی، عدد، - یا _ باشد.");
      return;
    }
    if (numericValue === null || !Number.isInteger(numericValue) || numericValue < 1 || (kind === "percent" && numericValue > maxPercent)) {
      toast.error(
        kind === "percent" ? `درصد تخفیف باید بین ۱ و ${formatNumber(maxPercent)} باشد.` : "مبلغ تخفیف را وارد کنید."
      );
      return;
    }
    const uses = maxUses.trim() === "" ? null : parseLocaleNumber(maxUses);
    if (uses !== null && (!Number.isInteger(uses) || uses < 1)) {
      toast.error("سقف استفاده باید عددی مثبت باشد، یا خالی برای نامحدود.");
      return;
    }

    const input: DiscountCodeInput = {
      code: normalized,
      kind,
      value: numericValue,
      plan_id: planId === ANY_PLAN ? null : planId,
      max_uses: uses,
      once_per_club: oncePerClub,
      expires_at: hasExpiry ? expiresAt : null,
      is_active: isActive,
      note: note.trim(),
    };

    setSaving(true);
    try {
      if (existing) {
        await config.update(existing.id, input);
      } else {
        await config.create(input);
      }
      toast.success("کد تخفیف ذخیره شد.");
      onClose();
      onSaved();
    } catch (error) {
      toast.error(getErrorMessage(error, "ذخیرهٔ کد تخفیف ناموفق بود."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!code} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? `ویرایش کد «${existing.code}»` : "کد تخفیف جدید"}</DialogTitle>
          {existing && existing.uses > 0 && (
            <DialogDescription>
              این کد تا حالا {formatNumber(existing.uses)} بار استفاده شده. تغییرها روی درخواست‌های
              قبلی اثری ندارند.
            </DialogDescription>
          )}
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="discount-code">کد</Label>
            <Input
              id="discount-code"
              dir="ltr"
              value={text}
              maxLength={40}
              placeholder="NOROOZ1405"
              className="font-mono uppercase"
              onChange={(e) => setText(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">حروف بزرگ و کوچک فرقی ندارند.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>نوع تخفیف</Label>
              <Select value={kind} onValueChange={(next) => setKind(next as DiscountKind)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">درصدی</SelectItem>
                  <SelectItem value="amount">مبلغ ثابت</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="discount-value">{kind === "percent" ? "درصد" : "مبلغ (تومان)"}</Label>
              <Input
                id="discount-value"
                dir="ltr"
                inputMode="numeric"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
          </div>

          {!config.hidePlanScope && (
          <div className="space-y-2">
            <Label>برای پلن</Label>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY_PLAN}>همهٔ پلن‌ها</SelectItem>
                {plans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                    {!p.is_active && " (غیرفعال)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {sample !== null && samplePlan && (
              <p className="text-xs text-muted-foreground">
                مثلاً «{samplePlan.name}»: {formatToman(samplePlan.price_toman)} ← {formatToman(sample)} تومان
              </p>
            )}
          </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="discount-max-uses">
              سقف کل استفاده <span className="text-muted-foreground">(خالی = نامحدود)</span>
            </Label>
            <Input
              id="discount-max-uses"
              dir="ltr"
              inputMode="numeric"
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
            />
          </div>

          <label className="flex cursor-pointer items-center gap-3 text-sm">
            <Switch checked={oncePerClub} onCheckedChange={setOncePerClub} />
            {config.onceLabel}
          </label>

          <label className="flex cursor-pointer items-center gap-3 text-sm">
            <Switch checked={hasExpiry} onCheckedChange={setHasExpiry} />
            تاریخ انقضا دارد
          </label>
          {hasExpiry && (
            <JalaliDateField
              id="discount-expires"
              label="قابل استفاده تا پایان روز"
              value={expiresAt}
              onChange={setExpiresAt}
              pastYears={1}
              futureYears={3}
            />
          )}

          <div className="space-y-2">
            <Label htmlFor="discount-note">
              یادداشت <span className="text-muted-foreground">(اختیاری، فقط برای شما)</span>
            </Label>
            <Input
              id="discount-note"
              value={note}
              maxLength={255}
              placeholder="مثلاً: جشنوارهٔ نوروز"
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <label className="flex cursor-pointer items-center gap-3 text-sm">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            فعال
          </label>
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
