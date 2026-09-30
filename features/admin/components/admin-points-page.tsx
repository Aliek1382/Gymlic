"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Medal, Plus, Save, Trash2, Trophy } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fullName } from "@/lib/api/client";
import { formatNumber, formatRelativeTime, parseLocaleNumber } from "@/lib/persian";
import { getErrorMessage } from "@/lib/get-error-message";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { ErrorState } from "@/features/dashboard/components/shared/error-state";
import {
  adjustCoachPoints,
  getAdminPoints,
  savePointLevels,
  updatePointRule,
  type PointLevel,
  type PointRule,
  type PointsLeader,
} from "../services/admin-points-service";
import { SettingsStorageNotice } from "./settings-storage-notice";

const QUERY_KEY = ["admin", "points"] as const;

export function AdminPointsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({ queryKey: QUERY_KEY, queryFn: getAdminPoints });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: QUERY_KEY });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">امتیاز مربیان</h1>
        <p className="text-sm text-muted-foreground">
          برای هر کاری که مربی در پنل انجام می‌دهد چند امتیاز بگیرد، سطح‌ها از چه امتیازی شروع شوند،
          و رتبه‌بندی مربیان. تغییر امتیاز یک قانون فقط روی امتیازهای بعدی اثر دارد، نه گذشته.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      ) : isError || !data ? (
        <ErrorState message="دریافت اطلاعات امتیاز با خطا مواجه شد." />
      ) : (
        <>
          {!data.levels_ready && <SettingsStorageNotice />}
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
            <RulesCard rules={data.rules} onChanged={refresh} />
            <LevelsCard
              key={JSON.stringify(data.levels)}
              initial={data.levels}
              locked={!data.levels_ready}
              onSaved={refresh}
            />
          </div>
          <LeaderboardCard leaders={data.leaderboard} onChanged={refresh} />
        </>
      )}
    </div>
  );
}

function RulesCard({ rules, onChanged }: { rules: PointRule[]; onChanged: () => void }) {
  return (
    <Card className="gap-4 py-5">
      <div className="space-y-1 px-6">
        <CardTitle className="text-base">قوانین امتیاز</CardTitle>
        <CardDescription className="text-xs leading-5">
          اینکه کدام کارها امتیاز دارند در کد تعریف شده؛ اینجا عنوان، مقدار و روشن‌بودن هرکدام را
          تنظیم می‌کنید.
        </CardDescription>
      </div>
      {rules.length === 0 ? (
        <p className="px-6 text-sm text-muted-foreground">
          قانونی در جدول point_rules نیست. دستور points-update.sql اجرا شده است؟
        </p>
      ) : (
        <div className="space-y-3 px-6">
          {rules.map((rule) => (
            <RuleRow key={`${rule.action_type}:${rule.label}:${rule.points}`} rule={rule} onChanged={onChanged} />
          ))}
        </div>
      )}
    </Card>
  );
}

function RuleRow({ rule, onChanged }: { rule: PointRule; onChanged: () => void }) {
  const [label, setLabel] = useState(rule.label);
  const [points, setPoints] = useState(String(rule.points));
  const [busy, setBusy] = useState(false);
  const dirty = label.trim() !== rule.label || parseLocaleNumber(points) !== rule.points;

  async function save(input: Parameters<typeof updatePointRule>[1], message: string) {
    setBusy(true);
    try {
      await updatePointRule(rule.action_type, input);
      toast.success(message);
      onChanged();
    } catch (error) {
      toast.error(getErrorMessage(error, "ذخیرهٔ قانون با خطا مواجه شد."));
    } finally {
      setBusy(false);
    }
  }

  function submit() {
    const value = parseLocaleNumber(points);
    if (value === null || !Number.isInteger(value) || value < 1) {
      toast.error("امتیاز باید عدد صحیح مثبت باشد.");
      return;
    }
    void save({ label: label.trim(), points: value }, "قانون ذخیره شد.");
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border p-3 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1 space-y-1">
        <Input value={label} onChange={(e) => setLabel(e.target.value)} aria-label="عنوان قانون" />
        <p dir="ltr" className="text-right text-[11px] text-muted-foreground">
          {rule.action_type}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Input
          value={points}
          onChange={(e) => setPoints(e.target.value)}
          dir="ltr"
          inputMode="numeric"
          className="w-20 text-center"
          aria-label="امتیاز"
        />
        <span className="text-xs text-muted-foreground">امتیاز</span>
        <Button size="sm" variant="outline" disabled={!dirty || busy} onClick={submit} aria-label="ذخیره">
          {busy ? <Loader2 className="animate-spin" /> : <Save />}
        </Button>
        <Switch
          checked={rule.is_active}
          disabled={busy}
          aria-label="فعال"
          onCheckedChange={(checked) =>
            void save(
              { is_active: checked },
              checked ? `«${rule.label}» دوباره امتیاز می‌دهد.` : `«${rule.label}» دیگر امتیاز نمی‌دهد.`
            )
          }
        />
      </div>
    </div>
  );
}

