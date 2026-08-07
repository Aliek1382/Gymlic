"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Apple,
  CheckCircle2,
  ChevronLeft,
  Download,
  Dumbbell,
  Loader2,
  Pencil,
  Search,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Skeleton } from "@/components/ui/skeleton";
import { formatPersianDate } from "@/lib/persian";
import { getErrorMessage } from "@/lib/get-error-message";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { TableCardSkeleton } from "@/features/dashboard/components/shared/dashboard-skeleton";
import { useAthletes } from "../hooks/use-athletes";
import { useCompletePlan } from "../hooks/use-complete-plan";
import { usePlanPrint } from "../hooks/use-plan-print";
import { usePlans } from "../hooks/use-plans";
import { useSavePlan } from "../hooks/use-save-plan";
import {
  appendExerciseLine,
  insertExerciseLineUnderHeading,
} from "../utils/workout-plan-text";
import { planSchema, type PlanFormValues } from "../validators/athlete-schemas";
import type { PlanEntry } from "../services/athlete-service";
import type { PlanKind } from "../types/athlete-types";
import { PlanPrintArea } from "./plan-print-area";
import { WorkoutDayBuilder } from "./workout-day-builder";

type SortOrder = "newest" | "oldest";

const ICON_BY_KIND = { workout: Dumbbell, nutrition: Apple } as const;

// A finalized plan can only be edited for a few days after it was
// assigned; drafts are always editable since they were never "published".
const EDIT_WINDOW_DAYS = 4;

function canEditPlan(plan: PlanEntry): boolean {
  if (plan.status === "draft") return true;
  const assignedAt = new Date(plan.assignedAt).getTime();
  const daysSinceAssigned = (Date.now() - assignedAt) / (1000 * 60 * 60 * 24);
  return daysSinceAssigned <= EDIT_WINDOW_DAYS;
}

