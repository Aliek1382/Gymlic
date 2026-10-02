"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { downloadFile } from "@/lib/api/download-file";
import { getErrorMessage } from "@/lib/get-error-message";

/**
 * All of the trainer's own data as one Excel file. Open on every plan, the
 * free one too: it is the trainer's data, not a plan feature.
 */
export function TrainerDataExportButton({
  label = "دریافت همه‌ی اطلاعات",
  size,
  variant = "outline",
}: {
  label?: string;
  size?: "sm" | "default";
  variant?: "outline" | "default" | "ghost";
}) {
  const [busy, setBusy] = useState(false);

  return (
    <Button
      size={size}
      variant={variant}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await downloadFile("/trainer/data-export", "gymlic-data.xlsx");
        } catch (error) {
          toast.error(getErrorMessage(error, "دریافت فایل با خطا مواجه شد."));
        } finally {
          setBusy(false);
        }
      }}
    >
      <Download />
      {busy ? "در حال ساخت فایل…" : label}
    </Button>
  );
}

export function TrainerDataExportCard() {
  return (
    <Card className="gap-4 py-6">
      <div className="space-y-1 px-6">
        <CardTitle className="text-base">اطلاعات شما</CardTitle>
        <CardDescription>
          یک فایل اکسل با ورزشکاران، همه‌ی برنامه‌ها و قالب‌ها، اندازه‌گیری‌ها، حرکت‌های سفارشی، درآمد و
          کامنت‌های برنامه‌ها. هر ۱۰ دقیقه یک بار.
        </CardDescription>
      </div>
      <CardContent>
        <TrainerDataExportButton />
      </CardContent>
    </Card>
  );
}
