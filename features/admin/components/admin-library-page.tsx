"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, DatabaseZap, Search, Share2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fullName } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/persian";
import { getErrorMessage } from "@/lib/get-error-message";
import { useDebouncedCallback } from "@/lib/use-debounced-callback";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { formatFoodCalories } from "@/features/foods/utils/food-macros";
import { ErrorState } from "@/features/dashboard/components/shared/error-state";
import {
  deleteLibraryEntry,
  listAdminLibrary,
  publishLibraryEntry,
  updateLibraryEntry,
  type AdminLibraryEntry,
  type LibraryKind,
  type LibraryScope,
} from "../services/admin-library-service";
import { KIND_LABEL, LibraryEntryDialog } from "./library-entry-dialog";
import { ExerciseMediaDialog } from "./exercise-media-dialog";

const KIND_TABS: { value: LibraryKind; label: string }[] = [
  { value: "exercises", label: "حرکات" },
  { value: "foods", label: "غذاها" },
  { value: "supplements", label: "مکمل‌ها" },
];

function details(kind: LibraryKind, entry: AdminLibraryEntry): string {
  if (kind === "exercises") return entry.muscle_group ?? "";
  if (kind === "foods") {
    const kcal = formatFoodCalories({
      caloriesPerUnit: entry.calories_per_unit ?? null,
      proteinG: entry.protein_g ?? null,
      carbsG: entry.carbs_g ?? null,
      fatG: entry.fat_g ?? null,
      defaultUnit: entry.default_unit ?? "",
    });
    return `${entry.category} · ${kcal ?? "بدون ارزش غذایی"}`;
  }
  return entry.description ?? "";
}

