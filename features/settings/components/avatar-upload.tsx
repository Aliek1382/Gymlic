"use client";

import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getErrorMessage } from "@/lib/get-error-message";
import { useUploadAvatar } from "../hooks/use-upload-avatar";

export function AvatarUpload({
  avatarUrl,
  fallback,
}: {
  avatarUrl: string | null;
  fallback: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const uploadAvatar = useUploadAvatar();

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    try {
      await uploadAvatar.mutateAsync(file);
      toast.success("تصویر پروفایل به‌روزرسانی شد.");
    } catch (error) {
      toast.error(getErrorMessage(error, "آپلود تصویر با خطا مواجه شد."));
      URL.revokeObjectURL(objectUrl);
      setPreviewUrl(null);
    }
  }

  const displaySrc = previewUrl ?? avatarUrl ?? undefined;

  return (
    <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:text-right">
      <div className="relative shrink-0">
        <Avatar className="size-24">
          {displaySrc && <AvatarImage src={displaySrc} alt="تصویر پروفایل" />}
          <AvatarFallback className="text-2xl">{fallback}</AvatarFallback>
        </Avatar>
        {uploadAvatar.isPending && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
            <Loader2 className="size-6 animate-spin text-white" />
          </div>
        )}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploadAvatar.isPending}
          className="absolute bottom-0 left-0 flex size-8 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-sm disabled:opacity-60"
          aria-label="تغییر تصویر پروفایل"
        >
          <Camera className="size-4" />
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      <div>
        <p className="text-sm font-medium text-foreground">تصویر پروفایل</p>
        <p className="text-xs text-muted-foreground">
          فرمت JPG یا PNG، حداکثر ۸ مگابایت — پیش از ذخیره خودکار فشرده می‌شود.
        </p>
      </div>
    </div>
  );
}
