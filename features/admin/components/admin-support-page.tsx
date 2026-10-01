"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Headset } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getErrorMessage } from "@/lib/get-error-message";
import { formatNumber, formatRelativeTime, toPersianDigits } from "@/lib/persian";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { ErrorState } from "@/features/dashboard/components/shared/error-state";
import { SUPPORT_CATEGORY_LABEL } from "@/features/support/services/support-service";
import { SupportStatusBadge } from "@/features/support/components/support-status-badge";
import { SupportThread } from "@/features/support/components/support-thread";
import {
  getSupportTicket,
  listSupportTickets,
  replySupportTicket,
  setSupportStatus,
  type SupportStatus,
} from "../services/admin-communication-service";

const ROLE_LABEL: Record<string, string> = { club: "باشگاه", trainer: "مربی", athlete: "ورزشکار" };

const FILTERS: { value: SupportStatus | "all"; label: string }[] = [
  { value: "open", label: "منتظر پاسخ" },
  { value: "answered", label: "پاسخ داده‌شده" },
  { value: "closed", label: "بسته" },
  { value: "all", label: "همه" },
];

export function AdminSupportPage() {
  const router = useRouter();
  const ticketId = useSearchParams().get("id");
  const [filter, setFilter] = useState<SupportStatus | "all">("open");
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "support", filter],
    queryFn: () => listSupportTickets(filter === "all" ? undefined : filter),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">تیکت‌های پشتیبانی</h1>
        <p className="text-sm text-muted-foreground">
          پیام‌هایی که باشگاه‌ها و مربی‌ها برای تیم جیم‌لیک فرستاده‌اند. هر پاسخ به‌صورت اعلان (و اگر کاربر
          خواسته باشد پیامک یا ایمیل) به آن‌ها می‌رسد. تیکت‌های جدید برای همهٔ مدیران با دسترسی پشتیبانی
          اعلان می‌شوند.
        </p>
      </div>

      {ticketId ? (
        <TicketView id={ticketId} onBack={() => router.push("/admin/support")} />
      ) : (
        <>
          <Tabs value={filter} onValueChange={(value) => setFilter(value as SupportStatus | "all")}>
            <TabsList className="h-auto flex-wrap justify-start rounded-2xl">
              {FILTERS.map((f) => (
                <TabsTrigger key={f.value} value={f.value}>
                  {f.label}
                  {f.value !== "all" && data?.counts && ` (${formatNumber(data.counts[f.value])})`}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {isLoading ? (
            <Skeleton className="h-48 rounded-2xl" />
          ) : isError || !data ? (
            <ErrorState message="دریافت تیکت‌ها با خطا مواجه شد." />
          ) : !data.ready ? (
            <Card className="py-8">
              <div className="px-6">
                <EmptyState
                  icon={Headset}
                  title="تیکت پشتیبانی هنوز فعال نیست."
                  description="به‌روزرسانی «اعلان همگانی، تیکت پشتیبانی و صفحه‌های متنی (فاز ۷)» را از صفحهٔ «به‌روزرسانی دیتابیس» اجرا کنید."
                />
              </div>
            </Card>
          ) : data.items.length === 0 ? (
            <Card className="py-8">
              <div className="px-6">
                <EmptyState icon={Headset} title="تیکتی در این وضعیت نیست." description="تیکت‌های تازه اینجا می‌آیند." />
              </div>
            </Card>
          ) : (
            <Card className="gap-0 py-0">
              <ul className="divide-y divide-border">
                {data.items.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => router.push(`/admin/support?id=${t.id}`)}
                      className="flex w-full items-center gap-3 px-5 py-4 text-start hover:bg-muted/50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-foreground">{t.subject}</p>
                        <p className="text-xs text-muted-foreground">
                          #{toPersianDigits(t.ticket_number)} · {SUPPORT_CATEGORY_LABEL[t.category]} ·{" "}
                          {[t.first_name, t.last_name].filter(Boolean).join(" ") || t.email}
                          {t.account_type && ` (${ROLE_LABEL[t.account_type]})`} · {formatRelativeTime(new Date(t.updated_at))}
                        </p>
                      </div>
                      <SupportStatusBadge status={t.status} forAdmin />
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function TicketView({ id, onBack }: { id: string; onBack: () => void }) {
  const queryClient = useQueryClient();
  const key = ["admin", "support", "ticket", id];
  const { data, isLoading, isError } = useQuery({ queryKey: key, queryFn: () => getSupportTicket(id) });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["admin", "support"] });

  if (isLoading) return <Skeleton className="h-64 rounded-xl" />;
  if (isError || !data) return <ErrorState message="بارگذاری تیکت با خطا مواجه شد." />;

  const { ticket } = data;
  const name = [ticket.first_name, ticket.last_name].filter(Boolean).join(" ") || "بدون نام";

  async function changeStatus(status: SupportStatus) {
    try {
      await setSupportStatus(id, status);
      toast.success(status === "closed" ? "تیکت بسته شد." : "وضعیت تیکت تغییر کرد.");
      refresh();
    } catch (error) {
      toast.error(getErrorMessage(error, "تغییر وضعیت ناموفق بود."));
    }
  }

  return (
    <SupportThread
      viewer="admin"
      ticket={ticket}
      messages={data.messages}
      onBack={onBack}
      sendExtra
      subtitle={
        <p className="text-xs text-muted-foreground">
          {name}
          {ticket.account_type && ` · ${ROLE_LABEL[ticket.account_type]}`}
          {ticket.phone && (
            <>
              {" · "}
              <span dir="ltr">{ticket.phone}</span>
            </>
          )}
          {ticket.email && ` · ${ticket.email}`}
        </p>
      }
      actions={
        <div className="flex flex-wrap gap-2">
          {ticket.status !== "closed" ? (
            <Button size="sm" variant="outline" onClick={() => changeStatus("closed")}>
              بستن بدون پاسخ
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => changeStatus("open")}>
              باز کردن دوباره
            </Button>
          )}
        </div>
      }
      onSend={async (body, close) => {
        await replySupportTicket(id, body, close);
        toast.success(close ? "پاسخ فرستاده و تیکت بسته شد." : "پاسخ فرستاده شد.");
        refresh();
      }}
    />
  );
}
