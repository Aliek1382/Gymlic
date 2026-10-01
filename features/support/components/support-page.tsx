"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Headset, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

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
import { getErrorMessage } from "@/lib/get-error-message";
import { formatRelativeTime, toPersianDigits } from "@/lib/persian";
import { RoleGate } from "@/features/authentication/components/role-gate";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { ErrorState } from "@/features/dashboard/components/shared/error-state";
import {
  MAX_SUPPORT_BODY,
  SUPPORT_CATEGORIES,
  SUPPORT_CATEGORY_LABEL,
  closeSupportTicket,
  createSupportTicket,
  getMySupportTicket,
  listMySupportTickets,
  replyToSupportTicket,
  type SupportCategory,
} from "../services/support-service";
import { SupportStatusBadge } from "./support-status-badge";
import { SupportThread } from "./support-thread";

const LIST_KEY = ["support", "mine"] as const;

/** /support — a club owner's or trainer's tickets to the Gymlic team; one ticket is ?id=. */
export function SupportPage() {
  const router = useRouter();
  const ticketId = useSearchParams().get("id");
  const [creating, setCreating] = useState(false);
  const { data, isLoading, isError } = useQuery({ queryKey: LIST_KEY, queryFn: listMySupportTickets });

  return (
    <RoleGate allow={["club", "trainer"]}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground">پشتیبانی</h1>
            <p className="text-sm text-muted-foreground">
              مشکل، سؤال مالی یا پیشنهادتان را برای تیم جیم‌لیک بفرستید و پاسخ را همین‌جا ببینید.
            </p>
          </div>
          {!ticketId && data?.ready && (
            <Button onClick={() => setCreating(true)}>
              <Plus />
              تیکت جدید
            </Button>
          )}
        </div>

        {ticketId ? (
          <TicketView id={ticketId} onBack={() => router.push("/support")} />
        ) : isLoading ? (
          <Skeleton className="h-48 rounded-2xl" />
        ) : isError || !data ? (
          <ErrorState message="دریافت تیکت‌ها با خطا مواجه شد." />
        ) : !data.ready ? (
          <Card className="py-8">
            <div className="px-6">
              <EmptyState icon={Headset} title="پشتیبانی هنوز راه‌اندازی نشده است." description="کمی بعد دوباره سر بزنید." />
            </div>
          </Card>
        ) : data.items.length === 0 ? (
          <Card className="py-8">
            <div className="px-6">
              <EmptyState
                icon={Headset}
                title="هنوز تیکتی نفرستاده‌اید."
                description="با «تیکت جدید» سؤال یا مشکلتان را برای پشتیبانی بفرستید."
              />
            </div>
          </Card>
        ) : (
          <Card className="gap-0 py-0">
            <ul className="divide-y divide-border">
              {data.items.map((ticket) => (
                <li key={ticket.id}>
                  <button
                    type="button"
                    onClick={() => router.push(`/support?id=${ticket.id}`)}
                    className="flex w-full items-center gap-3 px-5 py-4 text-start hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">{ticket.subject}</p>
                      <p className="text-xs text-muted-foreground">
                        #{toPersianDigits(ticket.ticket_number)} · {SUPPORT_CATEGORY_LABEL[ticket.category]} ·{" "}
                        {formatRelativeTime(new Date(ticket.updated_at))}
                      </p>
                    </div>
                    <SupportStatusBadge status={ticket.status} />
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <NewTicketDialog
          open={creating}
          onClose={() => setCreating(false)}
          onCreated={(id) => router.push(`/support?id=${id}`)}
        />
      </div>
    </RoleGate>
  );
}

function TicketView({ id, onBack }: { id: string; onBack: () => void }) {
  const queryClient = useQueryClient();
  const key = ["support", "ticket", id];
  const { data, isLoading, isError } = useQuery({ queryKey: key, queryFn: () => getMySupportTicket(id) });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: key });
    void queryClient.invalidateQueries({ queryKey: LIST_KEY });
  };

  if (isLoading) return <Skeleton className="h-64 rounded-xl" />;
  if (isError || !data) return <ErrorState message="بارگذاری تیکت با خطا مواجه شد." />;

  return (
    <SupportThread
      viewer="user"
      ticket={data.ticket}
      messages={data.messages}
      onBack={onBack}
      actions={
        data.ticket.status !== "closed" && (
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              try {
                await closeSupportTicket(id);
                toast.success("تیکت بسته شد.");
                refresh();
              } catch (error) {
                toast.error(getErrorMessage(error, "بستن تیکت ناموفق بود."));
              }
            }}
          >
            مشکلم حل شد، ببند
          </Button>
        )
      }
      onSend={async (body) => {
        await replyToSupportTicket(id, body);
        refresh();
      }}
    />
  );
}

function NewTicketDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<SupportCategory>("bug");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!subject.trim() || !body.trim()) {
      toast.error("موضوع و متن پیام را بنویسید.");
      return;
    }
    setSaving(true);
    try {
      const created = await createSupportTicket({ category, subject: subject.trim(), body: body.trim() });
      toast.success(`تیکت #${toPersianDigits(created.ticket_number)} ثبت شد.`);
      void queryClient.invalidateQueries({ queryKey: LIST_KEY });
      setSubject("");
      setBody("");
      onClose();
      onCreated(created.id);
    } catch (error) {
      toast.error(getErrorMessage(error, "ثبت تیکت ناموفق بود."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>تیکت جدید به پشتیبانی</DialogTitle>
          <DialogDescription>پاسخ پشتیبانی هم در همین بخش و هم به‌صورت اعلان به شما می‌رسد.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>موضوع کلی</Label>
            <Select value={category} onValueChange={(value) => setCategory(value as SupportCategory)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORT_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {SUPPORT_CATEGORY_LABEL[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="support-subject">عنوان</Label>
            <Input id="support-subject" value={subject} maxLength={255} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="support-body">شرح</Label>
            <textarea
              id="support-body"
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, MAX_SUPPORT_BODY))}
              placeholder="هرچه دقیق‌تر بنویسید، سریع‌تر پیگیری می‌شود؛ مثلاً در کدام صفحه و چه زمانی."
              className="w-full rounded-xl border border-input bg-transparent px-4 py-2 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="animate-spin" />}
            ارسال
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
