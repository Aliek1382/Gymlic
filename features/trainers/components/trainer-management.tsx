"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Dumbbell, Search } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toPersianDigits } from "@/lib/persian";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { ErrorState } from "@/features/dashboard/components/shared/error-state";
import { TableCardSkeleton } from "@/features/dashboard/components/shared/dashboard-skeleton";
import type { MembershipStatus } from "@/types/database.types";
import {
  ALL_FILTER_VALUE,
  TRAINER_SORT_LABEL,
  TRAINER_STATUS_LABEL,
  TRAINER_STATUS_VALUES,
  type TrainerSortOrder,
} from "../constants/trainers";
import { useClubTrainerList } from "../hooks/use-club-trainer-list";
import { usePendingTrainerInvites } from "../hooks/use-pending-trainer-invites";
import { AddTrainerDialog } from "./add-trainer-dialog";
import { PendingTrainerInvitesCard } from "./pending-trainer-invites-card";
import { TrainerTable } from "./trainer-table";

function SummaryChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

export function TrainerManagement({
  clubId,
  openAddOnMount = false,
}: {
  clubId: string;
  /** The dashboard's "افزودن مربی" quick action lands here as ?new=1. */
  openAddOnMount?: boolean;
}) {
  const router = useRouter();
  const trainers = useClubTrainerList(clubId);
  const invites = usePendingTrainerInvites(clubId);

  const [addOpen, setAddOpen] = useState(openAddOnMount);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(ALL_FILTER_VALUE);
  const [sortOrder, setSortOrder] = useState<TrainerSortOrder>("newest");

  // Drop ?new=1 once it has done its job, so a refresh doesn't reopen the
  // dialog the owner just closed.
  useEffect(() => {
    if (openAddOnMount) router.replace("/trainers");
  }, [openAddOnMount, router]);

  const rows = useMemo(() => trainers.data ?? [], [trainers.data]);
  const inviteRows = useMemo(() => invites.data ?? [], [invites.data]);

  const counts = useMemo(() => {
    const byStatus: Record<MembershipStatus, number> = {
      active: 0,
      pending: 0,
      suspended: 0,
    };
    let athletes = 0;
    for (const trainer of rows) {
      byStatus[trainer.status] += 1;
      athletes += trainer.athleteCount;
    }
    return { byStatus, athletes };
  }, [rows]);

  const filteredTrainers = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = rows.filter((trainer) => {
      const matchesQuery =
        !query ||
        trainer.name.toLowerCase().includes(query) ||
        (trainer.phone ?? "").includes(query);
      const matchesStatus =
        statusFilter === ALL_FILTER_VALUE || trainer.status === statusFilter;
      return matchesQuery && matchesStatus;
    });

    return [...list].sort((a, b) => {
      if (sortOrder === "name") return a.name.localeCompare(b.name, "fa");
      if (sortOrder === "most-athletes") return b.athleteCount - a.athleteCount;
      return sortOrder === "newest"
        ? b.joinedAt.localeCompare(a.joinedAt)
        : a.joinedAt.localeCompare(b.joinedAt);
    });
  }, [rows, search, statusFilter, sortOrder]);

  const filteredInvites = useMemo(() => {
    const query = search.trim().toLowerCase();
    return inviteRows.filter((invite) => {
      const matchesQuery =
        !query ||
        invite.name.toLowerCase().includes(query) ||
        (invite.phone ?? "").includes(query);
      // A pending invite has no membership row yet, so it only belongs in
      // the list under "همه" or the "در انتظار" status filter.
      const matchesStatus =
        statusFilter === ALL_FILTER_VALUE || statusFilter === "pending";
      return matchesQuery && matchesStatus;
    });
  }, [inviteRows, search, statusFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <SummaryChip
            label="مربیان فعال"
            value={toPersianDigits(counts.byStatus.active)}
          />
          <SummaryChip
            label="در انتظار"
            value={toPersianDigits(counts.byStatus.pending + inviteRows.length)}
          />
          <SummaryChip
            label="معلق"
            value={toPersianDigits(counts.byStatus.suspended)}
          />
          <SummaryChip
            label="شاگردان زیر نظر مربیان"
            value={toPersianDigits(counts.athletes)}
          />
        </div>

        <AddTrainerDialog
          clubId={clubId}
          open={addOpen}
          onOpenChange={setAddOpen}
        />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجوی نام یا شماره موبایل مربی..."
            className="pr-10"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="lg:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER_VALUE}>همه وضعیت‌ها</SelectItem>
            {TRAINER_STATUS_VALUES.map((status) => (
              <SelectItem key={status} value={status}>
                {TRAINER_STATUS_LABEL[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={sortOrder}
          onValueChange={(value) => setSortOrder(value as TrainerSortOrder)}
        >
          <SelectTrigger className="lg:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(TRAINER_SORT_LABEL) as TrainerSortOrder[]).map((value) => (
              <SelectItem key={value} value={value}>
                {TRAINER_SORT_LABEL[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {trainers.isError && (
        <ErrorState message="دریافت لیست مربیان با خطا مواجه شد. صفحه را دوباره بارگذاری کنید." />
      )}

      {trainers.isLoading || invites.isLoading ? (
        <TableCardSkeleton />
      ) : rows.length === 0 && inviteRows.length === 0 ? (
        <Card className="py-5">
          <EmptyState
            icon={Dumbbell}
            title="هنوز مربی‌ای به باشگاه اضافه نشده است."
            description="با دکمه «دعوت مربی جدید» اولین مربی باشگاه خود را دعوت کنید. شاگردان هر مربی هم به‌طور خودکار عضو باشگاه می‌شوند."
            actionLabel="دعوت مربی جدید"
            onAction={() => setAddOpen(true)}
          />
        </Card>
      ) : filteredTrainers.length === 0 && filteredInvites.length === 0 ? (
        <Card className="py-5">
          <EmptyState
            icon={Search}
            title="نتیجه‌ای پیدا نشد."
            description="مربی‌ای با این جستجو و فیلتر پیدا نشد."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredInvites.length > 0 && (
            <PendingTrainerInvitesCard invites={filteredInvites} />
          )}
          {filteredTrainers.length > 0 && (
            <TrainerTable trainers={filteredTrainers} />
          )}
        </div>
      )}
    </div>
  );
}
