"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listPlanAccounts } from "@/features/admin/services/plan-accounts-service";
import { getErrorMessage } from "@/lib/get-error-message";
import { formatNumber, toAsciiDigits } from "@/lib/persian";
import {
  createTrainerPlan,
  updateTrainerPlan,
  type ReportLevel,
  type TrainerPlan,
} from "../services/trainer-billing-service";

const digits = (value: string) => toAsciiDigits(value).replace(/\D+/g, "");
const optionalCap = (value: string) => (digits(value) ? Number(digits(value)) : null);
const capText = (value: number | null | undefined) => (value != null ? String(value) : "");

export const REPORT_LEVEL_LABEL: Record<ReportLevel, string> = {
  count: "فقط تعداد",
  basic: "پایه",
  full: "کامل",
  full_excel: "کامل + Excel",
};

/** Create or edit a trainer plan (the admin's catalogue, separate from the clubs'). */
export function TrainerPlanDialog({ plan }: { plan?: TrainerPlan }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(plan?.name ?? "");
  const [price, setPrice] = useState(plan ? String(plan.price_toman) : "");
  const [days, setDays] = useState(plan ? String(plan.duration_days) : "30");
  const [cap, setCap] = useState(capText(plan?.max_athletes));
  const [exercises, setExercises] = useState(capText(plan?.max_custom_exercises));
  const [templates, setTemplates] = useState(capText(plan?.max_templates));
  const [history, setHistory] = useState(capText(plan?.history_months));
  const [report, setReport] = useState<ReportLevel | "none">(plan?.report_level ?? "none");
  const [saving, setSaving] = useState(false);
  const isFree = plan?.is_free ?? false;
  // The plan-limits columns exist once the database update has run.
  const withLimits = plan ? plan.report_level !== undefined : true;

  // Before saving: how many trainers on this plan a new cap leaves above it.
  const accounts = useQuery({
    queryKey: ["admin", "plan-accounts"],
    queryFn: listPlanAccounts,
    enabled: open && !!plan,
  });
  const newCap = optionalCap(cap);
  const capChanged = !!plan && newCap !== (plan.max_athletes ?? null);
  const affected = (accounts.data?.trainers ?? []).filter((t) => {
    const l = t.limits;
    if (!plan || l.plan.id !== plan.id || l.override) return false;
    return newCap !== null && l.usage.active + l.usage.pending_invites > newCap;
  }).length;
  const onPlan = (accounts.data?.trainers ?? []).filter((t) => plan && t.limits.plan.id === plan.id).length;

  async function save() {
    const priceToman = Number(digits(price));
    const durationDays = Number(digits(days));
    if (!name.trim()) {
      toast.error("نام پلن را وارد کنید.");
      return;
    }
    if (!digits(price) || !Number.isInteger(priceToman)) {
      toast.error("قیمت را به تومان وارد کنید.");
      return;
    }
    if (!durationDays || durationDays > 3650) {
      toast.error("مدت باید بین ۱ و ۳۶۵۰ روز باشد.");
      return;
    }
    const maxAthletes = optionalCap(cap);

    setSaving(true);
    try {
      const input = {
        name: name.trim(),
        // The free plan stays free; its duration is never used.
        ...(isFree ? {} : { priceToman, durationDays }),
        maxAthletes,
        ...(withLimits
          ? {
              maxCustomExercises: optionalCap(exercises),
              maxTemplates: optionalCap(templates),
              historyMonths: optionalCap(history),
              reportLevel: report === "none" ? null : report,
            }
          : {}),
      };
      if (plan) {
        await updateTrainerPlan(plan.id, input);
        toast.success("پلن به‌روزرسانی شد.");
      } else {
        await createTrainerPlan({ ...input, priceToman, durationDays });
        toast.success("پلن ساخته شد.");
        setName("");
        setPrice("");
        setDays("30");
        setCap("");
        setExercises("");
        setTemplates("");
        setHistory("");
        setReport("none");
      }
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["admin", "trainer-plans"] });
      void queryClient.invalidateQueries({ queryKey: ["trainer-billing"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "plan-accounts"] });
    } catch (error) {
      toast.error(getErrorMessage(error, "ذخیرهٔ پلن ناموفق بود."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {plan ? (
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Pencil />
          ویرایش
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Plus />
          پلن جدید
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{plan ? (isFree ? "ویرایش پلن رایگان" : "ویرایش پلن مربی") : "پلن جدید برای مربیان"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tp-name">نام پلن</Label>
              <Input id="tp-name" maxLength={255} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tp-price">قیمت (تومان)</Label>
                <Input
                  id="tp-price"
                  dir="ltr"
                  inputMode="numeric"
                  disabled={isFree}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tp-days">مدت (روز)</Label>
                <Input
                  id="tp-days"
                  dir="ltr"
                  inputMode="numeric"
                  disabled={isFree}
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tp-cap">
                سقف ورزشکار <span className="text-muted-foreground">(خالی = نامحدود)</span>
              </Label>
              <Input
                id="tp-cap"
                dir="ltr"
                inputMode="numeric"
                className="w-32"
                value={cap}
                onChange={(e) => setCap(e.target.value)}
              />
            </div>
            {withLimits && (
              <>
                <p className="text-xs text-muted-foreground">
                  محدودیت‌های زیر فعلاً فقط ثبت می‌شوند و در فازهای بعد اعمال خواهند شد (خالی = نامحدود).
                </p>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div className="space-y-2">
                    <Label htmlFor="tp-exercises">حرکت سفارشی</Label>
                    <Input id="tp-exercises" dir="ltr" inputMode="numeric" value={exercises} onChange={(e) => setExercises(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tp-templates">قالب</Label>
                    <Input id="tp-templates" dir="ltr" inputMode="numeric" value={templates} onChange={(e) => setTemplates(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tp-history">تاریخچه (ماه)</Label>
                    <Input id="tp-history" dir="ltr" inputMode="numeric" value={history} onChange={(e) => setHistory(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tp-report">گزارش</Label>
                    <Select value={report} onValueChange={(value) => setReport(value as ReportLevel | "none")}>
                      <SelectTrigger id="tp-report" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">نامشخص</SelectItem>
                        {(Object.keys(REPORT_LEVEL_LABEL) as ReportLevel[]).map((level) => (
                          <SelectItem key={level} value={level}>
                            {REPORT_LEVEL_LABEL[level]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}
            <p className="text-xs leading-5 text-muted-foreground">
              {isFree
                ? "پلن رایگان همیشه فعال و بی‌مهلت است؛ قیمت و مدتش تغییر نمی‌کند."
                : "تغییر قیمت از خرید بعدی اعمال می‌شود؛ تغییر سقف‌ها برای همهٔ مربی‌های این پلن فوراً اعمال می‌شود."}
            </p>
            {plan && capChanged && accounts.data?.ready && (
              <p className="rounded-xl bg-info-muted px-3 py-2 text-xs leading-5 text-foreground">
                {formatNumber(onPlan)} مربی الان روی این پلن هستند.{" "}
                {affected > 0
                  ? `با سقف تازه، ${formatNumber(affected)} نفرشان بالای سقف می‌مانند: کسی حذف یا غیرفعال نمی‌شود، فقط دعوت تازه‌شان بسته می‌شود.`
                  : "با سقف تازه کسی بالای سقف نمی‌ماند."}
                {isFree && " (سقف رایگان، تعداد ورزشکاران فعال پس از پایان اشتراک‌های بعدی را هم تعیین می‌کند.)"}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              ذخیره
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
