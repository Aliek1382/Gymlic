"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import type { ReportLevel } from "@/features/trainer-billing/services/trainer-billing-service";
import { useReportAccess } from "../hooks/use-report-access";

/** In place of a report section the trainer's plan doesn't open. No data behind it. */
export function ReportLockedCard({ title, need }: { title: string; need: ReportLevel }) {
  const planName = useReportAccess().planFor(need);

  return (
    <Card className="gap-3 py-5">
      <div className="flex items-center gap-2 px-6">
        <Lock className="size-4 text-muted-foreground" />
        <CardTitle className="text-base">{title}</CardTitle>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-6">
        <p className="text-sm text-muted-foreground">
          {planName ? `${title} از پلن «${planName}» فعال است.` : `${title} در پلن فعلی شما نیست.`}{" "}
          برای دیدن آن، پلن خود را ارتقا دهید.
        </p>
        <Button asChild size="sm">
          <Link href="/subscription">ارتقا</Link>
        </Button>
      </div>
    </Card>
  );
}

/** A report section, or its locked card when the trainer's plan doesn't open it. */
export function ReportSection({
  title,
  need,
  children,
}: {
  title: string;
  need: ReportLevel;
  children: ReactNode;
}) {
  const access = useReportAccess();
  if (access.loading) return null;
  return access.allows(need) ? <>{children}</> : <ReportLockedCard title={title} need={need} />;
}
