"use client";

import { useEffect, useRef, useState } from "react";
import {
  Apple,
  Dumbbell,
  ImagePlus,
  Loader2,
  MessageCircle,
  Mic,
  Paperclip,
  Send,
  Square,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getErrorMessage } from "@/lib/get-error-message";
import type { PlanKind } from "@/features/athletes/types/athlete-types";
import { uploadMessageMedia, type OutgoingMessage } from "../services/message-service";
import type { ConversationPlan } from "../types/message-types";
import { usePublicSettings } from "@/features/site-settings";

// A message doesn't have to be about anything in particular — that is the
// default, and what makes the inbox usable before a plan exists.
const NO_PLAN = "none";

// Recordings stop themselves at 5 minutes, or sooner if the admin lowered the
// voice size limit: browsers record speech at up to ~64kbps, about 120
// seconds per MB, so a recording always fits under the limit.
const MAX_RECORDING_SECONDS = 300;
const RECORDING_SECONDS_PER_MB = 120;

// Picker filters only; the server re-checks what the file really is.
const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";
const VIDEO_ACCEPT = "video/mp4,video/webm,video/quicktime";
const FILE_ACCEPT = ".pdf,.doc,.docx";

// Safari records mp4, Chrome and Firefox webm/ogg: take whichever this
// browser can produce.
const RECORDING_FORMATS = [
  { mime: "audio/webm;codecs=opus", ext: "webm" },
  { mime: "audio/mp4", ext: "m4a" },
  { mime: "audio/ogg;codecs=opus", ext: "ogg" },
] as const;

