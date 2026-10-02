"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileSpreadsheet, Lock } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { showPlanLimitError } from "@/features/trainer-billing/utils/plan-limit-toast";
import { useReportAccess } from "../hooks/use-report-access";
import { downloadReportExcel } from "../services/report-service";

/** «خروجی اکسل» of the reports page; locked below report level full_excel. */
export function ReportExcelButton() {
  const access = useReportAccess();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (access.loading) return null;

  if (!access.allows("full_excel")) {
    const planName = access.planFor("full_excel");
    return (
      <Button
        variant="outline"
        onClick={() =>
          toast.error(
            `${planName ? `خروجی اکسل از پلن «${planName}» فعال است.` : "خروجی اکسل در پلن فعلی شما نیست."} برای دریافت آن، پلن خود را ارتقا دهید.`,
            { duration: 10_000, action: { label: "ارتقا", onClick: () => router.push("/subscription") } }
          )
        }
      >
        <Lock />
        خروجی اکسل
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await downloadReportExcel();
        } catch (error) {
          showPlanLimitError(error, "دریافت فایل اکسل با خطا مواجه شد.", {
            href: "/subscription",
            navigate: router.push,
          });
        } finally {
          setBusy(false);
        }
      }}
    >
      <FileSpreadsheet />
      {busy ? "در حال ساخت فایل…" : "خروجی اکسل"}
    </Button>
  );
}
