"use client";

import { useState } from "react";
import { Loader2, NotebookPen } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { getErrorMessage } from "@/lib/get-error-message";
import { useUpdateAthleteNote } from "../hooks/use-update-athlete-note";

export function AthleteProfileNote({
  athleteId,
  initialNote,
}: {
  athleteId: string;
  initialNote: string | null;
}) {
  const [note, setNote] = useState(initialNote ?? "");
  const updateNote = useUpdateAthleteNote(athleteId);

  async function handleSave() {
    try {
      await updateNote.mutateAsync(note.trim() || null);
      toast.success("یادداشت ذخیره شد.");
    } catch (error) {
      toast.error(getErrorMessage(error, "ذخیره یادداشت با خطا مواجه شد."));
    }
  }

  return (
    <Card className="gap-3 py-5">
      <div className="flex items-center gap-2 px-6">
        <NotebookPen className="size-4 text-muted-foreground" />
        <CardTitle className="text-base">یادداشت خصوصی</CardTitle>
      </div>
      <div className="space-y-2 px-6">
        <p className="text-xs text-muted-foreground">
          فقط خودتان این یادداشت را می‌بینید — ورزشکار به آن دسترسی ندارد.
        </p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="مثلاً زانوی راستش مشکل دارد، تا اردیبهشت مسافرته و..."
          className="w-full rounded-xl border border-input bg-transparent px-4 py-2 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30"
        />
        <Button
          size="sm"
          onClick={handleSave}
          disabled={updateNote.isPending || note === (initialNote ?? "")}
        >
          {updateNote.isPending && <Loader2 className="animate-spin" />}
          ذخیره یادداشت
        </Button>
      </div>
    </Card>
  );
}
