"use client";

import { Bookmark, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TableCardSkeleton } from "@/features/dashboard/components/shared/dashboard-skeleton";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { formatPersianDate } from "@/lib/persian";
import { getErrorMessage } from "@/lib/get-error-message";
import { useDeleteTemplate } from "../hooks/use-delete-template";
import { useTemplates } from "../hooks/use-templates";
import type { PlanKind } from "../types/athlete-types";

export function TemplateList({ kind }: { kind: PlanKind }) {
  const templates = useTemplates(kind, true);
  const deleteTemplate = useDeleteTemplate(kind);

  async function handleDelete(templateId: string) {
    try {
      await deleteTemplate.mutateAsync(templateId);
      toast.success("قالب حذف شد.");
    } catch (error) {
      toast.error(getErrorMessage(error, "حذف قالب با خطا مواجه شد."));
    }
  }

  if (templates.isLoading) {
    return <TableCardSkeleton />;
  }

  if (templates.isError) {
    return (
      <Card className="border-destructive/30 py-5">
        <p className="px-6 text-sm text-destructive">
          دریافت قالب‌ها با خطا مواجه شد. صفحه را دوباره بارگذاری کنید.
        </p>
      </Card>
    );
  }

  if (!templates.data || templates.data.length === 0) {
    return (
      <Card className="py-5">
        <EmptyState
          icon={Bookmark}
          title="هنوز قالبی ثبت نشده است."
          description="با دکمه بالا اولین قالب خود را بسازید."
        />
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {templates.data.map((template) => (
        <Card key={template.id} className="gap-2 py-4">
          <div className="flex items-start justify-between gap-2 px-5">
            <div className="min-w-0 space-y-1">
              <p className="truncate text-sm font-medium text-foreground">
                {template.title}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatPersianDate(new Date(template.createdAt))}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
              aria-label="حذف قالب"
              disabled={deleteTemplate.isPending}
              onClick={() => handleDelete(template.id)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
          {template.description && (
            <p className="line-clamp-3 whitespace-pre-line px-5 text-xs text-muted-foreground">
              {template.description}
            </p>
          )}
        </Card>
      ))}
    </div>
  );
}
