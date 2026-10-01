"use client";

import { useRef, useState } from "react";
import { Film, ImagePlus, Link2, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getErrorMessage } from "@/lib/get-error-message";
import { ExerciseMediaView } from "@/features/exercises/components/exercise-media";
import {
  setExerciseMediaLink,
  uploadExerciseMedia,
  type AdminLibraryEntry,
  type ExerciseMediaSlot,
} from "../services/admin-library-service";

/**
 * The how-to image (or GIF) and video of one exercise: upload a file or
 * paste a link (an Aparat or YouTube page plays in place). Trainers see it
 * in their library, athletes next to the exercise in their plan.
 */
export function ExerciseMediaDialog({ entry, onSaved }: { entry: AdminLibraryEntry; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState(entry.image_url ?? null);
  const [videoUrl, setVideoUrl] = useState(entry.video_url ?? null);
  const has = !!(imageUrl || videoUrl);

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        className={has ? "border-primary/40 text-primary" : undefined}
        aria-label={`عکس و ویدیوی ${entry.name}`}
      >
        <Film />
        {has ? "آموزش" : "افزودن آموزش"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>آموزش «{entry.name}»</DialogTitle>
            <DialogDescription>
              مربی‌ها این عکس و ویدیو را در کتابخانهٔ حرکات و ورزشکاران کنار همین حرکت در برنامه‌شان می‌بینند.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            {has && (
              <div className="rounded-xl border border-border p-3">
                <ExerciseMediaView media={{ imageUrl, videoUrl }} name={entry.name} />
              </div>
            )}
            <SlotEditor
              id={entry.id}
              slot="image"
              label="عکس یا GIF"
              hint="JPG، PNG، WebP یا GIF متحرک، حداکثر ۸ مگابایت."
              accept="image/jpeg,image/png,image/webp,image/gif"
              value={imageUrl}
              onChange={(url) => {
                setImageUrl(url);
                onSaved();
              }}
            />
            <SlotEditor
              id={entry.id}
              slot="video"
              label="ویدیو"
              hint="فایل MP4 یا WebM (حداکثر ۶۰ مگابایت، اگر سقف آپلود هاست اجازه دهد)، یا لینک صفحهٔ ویدیو در آپارات — برای فایل‌های بزرگ لینک آپارات بهتر است."
              accept="video/mp4,video/webm"
              value={videoUrl}
              onChange={(url) => {
                setVideoUrl(url);
                onSaved();
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SlotEditor({
  id,
  slot,
  label,
  hint,
  accept,
  value,
  onChange,
}: {
  id: string;
  slot: ExerciseMediaSlot;
  label: string;
  hint: string;
  accept: string;
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState<"upload" | "link" | "remove" | null>(null);
  const key = slot === "image" ? "image_url" : "video_url";

  async function run(kind: "upload" | "link" | "remove", action: () => Promise<Record<string, string | null>>) {
    setBusy(kind);
    try {
      const result = await action();
      onChange(result[key] ?? null);
      setLink("");
      toast.success(kind === "remove" ? "حذف شد." : "ذخیره شد.");
    } catch (error) {
      toast.error(getErrorMessage(error, "ذخیره ناموفق بود."));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <Label className="flex items-center gap-1.5">
          {slot === "image" ? <ImagePlus className="size-4" /> : <Film className="size-4" />}
          {label}
        </Label>
        {value && (
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive"
            disabled={!!busy}
            onClick={() => run("remove", () => setExerciseMediaLink(id, slot, null))}
          >
            {busy === "remove" ? <Loader2 className="animate-spin" /> : <Trash2 />}
            حذف
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
      <div className="flex flex-wrap gap-2">
        <input
          ref={fileRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void run("upload", () => uploadExerciseMedia(id, slot, file));
          }}
        />
        <Button size="sm" variant="outline" disabled={!!busy} onClick={() => fileRef.current?.click()}>
          {busy === "upload" ? <Loader2 className="animate-spin" /> : <Upload />}
          {value ? "جایگزینی با فایل" : "آپلود فایل"}
        </Button>
      </div>
      <div className="flex gap-2">
        <Input
          dir="ltr"
          value={link}
          placeholder={slot === "video" ? "https://www.aparat.com/v/…" : "https://…"}
          onChange={(e) => setLink(e.target.value)}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={!!busy || !link.trim()}
          onClick={() => run("link", () => setExerciseMediaLink(id, slot, link.trim()))}
        >
          {busy === "link" ? <Loader2 className="animate-spin" /> : <Link2 />}
          ثبت لینک
        </Button>
      </div>
    </div>
  );
}
