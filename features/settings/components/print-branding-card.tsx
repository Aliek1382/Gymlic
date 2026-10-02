"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getErrorMessage } from "@/lib/get-error-message";
import {
  getPrintBranding,
  removePrintLogo,
  savePrintWatermark,
  uploadPrintLogo,
  type PrintBranding,
} from "../services/settings-service";

/**
 * The trainer's logo and watermark on a printed or PDF plan. Athletes'
 * prints of the trainer's plans carry them too.
 */
export function PrintBrandingCard({ trainerName }: { trainerName: string }) {
  const queryClient = useQueryClient();
  const branding = useQuery({ queryKey: ["print-branding"], queryFn: getPrintBranding });
  const [watermark, setWatermark] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setWatermark(branding.data?.watermark ?? "");
  }, [branding.data?.watermark]);

  // The print reads the logo and watermark from the session (/auth/me).
  const done = (data: PrintBranding) => {
    queryClient.setQueryData(["print-branding"], data);
    void queryClient.invalidateQueries({ queryKey: ["auth", "context"] });
  };
  const fail = (error: unknown) => toast.error(getErrorMessage(error, "ذخیره نشد."));

  const upload = useMutation({ mutationFn: uploadPrintLogo, onSuccess: (d) => { done(d); toast.success("لوگو ذخیره شد."); }, onError: fail });
  const remove = useMutation({ mutationFn: removePrintLogo, onSuccess: done, onError: fail });
  const save = useMutation({
    mutationFn: () => savePrintWatermark(watermark.trim() || null),
    onSuccess: (d) => { done(d); toast.success("واترمارک ذخیره شد."); },
    onError: fail,
  });

  if (branding.isLoading || !branding.data) return null;
  if (!branding.data.ready) return null; // its database update hasn't run yet

  const logo = branding.data.logo_url;
  const busy = upload.isPending || remove.isPending;

  return (
    <Card className="gap-4 py-6">
      <div className="space-y-1 px-6">
        <CardTitle className="text-base">سربرگ برنامه‌ی چاپی</CardTitle>
        <CardDescription>
          لوگو و واترمارک شما روی برنامه‌ی چاپی و PDF، برای شما و ورزشکارانتان.
        </CardDescription>
      </div>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label>لوگو</Label>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-16 w-32 items-center justify-center rounded-lg border border-dashed border-border bg-muted/30">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element -- an uploaded file on the API's origin
                <img src={logo} alt="لوگو" className="max-h-14 max-w-28 object-contain" />
              ) : (
                <span className="text-xs text-muted-foreground">عکس پروفایل</span>
              )}
            </div>
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) upload.mutate(file);
                e.target.value = "";
              }}
            />
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => fileInput.current?.click()}>
              {upload.isPending ? <Loader2 className="animate-spin" /> : <ImagePlus />}
              {logo ? "تغییر لوگو" : "انتخاب لوگو"}
            </Button>
            {logo && (
              <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => remove.mutate()}>
                <Trash2 />
                حذف
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">PNG یا JPG. پس‌زمینه‌ی شفاف سفید می‌شود.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="print-watermark">متن واترمارک</Label>
          <div className="flex flex-wrap gap-2">
            <Input
              id="print-watermark"
              className="max-w-sm"
              maxLength={60}
              placeholder={`جیم‌لیک — ${trainerName}`}
              value={watermark}
              onChange={(e) => setWatermark(e.target.value)}
            />
            <Button type="button" size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
              {save.isPending && <Loader2 className="animate-spin" />}
              ذخیره
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">خالی بگذارید تا نام شما با جیم‌لیک نوشته شود.</p>
        </div>
      </CardContent>
    </Card>
  );
}
