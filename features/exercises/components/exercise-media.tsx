"use client";

import { useState } from "react";
import { ExternalLink, PlayCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface ExerciseMedia {
  imageUrl: string | null;
  videoUrl: string | null;
}

/**
 * Where a video link can be shown in-page: an uploaded file plays in a
 * <video>; an Aparat or YouTube page becomes that site's embed player;
 * anything else is just a link out.
 */
export function videoEmbed(url: string): { kind: "file" | "iframe" | "link"; src: string } {
  if (/\.(mp4|webm)(\?.*)?$/i.test(url)) return { kind: "file", src: url };
  const aparat = /aparat\.com\/v\/([A-Za-z0-9]+)/i.exec(url);
  if (aparat) return { kind: "iframe", src: `https://www.aparat.com/video/video/embed/videohash/${aparat[1]}/vt/frame` };
  const youtube = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{6,})/i.exec(url);
  if (youtube) return { kind: "iframe", src: `https://www.youtube.com/embed/${youtube[1]}` };
  return { kind: "link", src: url };
}

export function hasExerciseMedia(media: Partial<ExerciseMedia> | null | undefined): boolean {
  return !!(media?.imageUrl || media?.videoUrl);
}

/** The image and video of one exercise, stacked. */
export function ExerciseMediaView({ media, name }: { media: ExerciseMedia; name: string }) {
  const video = media.videoUrl ? videoEmbed(media.videoUrl) : null;
  return (
    <div className="space-y-3">
      {video?.kind === "file" && (
        <video src={video.src} controls playsInline preload="metadata" className="w-full rounded-xl bg-black" />
      )}
      {video?.kind === "iframe" && (
        <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
          <iframe
            src={video.src}
            title={`ویدیوی ${name}`}
            className="size-full"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        </div>
      )}
      {media.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- static export: no image optimizer, and GIFs must animate
        <img src={media.imageUrl} alt={name} className="mx-auto max-h-80 rounded-xl object-contain" loading="lazy" />
      )}
      {video?.kind === "link" && (
        <Button variant="outline" asChild>
          <a href={video.src} target="_blank" rel="noopener noreferrer">
            <ExternalLink />
            دیدن ویدیوی آموزشی
          </a>
        </Button>
      )}
    </div>
  );
}

/** A small "how to do it" button next to an exercise's name; nothing when it has no media. */
export function ExerciseMediaButton({
  name,
  media,
  description,
}: {
  name: string;
  media: Partial<ExerciseMedia> | null | undefined;
  description?: string | null;
}) {
  const [open, setOpen] = useState(false);
  if (!media || !hasExerciseMedia(media)) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-0.5 rounded-md px-1 text-[11px] font-medium text-primary hover:bg-primary/10"
        aria-label={`آموزش ${name}`}
      >
        <PlayCircle className="size-3.5" />
        آموزش
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{name}</DialogTitle>
            {description && <DialogDescription className="whitespace-pre-line">{description}</DialogDescription>}
          </DialogHeader>
          {open && <ExerciseMediaView media={{ imageUrl: media.imageUrl ?? null, videoUrl: media.videoUrl ?? null }} name={name} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
