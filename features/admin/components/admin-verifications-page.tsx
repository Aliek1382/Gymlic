"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Check, Loader2, Undo2, X } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { fullName } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/get-error-message";
import { formatNumber, formatRelativeTime } from "@/lib/persian";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { ErrorState } from "@/features/dashboard/components/shared/error-state";
import {
  decideVerification,
  listVerifications,
  type VerificationRow,
  type VerificationStatus,
} from "../services/admin-ops-service";
import { parseSqlDate } from "../utils/format";
import { MigrationNotice } from "./migration-notice";

const FILTERS: { value: VerificationStatus | "all"; label: string }[] = [
  { value: "pending", label: "در انتظار بررسی" },
  { value: "verified", label: "تأییدشده" },
  { value: "rejected", label: "ردشده" },
  { value: "none", label: "درخواست نداده" },
  { value: "all", label: "همه" },
];

const STATUS_BADGE: Record<VerificationStatus, { label: string; variant: "warning" | "success" | "destructive" | "outline" }> = {
  pending: { label: "در انتظار بررسی", variant: "warning" },
  verified: { label: "تأییدشده", variant: "success" },
  rejected: { label: "ردشده", variant: "destructive" },
  none: { label: "درخواست نداده", variant: "outline" },
};

const TEXTAREA_CLASS =
  "w-full rounded-xl border border-input bg-transparent px-4 py-2 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30";

/** /admin/verifications — trainers' certificates, and the «مربی تأییدشده» badge. */
export function AdminVerificationsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<VerificationStatus | "all">("pending");
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "verifications", status],
    queryFn: () => listVerifications(status),
    placeholderData: (previous) => previous,
  });
  const [zoom, setZoom] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<VerificationRow | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function decide(row: VerificationRow, decision: "verify" | "revoke") {
    setBusy(row.trainer_id);
    try {
      await decideVerification(row.trainer_id, decision);
      toast.success(decision === "verify" ? "مربی تأیید شد." : "نشان تأیید برداشته شد.");
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
    } catch (error) {
      toast.error(getErrorMessage(error, "انجام نشد."));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">تأیید مدارک مربی</h1>
        <p className="text-sm text-muted-foreground">
          مربی‌ها مدارکشان را در «رزومه» بارگذاری و برای بررسی می‌فرستند. با تأیید، نشان «مربی تأییدشده» کنار نامشان برای
          شاگردان دیده می‌شود؛ با رد، دلیلتان برایشان فرستاده می‌شود تا اصلاح کنند و دوباره بفرستند.
        </p>
      </div>

      {data && !data.ready && <MigrationNotice title="لاگ خطاها، سطل زباله و تأیید مدارک مربی (فاز ۱۰)" />}

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            data-active={status === item.value}
            onClick={() => setStatus(item.value)}
            className="rounded-full border border-border px-3 py-1 text-xs transition-colors hover:bg-muted data-[active=true]:border-primary data-[active=true]:bg-accent data-[active=true]:text-accent-foreground"
          >
            {item.label}
            {item.value !== "all" && data?.counts[item.value] ? ` (${formatNumber(data.counts[item.value] ?? 0)})` : ""}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : isError || !data ? (
        <ErrorState message="دریافت فهرست ناموفق بود." />
      ) : data.items.length === 0 ? (
        <Card className="py-8">
          <EmptyState icon={BadgeCheck} title={status === "pending" ? "درخواستی در انتظار بررسی نیست." : "موردی نیست."} />
        </Card>
      ) : (
        <div className="space-y-3">
          {data.items.map((row) => {
            const name = fullName(row.first_name, row.last_name);
            const badge = STATUS_BADGE[row.verification_status];
            return (
              <Card key={row.trainer_id} className="gap-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3 px-5">
                  <Link href={`/admin/trainers/detail?id=${row.trainer_id}`} className="flex items-center gap-3">
                    <Avatar className="size-10">
                      {row.avatar_url && <AvatarImage src={row.avatar_url} alt={name} />}
                      <AvatarFallback>{name.slice(0, 2)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-foreground hover:underline">{name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatNumber(row.athletes)} شاگرد فعال
                        {row.verification_requested_at &&
                          ` · درخواست ${formatRelativeTime(parseSqlDate(row.verification_requested_at))}`}
                      </p>
                    </div>
                  </Link>
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                </div>

                <div className="flex flex-wrap gap-2 px-5">
                  {row.certificates.map((url) => (
                    <button
                      key={url}
                      type="button"
                      onClick={() => setZoom(url)}
                      className="size-24 overflow-hidden rounded-xl border border-border transition hover:ring-2 hover:ring-ring"
                      aria-label="بزرگ‌نمایی مدرک"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- static export: no image optimizer */}
                      <img src={url} alt="مدرک" className="size-full object-cover" />
                    </button>
                  ))}
                </div>

                {row.verification_note && (
                  <p className="px-5 text-xs text-muted-foreground">یادداشت: {row.verification_note}</p>
                )}

                <div className="flex flex-wrap justify-end gap-2 border-t border-border px-5 pt-3">
                  {row.verification_status !== "verified" ? (
                    <>
                      <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => setRejecting(row)}>
                        <X />
                        رد با توضیح
                      </Button>
                      <Button size="sm" disabled={busy !== null} onClick={() => decide(row, "verify")}>
                        {busy === row.trainer_id ? <Loader2 className="animate-spin" /> : <Check />}
                        تأیید مدارک
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => decide(row, "revoke")}>
                      {busy === row.trainer_id ? <Loader2 className="animate-spin" /> : <Undo2 />}
                      برداشتن نشان تأیید
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!zoom} onOpenChange={(open) => !open && setZoom(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>مدرک</DialogTitle>
          </DialogHeader>
          {zoom && (
            // eslint-disable-next-line @next/next/no-img-element -- static export: no image optimizer
            <img src={zoom} alt="مدرک" className="max-h-[75dvh] w-full rounded-xl object-contain" />
          )}
        </DialogContent>
      </Dialog>

      <RejectDialog
        row={rejecting}
        onClose={() => setRejecting(null)}
        onDone={() => void queryClient.invalidateQueries({ queryKey: ["admin"] })}
      />
    </div>
  );
}

function RejectDialog({ row, onClose, onDone }: { row: VerificationRow | null; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!row) return;
    setBusy(true);
    try {
      await decideVerification(row.trainer_id, "reject", note.trim());
      toast.success("رد شد و دلیلش برای مربی فرستاده شد.");
      setNote("");
      onClose();
      onDone();
    } catch (error) {
      toast.error(getErrorMessage(error, "انجام نشد."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!row} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>رد مدارک {row ? fullName(row.first_name, row.last_name) : ""}</DialogTitle>
          <DialogDescription>این متن برای مربی فرستاده می‌شود تا بداند چه چیزی را درست کند.</DialogDescription>
        </DialogHeader>
        <textarea
          rows={4}
          maxLength={500}
          className={TEXTAREA_CLASS}
          placeholder="مثلاً: تصویر مدرک خوانا نیست؛ تصویر واضح‌تری بارگذاری کنید."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <DialogFooter>
          <Button variant="destructive" disabled={busy || note.trim() === ""} onClick={submit}>
            {busy && <Loader2 className="animate-spin" />}
            رد و ارسال توضیح
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