export function AdminLibraryPage() {
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<LibraryKind>("exercises");
  const [scope, setScope] = useState<LibraryScope>("public");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const applySearch = useDebouncedCallback((value: string) => setQ(value.trim()), 350);

  const queryKey = ["admin", "library", kind, scope, q] as const;
  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () => listAdminLibrary(kind, scope, q),
    placeholderData: (previous) => previous,
  });

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["admin", "library"] });

  const suggestions = useMemo(() => {
    const values = (data?.items ?? [])
      .map((entry) => (kind === "exercises" ? entry.muscle_group : entry.category))
      .filter((value): value is string => !!value);
    return [...new Set(values)].sort();
  }, [data, kind]);

  const rows = data?.items ?? [];
  const label = KIND_LABEL[kind];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">کتابخانه‌ها</h1>
          <p className="text-sm text-muted-foreground">
            بانک عمومی حرکات، غذاها و مکمل‌ها که همهٔ مربی‌ها می‌بینند. موردی را که در برنامه‌ها
            استفاده شده نمی‌شود حذف کرد، اما می‌شود پنهانش کرد تا دیگر در فهرست مربی‌ها نیاید.
          </p>
        </div>
        {scope === "public" && (
          <LibraryEntryDialog kind={kind} suggestions={suggestions} onSaved={refresh} />
        )}
      </div>

      {data && !data.hide_ready && (
        <div className="flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning-muted px-4 py-3 text-sm text-warning">
          <DatabaseZap className="mt-0.5 size-5 shrink-0" />
          <p className="leading-6">
            پنهان‌کردن هنوز فعال نیست: دستور{" "}
            <code dir="ltr">backend-php/schema/library-hidden-update.sql</code> را در phpMyAdmin
            اجرا کنید. افزودن، ویرایش و حذف همین حالا کار می‌کند.
          </p>
        </div>
      )}

      <Card className="gap-4 py-5">
        <div className="flex flex-col gap-3 px-6 lg:flex-row lg:items-center lg:justify-between">
          <Tabs value={kind} onValueChange={(value) => setKind(value as LibraryKind)}>
            <TabsList>
              {KIND_TABS.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Tabs value={scope} onValueChange={(value) => setScope(value as LibraryScope)}>
              <TabsList>
                <TabsTrigger value="public">
                  بانک عمومی
                  {data && <Badge variant="secondary">{formatNumber(data.public_count)}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="custom">
                  افزوده‌های مربی‌ها
                  {data && <Badge variant="secondary">{formatNumber(data.custom_count)}</Badge>}
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative">
              <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  applySearch(e.target.value);
                }}
                placeholder={`جستجوی ${label}...`}
                className="pr-9 sm:w-56"
              />
            </div>
          </div>
        </div>

        {scope === "custom" && (
          <p className="px-6 text-xs text-muted-foreground">
            این‌ها را هر مربی فقط برای خودش ساخته است. با «انتقال به بانک عمومی» یک مورد خوب را
            برای همهٔ مربی‌ها در دسترس کنید.
          </p>
        )}

        {isLoading ? (
          <div className="space-y-2 px-6">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        ) : isError || !data ? (
          <ErrorState message="دریافت کتابخانه با خطا مواجه شد." />
        ) : rows.length === 0 ? (
          <div className="px-6">
            <EmptyState
              icon={BookOpen}
              title={q ? "موردی با این نام پیدا نشد." : "این فهرست خالی است."}
              description={
                scope === "public"
                  ? `با دکمهٔ «${label} جدید» به بانک عمومی اضافه کنید.`
                  : "هنوز هیچ مربی موردی برای خودش نساخته است."
              }
            />
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>نام</TableHead>
                  <TableHead>جزئیات</TableHead>
                  {scope === "custom" && <TableHead>سازنده</TableHead>}
                  <TableHead>در برنامه‌ها</TableHead>
                  <TableHead>پنهان</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((entry) => (
                  <LibraryRow
                    key={entry.id}
                    kind={kind}
                    scope={scope}
                    entry={entry}
                    hideReady={data.hide_ready}
                    suggestions={suggestions}
                    onChanged={refresh}
                  />
                ))}
              </TableBody>
            </Table>
            {rows.length >= 500 && (
              <p className="px-6 text-xs text-muted-foreground">
                فقط ۵۰۰ مورد اول نشان داده شده؛ برای دیدن بقیه جستجو کنید.
              </p>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

function LibraryRow({
  kind,
  scope,
  entry,
  hideReady,
  suggestions,
  onChanged,
}: {
  kind: LibraryKind;
  scope: LibraryScope;
  entry: AdminLibraryEntry;
  hideReady: boolean;
  suggestions: string[];
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const inUse = entry.plan_usage > 0;

  async function toggleHidden(hidden: boolean) {
    setBusy(true);
    try {
      await updateLibraryEntry(kind, entry.id, { is_hidden: hidden });
      toast.success(hidden ? `«${entry.name}» از فهرست مربی‌ها پنهان شد.` : `«${entry.name}» دوباره نمایش داده می‌شود.`);
      onChanged();
    } catch (error) {
      toast.error(getErrorMessage(error, "تغییر وضعیت با خطا مواجه شد."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <TableRow className={cn(entry.is_hidden && "opacity-60")}>
      <TableCell>
        <p className="font-medium text-foreground">{entry.name}</p>
        {entry.name_en && (
          <p dir="ltr" className="text-right text-xs text-muted-foreground">
            {entry.name_en}
          </p>
        )}
      </TableCell>
      <TableCell className="max-w-64 truncate text-sm text-muted-foreground">
        {details(kind, entry) || "—"}
      </TableCell>
      {scope === "custom" && (
        <TableCell className="text-sm text-muted-foreground">
          {fullName(entry.creator_first_name, entry.creator_last_name)}
        </TableCell>
      )}
      <TableCell className="text-sm text-muted-foreground">
        {inUse ? `${formatNumber(entry.plan_usage)} بار` : "استفاده نشده"}
      </TableCell>
      <TableCell>
        <Switch
          checked={entry.is_hidden}
          disabled={busy || !hideReady}
          onCheckedChange={toggleHidden}
          aria-label={`پنهان‌کردن ${entry.name}`}
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-2">
          {scope === "custom" && (
            <Button size="sm" variant="outline" onClick={() => setConfirmPublish(true)}>
              <Share2 />
              انتقال به بانک عمومی
            </Button>
          )}
          {kind === "exercises" && "video_url" in entry && <ExerciseMediaDialog entry={entry} onSaved={onChanged} />}
          <LibraryEntryDialog kind={kind} entry={entry} suggestions={suggestions} onSaved={onChanged} />
          <Button
            size="sm"
            variant="outline"
            className="text-destructive"
            disabled={inUse}
            title={inUse ? "در برنامه‌ها استفاده شده؛ به‌جای حذف پنهانش کنید." : undefined}
            onClick={() => setConfirmDelete(true)}
            aria-label={`حذف ${entry.name}`}
          >
            <Trash2 />
          </Button>
        </div>

        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={`حذف «${entry.name}»`}
          description="این مورد برای همیشه حذف می‌شود و قابل برگشت نیست."
          confirmLabel="حذف"
          errorMessage="حذف با خطا مواجه شد."
          onConfirm={async () => {
            await deleteLibraryEntry(kind, entry.id);
            toast.success("حذف شد.");
            onChanged();
          }}
        />
        <ConfirmDialog
          open={confirmPublish}
          onOpenChange={setConfirmPublish}
          title={`انتقال «${entry.name}» به بانک عمومی`}
          description="بعد از انتقال، همهٔ مربی‌ها این مورد را در کتابخانه‌شان می‌بینند و دیگر فقط متعلق به سازنده‌اش نیست."
          confirmLabel="انتقال"
          errorMessage="انتقال با خطا مواجه شد."
          onConfirm={async () => {
            await publishLibraryEntry(kind, entry.id);
            toast.success("به بانک عمومی منتقل شد.");
            onChanged();
          }}
        />
      </TableCell>
    </TableRow>
  );
}
