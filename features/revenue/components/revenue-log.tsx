"use client";

import { useState } from "react";
import { Trash2, Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { parseIsoDate } from "@/lib/iso-date";
import { formatNumber, formatPersianDate } from "@/lib/persian";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { REVENUE_CATEGORY_LABEL } from "../constants/revenue";
import { useDeleteRevenueEntry } from "../hooks/use-delete-revenue-entry";
import type { RevenueEntry } from "../types/revenue-types";
import { RevenueFormDialog } from "./revenue-form-dialog";

function EntryRow({ clubId, entry }: { clubId: string; entry: RevenueEntry }) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const deleteEntry = useDeleteRevenueEntry();

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            {entry.memberName ?? "بدون عضو"}
          </span>
          <Badge variant="secondary">
            {REVENUE_CATEGORY_LABEL[entry.category]}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {formatPersianDate(parseIsoDate(entry.occurredOn))}
          </span>
        </div>
        {/* The exact amount, not formatToman's "۲٫۵ میلیون" rounding — a
            ledger row has to reconcile against what was received. */}
        <p className="text-sm text-muted-foreground">
          {formatNumber(entry.amount)} تومان
        </p>
        {entry.note && (
          <p className="text-xs text-muted-foreground">{entry.note}</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <RevenueFormDialog clubId={clubId} entry={entry} />
        <Button
          size="icon"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          aria-label="حذف دریافتی"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 />
        </Button>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="حذف دریافتی"
        description={`این دریافتی به مبلغ ${formatNumber(entry.amount)} تومان حذف می‌شود و از درآمد ماهانه‌ی باشگاه کم می‌شود.`}
        confirmLabel="بله، حذف کن"
        errorMessage="حذف دریافتی با خطا مواجه شد."
        onConfirm={() => deleteEntry.mutateAsync(entry.id)}
      />
    </div>
  );
}

/** The full ledger, newest entry first. */
export function RevenueLog({
  clubId,
  entries,
}: {
  clubId: string;
  entries: RevenueEntry[];
}) {
  return (
    <Card className="gap-4 py-5">
      <div className="px-6">
        <CardTitle className="text-base">تاریخچه‌ی دریافتی‌ها</CardTitle>
      </div>
      <div className="space-y-2 px-6">
        {entries.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="هنوز دریافتی‌ای ثبت نشده است."
            description="با دکمه «ثبت دریافتی جدید» اولین شهریه یا درآمد باشگاه را وارد کنید."
          />
        ) : (
          entries.map((entry) => (
            <EntryRow key={entry.id} clubId={clubId} entry={entry} />
          ))
        )}
      </div>
    </Card>
  );
}