export function PlanBrowser({
  kind,
  trainerName,
}: {
  kind: PlanKind;
  trainerName?: string | null;
}) {
  const Icon = ICON_BY_KIND[kind];
  const athletes = useAthletes();
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [selectedAthlete, setSelectedAthlete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanEntry | null>(null);
  const [editingPlan, setEditingPlan] = useState<PlanEntry | null>(null);

  const filteredAthletes = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = (athletes.data ?? []).filter((athlete) =>
      athlete.name.toLowerCase().includes(query)
    );
    return list.sort((a, b) =>
      sortOrder === "newest"
        ? b.joinedAt.localeCompare(a.joinedAt)
        : a.joinedAt.localeCompare(b.joinedAt)
    );
  }, [athletes.data, search, sortOrder]);

  const plans = usePlans(
    kind,
    { athleteId: selectedAthlete?.id ?? "" },
    !!selectedAthlete
  );
  const savePlan = useSavePlan(kind, { athleteId: selectedAthlete?.id ?? "" });
  const completePlan = useCompletePlan(kind, {
    athleteId: selectedAthlete?.id ?? "",
  });
  const { plan: printingPlan, printPlan } = usePlanPrint();

  const editForm = useForm<PlanFormValues>({
    resolver: zodResolver(planSchema),
    defaultValues: { title: "", description: "" },
  });

  useEffect(() => {
    if (editingPlan) {
      editForm.reset({
        title: editingPlan.title,
        description: editingPlan.description ?? "",
      });
    }
  }, [editingPlan, editForm]);

  function handleInsertExerciseLine(heading: string | null, line: string) {
    const current = editForm.getValues("description") ?? "";
    const next = heading
      ? insertExerciseLineUnderHeading(current, heading, line)
      : appendExerciseLine(current, line);
    editForm.setValue("description", next, { shouldDirty: true });
  }

  async function handleComplete(planId: string) {
    try {
      await completePlan.mutateAsync(planId);
      toast.success("برنامه به‌عنوان تکمیل‌شده علامت خورد.");
    } catch (error) {
      toast.error(getErrorMessage(error, "ثبت تکمیل برنامه با خطا مواجه شد."));
    }
  }

  async function onEditSubmit(values: PlanFormValues) {
    if (!editingPlan) return;
    try {
      await savePlan.mutateAsync({
        id: editingPlan.id,
        title: values.title,
        description: values.description || null,
        status: editingPlan.status === "draft" ? "draft" : "active",
      });
      toast.success("تغییرات ذخیره شد.");
      setEditingPlan(null);
    } catch (error) {
      toast.error(getErrorMessage(error, "ذخیره تغییرات با خطا مواجه شد."));
    }
  }

  if (athletes.isLoading) {
    return <TableCardSkeleton />;
  }

  if (selectedAthlete) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => setSelectedAthlete(null)}>
          <ChevronLeft />
          بازگشت به لیست ورزشکاران
        </Button>

        <Card className="gap-4 py-5">
          <div className="px-6">
            <CardTitle className="text-base">
              برنامه‌های {selectedAthlete.name}
            </CardTitle>
          </div>
          <div className="space-y-2 px-6">
            {plans.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : !plans.data || plans.data.length === 0 ? (
              <EmptyState
                icon={Icon}
                title="هنوز برنامه‌ای ثبت نشده است."
                description="با ورود به پروفایل ورزشکار می‌توانید برنامه جدیدی برایش ثبت کنید."
              />
            ) : (
              plans.data.map((plan) => (
                <div
                  key={plan.id}
                  className="flex flex-col gap-3 rounded-xl border border-border p-4 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center"
                >
                  <button
                    type="button"
                    onClick={() => setSelectedPlan(plan)}
                    className="min-w-0 flex-1 text-right"
                  >
                    <span className="truncate font-medium text-foreground">
                      {plan.title}
                    </span>
                  </button>
                  <span className="flex flex-wrap items-center gap-2">
                    {plan.status === "draft" && (
                      <Badge variant="warning">پیش‌نویس</Badge>
                    )}
                    {plan.status === "completed" && (
                      <Badge variant="success">تکمیل‌شده</Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatPersianDate(new Date(plan.assignedAt))}
                    </span>
                    {plan.status === "active" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={completePlan.isPending}
                        onClick={() => handleComplete(plan.id)}
                      >
                        <CheckCircle2 />
                        تکمیل شد
                      </Button>
                    )}
                    {canEditPlan(plan) && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setEditingPlan(plan)}
                        aria-label="ویرایش برنامه"
                      >
                        <Pencil className="size-4" />
                      </Button>
                    )}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>

        <Dialog
          open={!!selectedPlan}
          onOpenChange={(open) => !open && setSelectedPlan(null)}
        >
          {selectedPlan && (
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{selectedPlan.title}</DialogTitle>
                <DialogDescription>
                  تخصیص داده شده در{" "}
                  {formatPersianDate(new Date(selectedPlan.assignedAt))}
                </DialogDescription>
              </DialogHeader>
              <p className="whitespace-pre-line text-sm text-foreground">
                {selectedPlan.description || "توضیحاتی برای این برنامه ثبت نشده است."}
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() =>
                  printPlan({
                    kind,
                    title: selectedPlan.title,
                    description: selectedPlan.description,
                    assignedAt: selectedPlan.assignedAt,
                    athleteName: selectedAthlete?.name,
                    trainerName: trainerName ?? undefined,
                  })
                }
              >
                <Download />
                دانلود PDF
              </Button>
            </DialogContent>
          )}
        </Dialog>

        <Dialog
          open={!!editingPlan}
          onOpenChange={(open) => !open && setEditingPlan(null)}
        >
          {editingPlan && (
            <DialogContent>
              <DialogHeader>
                <DialogTitle>ویرایش برنامه</DialogTitle>
                <DialogDescription>
                  {editingPlan.status === "draft"
                    ? "این پیش‌نویس را ویرایش کنید."
                    : `تا ${EDIT_WINDOW_DAYS} روز پس از ثبت نهایی قابل ویرایش است.`}
                </DialogDescription>
              </DialogHeader>

              <form
                onSubmit={editForm.handleSubmit(onEditSubmit)}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="edit-plan-title">عنوان برنامه</Label>
                  <Input
                    id="edit-plan-title"
                    {...editForm.register("title")}
                  />
                  {editForm.formState.errors.title && (
                    <p className="text-xs text-destructive">
                      {editForm.formState.errors.title.message}
                    </p>
                  )}
                </div>

                {kind === "workout" && (
                  <WorkoutDayBuilder onInsertLine={handleInsertExerciseLine} />
                )}

                <div className="space-y-2">
                  <Label htmlFor="edit-plan-description">
                    توضیحات (اختیاری)
                  </Label>
                  <textarea
                    id="edit-plan-description"
                    rows={kind === "workout" ? 6 : 4}
                    className="w-full rounded-xl border border-input bg-transparent px-4 py-2 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30"
                    {...editForm.register("description")}
                  />
                  {kind === "workout" && (
                    <p className="text-xs text-muted-foreground">
                      اگر درمورد سیستم انجام دادن حرکات توضیحی دارید اضافه
                      کنید، مثل انجام حرکت به شکل سوپر ست یا دراپ ست و ...
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={savePlan.isPending}
                >
                  {savePlan.isPending && <Loader2 className="animate-spin" />}
                  ذخیره تغییرات
                </Button>
              </form>
            </DialogContent>
          )}
        </Dialog>

        <PlanPrintArea plan={printingPlan} />
      </div>
    );
  }

  if ((athletes.data?.length ?? 0) === 0) {
    return (
      <Card className="py-5">
        <EmptyState
          icon={Users}
          title="هنوز ورزشکاری ثبت نشده است."
          description="ابتدا از بخش ورزشکاران، یک ورزشکار اضافه کنید."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجوی نام و نام خانوادگی ورزشکار..."
            className="pr-10"
          />
        </div>
        <Select
          value={sortOrder}
          onValueChange={(value) => setSortOrder(value as SortOrder)}
        >
          <SelectTrigger className="sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">جدیدترین به قدیمی‌ترین</SelectItem>
            <SelectItem value="oldest">قدیمی‌ترین به جدیدترین</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredAthletes.length === 0 ? (
        <Card className="py-5">
          <EmptyState
            icon={Search}
            title="نتیجه‌ای پیدا نشد."
            description="ورزشکاری با این نام و نام خانوادگی پیدا نشد."
          />
        </Card>
      ) : (
        <Card className="gap-4 py-5">
          <div className="space-y-2 px-6">
            {filteredAthletes.map((athlete) => (
              <button
                key={athlete.id}
                type="button"
                onClick={() => setSelectedAthlete(athlete)}
                className="flex w-full items-center gap-3 rounded-xl border border-border p-4 text-right transition-colors hover:bg-muted/50"
              >
                <Avatar className="size-9">
                  <AvatarFallback className="text-xs">
                    {athlete.name.slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {athlete.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    عضویت از {formatPersianDate(new Date(athlete.joinedAt))}
                  </p>
                </div>
                <ChevronLeft className="size-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
