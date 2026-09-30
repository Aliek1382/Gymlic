"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RoleGate } from "@/features/authentication/components/role-gate";
import { useAuthContext } from "@/features/authentication/hooks/use-auth-context";
import { useState } from "react";
import { TICKET_STATUSES, TICKET_STATUS_LABEL } from "../constants/tickets";
import type { TicketStatus } from "../types/ticket-types";
import { NewTicketDialog } from "./new-ticket-dialog";
import { TicketDetail } from "./ticket-detail";
import { TicketList } from "./ticket-list";

export function TicketsPage() {
  const { data: context } = useAuthContext();
  const router = useRouter();
  // The site is a static export, so there is no /tickets/[id] route: one
  // ticket is `/tickets?id=<id>`, which is also what notifications link to.
  const ticketId = useSearchParams().get("id");
  const [status, setStatus] = useState<TicketStatus>("open");
  const role = context?.accountType;

  return (
    <RoleGate allow={["athlete", "trainer"]}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground">تیکت‌ها</h1>
            <p className="text-sm text-muted-foreground">
              {role === "athlete"
                ? "درخواست‌های رسمی خود را برای مربی ثبت و پیگیری کنید."
                : "درخواست‌های رسمی ورزشکاران را ببینید، پاسخ دهید و وضعیتشان را مدیریت کنید."}
            </p>
          </div>
          {role === "athlete" && !ticketId && (
            <NewTicketDialog onCreated={(id) => router.push(`/tickets?id=${id}`)} />
          )}
        </div>

        {context && (role === "athlete" || role === "trainer") &&
          (ticketId ? (
            <TicketDetail
              ticketId={ticketId}
              currentUserId={context.userId}
              role={role}
              onBack={() => router.push("/tickets")}
            />
          ) : role === "athlete" ? (
            <TicketList
              role="athlete"
              emptyDescription="با دکمهٔ «تیکت جدید» اولین درخواست خود را برای مربی ثبت کنید."
            />
          ) : (
            <div className="space-y-4">
              <Tabs value={status} onValueChange={(value) => setStatus(value as TicketStatus)}>
                <TabsList>
                  {TICKET_STATUSES.map((s) => (
                    <TabsTrigger key={s} value={s}>
                      {TICKET_STATUS_LABEL[s]}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <TicketList
                role="trainer"
                status={status}
                emptyDescription="هیچ تیکتی در این وضعیت وجود ندارد."
              />
            </div>
          ))}
      </div>
    </RoleGate>
  );
}
