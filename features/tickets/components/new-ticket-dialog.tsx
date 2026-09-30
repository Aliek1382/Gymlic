"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { getErrorMessage } from "@/lib/get-error-message";
import { toPersianDigits } from "@/lib/persian";
import {
  MAX_TICKET_BODY_LENGTH,
  MAX_TICKET_SUBJECT_LENGTH,
  TICKET_CATEGORY_LABEL,
} from "../constants/tickets";
import { useCreateTicket, useTicketTrainers } from "../hooks/use-tickets";
import type { TicketCategory } from "../types/ticket-types";

export function NewTicketDialog({ onCreated }: { onCreated: (ticketId: string) => void }) {
  const [open, setOpen] = useState(false);
  const [trainerId, setTrainerId] = useState<string | null>(null);
  const [category, setCategory] = useState<TicketCategory>("other");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const trainers = useTicketTrainers(open);
  const createTicket = useCreateTicket();

  const options = trainers.data ?? [];
  // A single trainer is the common case, so it is picked for the athlete.
  const effectiveTrainerId = trainerId ?? (options.length === 1 ? options[0].id : null);
  const canSubmit =
    !!effectiveTrainerId && subject.trim() !== "" && body.trim() !== "" && !createTicket.isPending;

  async function handleSubmit() {
    if (!effectiveTrainerId || !canSubmit) return;
    try {
      const created = await createTicket.mutateAsync({
        trainerId: effectiveTrainerId,
        category,
        subject: subject.trim(),
        body: body.trim(),
      });
      toast.success(`تیکت ثبت شد. شمارهٔ پیگیری: ${toPersianDigits(created.ticketNumber)}`);
      setOpen(false);
      setSubject("");
      setBody("");
      setCategory("other");
      onCreated(created.id);
    } catch (error) {
      toast.error(getErrorMessage(error, "ثبت تیکت با خطا مواجه شد."));
    }
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <Plus />
        تیکت جدید
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تیکت جدید</DialogTitle>
            <DialogDescription>
              درخواست رسمی خود را برای مربی ثبت کنید؛ یک شمارهٔ پیگیری دریافت می‌کنید.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {options.length === 0 && !trainers.isLoading ? (
              <p className="text-sm text-muted-foreground">
                برای ثبت تیکت باید به یک مربی وصل باشید.
              </p>
            ) : (
              options.length > 1 && (
                <div className="space-y-1.5">
                  <Label>مربی</Label>
                  <Select value={effectiveTrainerId ?? undefined} onValueChange={setTrainerId}>
                    <SelectTrigger>
                      <SelectValue placeholder="مربی را انتخاب کنید" />
                    </SelectTrigger>
                    <SelectContent>
                      {options.map((trainer) => (
                        <SelectItem key={trainer.id} value={trainer.id}>
                          {trainer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )
            )}

            <div className="space-y-1.5">
              <Label>دسته‌بندی</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as TicketCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TICKET_CATEGORY_LABEL) as TicketCategory[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {TICKET_CATEGORY_LABEL[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ticket-subject">موضوع</Label>
              <Input
                id="ticket-subject"
                value={subject}
                maxLength={MAX_TICKET_SUBJECT_LENGTH}
                onChange={(event) => setSubject(event.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ticket-body">پیام</Label>
              <textarea
                id="ticket-body"
                value={body}
                rows={5}
                onChange={(event) => setBody(event.target.value.slice(0, MAX_TICKET_BODY_LENGTH))}
                className="w-full resize-none rounded-xl border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" disabled={!canSubmit} onClick={handleSubmit}>
              {createTicket.isPending && <Loader2 className="animate-spin" />}
              ثبت تیکت
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
