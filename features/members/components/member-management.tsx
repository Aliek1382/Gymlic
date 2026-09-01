"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Users } from "lucide-react";

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
  MEMBER_SORT_LABEL,
  MEMBER_STATUS_LABEL,
  MEMBER_STATUS_VALUES,
  PLAN_TIER_LABEL,
  PLAN_TIER_VALUES,
  type MemberSortOrder,
} from "../constants/members";
import { useClubCapacity } from "../hooks/use-club-capacity";
import { useClubMembers } from "../hooks/use-club-members";
import { useClubTrainers } from "../hooks/use-club-trainers";
import { usePendingMemberInvites } from "../hooks/use-pending-member-invites";
import { AddMemberDialog } from "./add-member-dialog";
import { MemberTable } from "./member-table";
import { PendingInvitesCard } from "./pending-invites-card";

function SummaryChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

export function MemberManagement({
  clubId,
  openAddOnMount = false,
}: {
  clubId: string;
  /** The dashboard's "افزودن عضو جدید" quick action lands here as ?new=1. */
  openAddOnMount?: boolean;
}) {
  const router = useRouter();
  const members = useClubMembers(clubId);
  const invites = usePendingMemberInvites(clubId);
  const trainers = useClubTrainers(clubId);
  const capacity = useClubCapacity(clubId);

  const [addOpen, setAddOpen] = useState(openAddOnMount);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(ALL_FILTER_VALUE);
  const [planFilter, setPlanFilter] = useState<string>(ALL_FILTER_VALUE);
  const [sortOrder, setSortOrder] = useState<MemberSortOrder>("newest");

  // Drop ?new=1 once it has done its job, so a refresh doesn't reopen the
  // dialog the owner just closed.
  useEffect(() => {
    if (openAddOnMount) router.replace("/members");
  }, [openAddOnMount, router]);

  const rows = useMemo(() => members.data ?? [], [members.data]);
  const inviteRows = useMemo(() => invites.data ?? [], [invites.data]);

  const trainerNameById = useMemo(
    () => new Map((trainers.data ?? []).map((t) => [t.id, t.name])),
    [trainers.data]
  );

  const counts = useMemo(() => {
    const byStatus: Record<MembershipStatus, number> = {
      active: 0,
      pending: 0,
      suspended: 0,
    };
    for (const member of rows) byStatus[member.status] += 1;
    return byStatus;
  }, [rows]);

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = rows.filter((member) => {
      const matchesQuery =
        !query ||
        member.name.toLowerCase().includes(query) ||
        (member.phone ?? "").includes(query);
      const matchesStatus =
        statusFilter === ALL_FILTER_VALUE || member.status === statusFilter;
      const matchesPlan =
        planFilter === ALL_FILTER_VALUE || member.planTier === planFilter;
      return matchesQuery && matchesStatus && matchesPlan;
    });

    return [...list].sort((a, b) => {
      if (sortOrder === "name") return a.name.localeCompare(b.name, "fa");
      return sortOrder === "newest"
        ? b.joinedAt.localeCompare(a.joinedAt)
        : a.joinedAt.localeCompare(b.joinedAt);
    });
  }, [rows, search, statusFilter, planFilter, sortOrder]);

  const filteredInvites = useMemo(() => {
    const query = search.trim().toLowerCase();
    return inviteRows.filter((invite) => {
      const matchesQuery =
        !query ||
        invite.name.toLowerCase().includes(query) ||
        (invite.phone ?? "").includes(query);
      const matchesPlan =
        planFilter === ALL_FILTER_VALUE || invite.planTier === planFilter;
      // A pending invite has no membership row yet, so it only belongs in
      // the list under "همه" or the "در انتظار" status filter.
      const matchesStatus =
        statusFilter === ALL_FILTER_VALUE || statusFilter === "pending";
      return matchesQuery && matchesPlan && matchesStatus;
    });
  }, [inviteRows, search, planFilter, statusFilter]);

  const capacityLabel = capacity.data
    ? capacity.data.capacity === null
      ? `${toPersianDigits(capacity.data.activeMembers)} (بدون سقف)`
      : `${toPersianDigits(capacity.data.activeMembers)} از ${toPersianDigits(
          capacity.data.capacity
        )}`
    : "—";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <SummaryChip label="ظرفیت پلن" value={capacityLabel} />
          <SummaryChip label="فعال" value={toPersianDigits(counts.active)} />
          <SummaryChip
            label="در انتظار"
            value={toPersianDigits(counts.pending + inviteRows.length)}
          />
          <SummaryChip label="معلق" value={toPersianDigits(counts.suspended)} />
        </div>

        <AddMemberDialog
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
            placeholder="جستجوی نام یا شماره موبایل عضو..."
            className="pr-10"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="lg:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER_VALUE}>همه وضعیت‌ها</SelectItem>
            {MEMBER_STATUS_VALUES.map((status) => (
              <SelectItem key={status} value={status}>
                {MEMBER_STATUS_LABEL[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={planFilter} onValueChange={setPlanFilter}>
          <SelectTrigger className="lg:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER_VALUE}>همه طرح‌ها</SelectItem>
            {PLAN_TIER_VALUES.map((tier) => (
              <SelectItem key={tier} value={tier}>
                {PLAN_TIER_LABEL[tier]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={sortOrder}
          onValueChange={(value) => setSortOrder(value as MemberSortOrder)}
        >
          <SelectTrigger className="lg:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(MEMBER_SORT_LABEL) as MemberSortOrder[]).map((value) => (
              <SelectItem key={value} value={value}>
                {MEMBER_SORT_LABEL[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {members.isError && (
        <ErrorState message="دریافت لیست اعضا با خطا مواجه شد. صفحه را دوباره بارگذاری کنید." />
      )}

      {members.isLoading || invites.isLoading ? (
        <TableCardSkeleton />
      ) : rows.length === 0 && inviteRows.length === 0 ? (
        <Card className="py-5">
          <EmptyState
            icon={Users}
            title="هنوز عضوی ثبت نشده است."
            description="با دکمه «افزودن عضو جدید» اولین عضو باشگاه خود را دعوت کنید."
            actionLabel="افزودن عضو جدید"
            onAction={() => setAddOpen(true)}
          />
        </Card>
      ) : filteredMembers.length === 0 && filteredInvites.length === 0 ? (
        <Card className="py-5">
          <EmptyState
            icon={Search}
            title="نتیجه‌ای پیدا نشد."
            description="عضوی با این جستجو و فیلترها پیدا نشد."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredInvites.length > 0 && (
            <PendingInvitesCard
              invites={filteredInvites}
              trainerNameById={trainerNameById}
            />
          )}
          {filteredMembers.length > 0 && (
            <MemberTable members={filteredMembers} />
          )}
        </div>
      )}
    </div>
  );
}
