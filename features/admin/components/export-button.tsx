"use client";

import { useState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/get-error-message";
import { downloadExport, type ExportKind } from "../services/admin-billing-service";

/** Downloads one of the admin CSV exports (opens in Excel, Persian intact). */
export function ExportButton({ kind, label = "خروجی Excel" }: { kind: ExportKind; label?: string }) {
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      await downloadExport(kind);
    } catch (error) {
      toast.error(getErrorMessage(error, "دریافت فایل ناموفق بود."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="outline" onClick={download} disabled={busy}>
      {busy ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}
      {label}
    </Button>
  );
}