function formatClock(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const PLAN_ICON = { workout: Dumbbell, nutrition: Apple } as const;

function planKey(plan: ConversationPlan) {
  return `${plan.kind}:${plan.id}`;
}

export function MessageComposer({
  plans,
  isPending,
  onSend,
}: {
  plans: ConversationPlan[];
  isPending: boolean;
  onSend: (input: {
    message: OutgoingMessage;
    plan?: { kind: PlanKind; id: string } | null;
  }) => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [selectedKey, setSelectedKey] = useState<string>(NO_PLAN);
  const [uploading, setUploading] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const discardRef = useRef(false);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // What the admin allows (/admin/settings); the API enforces the same.
  const { limits } = usePublicSettings();
  const allowed = limits.attachments;
  const galleryAccept = [allowed.image && IMAGE_ACCEPT, allowed.video && VIDEO_ACCEPT]
    .filter(Boolean)
    .join(",");

  const maxRecordingSeconds = Math.min(
    MAX_RECORDING_SECONDS,
    limits.upload_mb.voice * RECORDING_SECONDS_PER_MB
  );

  const busy = isPending || uploading;
  const recording = recordingSeconds !== null;

  const selectedPlan = plans.find((plan) => planKey(plan) === selectedKey) ?? null;

  const plan = selectedPlan ? { kind: selectedPlan.kind, id: selectedPlan.id } : null;

  async function handleSubmit() {
    const body = draft.trim();
    if (!body || busy) return;

    try {
      await onSend({ message: { type: "text", body }, plan });
      setDraft("");
    } catch (error) {
      toast.error(getErrorMessage(error, "ارسال پیام با خطا مواجه شد."));
    }
  }

  // Two requests, not one: the file goes up first, and only a successful
  // upload becomes a message.
  async function sendAttachment(file: File, options: { voiceRecording?: boolean } = {}) {
    setUploading(true);
    try {
      const message = await uploadMessageMedia(file, options);
      await onSend({ message, plan });
    } catch (error) {
      toast.error(getErrorMessage(error, "ارسال فایل با خطا مواجه شد."));
    } finally {
      setUploading(false);
    }
  }

  function handlePicked(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // picking the same file twice must still fire
    if (!file) return;
    // Caught here rather than after a long upload the server would refuse.
    const type = file.type.startsWith("video/") ? "video" : file.type.startsWith("image/") ? "image" : "file";
    const maxMb = limits.upload_mb[type];
    if (file.size > maxMb * 1024 * 1024) {
      toast.error(`حجم این فایل بیشتر از حد مجاز (${maxMb.toLocaleString("fa-IR")} مگابایت) است.`);
      return;
    }
    void sendAttachment(file);
  }

  async function startRecording() {
    if (busy || recording) return;
    const format = RECORDING_FORMATS.find(
      (f) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(f.mime)
    );
    if (!format || !navigator.mediaDevices?.getUserMedia) {
      toast.error("مرورگر شما از ضبط صدا پشتیبانی نمی‌کند.");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast.error("دسترسی به میکروفن داده نشد.");
      return;
    }

    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(stream, { mimeType: format.mime });
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      setRecordingSeconds(null);
      recorderRef.current = null;
      if (discardRef.current || chunks.length === 0) return;
      const blob = new Blob(chunks, { type: format.mime.split(";")[0] });
      void sendAttachment(new File([blob], `voice.${format.ext}`, { type: blob.type }), {
        voiceRecording: true,
      });
    };

    discardRef.current = false;
    recorderRef.current = recorder;
    recorder.start();
    setRecordingSeconds(0);
  }

  function stopRecording(discard: boolean) {
    discardRef.current = discard;
    recorderRef.current?.stop();
  }

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => {
      setRecordingSeconds((seconds) => (seconds === null ? null : seconds + 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [recording]);

  useEffect(() => {
    if (recordingSeconds !== null && recordingSeconds >= maxRecordingSeconds) {
      stopRecording(false);
    }
  }, [recordingSeconds, maxRecordingSeconds]);

  // Leaving the thread mid-recording must release the microphone.
  useEffect(
    () => () => {
      discardRef.current = true;
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    },
    []
  );

  return (
    <div className="space-y-2 border-t border-border p-3">
      {plans.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-xs text-muted-foreground">درباره:</span>
          <Select
            value={selectedPlan ? planKey(selectedPlan) : NO_PLAN}
            onValueChange={setSelectedKey}
          >
            <SelectTrigger className="h-9 flex-1 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_PLAN}>
                <MessageCircle className="size-3.5" />
                پیام عمومی
              </SelectItem>
              {plans.map((plan) => {
                const Icon = PLAN_ICON[plan.kind];
                return (
                  <SelectItem key={planKey(plan)} value={planKey(plan)}>
                    <Icon className="size-3.5" />
                    {plan.title}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      )}

      <input
        ref={galleryInputRef}
        type="file"
        accept={galleryAccept}
        className="hidden"
        onChange={handlePicked}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept={FILE_ACCEPT}
        className="hidden"
        onChange={handlePicked}
      />

      {recording ? (
        <div className="flex items-center gap-3 rounded-xl border border-input px-3 py-2">
          <span className="size-2.5 animate-pulse rounded-full bg-destructive" />
          <span className="flex-1 text-sm tabular-nums">
            در حال ضبط… {formatClock(recordingSeconds)}
          </span>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => stopRecording(true)}
            aria-label="لغو ضبط"
          >
            <X />
          </Button>
          <Button
            type="button"
            size="icon"
            onClick={() => stopRecording(false)}
            aria-label="پایان ضبط و ارسال"
          >
            <Square />
          </Button>
        </div>
      ) : (
      <div className="flex items-end gap-2">
        {galleryAccept && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={busy}
            onClick={() => galleryInputRef.current?.click()}
            aria-label={
              allowed.image && allowed.video ? "ارسال عکس یا ویدیو" : allowed.image ? "ارسال عکس" : "ارسال ویدیو"
            }
          >
            <ImagePlus />
          </Button>
        )}
        {allowed.file && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
            aria-label="ارسال فایل"
          >
            <Paperclip />
          </Button>
        )}
        {allowed.voice && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={busy}
            onClick={startRecording}
            aria-label="ضبط پیام صوتی"
          >
            <Mic />
          </Button>
        )}
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value.slice(0, limits.message_max_chars))}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              handleSubmit();
            }
          }}
          rows={2}
          placeholder="پیامتان را بنویسید..."
          className="flex-1 resize-none rounded-xl border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30"
        />
        <Button
          type="button"
          size="icon"
          disabled={busy || !draft.trim()}
          onClick={handleSubmit}
          aria-label="ارسال پیام"
        >
          {busy ? <Loader2 className="animate-spin" /> : <Send />}
        </Button>
      </div>
      )}
    </div>
  );
}
