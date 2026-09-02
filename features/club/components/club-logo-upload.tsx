"use client";

import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getErrorMessage } from "@/lib/get-error-message";
import { useUploadClubLogo } from "../hooks/use-upload-club-logo";

export function ClubLogoUpload({
  clubId,
  logoUrl,
  clubName,
}: {
  clubId: string;
  logoUrl: string | null;
  clubName: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const uploadLogo = useUploadClubLogo(clubId);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    try {
      await uploadLogo.mutateAsync(file);
      toast.success("لوگوی باشگاه به‌روزرسانی شد.");
    } catch (error) {
      toast.error(getErrorMessage(error, "آپلود لوگو با خطا مواجه شد."));
      URL.revokeObjectURL(objectUrl);
      setPreviewUrl(null);
    }
  }

  const displaySrc = previewUrl ?? logoUrl ?? undefined;

  return (
    <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:text-right">
      <div className="relative shrink-0">
        <Avatar className="size-24 rounded-2xl">
          {displaySrc && (
            <AvatarImage src={displaySrc} alt={`لوگوی ${clubName}`} className="rounded-2xl" />
          )}
          <AvatarFallback className="rounded-2xl text-2xl">
            {clubName.slice(0, 2)}
          </AvatarFallback>
        </Avatar>
        {uploadLogo.isPending && (
          <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/40">
            <Loader2 className="size-6 animate-spin text-white" />
          </div>
        )}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploadLogo.isPending}
          className="absolute bottom-0 left-0 flex size-8 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-sm disabled:opacity-60"
          aria-label="تغییر لوگوی باشگاه"
        >
          <Camera className="size-4" />
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      <div className="space-y-1">
        <p className="font-medium text-foreground">{clubName}</p>
        <p className="text-xs text-muted-foreground">
          لوگوی باشگاه را در اندازه مربعی و حداکثر ۸ مگابایت انتخاب کنید.
        </p>
      </div>
    </div>
  );
}
