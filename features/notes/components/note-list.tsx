"use client";

import { useState } from "react";
import { NotebookPen, Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { formatPersianDate } from "@/lib/persian";
import { useDeleteNote } from "../hooks/use-note-actions";
import { useNotes } from "../hooks/use-notes";
import type { Note } from "../types/note-types";
import { NoteDialog } from "./note-dialog";

function NoteItem({ note }: { note: Note }) {
  const deleteNote = useDeleteNote();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <div className="space-y-2 rounded-xl border border-border p-4">
      <p className="whitespace-pre-wrap break-words text-sm text-foreground">{note.content}</p>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {formatPersianDate(new Date(note.createdAt.replace(" ", "T")))}
        </p>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" aria-label="ویرایش" onClick={() => setEditOpen(true)}>
            <Pencil />
          </Button>
          <Button size="icon" variant="ghost" aria-label="حذف" onClick={() => setDeleteOpen(true)}>
            <Trash2 />
          </Button>
        </div>
      </div>

      {/* Mounted only while open so the edit form starts from the saved text. */}
      {editOpen && (
        <NoteDialog open onOpenChange={setEditOpen} athleteId={note.athleteId} note={note} />
      )}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="حذف یادداشت"
        description="این یادداشت برای همیشه حذف می‌شود."
        confirmLabel="حذف"
        errorMessage="حذف یادداشت با خطا مواجه شد."
        onConfirm={() => deleteNote.mutateAsync(note.id)}
      />
    </div>
  );
}

/**
 * The trainer's private notes: about one athlete, or — with a null `athleteId` —
 * general ones. Only the trainer ever sees these.
 */
export function NoteList({
  athleteId,
  title,
  description,
}: {
  athleteId: string | null;
  title: string;
  description: string;
}) {
  const notes = useNotes(athleteId);
  const [addOpen, setAddOpen] = useState(false);

  return (
    <Card className="gap-4 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6">
        <div>
          <h2 className="text-base font-bold text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus />
          یادداشت جدید
        </Button>
      </div>

      <div className="space-y-3 px-6">
        {notes.isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : notes.isError ? (
          <p className="text-sm text-destructive">دریافت یادداشت‌ها با خطا مواجه شد.</p>
        ) : !notes.data || notes.data.length === 0 ? (
          <EmptyState icon={NotebookPen} title="هنوز یادداشتی نوشته نشده است." />
        ) : (
          notes.data.map((note) => <NoteItem key={note.id} note={note} />)
        )}
      </div>

      {addOpen && <NoteDialog open onOpenChange={setAddOpen} athleteId={athleteId} />}
    </Card>
  );
}