interface LevelDraft {
  name: string;
  min: string;
}

function LevelsCard({
  initial,
  locked,
  onSaved,
}: {
  initial: PointLevel[];
  locked: boolean;
  onSaved: () => void;
}) {
  const [levels, setLevels] = useState<LevelDraft[]>(() =>
    initial.map((level) => ({ name: level.name, min: String(level.min_points) }))
  );
  const [saving, setSaving] = useState(false);

  function update(index: number, changes: Partial<LevelDraft>) {
    setLevels((current) => current.map((level, i) => (i === index ? { ...level, ...changes } : level)));
  }

  async function save() {
    const parsed: PointLevel[] = [];
    for (const [index, level] of levels.entries()) {
      const min = index === 0 ? 0 : parseLocaleNumber(level.min);
      if (!level.name.trim()) {
        toast.error("همهٔ سطح‌ها باید نام داشته باشند.");
        return;
      }
      if (min === null || !Number.isInteger(min) || min < 0) {
        toast.error(`حداقل امتیاز سطح «${level.name}» باید عدد صحیح باشد.`);
        return;
      }
      parsed.push({ name: level.name.trim(), min_points: min });
    }
    const mins = parsed.map((level) => level.min_points);
    if (new Set(mins).size !== mins.length) {
      toast.error("دو سطح نمی‌توانند حداقل امتیاز یکسان داشته باشند.");
      return;
    }

    setSaving(true);
    try {
      await savePointLevels(parsed);
      toast.success("سطح‌ها ذخیره شد.");
      onSaved();
    } catch (error) {
      toast.error(getErrorMessage(error, "ذخیرهٔ سطح‌ها با خطا مواجه شد."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="gap-4 py-5">
      <div className="space-y-1 px-6">
        <CardTitle className="text-base">سطح‌ها</CardTitle>
        <CardDescription className="text-xs leading-5">
          مربی به بالاترین سطحی می‌رسد که حداقل امتیازش را دارد. سطح اول همیشه از صفر شروع می‌شود؛
          ترتیب را خود سیستم بر اساس امتیاز مرتب می‌کند.
        </CardDescription>
      </div>
      <div className="space-y-2 px-6">
        {levels.map((level, index) => (
          <div key={index} className="flex items-center gap-2">
            <Medal className="size-4 shrink-0 text-muted-foreground" />
            <Input
              value={level.name}
              maxLength={50}
              onChange={(e) => update(index, { name: e.target.value })}
              placeholder="نام سطح"
              aria-label="نام سطح"
            />
            <Input
              value={index === 0 ? "0" : level.min}
              disabled={index === 0}
              onChange={(e) => update(index, { min: e.target.value })}
              dir="ltr"
              inputMode="numeric"
              className="w-28 text-center"
              aria-label="حداقل امتیاز"
            />
            <Button
              size="sm"
              variant="ghost"
              disabled={levels.length <= 1}
              onClick={() => setLevels((current) => current.filter((_, i) => i !== index))}
              aria-label="حذف سطح"
            >
              <Trash2 />
            </Button>
          </div>
        ))}
      </div>
      <div className="flex justify-between gap-2 border-t border-border px-6 pt-4">
        <Button
          variant="outline"
          disabled={levels.length >= 20}
          onClick={() => setLevels((current) => [...current, { name: "", min: "" }])}
        >
          <Plus />
          سطح جدید
        </Button>
        <Button onClick={save} disabled={saving || locked}>
          {saving && <Loader2 className="animate-spin" />}
          ذخیره
        </Button>
      </div>
    </Card>
  );
}

function LeaderboardCard({ leaders, onChanged }: { leaders: PointsLeader[]; onChanged: () => void }) {
  const [target, setTarget] = useState<PointsLeader | null>(null);

  return (
    <Card className="gap-4 py-5">
      <div className="space-y-1 px-6">
        <CardTitle className="text-base">رتبه‌بندی مربیان</CardTitle>
        <CardDescription className="text-xs">
          ۱۰۰ مربی اول بر اساس مجموع امتیاز. با «امتیاز دستی» می‌توانید به مربی امتیاز بدهید یا از
          او کم کنید؛ در تاریخچهٔ امتیازش با عنوان «امتیاز از طرف مدیریت» ثبت می‌شود.
        </CardDescription>
      </div>
      {leaders.length === 0 ? (
        <div className="px-6">
          <EmptyState icon={Trophy} title="هنوز مربی‌ای ثبت‌نام نکرده است." description="" />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>رتبه</TableHead>
              <TableHead>مربی</TableHead>
              <TableHead>سطح</TableHead>
              <TableHead>امتیاز</TableHead>
              <TableHead>آخرین امتیاز</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {leaders.map((leader, index) => {
              const name = fullName(leader.first_name, leader.last_name);
              return (
                <TableRow key={leader.id}>
                  <TableCell className="text-muted-foreground">{formatNumber(index + 1)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="size-8">
                        {leader.avatar_url && <AvatarImage src={leader.avatar_url} alt={name} />}
                        <AvatarFallback>{name.slice(0, 2)}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-foreground">{name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="info">{leader.level}</Badge>
                  </TableCell>
                  <TableCell className="font-medium text-foreground">
                    {formatNumber(leader.total_points)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {leader.last_award_at ? formatRelativeTime(new Date(leader.last_award_at)) : "—"}
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => setTarget(leader)}>
                      امتیاز دستی
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
      <AdjustDialog target={target} onClose={() => setTarget(null)} onDone={onChanged} />
    </Card>
  );
}

function AdjustDialog({
  target,
  onClose,
  onDone,
}: {
  target: PointsLeader | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const name = target ? fullName(target.first_name, target.last_name) : "";

  async function submit(sign: 1 | -1) {
    if (!target) return;
    const value = parseLocaleNumber(amount);
    if (value === null || !Number.isInteger(value) || value <= 0) {
      toast.error("یک عدد صحیح مثبت وارد کنید.");
      return;
    }
    setSaving(true);
    try {
      await adjustCoachPoints(target.id, sign * value);
      toast.success(sign > 0 ? `${formatNumber(value)} امتیاز به ${name} داده شد.` : `${formatNumber(value)} امتیاز از ${name} کم شد.`);
      setAmount("");
      onClose();
      onDone();
    } catch (error) {
      toast.error(getErrorMessage(error, "ثبت امتیاز با خطا مواجه شد."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>امتیاز دستی برای {name}</DialogTitle>
          <DialogDescription>
            امتیاز فعلی: {target ? formatNumber(target.total_points) : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="adjust-amount">چند امتیاز؟</Label>
          <Input
            id="adjust-amount"
            dir="ltr"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="50"
          />
        </div>
        <DialogFooter>
          <Button onClick={() => submit(1)} disabled={saving}>
            {saving && <Loader2 className="animate-spin" />}
            افزودن امتیاز
          </Button>
          <Button variant="outline" className="text-destructive" onClick={() => submit(-1)} disabled={saving}>
            کم کردن امتیاز
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
