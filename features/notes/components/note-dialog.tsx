"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getErrorMessage } from "@/lib/get-error-message";
import { MAX_NOTE_LENGTH } from "../constants";
import { useCreateNote, useUpdateNote } from "../hooks/use-note-actions";
import type { Note } from "../types/note-types";

/** Adds a note (no `note`) or edits one's text. Just a textarea. */
export function NoteDialog({
  open,
  onOpenChange,
  athleteId,
  note,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  athleteId: string | null;
  note?: Note;
}) {
  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const [content, setContent] = useState(note?.content ?? "");
  const isPending = createNote.isPending || updateNote.isPending;

  async function handleSubmit() {
    const text = content.trim();
    if (!text) {
      toast.error("متن یادداشت را بنویسید.");
      return;
    }

    try {
      if (note) {
        await updateNote.mutateAsync({ id: note.id, content: text });
      } else {
        await createNote.mutateAsync({ athleteId, content: text });
        setContent("");
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error, "ذخیره یادداشت با خطا مواجه شد."));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{note ? "ویرایش یادداشت" : "یادداشت جدید"}</DialogTitle>
        </DialogHeader>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={5}
          maxLength={MAX_NOTE_LENGTH}
          autoFocus
          placeholder="یادداشت خود را بنویسید..."
          className="w-full rounded-xl border border-input bg-transparent px-4 py-2 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30"
        />
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="animate-spin" />}
            ذخیره
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            انصراف
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
